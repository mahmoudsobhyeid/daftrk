/**
 * ZATCA Phase 2 — Simplified OTP-Based Onboarding Service
 *
 * This service orchestrates the entire automated onboarding process:
 * 1. Validate business credentials (CR, VAT, National Address)
 * 2. Generate ECDSA private key and CSR automatically
 * 3. Exchange OTP for Compliance CSID via ZATCA API
 * 4. Run compliance checks with sample invoices
 * 5. Obtain Production CSID
 * 6. Store credentials securely in database
 *
 * The user only needs to provide:
 * - Commercial Registration Number
 * - VAT Registration Number
 * - National Address Details
 * - ZATCA OTP (from official portal)
 */

import { supabase } from '../supabase';
import { generateCsr, extractPublicKey, signData } from './crypto';
import { ZatcaApiClient } from './api-client';
import { generateUblXml, generateCanonicalXml } from './xml';
import { hashInvoiceXml } from './hash';
import { buildQrInput, encodeTlvQr } from './tlv';
import type { Company } from '../types';

export interface OnboardingInput {
  companyId: string;
  vatNumber: string;
  crNumber: string;
  otp: string;
  environment: 'sandbox' | 'production';
  // National Address (from company record)
  organizationName: string;
  organizationNameAr: string;
  country: string;
  city: string;
  district?: string;
  street: string;
  buildingNumber: string;
  additionalNumber?: string;
  postalCode: string;
}

export interface OnboardingResult {
  success: boolean;
  status: string;
  message: string;
  complianceCsid?: string;
  productionCsid?: string;
  certificate?: string;
  certificateExpiry?: string;
  error?: string;
}

/**
 * Main onboarding function - runs the complete automated flow
 */
export async function completeZatcaOnboarding(input: OnboardingInput): Promise<OnboardingResult> {
  try {
    // Step 1: Validate input
    const validation = validateOnboardingInput(input);
    if (!validation.valid) {
      return {
        success: false,
        status: 'failed',
        message: validation.message,
        error: validation.message,
      };
    }

    // Step 2: Update status to 'otp_submitted'
    await updateOnboardingStatus(input.companyId, 'otp_submitted');

    // Step 3: Generate CSR and private key automatically
    const { csrPem, privateKey, publicKey } = await generateCsr({
      organizationName: input.organizationName,
      organizationNameAr: input.organizationNameAr,
      vatNumber: input.vatNumber,
      crNumber: input.crNumber,
      commonName: input.crNumber,
      country: input.country,
      location: input.city,
      postalCode: input.postalCode,
      street: input.street,
      buildingNumber: input.buildingNumber,
      additionalNumber: input.additionalNumber,
      district: input.district,
    });

    // Step 4: Exchange OTP for Compliance CSID
    const apiClient = new ZatcaApiClient({
      environment: input.environment,
      vatNumber: input.vatNumber,
      crNumber: input.crNumber,
    });

    const complianceResponse = await apiClient.exchangeOtpForComplianceCsid({
      vatNumber: input.vatNumber,
      commercialRegistrationNumber: input.crNumber,
      otp: input.otp,
      csr: csrPem,
      deviceName: 'Daftrk-EGS-Automated',
    });

    // Step 5: Store Compliance CSID
    await updateOnboardingStatus(input.companyId, 'compliance_csid_obtained');
    await storeCsidCredentials(input.companyId, {
      complianceCsid: complianceResponse.binarySecurityToken,
      secret: complianceResponse.secret,
      privateKey,
      publicKey,
    });

    // Step 6: Run compliance checks automatically
    await updateOnboardingStatus(input.companyId, 'compliance_checks_running');

    const complianceCheckResult = await runAutomatedComplianceChecks(
      input.companyId,
      input.vatNumber,
      input.crNumber,
      complianceResponse.binarySecurityToken,
      complianceResponse.secret,
      input.environment
    );

    if (!complianceCheckResult.success) {
      await updateOnboardingStatus(input.companyId, 'failed');
      await storeLastError(input.companyId, complianceCheckResult.error || 'Compliance checks failed');
      return {
        success: false,
        status: 'failed',
        message: complianceCheckResult.error || 'Compliance checks failed',
        error: complianceCheckResult.error,
      };
    }

    // Step 7: Update status to compliance checks passed
    await updateOnboardingStatus(input.companyId, 'compliance_checks_passed');

    // Step 8: Obtain Production CSID
    const productionResponse = await apiClient.obtainProductionCsid({
      vatNumber: input.vatNumber,
      commercialRegistrationNumber: input.crNumber,
      complianceCsid: complianceResponse.binarySecurityToken,
      complianceSecret: complianceResponse.secret,
      csr: csrPem,
    });

    // Step 9: Store Production CSID and certificate
    await updateOnboardingStatus(input.companyId, 'production_csid_obtained');
    await storeProductionCredentials(input.companyId, {
      productionCsid: productionResponse.binarySecurityToken,
      secret: productionResponse.secret,
      certificate: productionResponse.binarySecurityToken, // In production, this would be the actual certificate
      certificateExpiry: productionResponse.expiresOn,
    });

    // Step 10: Final status - connected
    await updateOnboardingStatus(input.companyId, 'connected');
    await clearOtp(input.companyId);

    return {
      success: true,
      status: 'connected',
      message: 'ZATCA onboarding completed successfully. Your business is now connected to ZATCA.',
      complianceCsid: complianceResponse.binarySecurityToken,
      productionCsid: productionResponse.binarySecurityToken,
      certificate: productionResponse.binarySecurityToken,
      certificateExpiry: productionResponse.expiresOn,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during onboarding';
    await updateOnboardingStatus(input.companyId, 'failed');
    await storeLastError(input.companyId, errorMessage);
    return {
      success: false,
      status: 'failed',
      message: errorMessage,
      error: errorMessage,
    };
  }
}

/**
 * Validates onboarding input
 */
function validateOnboardingInput(input: OnboardingInput): { valid: boolean; message?: string } {
  if (!input.vatNumber || !/^\d{15}$/.test(input.vatNumber.replace(/\D/g, ''))) {
    return { valid: false, message: 'VAT number must be 15 digits' };
  }

  if (!input.crNumber || !/^\d{10}$/.test(input.crNumber)) {
    return { valid: false, message: 'CR number must be 10 digits' };
  }

  if (!input.otp || input.otp.length < 6) {
    return { valid: false, message: 'OTP must be at least 6 digits' };
  }

  if (!input.organizationName || !input.organizationNameAr) {
    return { valid: false, message: 'Organization name (English and Arabic) is required' };
  }

  if (!input.street || !input.buildingNumber || !input.postalCode || !input.city) {
    return { valid: false, message: 'Complete national address is required' };
  }

  return { valid: true };
}

/**
 * Runs automated compliance checks with sample invoices
 */
async function runAutomatedComplianceChecks(
  companyId: string,
  vatNumber: string,
  crNumber: string,
  complianceCsid: string,
  secret: string,
  environment: 'sandbox' | 'production'
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch company details for sample invoice
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    // Generate sample Standard B2B invoice
    const standardInvoiceData = buildSampleInvoiceData(company, 'standard');
    const standardXml = generateUblXml(standardInvoiceData);
    const standardCanonical = generateCanonicalXml(standardInvoiceData);
    const { hashBase64: standardHash } = await hashInvoiceXml(standardCanonical);

    // Generate sample Simplified B2C invoice
    const simplifiedInvoiceData = buildSampleInvoiceData(company, 'simplified');
    const simplifiedXml = generateUblXml(simplifiedInvoiceData);
    const simplifiedCanonical = generateCanonicalXml(simplifiedInvoiceData);
    const { hashBase64: simplifiedHash } = await hashInvoiceXml(simplifiedCanonical);

    // Submit compliance checks
    const apiClient = new ZatcaApiClient({
      environment,
      vatNumber,
      crNumber,
      complianceCsid,
      secret,
    });

    const result = await apiClient.runComplianceChecks({
      standardInvoiceXML: standardXml,
      simplifiedInvoiceXML: simplifiedXml,
    });

    if (result.status === 'PASS') {
      return { success: true };
    } else {
      const errors = [
        ...result.standardInvoiceResult.validationResults,
        ...result.simplifiedInvoiceResult.validationResults,
      ]
        .filter((m) => m.status === 'ERROR')
        .map((m) => m.message)
        .join('; ');

      return { success: false, error: errors || 'Compliance checks failed' };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Compliance check error',
    };
  }
}

/**
 * Builds sample invoice data for compliance checks
 */
function buildSampleInvoiceData(company: Company, invoiceType: 'standard' | 'simplified') {
  const now = new Date();
  const issueDate = now.toISOString().split('T')[0];
  const issueTime = now.toTimeString().split(' ')[0];

  return {
    uuid: crypto.randomUUID(),
    icv: 1,
    invoiceNumber: 'COMPLIANCE-TEST-001',
    invoiceType,
    typeCode: '388',
    subtype: invoiceType === 'standard' ? '0100000' : '0200000',
    issueDate,
    issueTime,
    currencyCode: 'SAR',
    exchangeRate: 1,
    paymentMeansCode: '10',
    seller: {
      nameAr: company.name_ar || company.name,
      nameEn: company.name,
      vatNumber: company.tax_number || '',
      crNumber: company.commercial_registration,
      address: {
        street: company.address || '',
        buildingNumber: company.building_number || '0000',
        additionalNumber: company.additional_number,
        postalZone: company.postal_code || '00000',
        district: company.district,
        cityName: company.city || 'Riyadh',
        countryCode: 'SA',
      },
    },
    buyer: {
      name: invoiceType === 'standard' ? 'Test B2B Customer' : 'Test B2C Customer',
      vatNumber: invoiceType === 'standard' ? '399999999999993' : undefined,
      address: {
        street: 'Test Street',
        buildingNumber: '1234',
        postalZone: '12345',
        cityName: 'Riyadh',
        countryCode: 'SA',
      },
    },
    items: [
      {
        id: '1',
        description: 'Sample Product for Compliance',
        unit: 'PCE',
        quantity: 1,
        unitPrice: 100,
        discountPercent: 0,
        discountAmount: 0,
        taxCategory: 'S',
        taxRate: 15,
        grossAmount: 100,
        netAmount: 100,
        vatAmount: 15,
        lineTotal: 115,
      },
    ],
    lineExtensionAmount: 100,
    taxExclusiveAmount: 100,
    taxInclusiveAmount: 115,
    allowanceTotal: 0,
    taxTotal: 15,
    taxTotals: [
      {
        taxCategory: 'S',
        taxRate: 15,
        taxableAmount: 100,
        taxAmount: 15,
      },
    ],
    roundingAmount: 0,
  };
}

/**
 * Updates onboarding status in database
 */
async function updateOnboardingStatus(companyId: string, status: string): Promise<void> {
  await supabase
    .from('zatca_company_config')
    .update({
      onboarding_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId);
}

/**
 * Stores CSID credentials
 */
async function storeCsidCredentials(
  companyId: string,
  credentials: {
    complianceCsid: string;
    secret: string;
    privateKey: string;
    publicKey: string;
  }
): Promise<void> {
  await supabase
    .from('zatca_company_config')
    .update({
      compliance_csid: credentials.complianceCsid,
      secret: credentials.secret,
      private_key: credentials.privateKey,
      public_key_pem: credentials.publicKey,
      certificate_status: 'compliance_certificate',
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId);
}

/**
 * Stores Production CSID credentials
 */
async function storeProductionCredentials(
  companyId: string,
  credentials: {
    productionCsid: string;
    secret: string;
    certificate: string;
    certificateExpiry: string;
  }
): Promise<void> {
  await supabase
    .from('zatca_company_config')
    .update({
      production_csid: credentials.productionCsid,
      secret: credentials.secret,
      certificate_pem: credentials.certificate,
      certificate_expiry: credentials.certificateExpiry,
      certificate_status: 'production_certificate',
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId);
}

/**
 * Stores last error for troubleshooting
 */
async function storeLastError(companyId: string, error: string): Promise<void> {
  await supabase
    .from('zatca_company_config')
    .update({
      last_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId);
}

/**
 * Clears OTP after successful onboarding (security)
 */
async function clearOtp(companyId: string): Promise<void> {
  await supabase
    .from('zatca_company_config')
    .update({
      zatca_otp: null,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId);
}
