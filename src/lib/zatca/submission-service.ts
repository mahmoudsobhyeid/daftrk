/**
 * ZATCA Phase 2 — Real-Time Invoice Submission & Clearance Service
 *
 * This service handles automatic submission of invoices to ZATCA:
 * - Standard B2B invoices → Clearance API (real-time approval)
 * - Simplified B2C invoices → Reporting API (within required timeframe)
 *
 * Integration point: called automatically after invoice issuance
 */

import { supabase } from '../supabase';
import { ZatcaApiClient, mapZatcaClearanceStatus, mapZatcaSubmissionStatus } from './api-client';
import { signData } from './crypto';
import type { ZatcaClearanceStatus, ZatcaSubmissionStatus } from './types';

export interface SubmissionInput {
  invoiceId: string;
  companyId: string;
  invoiceType: 'standard' | 'simplified';
  invoiceXml: string;
  invoiceHash: string;
}

export interface SubmissionResult {
  success: boolean;
  clearanceStatus: ZatcaClearanceStatus;
  submissionStatus: ZatcaSubmissionStatus;
  clearanceUuid?: string;
  responseCode?: number;
  warnings?: string[];
  errors?: string[];
  error?: string;
}

/**
 * Submits an invoice to ZATCA for clearance or reporting
 * This is called automatically after invoice issuance
 */
export async function submitInvoiceToZatca(input: SubmissionInput): Promise<SubmissionResult> {
  try {
    // Step 1: Fetch ZATCA configuration
    const { data: config, error: configError } = await supabase
      .from('zatca_company_config')
      .select('*')
      .eq('company_id', input.companyId)
      .single();

    if (configError || !config) {
      throw new Error('ZATCA configuration not found. Please complete onboarding first.');
    }

    // Step 2: Check if onboarding is complete
    if (config.onboarding_status !== 'connected' || !config.production_csid) {
      throw new Error('ZATCA onboarding not complete. Please complete OTP-based onboarding first.');
    }

    // Step 3: Check certificate expiry
    if (config.certificate_expiry && new Date(config.certificate_expiry) < new Date()) {
      throw new Error('ZATCA certificate has expired. Please renew your certificate.');
    }

    // Step 4: Update invoice status to 'submitted'
    await updateInvoiceSubmissionStatus(input.invoiceId, 'submitted', 'submitted');

    // Step 5: Initialize API client
    const apiClient = new ZatcaApiClient({
      environment: config.zatca_environment as 'sandbox' | 'production',
      vatNumber: config.vat_number || '',
      crNumber: config.cr_number || '',
      productionCsid: config.production_csid,
      secret: config.secret || undefined,
      privateKey: config.private_key || undefined,
      certificate: config.certificate_pem || undefined,
    });

    // Step 6: Sign the invoice with ECDSA
    const signatureResult = await signData(input.invoiceHash, config.private_key || '');
    const publicKey = await extractPublicKeyFromConfig(config);

    // Step 7: Submit to appropriate endpoint
    let response;
    if (input.invoiceType === 'standard') {
      // B2B Standard → Clearance API
      response = await apiClient.submitInvoiceForClearance({
        invoiceXML: input.invoiceXml,
        invoiceHash: input.invoiceHash,
        digitalSignature: signatureResult.signature,
        publicKey: publicKey,
        certificate: config.certificate_pem || '',
      });
    } else {
      // B2C Simplified → Reporting API
      response = await apiClient.submitInvoiceForReporting({
        invoiceXML: input.invoiceXml,
        invoiceHash: input.invoiceHash,
        digitalSignature: signatureResult.signature,
        publicKey: publicKey,
        certificate: config.certificate_pem || '',
      });
    }

    // Step 8: Map ZATCA response to internal status
    const clearanceStatus = mapZatcaClearanceStatus(
      response.clearanceStatus || response.reportingStatus || 'NOT_YET_CLEARED'
    );
    const submissionStatus = mapZatcaSubmissionStatus(response.validationResults?.status || 'PASS');

    // Step 9: Extract warnings and errors
    const warnings = response.validationResults?.warningMessages?.map((m) => m.message) || [];
    const errors = response.validationResults?.errorMessages?.map((m) => m.message) || [];

    // Step 10: Update invoice with ZATCA response
    await updateInvoiceWithZatcaResponse(input.invoiceId, {
      clearanceStatus,
      submissionStatus,
      clearanceUuid: response.requestID,
      responseCode: 200,
      warnings,
      errors,
      responseBody: response,
    });

    // Step 11: Update config last sync timestamp
    await updateConfigLastSync(input.companyId);

    return {
      success: true,
      clearanceStatus,
      submissionStatus,
      clearanceUuid: response.requestID,
      responseCode: 200,
      warnings,
      errors,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during submission';

    // Update invoice with error status
    await updateInvoiceWithZatcaResponse(input.invoiceId, {
      clearanceStatus: 'rejected',
      submissionStatus: 'failed',
      responseCode: 500,
      errors: [errorMessage],
      responseBody: { error: errorMessage },
    });

    return {
      success: false,
      clearanceStatus: 'rejected',
      submissionStatus: 'failed',
      errors: [errorMessage],
      error: errorMessage,
    };
  }
}

/**
 * Submits a batch of invoices to ZATCA
 * Useful for bulk operations or retrying failed submissions
 */
export async function submitInvoiceBatchToZatca(invoiceIds: string[]): Promise<{
  success: number;
  failed: number;
  results: SubmissionResult[];
}> {
  const results: SubmissionResult[] = [];
  let success = 0;
  let failed = 0;

  for (const invoiceId of invoiceIds) {
    // Fetch invoice details
    const { data: invoice, error } = await supabase
      .from('invoices')
      .select('*, company_id, invoice_type, zatca_xml, zatca_hash')
      .eq('id', invoiceId)
      .single();

    if (error || !invoice) {
      results.push({
        success: false,
        clearanceStatus: 'rejected',
        submissionStatus: 'failed',
        errors: ['Invoice not found'],
        error: 'Invoice not found',
      });
      failed++;
      continue;
    }

    // Submit to ZATCA
    const result = await submitInvoiceToZatca({
      invoiceId: invoice.id,
      companyId: invoice.company_id,
      invoiceType: invoice.invoice_type as 'standard' | 'simplified',
      invoiceXml: invoice.zatca_xml || '',
      invoiceHash: invoice.zatca_hash || '',
    });

    results.push(result);
    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { success, failed, results };
}

/**
 * Retries failed invoice submissions
 * Implements exponential backoff
 */
export async function retryFailedSubmissions(companyId: string, maxRetries = 3): Promise<{
  retried: number;
  success: number;
  failed: number;
}> {
  // Fetch failed invoices
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, zatca_retry_count')
    .eq('company_id', companyId)
    .in('zatca_submission_status', ['failed', 'rejected'])
    .lte('zatca_retry_count', maxRetries);

  if (error || !invoices || invoices.length === 0) {
    return { retried: 0, success: 0, failed: 0 };
  }

  let success = 0;
  let failed = 0;

  for (const invoice of invoices) {
    // Increment retry count
    await supabase
      .from('invoices')
      .update({ zatca_retry_count: (invoice.zatca_retry_count || 0) + 1 })
      .eq('id', invoice.id);

    // Submit again
    const { data: fullInvoice } = await supabase
      .from('invoices')
      .select('*, company_id, invoice_type, zatca_xml, zatca_hash')
      .eq('id', invoice.id)
      .single();

    if (!fullInvoice) continue;

    const result = await submitInvoiceToZatca({
      invoiceId: fullInvoice.id,
      companyId: fullInvoice.company_id,
      invoiceType: fullInvoice.invoice_type as 'standard' | 'simplified',
      invoiceXml: fullInvoice.zatca_xml || '',
      invoiceHash: fullInvoice.zatca_hash || '',
    });

    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { retried: invoices.length, success, failed };
}

/**
 * Checks certificate expiry and sends alerts
 */
export async function checkCertificateExpiry(companyId: string): Promise<{
  isExpiring: boolean;
  isExpired: boolean;
  daysUntilExpiry: number;
}> {
  const { data: config } = await supabase
    .from('zatca_company_config')
    .select('certificate_expiry')
    .eq('company_id', companyId)
    .single();

  if (!config || !config.certificate_expiry) {
    return { isExpiring: false, isExpired: false, daysUntilExpiry: -1 };
  }

  const expiryDate = new Date(config.certificate_expiry);
  const now = new Date();
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const isExpired = daysUntilExpiry <= 0;
  const isExpiring = daysUntilExpiry <= 30 && daysUntilExpiry > 0;

  // Update certificate status if expired
  if (isExpired) {
    await supabase
      .from('zatca_company_config')
      .update({ certificate_status: 'certificate_expired' })
      .eq('company_id', companyId);
  }

  return { isExpiring, isExpired, daysUntilExpiry };
}

/**
 * Helper: Update invoice submission status
 */
async function updateInvoiceSubmissionStatus(
  invoiceId: string,
  clearanceStatus: ZatcaClearanceStatus,
  submissionStatus: ZatcaSubmissionStatus
): Promise<void> {
  await supabase
    .from('invoices')
    .update({
      zatca_clearance_status: clearanceStatus,
      zatca_submission_status: submissionStatus,
      zatca_submission_time: new Date().toISOString(),
    })
    .eq('id', invoiceId);
}

/**
 * Helper: Update invoice with ZATCA response
 */
async function updateInvoiceWithZatcaResponse(
  invoiceId: string,
  data: {
    clearanceStatus: ZatcaClearanceStatus;
    submissionStatus: ZatcaSubmissionStatus;
    clearanceUuid?: string;
    responseCode?: number;
    warnings?: string[];
    errors?: string[];
    responseBody?: any;
  }
): Promise<void> {
  await supabase
    .from('invoices')
    .update({
      zatca_clearance_status: data.clearanceStatus,
      zatca_submission_status: data.submissionStatus,
      zatca_clearance_uuid: data.clearanceUuid,
      zatca_response_code: data.responseCode,
      zatca_warnings: data.warnings || [],
      zatca_errors: data.errors || [],
      zatca_response_body: data.responseBody,
      zatca_submission_time: new Date().toISOString(),
    })
    .eq('id', invoiceId);
}

/**
 * Helper: Extract public key from config
 */
async function extractPublicKeyFromConfig(config: any): Promise<string> {
  if (config.public_key_pem) {
    return config.public_key_pem;
  }

  if (config.private_key) {
    const { extractPublicKey } = await import('./crypto');
    return await extractPublicKey(config.private_key);
  }

  throw new Error('No public key available');
}

/**
 * Helper: Update config last sync timestamp
 */
async function updateConfigLastSync(companyId: string): Promise<void> {
  await supabase
    .from('zatca_company_config')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('company_id', companyId);
}
