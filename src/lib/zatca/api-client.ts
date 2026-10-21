/**
 * ZATCA Phase 2 — API Client
 *
 * Handles all communication with ZATCA's e-invoicing APIs:
 * - Compliance API (OTP exchange for CSID)
 * - Production CSID API
 * - Invoice Clearance API (B2B Standard)
 * - Invoice Reporting API (B2C Simplified)
 *
 * Environment-specific endpoints:
 * - Sandbox: https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation
 * - Production: https://gw-fatoora.zatca.gov.sa/e-invoicing/core
 */

import type { ZatcaClearanceStatus, ZatcaSubmissionStatus } from './types';

export interface ZatcaApiConfig {
  environment: 'sandbox' | 'production';
  vatNumber: string;
  crNumber: string;
  complianceCsid?: string;
  productionCsid?: string;
  secret?: string;
  privateKey?: string;
  certificate?: string;
}

export interface ZatcaComplianceRequest {
  vatNumber: string;
  commercialRegistrationNumber: string;
  otp: string;
  csr: string;
  deviceName?: string;
}

export interface ZatcaComplianceResponse {
  requestID: string;
  binarySecurityToken: string; // Compliance CSID
  secret: string;
  serverTime: string;
  expiresOn: string;
}

export interface ZatcaProductionCsidRequest {
  vatNumber: string;
  commercialRegistrationNumber: string;
  complianceCsid: string;
  complianceSecret: string;
  csr: string;
}

export interface ZatcaProductionCsidResponse {
  requestID: string;
  binarySecurityToken: string; // Production CSID
  secret: string;
  serverTime: string;
  expiresOn: string;
}

export interface ZatcaClearanceRequest {
  invoiceXML: string;
  invoiceHash: string;
  digitalSignature: string;
  publicKey: string;
  certificate: string;
}

export interface ZatcaClearanceResponse {
  requestID: string;
  clearanceStatus: 'CLEARED' | 'NOT_CLEARED' | 'NOT_YET_CLEARED';
  reportingStatus?: 'REPORTED' | 'NOT_REPORTED' | 'NOT_YET_REPORTED';
  invoiceHash: string;
  qrCode?: string;
  validationResults: {
    infoMessages: ZatcaApiMessage[];
    warningMessages: ZatcaApiMessage[];
    errorMessages: ZatcaApiMessage[];
  };
  clearedInvoice?: string;
}

export interface ZatcaApiMessage {
  type: string;
  code: string;
  category: string;
  message: string;
  status: string;
}

export interface ZatcaComplianceCheckRequest {
  standardInvoiceXML: string;
  simplifiedInvoiceXML: string;
}

export interface ZatcaComplianceCheckResponse {
  requestID: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  standardInvoiceResult: {
    status: string;
    validationResults: ZatcaApiMessage[];
  };
  simplifiedInvoiceResult: {
    status: string;
    validationResults: ZatcaApiMessage[];
  };
}

/**
 * ZATCA API Client class
 */
export class ZatcaApiClient {
  private config: ZatcaApiConfig;
  private baseUrl: string;

  constructor(config: ZatcaApiConfig) {
    this.config = config;
    this.baseUrl =
      config.environment === 'production'
        ? 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core'
        : 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation';
  }

  /**
   * Step 1: Exchange OTP for Compliance CSID
   * This is the first step in the onboarding process
   */
  async exchangeOtpForComplianceCsid(params: ZatcaComplianceRequest): Promise<ZatcaComplianceResponse> {
    const endpoint = `${this.baseUrl}/compliance`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${this.encodeCredentials()}`,
      },
      body: JSON.stringify({
        vatNumber: params.vatNumber,
        commercialRegistrationNumber: params.commercialRegistrationNumber,
        otp: params.otp,
        csr: params.csr,
        deviceName: params.deviceName || 'Daftrk-EGS',
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ZatcaApiError(
        `OTP exchange failed: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return await response.json();
  }

  /**
   * Step 2: Run compliance checks with sample invoices
   * ZATCA requires submitting sample standard and simplified invoices
   */
  async runComplianceChecks(params: ZatcaComplianceCheckRequest): Promise<ZatcaComplianceCheckResponse> {
    const endpoint = `${this.baseUrl}/compliance/invoices`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.config.complianceCsid}`,
        'X-Custom-Secret': this.config.secret || '',
      },
      body: JSON.stringify({
        standardInvoice: params.standardInvoiceXML,
        simplifiedInvoice: params.simplifiedInvoiceXML,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ZatcaApiError(
        `Compliance checks failed: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return await response.json();
  }

  /**
   * Step 3: Obtain Production CSID after compliance checks pass
   */
  async obtainProductionCsid(params: ZatcaProductionCsidRequest): Promise<ZatcaProductionCsidResponse> {
    const endpoint = `${this.baseUrl}/production/csids`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${params.complianceCsid}`,
        'X-Custom-Secret': params.complianceSecret,
      },
      body: JSON.stringify({
        vatNumber: params.vatNumber,
        commercialRegistrationNumber: params.commercialRegistrationNumber,
        csr: params.csr,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ZatcaApiError(
        `Production CSID retrieval failed: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return await response.json();
  }

  /**
   * Submit a Standard B2B invoice for real-time clearance
   */
  async submitInvoiceForClearance(params: ZatcaClearanceRequest): Promise<ZatcaClearanceResponse> {
    const endpoint = `${this.baseUrl}/invoices/clearance`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.config.productionCsid}`,
        'X-Custom-Secret': this.config.secret || '',
        'X-ZATCA-Certificate': this.config.certificate || '',
      },
      body: JSON.stringify({
        invoiceXML: params.invoiceXML,
        invoiceHash: params.invoiceHash,
        digitalSignature: params.digitalSignature,
        publicKey: params.publicKey,
        certificate: params.certificate,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ZatcaApiError(
        `Invoice clearance failed: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return await response.json();
  }

  /**
   * Submit a Simplified B2C invoice for reporting
   * (Note: Simplified invoices are reported, not cleared)
   */
  async submitInvoiceForReporting(params: ZatcaClearanceRequest): Promise<ZatcaClearanceResponse> {
    const endpoint = `${this.baseUrl}/invoices/reporting`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.config.productionCsid}`,
        'X-Custom-Secret': this.config.secret || '',
        'X-ZATCA-Certificate': this.config.certificate || '',
      },
      body: JSON.stringify({
        invoiceXML: params.invoiceXML,
        invoiceHash: params.invoiceHash,
        digitalSignature: params.digitalSignature,
        publicKey: params.publicKey,
        certificate: params.certificate,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new ZatcaApiError(
        `Invoice reporting failed: ${error.message || response.statusText}`,
        response.status,
        error
      );
    }

    return await response.json();
  }

  /**
   * Test connection to ZATCA API
   */
  async testConnection(): Promise<{ success: boolean; message: string; serverTime?: string }> {
    try {
      const endpoint = `${this.baseUrl}/health`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          message: 'Connection successful',
          serverTime: data.serverTime,
        };
      } else {
        return {
          success: false,
          message: `Connection failed: ${response.statusText}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Encode basic auth credentials
   */
  private encodeCredentials(): string {
    const credentials = `${this.config.vatNumber}:${this.config.crNumber}`;
    return btoa(credentials);
  }
}

/**
 * Custom error class for ZATCA API errors
 */
export class ZatcaApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details: any
  ) {
    super(message);
    this.name = 'ZatcaApiError';
  }
}

/**
 * Helper function to map ZATCA API status to internal status
 */
export function mapZatcaClearanceStatus(
  zatcaStatus: string
): ZatcaClearanceStatus {
  switch (zatcaStatus) {
    case 'CLEARED':
      return 'cleared';
    case 'REPORTED':
      return 'reported';
    case 'NOT_CLEARED':
    case 'NOT_REPORTED':
      return 'rejected';
    case 'NOT_YET_CLEARED':
    case 'NOT_YET_REPORTED':
      return 'submitted';
    default:
      return 'submitted';
  }
}

/**
 * Helper function to map ZATCA API submission status
 */
export function mapZatcaSubmissionStatus(
  apiStatus: string
): ZatcaSubmissionStatus {
  switch (apiStatus) {
    case 'PASS':
      return 'accepted';
    case 'FAIL':
      return 'rejected';
    case 'WARNING':
      return 'accepted';
    default:
      return 'pending';
  }
}
