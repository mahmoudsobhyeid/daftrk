import { forwardRef } from 'react';
import { ZatcaQrCode } from './zatca/QrCode';
import type { REInvoice } from '../lib/types';

export type TemplateId = 'standard' | 'minimal' | 'thermal';

export interface PrintInvoiceData {
  invoice: REInvoice;
  company: { name: string; address: string | null; phone: string | null; email: string | null; tax_number: string | null };
}

const fmt = (n: number) => n.toFixed(2);

export const InvoicePrintArea = forwardRef<HTMLDivElement, PrintInvoiceData & { template: TemplateId }>(
  ({ invoice, company, template }, ref) => {
    const tenant = invoice.lease?.tenant_name ?? '—';
    const tenantPhone = invoice.lease?.tenant_phone ?? '—';

    if (template === 'thermal') return <ThermalTemplate ref={ref} invoice={invoice} company={company} tenant={tenant} tenantPhone={tenantPhone} />;
    if (template === 'minimal') return <MinimalTemplate ref={ref} invoice={invoice} company={company} tenant={tenant} tenantPhone={tenantPhone} />;
    return <StandardTemplate ref={ref} invoice={invoice} company={company} tenant={tenant} tenantPhone={tenantPhone} />;
  }
);
InvoicePrintArea.displayName = 'InvoicePrintArea';

interface TemplateProps {
  invoice: REInvoice;
  company: PrintInvoiceData['company'];
  tenant: string;
  tenantPhone: string;
}

const StandardTemplate = forwardRef<HTMLDivElement, TemplateProps>(({ invoice, company, tenant, tenantPhone }, ref) => (
  <div ref={ref} id="invoice-print-area" className="print-a4" style={{ fontFamily: "'Cairo', 'Tajawal', 'Noto Sans Arabic', 'Inter', system-ui, sans-serif" }}>
    <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-blue-600">
      <div>
        <h1 className="text-3xl font-bold text-blue-700 mb-1">INVOICE</h1>
        <p className="text-sm text-gray-500">{invoice.invoice_number}</p>
      </div>
      <div className="text-end">
        <h2 className="text-xl font-bold text-gray-800">{company.name}</h2>
        {company.address && <p className="text-sm text-gray-500">{company.address}</p>}
        {company.phone && <p className="text-sm text-gray-500">{company.phone}</p>}
        {company.tax_number && <p className="text-sm text-gray-500">VAT: {company.tax_number}</p>}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-8 mb-8">
      <div>
        <p className="text-xs font-bold uppercase text-gray-400 mb-1">Bill To</p>
        <p className="text-base font-semibold text-gray-800">{tenant}</p>
        <p className="text-sm text-gray-500">{tenantPhone}</p>
      </div>
      <div className="text-end">
        <div className="mb-1"><span className="text-xs font-bold uppercase text-gray-400">Issue Date</span><p className="text-sm font-medium">{invoice.issue_date}</p></div>
        <div className="mb-1"><span className="text-xs font-bold uppercase text-gray-400">Due Date</span><p className="text-sm font-medium">{invoice.due_date}</p></div>
        <div><span className="text-xs font-bold uppercase text-gray-400">Status</span><p className="text-sm font-bold capitalize" style={{ color: invoice.status === 'paid' ? '#16a34a' : invoice.status === 'overdue' ? '#dc2626' : '#d97706' }}>{invoice.status}</p></div>
      </div>
    </div>

    <table className="w-full mb-8" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: '#2563eb', color: 'white' }}>
          <th style={{ textAlign: 'start', padding: '10px 14px', fontSize: '12px', fontWeight: 600 }}>Description</th>
          <th style={{ textAlign: 'end', padding: '10px 14px', fontSize: '12px', fontWeight: 600 }}>Amount (SAR)</th>
        </tr>
      </thead>
      <tbody>
        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
          <td style={{ padding: '12px 14px', fontSize: '13px' }}>Rent Payment — {tenant}</td>
          <td style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'end' }}>{fmt(invoice.subtotal)}</td>
        </tr>
        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
          <td style={{ padding: '12px 14px', fontSize: '13px' }}>VAT (15%)</td>
          <td style={{ padding: '12px 14px', fontSize: '13px', textAlign: 'end' }}>{fmt(invoice.vat_amount)}</td>
        </tr>
        <tr style={{ background: '#f0f9ff', borderTop: '2px solid #2563eb' }}>
          <td style={{ padding: '14px', fontSize: '14px', fontWeight: 700 }}>Total</td>
          <td style={{ padding: '14px', fontSize: '14px', fontWeight: 700, textAlign: 'end' }}>{fmt(invoice.total_amount)} SAR</td>
        </tr>
      </tbody>
    </table>

    <div className="flex justify-end mb-6 print-no-break">
      <div className="text-center">
        <p className="text-xs font-bold uppercase text-gray-400 mb-2">ZATCA QR Code</p>
        <div className="print-qr"><ZatcaQrCode data={invoice.qr_code_data ?? ''} size={140} /></div>
      </div>
    </div>

    <div className="pt-6 border-t border-gray-200">
      <p className="text-xs text-gray-400 text-center">This is a ZATCA-compliant electronic invoice. Thank you for your business.</p>
    </div>
  </div>
));
StandardTemplate.displayName = 'StandardTemplate';

const MinimalTemplate = forwardRef<HTMLDivElement, TemplateProps>(({ invoice, company, tenant, tenantPhone }, ref) => (
  <div ref={ref} id="invoice-print-area" className="print-a4" style={{ fontFamily: "'Cairo', 'Tajawal', 'Noto Sans Arabic', 'Inter', system-ui, sans-serif" }}>
    <div className="text-center mb-10">
      <h1 className="text-2xl font-bold text-gray-800 mb-1">RENT INVOICE</h1>
      <p className="text-sm text-gray-400">{company.name} · {invoice.invoice_number}</p>
    </div>

    <div className="flex justify-between mb-8 text-sm">
      <div>
        <p className="font-semibold text-gray-700">{company.name}</p>
        {company.address && <p className="text-gray-500">{company.address}</p>}
        {company.tax_number && <p className="text-gray-500">VAT: {company.tax_number}</p>}
      </div>
      <div className="text-end">
        <p className="text-gray-500">Tenant: <span className="font-semibold text-gray-700">{tenant}</span></p>
        <p className="text-gray-500">Issued: {invoice.issue_date}</p>
        <p className="text-gray-500">Due: {invoice.due_date}</p>
      </div>
    </div>

    <table className="w-full mb-10" style={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #333' }}>
          <th style={{ textAlign: 'start', padding: '8px 0', fontSize: '12px', fontWeight: 600 }}>Description</th>
          <th style={{ textAlign: 'end', padding: '8px 0', fontSize: '12px', fontWeight: 600 }}>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style={{ borderBottom: '1px solid #eee' }}>
          <td style={{ padding: '10px 0', fontSize: '13px' }}>Monthly Rent — {tenant}</td>
          <td style={{ padding: '10px 0', fontSize: '13px', textAlign: 'end' }}>{fmt(invoice.subtotal)} SAR</td>
        </tr>
        <tr style={{ borderBottom: '1px solid #eee' }}>
          <td style={{ padding: '10px 0', fontSize: '13px' }}>VAT (15%)</td>
          <td style={{ padding: '10px 0', fontSize: '13px', textAlign: 'end' }}>{fmt(invoice.vat_amount)} SAR</td>
        </tr>
        <tr style={{ borderBottom: '2px solid #333' }}>
          <td style={{ padding: '12px 0', fontSize: '14px', fontWeight: 700 }}>Total Due</td>
          <td style={{ padding: '12px 0', fontSize: '14px', fontWeight: 700, textAlign: 'end' }}>{fmt(invoice.total_amount)} SAR</td>
        </tr>
      </tbody>
    </table>

    <div className="flex justify-between items-end print-no-break">
      <div className="flex gap-16">
        <div className="text-center">
          <div className="w-48 border-b border-gray-300 mb-1" style={{ height: '60px' }} />
          <p className="text-xs text-gray-400">Tenant Signature</p>
        </div>
        <div className="text-center">
          <div className="w-48 border-b border-gray-300 mb-1" style={{ height: '60px' }} />
          <p className="text-xs text-gray-400">Landlord Signature</p>
        </div>
      </div>
      <div className="print-qr"><ZatcaQrCode data={invoice.qr_code_data ?? ''} size={120} /></div>
    </div>
  </div>
));
MinimalTemplate.displayName = 'MinimalTemplate';

const ThermalTemplate = forwardRef<HTMLDivElement, TemplateProps>(({ invoice, company, tenant, tenantPhone }, ref) => (
  <div ref={ref} id="invoice-print-area" className="print-thermal" style={{ fontFamily: "'Cairo', 'Tajawal', 'Courier New', monospace" }}>
    <div className="text-center mb-2">
      <p className="font-bold text-sm" style={{ fontSize: '11pt' }}>{company.name}</p>
      {company.address && <p style={{ fontSize: '8pt' }}>{company.address}</p>}
      {company.tax_number && <p style={{ fontSize: '8pt' }}>VAT: {company.tax_number}</p>}
    </div>
    <div style={{ borderTop: '1px dashed #999', borderBottom: '1px dashed #999' }} className="py-1 my-2">
      <div className="flex justify-between" style={{ fontSize: '8pt' }}><span>Invoice:</span><span>{invoice.invoice_number}</span></div>
      <div className="flex justify-between" style={{ fontSize: '8pt' }}><span>Date:</span><span>{invoice.issue_date}</span></div>
      <div className="flex justify-between" style={{ fontSize: '8pt' }}><span>Due:</span><span>{invoice.due_date}</span></div>
      <div className="flex justify-between" style={{ fontSize: '8pt' }}><span>Tenant:</span><span>{tenant}</span></div>
    </div>
    <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '8pt' }}>
      <thead>
        <tr style={{ borderBottom: '1px dashed #999' }}>
          <th style={{ textAlign: 'start', padding: '4px 0' }}>Item</th>
          <th style={{ textAlign: 'end', padding: '4px 0' }}>SAR</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style={{ padding: '4px 0' }}>Rent — {tenant}</td><td style={{ padding: '4px 0', textAlign: 'end' }}>{fmt(invoice.subtotal)}</td></tr>
        <tr><td style={{ padding: '4px 0' }}>VAT 15%</td><td style={{ padding: '4px 0', textAlign: 'end' }}>{fmt(invoice.vat_amount)}</td></tr>
        <tr style={{ borderTop: '1px dashed #999' }}>
          <td style={{ padding: '6px 0', fontWeight: 'bold', fontSize: '10pt' }}>TOTAL</td>
          <td style={{ padding: '6px 0', fontWeight: 'bold', fontSize: '10pt', textAlign: 'end' }}>{fmt(invoice.total_amount)}</td>
        </tr>
      </tbody>
    </table>
    <div className="text-center mt-3 print-no-break">
      <div className="print-qr inline-block"><ZatcaQrCode data={invoice.qr_code_data ?? ''} size={100} /></div>
      <p style={{ fontSize: '7pt', marginTop: '4px' }}>ZATCA Phase 1/2 Compliant</p>
    </div>
    <p className="text-center" style={{ fontSize: '7pt', marginTop: '8px' }}>Thank you!</p>
  </div>
));
ThermalTemplate.displayName = 'ThermalTemplate';
