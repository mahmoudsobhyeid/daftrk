/**
 * ZATCA Phase 2 (Fatoora) E-Invoicing Types
 * All types required for full ZATCA Phase 2 compliance.
 * Architecture designed so connecting to the live ZATCA API requires only
 * supplying credentials — no structural changes needed.
 */

// ─── Invoice Types ────────────────────────────────────────────────────────────

export type ZatcaInvoiceType = 'standard' | 'simplified';

/**
 * ZATCA invoice type codes (UN/CEFACT):
 * 388 = Tax Invoice (B2B Standard)
 * 381 = Credit Note
 * 383 = Debit Note
 * 386 = Prepayment Invoice
 * 389 = Self-billed Invoice
 */
export type ZatcaTypeCode = '388' | '381' | '383' | '386' | '389';

/**
 * ZATCA Invoice Subtype — 7-digit binary string
 * Position 1: Third-party invoice (0/1)
 * Position 2: Nominal invoice (0/1)
 * Position 3: Exports invoice (0/1)
 * Position 4: Summary invoice (0/1)
 * Position 5-7: Reserved (000)
 * Default B2B standard: 0100000
 * Simplified B2C: 0200000 (but encoding uses 02 prefix)
 */
export type ZatcaSubtype = string;

/**
 * ZATCA tax category codes:
 * S = Standard rate (15% VAT)
 * Z = Zero-rated
 * E = Exempt
 * O = Out of scope
 */
export type ZatcaTaxCategory = 'S' | 'Z' | 'E' | 'O';

/**
 * Payment means codes (UN/CEFACT):
 * 10 = Cash
 * 30 = Credit transfer
 * 42 = Payment to bank account
 * 48 = Bank card
 * 1 = Instrument not defined
 */
export type ZatcaPaymentMeans = '1' | '10' | '30' | '42' | '48';

/**
 * ZATCA clearance/reporting lifecycle status
 */
export type ZatcaClearanceStatus =
  | 'draft'
  | 'ready'
  | 'submitted'
  | 'cleared'
  | 'reported'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export type ZatcaSubmissionStatus =
  | 'not_submitted'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'failed';

// ─── ZATCA Seller Address (National Address) ──────────────────────────────────

export interface ZatcaAddress {
  street: string;
  additionalStreet?: string;
  buildingNumber: string;
  additionalNumber?: string;
  postalZone: string;
  district?: string;
  cityName: string;
  countryCode: string; // ISO 3166-1 alpha-2 (SA)
}

// ─── ZATCA Seller / Company Info ─────────────────────────────────────────────

export interface ZatcaSeller {
  nameAr: string;
  nameEn?: string;
  vatNumber: string; // 15-digit, starts with 3, ends with 3
  crNumber?: string;
  address: ZatcaAddress;
  phone?: string;
  email?: string;
  website?: string;
}

// ─── ZATCA Buyer / Customer Info ─────────────────────────────────────────────

export interface ZatcaBuyer {
  name: string;
  nameAr?: string;
  vatNumber?: string; // Required for B2B (Standard Invoice)
  crNumber?: string;
  address?: Partial<ZatcaAddress>;
  phone?: string;
  email?: string;
}

// ─── ZATCA Invoice Line Item ──────────────────────────────────────────────────

export interface ZatcaLineItem {
  id: string;
  itemId?: string; // Product/SKU reference
  description: string;
  sku?: string;
  unit: string; // UN/ECE Unit of Measure (PCE, KGM, HUR, DAY, MTR...)
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxCategory: ZatcaTaxCategory;
  taxExemptionReasonCode?: string;
  taxExemptionReason?: string;
  taxRate: number; // percentage (e.g. 15)
  grossAmount: number; // qty × price (before discount)
  netAmount: number; // grossAmount - discountAmount
  vatAmount: number; // netAmount × (taxRate / 100)
  lineTotal: number; // netAmount + vatAmount
}

// ─── ZATCA Tax Totals ─────────────────────────────────────────────────────────

export interface ZatcaTaxTotal {
  taxCategory: ZatcaTaxCategory;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  exemptionReasonCode?: string;
  exemptionReason?: string;
}

// ─── Core ZATCA Invoice Data (used by XML generator, hash engine, QR encoder) ─

export interface ZatcaInvoiceData {
  // Identity
  uuid: string;
  icv: number;
  invoiceNumber: string;
  invoiceType: ZatcaInvoiceType;
  typeCode: ZatcaTypeCode;
  subtype: ZatcaSubtype;

  // Dates
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:MM:SS
  deliveryDate?: string;

  // References
  referenceNumber?: string;
  purchaseOrder?: string;
  salesperson?: string;

  // Currency
  currencyCode: string; // ISO 4217
  exchangeRate: number;

  // Payment
  paymentMeansCode: ZatcaPaymentMeans;
  paymentAccountId?: string;
  paymentNote?: string;

  // Parties
  seller: ZatcaSeller;
  buyer: ZatcaBuyer;

  // Lines
  items: ZatcaLineItem[];

  // Totals
  lineExtensionAmount: number; // sum of all netAmounts
  taxExclusiveAmount: number; // subtotal before tax
  taxInclusiveAmount: number; // grand total including tax
  allowanceTotal: number; // total discounts
  taxTotal: number; // total VAT
  taxTotals: ZatcaTaxTotal[]; // breakdown per tax category
  roundingAmount: number; // rounding adjustment (usually 0)

  // Notes
  notes?: string;
  terms?: string;

  // Cryptographic (populated after hashing/signing)
  prevInvoiceHash?: string;
  invoiceHash?: string;
  signature?: string;
  qrData?: string; // Base64 TLV
  certificateContent?: string;
}

// ─── ZATCA Hash Result ────────────────────────────────────────────────────────

export interface ZatcaHashResult {
  xmlCanonical: string;
  hashBase64: string;
  hashHex: string;
}

// ─── ZATCA QR TLV Structure ───────────────────────────────────────────────────

export interface ZatcaQrInput {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO 8601: YYYY-MM-DDTHH:MM:SS+03:00
  invoiceTotal: string; // 2 decimal places
  vatTotal: string; // 2 decimal places
  invoiceHash?: string; // Base64 SHA-256 (Phase 2)
  ecdsaSignature?: string; // Base64 ECDSA signature (Phase 2)
  publicKey?: string; // Base64 ECDSA public key (Phase 2)
  certificateSignature?: string; // Base64 cert signature (Simplified only)
}

// ─── ZATCA Validation Result ──────────────────────────────────────────────────

export interface ZatcaValidationResult {
  valid: boolean;
  errors: ZatcaValidationError[];
  warnings: ZatcaValidationWarning[];
}

export interface ZatcaValidationError {
  code: string;
  message: string;
  field?: string;
  category: 'BRules' | 'Schema' | 'Security';
}

export interface ZatcaValidationWarning {
  code: string;
  message: string;
  field?: string;
}

// ─── ZATCA API Response (future integration) ─────────────────────────────────

export interface ZatcaApiResponse {
  requestId: string;
  dispositionMessage: string;
  clearanceStatus?: 'CLEARED' | 'NOT_YET_CLEARED' | 'NOT_CLEARED';
  reportingStatus?: 'REPORTED' | 'NOT_YET_REPORTED' | 'NOT_REPORTED';
  status: 'PASS' | 'WARNING' | 'ERROR';
  invoiceHash: string;
  qrSellersJson?: string;
  validationResults: {
    infoMessages: ZatcaApiMessage[];
    warningMessages: ZatcaApiMessage[];
    errorMessages: ZatcaApiMessage[];
    status: 'PASS' | 'WARNING' | 'ERROR';
  };
}

export interface ZatcaApiMessage {
  type: string;
  code: string;
  category: string;
  message: string;
  status: string;
}

// ─── ZATCA Company Config ─────────────────────────────────────────────────────

export interface ZatcaCompanyConfig {
  id: string;
  company_id: string;
  vat_number: string | null;
  cr_number: string | null;
  zatca_environment: 'sandbox' | 'production';
  is_onboarded: boolean;
  onboarding_token: string | null;
  device_id: string | null;
  device_name: string | null;
  csr_pem: string | null;
  certificate_pem: string | null;
  certificate_serial: string | null;
  certificate_expiry: string | null;
  certificate_thumbprint: string | null;
  public_key_pem: string | null;
  private_key_encrypted: string | null;
  default_invoice_type: 'standard' | 'simplified';
  default_invoice_type_code: string;
  default_payment_means: string;
  default_currency: string;
  invoice_sequence_start: number;
  zatca_base_url: string;
  zatca_api_version: string;
  created_at: string;
  updated_at: string;
}

// ─── ZATCA ICV Sequence ───────────────────────────────────────────────────────

export interface ZatcaIcvSequence {
  id: string;
  company_id: string;
  last_icv: number;
  last_invoice_hash: string | null;
  last_invoice_uuid: string | null;
  updated_at: string;
}

// ─── Tax Exemption Reason Codes ───────────────────────────────────────────────

export const ZATCA_EXEMPTION_REASONS: Record<string, string> = {
  'VATEX-SA-29': 'Financial services',
  'VATEX-SA-29-7': 'Life insurance services',
  'VATEX-SA-30': 'Real estate transactions',
  'VATEX-SA-32': 'Exports of goods',
  'VATEX-SA-33': 'Exports of services',
  'VATEX-SA-34-1': 'International transport of goods',
  'VATEX-SA-34-2': 'International transport of passengers',
  'VATEX-SA-34-3': 'Services related to international transport',
  'VATEX-SA-34-4': 'Supply of qualifying means of transport',
  'VATEX-SA-34-5': 'Supply of goods/services related to qualifying means of transport',
  'VATEX-SA-35': 'Supply of aircraft designated for international use',
  'VATEX-SA-36': 'Supply of goods/services related to aircraft',
  'VATEX-SA-EDU': 'Education sector',
  'VATEX-SA-HEA': 'Health sector',
};

// ─── UN/ECE Units of Measure ──────────────────────────────────────────────────

export const ZATCA_UNITS: Record<string, string> = {
  PCE: 'Piece',
  KGM: 'Kilogram',
  GRM: 'Gram',
  LTR: 'Litre',
  MTR: 'Metre',
  MTK: 'Square Metre',
  MTQ: 'Cubic Metre',
  HUR: 'Hour',
  DAY: 'Day',
  MON: 'Month',
  ANN: 'Year',
  SET: 'Set',
  BOX: 'Box',
  TNE: 'Tonne',
  BAG: 'Bag',
};

// ─── Invoice Type Codes ───────────────────────────────────────────────────────

export const ZATCA_TYPE_CODES: Record<ZatcaTypeCode, string> = {
  '388': 'Tax Invoice',
  '381': 'Credit Note',
  '383': 'Debit Note',
  '386': 'Prepayment Invoice',
  '389': 'Self-billed Invoice',
};

export const ZATCA_TYPE_CODES_AR: Record<ZatcaTypeCode, string> = {
  '388': 'فاتورة ضريبية',
  '381': 'إشعار دائن',
  '383': 'إشعار مدين',
  '386': 'فاتورة دفعة مقدمة',
  '389': 'فاتورة ذاتية',
};

// ─── Payment Means Labels ─────────────────────────────────────────────────────

export const PAYMENT_MEANS_LABELS: Record<string, string> = {
  '1': 'Not Defined',
  '10': 'Cash',
  '30': 'Credit Transfer',
  '42': 'Bank Account',
  '48': 'Bank Card',
};

export const PAYMENT_MEANS_LABELS_AR: Record<string, string> = {
  '1': 'غير محدد',
  '10': 'نقداً',
  '30': 'تحويل بنكي',
  '42': 'حساب بنكي',
  '48': 'بطاقة بنكية',
};
