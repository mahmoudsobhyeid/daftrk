/**
 * ZATCA Phase 2 — Invoice Validation Engine
 *
 * Validates invoices against ZATCA Business Rules (BR-*) before submission.
 * Covers mandatory fields, VAT number format, totals consistency,
 * sequence integrity, and structural requirements.
 */

import type { ZatcaInvoiceData, ZatcaValidationResult, ZatcaValidationError, ZatcaValidationWarning } from './types';

function err(code: string, message: string, field?: string, category: ZatcaValidationError['category'] = 'BRules'): ZatcaValidationError {
  return { code, message, field, category };
}

function warn(code: string, message: string, field?: string): ZatcaValidationWarning {
  return { code, message, field };
}

/**
 * Validates a Saudi VAT number:
 * - Must be exactly 15 digits
 * - Must start with '3'
 * - Must end with '3'
 */
export function isValidVatNumber(vat: string): boolean {
  return /^3\d{13}3$/.test((vat ?? '').trim());
}

export function normalizeSaudiVatNumber(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '').slice(0, 15);
}

/**
 * Validates a Saudi CR (Commercial Registration) number:
 * - Must be exactly 10 digits
 */
export function isValidCrNumber(cr: string): boolean {
  return /^\d{10}$/.test(cr.trim());
}

/**
 * Validates an invoice number — must not be empty or purely whitespace.
 * Should follow the configured prefix pattern but that's not enforced structurally.
 */
export function isValidInvoiceNumber(num: string): boolean {
  return typeof num === 'string' && num.trim().length > 0 && num.trim().length <= 127;
}

/**
 * Validates an ISO date string (YYYY-MM-DD).
 */
export function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

/**
 * Validates an ISO time string (HH:MM:SS).
 */
export function isValidTime(time: string): boolean {
  return /^\d{2}:\d{2}:\d{2}$/.test(time);
}

/**
 * Validates a UUID v4 format.
 */
export function isValidUuid(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Verifies that all monetary totals are internally consistent:
 * - lineExtensionAmount ≈ sum of item netAmounts
 * - taxTotal ≈ sum of item vatAmounts
 * - taxInclusiveAmount ≈ lineExtensionAmount + taxTotal - allowanceTotal + roundingAmount
 */
function validateTotals(data: ZatcaInvoiceData): ZatcaValidationError[] {
  const errors: ZatcaValidationError[] = [];
  const TOLERANCE = 0.05;

  const computedLineExt = data.items.reduce((s, i) => s + i.netAmount, 0);
  if (Math.abs(computedLineExt - data.lineExtensionAmount) > TOLERANCE) {
    errors.push(err('BR-CO-10', `Line extension amount mismatch. Expected ${computedLineExt.toFixed(2)}, got ${data.lineExtensionAmount.toFixed(2)}`, 'lineExtensionAmount'));
  }

  const computedTax = data.items.reduce((s, i) => s + i.vatAmount, 0);
  if (Math.abs(computedTax - data.taxTotal) > TOLERANCE) {
    errors.push(err('BR-CO-14', `Tax total mismatch. Expected ${computedTax.toFixed(2)}, got ${data.taxTotal.toFixed(2)}`, 'taxTotal'));
  }

  const computedTotal = data.lineExtensionAmount + data.taxTotal - data.allowanceTotal + data.roundingAmount;
  if (Math.abs(computedTotal - data.taxInclusiveAmount) > TOLERANCE) {
    errors.push(err('BR-CO-15', `Invoice total mismatch. Expected ${computedTotal.toFixed(2)}, got ${data.taxInclusiveAmount.toFixed(2)}`, 'taxInclusiveAmount'));
  }

  if (data.taxInclusiveAmount < 0) {
    errors.push(err('BR-S-09', 'Invoice total must not be negative for tax invoices', 'taxInclusiveAmount'));
  }

  return errors;
}

/**
 * Full ZATCA Phase 2 validation of an invoice data object.
 * Returns a structured result with errors and warnings.
 */
export function validateZatcaInvoice(data: ZatcaInvoiceData): ZatcaValidationResult {
  const errors: ZatcaValidationError[] = [];
  const warnings: ZatcaValidationWarning[] = [];

  // ── Identity ─────────────────────────────────────
  if (!isValidUuid(data.uuid)) {
    errors.push(err('BR-KSA-06', 'Invoice UUID must be a valid UUID v4', 'uuid'));
  }
  if (!isValidInvoiceNumber(data.invoiceNumber)) {
    errors.push(err('BR-02', 'Invoice number is required and must be <= 127 characters', 'invoiceNumber'));
  }
  if (data.icv < 1) {
    errors.push(err('BR-KSA-16', 'ICV (Internal Counter Value) must be >= 1', 'icv'));
  }

  // ── Dates ────────────────────────────────────────
  if (!isValidDate(data.issueDate)) {
    errors.push(err('BR-02', 'Issue date must be a valid date in YYYY-MM-DD format', 'issueDate'));
  }
  if (!isValidTime(data.issueTime)) {
    errors.push(err('BR-KSA-02', 'Issue time must be in HH:MM:SS format', 'issueTime'));
  }
  if (data.deliveryDate && !isValidDate(data.deliveryDate)) {
    errors.push(err('BR-KSA-18', 'Delivery date must be in YYYY-MM-DD format', 'deliveryDate'));
  }

  // ── Seller ───────────────────────────────────────
  if (!data.seller.nameAr || data.seller.nameAr.trim().length === 0) {
    errors.push(err('BR-04', 'Seller Arabic name is required', 'seller.nameAr'));
  }
  if (!data.seller.vatNumber) {
    errors.push(err('BR-CO-09', 'Seller VAT number is required', 'seller.vatNumber'));
  } else if (!isValidVatNumber(data.seller.vatNumber)) {
    errors.push(err('BR-KSA-12', 'Seller VAT number must be 15 digits, start with 3 and end with 3', 'seller.vatNumber'));
  }
  if (!data.seller.address.buildingNumber) {
    errors.push(err('BR-KSA-22', 'Seller building number is required', 'seller.address.buildingNumber'));
  }
  if (!data.seller.address.postalZone) {
    errors.push(err('BR-KSA-23', 'Seller postal code is required', 'seller.address.postalZone'));
  }
  if (!data.seller.address.cityName) {
    errors.push(err('BR-KSA-24', 'Seller city is required', 'seller.address.cityName'));
  }
  if (!data.seller.address.street) {
    errors.push(err('BR-KSA-25', 'Seller street is required', 'seller.address.street'));
  }

  // ── Buyer ────────────────────────────────────────
  if (!data.buyer.name || data.buyer.name.trim().length === 0) {
    errors.push(err('BR-07', 'Buyer name is required', 'buyer.name'));
  }
  if (data.invoiceType === 'standard') {
    if (!data.buyer.vatNumber) {
      warnings.push(warn('BR-KSA-46', 'Buyer VAT number recommended for Standard (B2B) invoices', 'buyer.vatNumber'));
    } else if (!isValidVatNumber(data.buyer.vatNumber)) {
      errors.push(err('BR-KSA-13', 'Buyer VAT number must be 15 digits, start with 3 and end with 3', 'buyer.vatNumber'));
    }
  }

  // ── Items ────────────────────────────────────────
  if (!data.items || data.items.length === 0) {
    errors.push(err('BR-16', 'Invoice must have at least one line item', 'items'));
  } else {
    data.items.forEach((item, idx) => {
      if (!item.description || item.description.trim().length === 0) {
        errors.push(err('BR-25', `Line ${idx + 1}: Item name/description is required`, `items[${idx}].description`));
      }
      if (item.quantity <= 0) {
        errors.push(err('BR-KSA-29', `Line ${idx + 1}: Quantity must be positive`, `items[${idx}].quantity`));
      }
      if (item.unitPrice < 0) {
        errors.push(err('BR-27', `Line ${idx + 1}: Unit price cannot be negative`, `items[${idx}].unitPrice`));
      }
      if (!['S', 'Z', 'E', 'O'].includes(item.taxCategory)) {
        errors.push(err('BR-KSA-30', `Line ${idx + 1}: Invalid tax category '${item.taxCategory}'`, `items[${idx}].taxCategory`));
      }
      if ((item.taxCategory === 'E' || item.taxCategory === 'Z' || item.taxCategory === 'O') && !item.taxExemptionReasonCode) {
        warnings.push(warn('BR-KSA-31', `Line ${idx + 1}: Tax exemption reason code recommended for category ${item.taxCategory}`, `items[${idx}].taxExemptionReasonCode`));
      }
    });
  }

  // ── Totals ───────────────────────────────────────
  errors.push(...validateTotals(data));

  // ── Currency ─────────────────────────────────────
  if (!data.currencyCode || data.currencyCode.length !== 3) {
    errors.push(err('BR-05', 'Currency code must be a valid ISO 4217 3-letter code', 'currencyCode'));
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
