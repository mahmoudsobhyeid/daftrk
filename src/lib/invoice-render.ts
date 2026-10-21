import type { Company, InvoiceRenderData, InvoiceWithDetails } from './types';
import { getInvoiceCustomization } from './invoice-customization';

/**
 * Builds the unified shape consumed by <InvoiceTemplate /> from a fully loaded
 * invoice (customer + items) and the active company. Shared by the invoice
 * detail view and the invoices list PDF downloads.
 */
export function buildInvoiceRenderData(
  invoice: InvoiceWithDetails,
  company: Company,
  templateOverride?: string
): InvoiceRenderData {
  const custom = getInvoiceCustomization(company);
  const effectiveTemplate = templateOverride || custom.template || invoice.template || 'classic';

  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    subtotal: invoice.subtotal,
    tax_total: invoice.tax_total,
    discount_total: invoice.discount_total ?? 0,
    total: invoice.total,
    notes: invoice.notes,
    terms: invoice.terms,
    template: effectiveTemplate,
    customization: custom,
    share_token: invoice.share_token,
    uuid: invoice.uuid ?? null,
    icv: invoice.icv ?? null,
    invoice_type: invoice.invoice_type ?? null,
    zatca_qr_data: (invoice as any).zatca_qr_data ?? null,
    zatca_hash: invoice.zatca_hash ?? null,
    zatca_clearance_status: (invoice as any).zatca_clearance_status ?? null,
    zatca_submission_status: (invoice as any).zatca_submission_status ?? null,
    is_locked: (invoice as any).is_locked ?? false,
    company: {
      id: company.id,
      name: company.name,
      name_ar: company.name_ar,
      address: company.address,
      city: company.city ?? null,
      city_ar: company.city_ar ?? null,
      postal_code: company.postal_code ?? null,
      building_number: company.building_number ?? null,
      additional_number: company.additional_number ?? null,
      district: company.district ?? null,
      phone: company.phone,
      email: company.email,
      tax_number: company.tax_number,
      commercial_registration: company.commercial_registration ?? null,
      logo_path: company.logo_path,
      currency: company.currency,
      primary_color: company.primary_color || '#2563eb',
      invoice_footer: company.invoice_footer ?? null,
      invoice_customization: custom,
    },
    customer: invoice.customer
      ? {
          id: invoice.customer.id,
          name: invoice.customer.name,
          name_ar: invoice.customer.name_ar,
          address: invoice.customer.address ?? null,
          city: (invoice.customer as any).city ?? null,
          phone: invoice.customer.phone ?? null,
          email: invoice.customer.email ?? null,
          tax_number: invoice.customer.tax_number ?? null,
          cr_number: (invoice.customer as any).cr_number ?? null,
        }
      : null,
    items: invoice.items.map((it) => ({
      id: it.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      discount: it.discount ?? 0,
      tax_rate: it.tax_rate,
      line_total: it.line_total,
      unit: (it as any).unit ?? null,
      tax_category: (it as any).tax_category ?? null,
      vat_amount: (it as any).vat_amount ?? null,
      net_amount: (it as any).net_amount ?? null,
    })),
  };
}

/** Invoice columns required by buildInvoiceRenderData (joins customer + items). */
export const INVOICE_PDF_SELECT = `
  *,
  customer:customers(id,name,name_ar,email,phone,address,city,country,tax_number,postal_code,building_number,district,cr_number),
  items:invoice_items(*)
`;
