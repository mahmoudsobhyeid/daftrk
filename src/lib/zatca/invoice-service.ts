/**
 * ZATCA Phase 2 — Core Invoice Service
 *
 * Orchestrates the full invoice issuance pipeline:
 * 1. Acquire next ICV (atomic, per-company)
 * 2. Build ZatcaInvoiceData from form data
 * 3. Generate UBL XML
 * 4. Hash the canonical XML
 * 5. Generate QR TLV data
 * 6. Persist to database (locked after issuance)
 * 7. Update ICV chain with new hash
 *
 * Architecture: adding official ZATCA API connectivity requires only
 * wiring in the ZatcaApiClient after step 5 — no changes to this service needed.
 */

import { supabase } from '../supabase';
import { generateUblXml, generateCanonicalXml } from './xml';
import { hashInvoiceXml, buildSignaturePlaceholder } from './hash';
import { buildQrInput, encodeTlvQr } from './tlv';
import { validateZatcaInvoice } from './validation';
import type {
  ZatcaInvoiceData,
  ZatcaLineItem,
  ZatcaTaxTotal,
  ZatcaSeller,
  ZatcaBuyer,
  ZatcaTaxCategory,
} from './types';
import type { Company, Customer, InvoiceItem } from '../types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZatcaIssuanceInput {
  invoiceId: string;
  company: Company & {
    city?: string | null;
    postal_code?: string | null;
    building_number?: string | null;
    additional_number?: string | null;
    district?: string | null;
    website?: string | null;
    city_ar?: string | null;
  };
  customer: Customer & {
    postal_code?: string | null;
    building_number?: string | null;
    district?: string | null;
    cr_number?: string | null;
  };
  invoiceNumber: string;
  invoiceType: 'standard' | 'simplified';
  typeCode: string;
  subtype: string;
  issueDate: string;
  issueTime: string;
  deliveryDate?: string;
  currencyCode: string;
  exchangeRate: number;
  paymentMeansCode: string;
  paymentAccountId?: string;
  notes?: string;
  terms?: string;
  purchaseOrder?: string;
  referenceNumber?: string;
  salesperson?: string;
  items: (InvoiceItem & {
    unit?: string;
    tax_category?: string;
    tax_exemption_reason_code?: string;
    tax_exemption_reason?: string;
    vat_amount?: number;
    net_amount?: number;
    gross_amount?: number;
  })[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  total: number;
}

export interface ZatcaIssuanceResult {
  success: boolean;
  invoiceHash?: string;
  qrData?: string;
  xml?: string;
  icv?: number;
  validationErrors?: string[];
  error?: string;
}

// ─── Build seller from company ────────────────────────────────────────────────

function buildSeller(company: ZatcaIssuanceInput['company']): ZatcaSeller {
  const normalizedVat = (company.tax_number ?? '').replace(/\D/g, '').slice(0, 15);
  return {
    nameAr: company.name_ar || company.name,
    nameEn: company.name,
    vatNumber: normalizedVat,
    crNumber: (company as any).commercial_registration ?? undefined,
    address: {
      street: company.address ?? '',
      buildingNumber: company.building_number ?? '0000',
      additionalNumber: company.additional_number ?? undefined,
      postalZone: company.postal_code ?? '00000',
      district: company.district ?? undefined,
      cityName: company.city ?? 'Riyadh',
      countryCode: company.country === 'Saudi Arabia' ? 'SA' : (company.country?.slice(0, 2).toUpperCase() ?? 'SA'),
    },
    phone: company.phone ?? undefined,
    email: company.email ?? undefined,
    website: company.website ?? undefined,
  };
}

// ─── Build buyer from customer ────────────────────────────────────────────────

function buildBuyer(customer: ZatcaIssuanceInput['customer']): ZatcaBuyer {
  return {
    name: customer.name,
    nameAr: customer.name_ar ?? undefined,
    vatNumber: customer.tax_number ?? undefined,
    crNumber: customer.cr_number ?? undefined,
    address: customer.address
      ? {
          street: customer.address,
          buildingNumber: customer.building_number ?? undefined,
          postalZone: customer.postal_code ?? undefined,
          district: customer.district ?? undefined,
          cityName: customer.city ?? undefined,
          countryCode: customer.country === 'Saudi Arabia' ? 'SA' : (customer.country?.slice(0, 2).toUpperCase() ?? 'SA'),
        }
      : undefined,
    phone: customer.phone ?? undefined,
    email: customer.email ?? undefined,
  };
}

// ─── Build line items ─────────────────────────────────────────────────────────

function buildLineItems(items: ZatcaIssuanceInput['items']): ZatcaLineItem[] {
  return items.map((it, idx) => {
    const grossAmount = it.quantity * it.unit_price;
    const discountAmount = grossAmount * ((it.discount ?? 0) / 100);
    const netAmount = it.net_amount ?? (grossAmount - discountAmount);
    const taxRate = it.tax_rate ?? 0;
    const taxCategory = (it.tax_category as ZatcaTaxCategory) ?? 'S';
    const vatAmount = it.vat_amount ?? (taxCategory === 'S' ? netAmount * (taxRate / 100) : 0);
    const lineTotal = netAmount + vatAmount;

    return {
      id: it.id ?? String(idx + 1),
      itemId: it.product_id ?? undefined,
      description: it.description,
      sku: (it as any).sku ?? undefined,
      unit: (it as any).unit ?? 'PCE',
      quantity: it.quantity,
      unitPrice: it.unit_price,
      discountPercent: it.discount ?? 0,
      discountAmount,
      taxCategory,
      taxExemptionReasonCode: it.tax_exemption_reason_code ?? undefined,
      taxExemptionReason: it.tax_exemption_reason ?? undefined,
      taxRate,
      grossAmount: it.gross_amount ?? grossAmount,
      netAmount,
      vatAmount,
      lineTotal,
    };
  });
}

// ─── Build tax totals breakdown ───────────────────────────────────────────────

function buildTaxTotals(lineItems: ZatcaLineItem[]): ZatcaTaxTotal[] {
  const map = new Map<string, ZatcaTaxTotal>();

  for (const item of lineItems) {
    const key = `${item.taxCategory}:${item.taxRate}`;
    const existing = map.get(key);
    if (existing) {
      existing.taxableAmount += item.netAmount;
      existing.taxAmount += item.vatAmount;
    } else {
      map.set(key, {
        taxCategory: item.taxCategory,
        taxRate: item.taxRate,
        taxableAmount: item.netAmount,
        taxAmount: item.vatAmount,
        exemptionReasonCode: item.taxExemptionReasonCode,
        exemptionReason: item.taxExemptionReason,
      });
    }
  }

  return Array.from(map.values());
}

// ─── Main issuance pipeline ───────────────────────────────────────────────────

export async function issueZatcaInvoice(input: ZatcaIssuanceInput): Promise<ZatcaIssuanceResult> {
  try {
    // Step 1: Acquire ICV and previous hash atomically
    const { data: icvData, error: icvError } = await supabase.rpc('next_icv', {
      p_company_id: input.company.id,
    });
    if (icvError) throw new Error(`ICV acquisition failed: ${icvError.message}`);

    const icvRow = icvData?.[0] ?? icvData;
    const icv: number = icvRow?.icv ?? 1;
    const prevHash: string | null = icvRow?.prev_hash ?? null;

    // Step 2: Generate invoice UUID
    const uuid = crypto.randomUUID();

    // Step 3: Build line items and tax totals
    const lineItems = buildLineItems(input.items);
    const taxTotals = buildTaxTotals(lineItems);

    const lineExtensionAmount = lineItems.reduce((s, i) => s + i.netAmount, 0);
    const computedTaxTotal = lineItems.reduce((s, i) => s + i.vatAmount, 0);
    const computedTaxExclusiveAmount = Math.max(0, lineExtensionAmount - input.discountTotal);
    const computedTaxInclusiveAmount = lineExtensionAmount + computedTaxTotal - input.discountTotal;

    // Step 4: Build ZatcaInvoiceData
    const invoiceData: ZatcaInvoiceData = {
      uuid,
      icv,
      invoiceNumber: input.invoiceNumber,
      invoiceType: input.invoiceType,
      typeCode: input.typeCode as any,
      subtype: input.subtype,
      issueDate: input.issueDate,
      issueTime: input.issueTime,
      deliveryDate: input.deliveryDate,
      referenceNumber: input.referenceNumber,
      purchaseOrder: input.purchaseOrder,
      salesperson: input.salesperson,
      currencyCode: input.currencyCode,
      exchangeRate: input.exchangeRate,
      paymentMeansCode: input.paymentMeansCode as any,
      paymentAccountId: input.paymentAccountId,
      notes: input.notes,
      terms: input.terms,
      seller: buildSeller(input.company),
      buyer: buildBuyer(input.customer),
      items: lineItems,
      lineExtensionAmount,
      taxExclusiveAmount: computedTaxExclusiveAmount,
      taxInclusiveAmount: computedTaxInclusiveAmount,
      allowanceTotal: input.discountTotal,
      taxTotal: computedTaxTotal,
      taxTotals,
      roundingAmount: 0,
      prevInvoiceHash: prevHash ?? undefined,
    };

    // Step 5: Validate
    const validation = validateZatcaInvoice(invoiceData);
    if (!validation.valid) {
      const criticalErrors = validation.errors.filter((e) => e.category === 'BRules');
      if (criticalErrors.length > 0) {
        return {
          success: false,
          validationErrors: criticalErrors.map((e) => `[${e.code}] ${e.message}`),
        };
      }
    }

    // Step 6: Generate XML
    const xml = generateUblXml(invoiceData);
    const canonicalXml = generateCanonicalXml(invoiceData);

    // Step 7: Hash canonical XML
    const { hashBase64 } = await hashInvoiceXml(canonicalXml);

    // Step 8: Build signature placeholder (replaced with real ECDSA when cert is available)
    const signature = buildSignaturePlaceholder(hashBase64);

    // Step 9: Generate QR data
    const qrInput = buildQrInput({
      sellerName: invoiceData.seller.nameAr,
      vatNumber: invoiceData.seller.vatNumber,
      issueDate: input.issueDate,
      issueTime: input.issueTime,
      invoiceTotal: input.total,
      vatTotal: input.taxTotal,
      invoiceHash: hashBase64,
      ecdsaSignature: signature,
      isSimplified: input.invoiceType === 'simplified',
    });
    const qrData = encodeTlvQr(qrInput);

    // Step 10: Update invoice in DB with all ZATCA fields
    const { error: updateError } = await supabase.from('invoices').update({
      uuid,
      icv,
      invoice_type: input.invoiceType,
      invoice_type_code: input.typeCode,
      invoice_subtype: input.subtype,
      issue_time: input.issueTime,
      delivery_date: input.deliveryDate ?? null,
      reference_number: input.referenceNumber ?? null,
      purchase_order: input.purchaseOrder ?? null,
      salesperson: input.salesperson ?? null,
      currency_code: input.currencyCode,
      exchange_rate: input.exchangeRate,
      payment_means_code: input.paymentMeansCode,
      payment_account_id: input.paymentAccountId ?? null,
      zatca_hash: hashBase64,
      zatca_prev_hash: prevHash,
      zatca_qr_data: qrData,
      zatca_xml: xml,
      zatca_signature: signature,
      zatca_clearance_status: 'ready',
      zatca_submission_status: 'not_submitted',
      is_locked: true,
    }).eq('id', input.invoiceId);

    if (updateError) throw new Error(`Failed to persist ZATCA data: ${updateError.message}`);

    // Step 11: Update ICV chain
    await supabase.rpc('update_icv_hash', {
      p_company_id: input.company.id,
      p_invoice_hash: hashBase64,
      p_invoice_uuid: uuid,
    });

    return {
      success: true,
      invoiceHash: hashBase64,
      qrData,
      xml,
      icv,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during ZATCA issuance',
    };
  }
}

/**
 * Regenerates the QR data and XML for an existing issued invoice.
 * Use when the certificate is updated or for re-submission.
 * Does NOT increment ICV — uses the stored ICV value.
 */
export async function regenerateZatcaData(invoiceId: string): Promise<ZatcaIssuanceResult> {
  const { data: inv, error } = await supabase
    .from('invoices')
    .select('*, customer:customers(*), items:invoice_items(*)')
    .eq('id', invoiceId)
    .maybeSingle();

  if (error || !inv) return { success: false, error: 'Invoice not found' };

  const { data: companyData } = await supabase.from('companies').select('*').eq('id', inv.company_id).maybeSingle();
  if (!companyData) return { success: false, error: 'Company not found' };

  return issueZatcaInvoice({
    invoiceId,
    company: companyData,
    customer: inv.customer,
    invoiceNumber: inv.number,
    invoiceType: inv.invoice_type ?? 'standard',
    typeCode: inv.invoice_type_code ?? '388',
    subtype: inv.invoice_subtype ?? '0100000',
    issueDate: inv.issue_date,
    issueTime: inv.issue_time ?? '00:00:00',
    deliveryDate: inv.delivery_date ?? undefined,
    currencyCode: inv.currency_code ?? 'SAR',
    exchangeRate: inv.exchange_rate ?? 1,
    paymentMeansCode: inv.payment_means_code ?? '10',
    paymentAccountId: inv.payment_account_id ?? undefined,
    notes: inv.notes ?? undefined,
    terms: inv.terms ?? undefined,
    purchaseOrder: inv.purchase_order ?? undefined,
    referenceNumber: inv.reference_number ?? undefined,
    salesperson: inv.salesperson ?? undefined,
    items: inv.items,
    subtotal: inv.subtotal,
    taxTotal: inv.tax_total,
    discountTotal: inv.discount_total,
    total: inv.total,
  });
}

/**
 * Generates a preliminary ZATCA QR code for a draft invoice.
 * Uses current company tax data and invoice totals.
 * This QR is sufficient for Phase 1 compliance.
 * When the invoice is "issued" via issueZatcaInvoice(), the QR is regenerated with full ZATCA fields.
 *
 * @param invoiceId - ID of the invoice
 * @param company - Company data (must include tax_number)
 * @param issueDate - Invoice issue date (YYYY-MM-DD)
 * @param invoiceTotal - Total invoice amount (with VAT)
 * @param vatTotal - Total VAT amount
 */
export async function generatePreliminaryQr(
  invoiceId: string,
  company: Company,
  issueDate: string,
  invoiceTotal: number,
  vatTotal: number,
): Promise<{ success: boolean; qrData?: string; error?: string }> {
  try {
    if (!company.tax_number) {
      return { success: false, error: 'Company VAT number is required for QR generation' };
    }

    // Build minimal QR input with available data
    // For draft invoices, we use placeholder/empty values for hash and signature
    const qrInput = buildQrInput({
      sellerName: company.name_ar || company.name,
      vatNumber: company.tax_number,
      issueDate,
      issueTime: new Date().toTimeString().slice(0, 8), // Current time as HH:MM:SS
      invoiceTotal,
      vatTotal,
      invoiceHash: '0000000000000000000000000000000000000000000000000000000000000000', // Placeholder hash
      ecdsaSignature: 'PRELIMINARY_QR_NO_SIGNATURE', // Placeholder signature
      isSimplified: false, // Will be updated during issuance
    });

    const qrData = encodeTlvQr(qrInput);

    // Store in database
    const { error } = await supabase
      .from('invoices')
      .update({ zatca_qr_data: qrData })
      .eq('id', invoiceId);

    if (error) {
      return { success: false, error: `Failed to store QR data: ${error.message}` };
    }

    return { success: true, qrData };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error generating preliminary QR',
    };
  }
}
/**
 * Deduct inventory when an invoice is created
 * Called after successful invoice issuance
 */
export async function deductInventory(
  companyId: string,
  invoiceId: string,
  items: (InvoiceItem & { product_id?: string })[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!items || items.length === 0) {
      return { success: true };
    }

    // Deduct each item from inventory
    for (const item of items) {
      if (!item.product_id && !item.id) continue;

      const productId = item.product_id || item.id;
      const quantity = item.quantity || 0;

      if (quantity <= 0) continue;

      // Get current inventory
      const { data: inventory, error: fetchError } = await supabase
        .from('warehouse_inventory')
        .select('id, quantity_in_stock, quantity_reserved')
        .eq('company_id', companyId)
        .eq('product_id', productId)
        .single();

      if (fetchError || !inventory) {
        console.warn(`No inventory found for product ${productId}`);
        continue;
      }

      const newQuantity = Math.max(0, inventory.quantity_in_stock - quantity);

      // Update inventory
      const { error: updateError } = await supabase
        .from('warehouse_inventory')
        .update({
          quantity_in_stock: newQuantity,
        })
        .eq('id', inventory.id);

      if (updateError) {
        console.error(`Failed to deduct inventory for product ${productId}:`, updateError);
        continue;
      }

      // Log transaction
      await supabase.from('inventory_transactions').insert({
        company_id: companyId,
        inventory_id: inventory.id,
        product_id: productId,
        invoice_id: invoiceId,
        transaction_type: 'sale',
        quantity_change: -quantity,
        notes: `الخصم من الفاتورة #${invoiceId}`,
        performed_by: (await supabase.auth.getUser()).data.user?.id,
      });
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error deducting inventory',
    };
  }
}