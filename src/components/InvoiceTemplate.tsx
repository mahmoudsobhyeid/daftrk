import { supabase } from '../lib/supabase';
import type { InvoiceRenderData, InvoiceStatus } from '../lib/types';
import { ZatcaQrCode } from './zatca/QrCode';
import { ZatcaClearanceBadge } from './zatca/ZatcaStatus';
import {
  getInvoiceCustomization,
  type InvoiceCustomization,
  type InvoiceFontFamily,
  type InvoiceFontSize,
  type InvoiceLogoPosition,
  type InvoiceLogoSize,
} from '../lib/invoice-customization';

export interface InvoiceTemplateProps {
  data: InvoiceRenderData;
  lang: string;
  fmt: (amount: number, currency?: string) => string;
  fmtDate: (date: string) => string;
  t: (key: string) => string;
  customizationOverride?: InvoiceCustomization;
}

/** Derive accent colors from a hex string for inline style overrides */
function accent(hex: string) {
  const c = hex || '#2563eb';
  return {
    solid: c,
    light08: `${c}14`,
    light12: `${c}1f`,
    light20: `${c}33`,
    bar: `linear-gradient(to right, ${c}, ${c}bb)`,
  };
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300',
  sent: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  overdue: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-500 line-through',
};

function StatusChip({ status, t }: { status: InvoiceStatus; t: (k: string) => string }) {
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_COLORS[status] || STATUS_COLORS.draft}`}>
      {t(`status.${status}`) || status}
    </span>
  );
}

function getLogoUrl(logoPath: string | null) {
  if (!logoPath) return null;
  return supabase.storage.from('company-logos').getPublicUrl(logoPath).data.publicUrl;
}

function resolveFontClass(font: InvoiceFontFamily | undefined, isRtl: boolean): string {
  switch (font) {
    case 'cairo':
      return 'font-cairo';
    case 'tajawal':
      return 'font-tajawal';
    case 'noto':
      return 'font-noto';
    case 'inter':
      return 'font-sans';
    default:
      return isRtl ? 'font-arabic' : 'font-sans';
  }
}

function resolveFontSizeClass(size: InvoiceFontSize | undefined): string {
  switch (size) {
    case 'small':
      return 'text-xs';
    case 'large':
      return 'text-base';
    case 'medium':
    default:
      return 'text-sm';
  }
}

function resolveLogoSizePx(size: InvoiceLogoSize | undefined): number {
  switch (size) {
    case 'small':
      return 44;
    case 'large':
      return 88;
    case 'medium':
    default:
      return 64;
  }
}

// ─── Shared Common Components ──────────────────────────────────────────────────

function CompanyLogo({
  company,
  custom,
  solidColor,
}: {
  company: InvoiceRenderData['company'];
  custom: InvoiceCustomization;
  solidColor: string;
}) {
  if (!custom.showLogo) return null;
  const logoUrl = getLogoUrl(company.logo_path);
  const px = resolveLogoSizePx(custom.logoSize);

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={company.name}
        style={{ height: `${px}px`, maxWidth: `${px * 2.5}px` }}
        className="object-contain"
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-xl font-black text-white shrink-0"
      style={{
        backgroundColor: solidColor,
        width: `${px}px`,
        height: `${px}px`,
        fontSize: `${Math.round(px * 0.4)}px`,
      }}
    >
      {company.name.charAt(0).toUpperCase()}
    </div>
  );
}

function SignatureStampBox({
  custom,
  isRtl,
}: {
  custom: InvoiceCustomization;
  isRtl: boolean;
}) {
  if (!custom.showSignatureBox) return null;
  const label = isRtl
    ? custom.signatureLabelAr || 'التوقيع والختم المعتمد'
    : custom.signatureLabel || 'Authorized Signature & Stamp';

  return (
    <div className="mt-8 pt-4 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-end gap-6">
      <div className="text-xs text-gray-400">
        <p>{isRtl ? 'شكراً لتعاملكم معنا' : 'Thank you for your business.'}</p>
        {custom.footerText && <p className="mt-1 font-medium text-gray-600">{custom.footerText}</p>}
      </div>
      <div className="w-56 p-3 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-center">
        <div className="h-14 flex items-center justify-center text-gray-300 text-xs italic">
          {isRtl ? 'مكان الختم / التوقيع' : 'Stamp / Signature Area'}
        </div>
        <p className="border-t border-gray-200 pt-1 text-[11px] font-bold text-gray-600 uppercase">
          {label}
        </p>
      </div>
    </div>
  );
}

// ─── 1. Classic Standard Template ─────────────────────────────────────────────

function ClassicTemplate({ data, lang, fmt, fmtDate, t, customizationOverride }: InvoiceTemplateProps) {
  const { company, customer, items } = data;
  const custom = customizationOverride || getInvoiceCustomization(company as any);
  const isRtl = lang === 'ar';
  const customerName = isRtl ? (customer?.name_ar || customer?.name) : customer?.name;
  const companyName = isRtl ? (company.name_ar || company.name) : company.name;
  const a = accent(custom.primaryColor || company.primary_color);
  const fontClass = resolveFontClass(custom.fontFamily, isRtl);
  const fontSizeClass = resolveFontSizeClass(custom.fontSize);

  return (
    <div className={`bg-white text-gray-900 ${fontClass} ${fontSizeClass}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Accent top bar */}
      <div className="h-2.5" style={{ background: a.bar }} />

      <div className="p-8 sm:p-12">
        {/* Header */}
        <div
          className={`flex flex-col sm:flex-row justify-between gap-8 mb-8 ${
            custom.headerLayout === 'stacked' ? 'items-center text-center' : ''
          }`}
        >
          <div className={`flex-1 ${custom.headerLayout === 'stacked' ? 'flex flex-col items-center' : ''}`}>
            <div className="mb-4">
              <CompanyLogo company={company} custom={custom} solidColor={a.solid} />
            </div>
            <p className="text-xl font-bold text-gray-900">{companyName}</p>
            {custom.showAddress && company.address && (
              <p className="mt-1 text-xs text-gray-500 leading-relaxed max-w-sm">{company.address}</p>
            )}
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {custom.showPhone && company.phone && <span>{company.phone}</span>}
              {custom.showEmail && company.email && <span>{company.email}</span>}
            </div>
            {custom.showTaxNumber && company.tax_number && (
              <p className="mt-1 text-xs font-semibold text-gray-600">
                {t('invoices.vatNumber')}: <span className="font-mono">{company.tax_number}</span>
              </p>
            )}
            {custom.showCommercialReg && company.commercial_registration && (
              <p className="text-xs text-gray-500">
                {isRtl ? 'السجل التجاري' : 'CR'}: <span className="font-mono">{company.commercial_registration}</span>
              </p>
            )}
          </div>

          <div className={`${isRtl ? 'text-start' : 'text-end'} shrink-0 flex flex-col items-${isRtl ? 'start' : 'end'}`}>
            <p className="text-4xl sm:text-5xl font-black tracking-tight uppercase mb-1" style={{ color: a.solid }}>
              {t('invoices.invoiceOf')}
            </p>
            <p className="text-lg font-bold text-gray-800 font-mono">{data.number}</p>
            <div className="mt-2 space-y-0.5 text-xs text-gray-500">
              <p>
                <span className="font-semibold text-gray-700">{t('invoices.issueDate')}: </span>
                {fmtDate(data.issue_date)}
              </p>
              <p>
                <span className="font-semibold text-gray-700">{t('invoices.dueDate')}: </span>
                {fmtDate(data.due_date)}
              </p>
            </div>
            {custom.showStatusBadge && (
              <div className="mt-2.5">
                <StatusChip status={data.status} t={t} />
              </div>
            )}
            {custom.qrPosition === 'header' && (data.zatca_qr_data || (data as any).qr_code_data) && (
              <div className="mt-3">
                <ZatcaQrCode qrData={data.zatca_qr_data || (data as any).qr_code_data || ''} size={76} />
              </div>
            )}
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-6 p-4 rounded-xl border border-gray-100" style={{ backgroundColor: a.light08 }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: a.solid }}>
            {t('invoices.billTo')}
          </p>
          {customer ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-sm font-bold text-gray-900">{customerName}</p>
                {custom.showAddress && customer.address && (
                  <p className="mt-0.5 text-gray-600 leading-relaxed">{customer.address}</p>
                )}
              </div>
              <div className="space-y-0.5">
                {custom.showPhone && customer.phone && <p className="text-gray-600">{customer.phone}</p>}
                {custom.showEmail && customer.email && <p className="text-gray-600">{customer.email}</p>}
                {custom.showTaxNumber && customer.tax_number && (
                  <p className="text-gray-700 font-medium">
                    {t('invoices.vatNumber')}: <span className="font-mono">{customer.tax_number}</span>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">—</p>
          )}
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto mb-6 rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ backgroundColor: a.light12 }}>
                <th className={`${isRtl ? 'text-end' : 'text-start'} px-4 py-3 font-bold uppercase tracking-wider`} style={{ color: a.solid }}>{t('invoices.itemDescription')}</th>
                <th className="text-center px-3 py-3 font-bold uppercase tracking-wider w-16" style={{ color: a.solid }}>{t('invoices.itemQuantity')}</th>
                <th className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3 font-bold uppercase tracking-wider`} style={{ color: a.solid }}>{t('invoices.itemPrice')}</th>
                {items.some((i) => i.discount > 0) && (
                  <th className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3 font-bold uppercase tracking-wider w-16`} style={{ color: a.solid }}>{t('invoices.discount')}</th>
                )}
                <th className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3 font-bold uppercase tracking-wider w-16`} style={{ color: a.solid }}>{t('invoices.itemTax')}</th>
                <th className={`${isRtl ? 'text-start' : 'text-end'} px-4 py-3 font-bold uppercase tracking-wider`} style={{ color: a.solid }}>{t('invoices.itemTotal')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-gray-50/70 transition-colors">
                  <td className={`${isRtl ? 'text-end' : 'text-start'} px-4 py-3 text-gray-800`}>
                    {item.description || t('invoices.noItemDesc')}
                  </td>
                  <td className="px-3 py-3 text-center text-gray-700 font-mono">{item.quantity}</td>
                  <td className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3 text-gray-700 font-mono`}>{fmt(Number(item.unit_price), company.currency)}</td>
                  {items.some((i) => i.discount > 0) && (
                    <td className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3 text-orange-600 font-medium font-mono`}>
                      {item.discount > 0 ? `${item.discount}%` : '—'}
                    </td>
                  )}
                  <td className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3 text-gray-600 font-mono`}>{item.tax_rate}%</td>
                  <td className={`${isRtl ? 'text-start' : 'text-end'} px-4 py-3 font-bold text-gray-900 font-mono`}>{fmt(Number(item.line_total), company.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals & QR Bottom */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 mb-6">
          <div className="flex items-center gap-4">
            {custom.qrPosition === 'footer' && (data.zatca_qr_data || (data as any).qr_code_data) && (
              <div className="p-2 bg-gray-50 rounded-xl border border-gray-200">
                <ZatcaQrCode qrData={data.zatca_qr_data || (data as any).qr_code_data || ''} size={90} />
              </div>
            )}
            {data.zatca_clearance_status && (
              <ZatcaClearanceBadge status={data.zatca_clearance_status} />
            )}
          </div>

          <div className="w-full sm:w-72 space-y-1.5 text-xs">
            <div className="flex justify-between text-gray-600 py-1">
              <span>{t('invoices.subtotal')}</span>
              <span className="font-semibold text-gray-800 font-mono">{fmt(Number(data.subtotal), company.currency)}</span>
            </div>
            {data.discount_total > 0 && (
              <div className="flex justify-between text-orange-600 py-1 font-medium">
                <span>{t('invoices.discount')}</span>
                <span className="font-mono">- {fmt(Number(data.discount_total), company.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600 py-1 border-b border-gray-200 pb-2">
              <span>{t('invoices.vat')}</span>
              <span className="font-semibold text-gray-800 font-mono">{fmt(Number(data.tax_total), company.currency)}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 px-3.5 rounded-xl text-white font-bold text-sm" style={{ backgroundColor: a.solid }}>
              <span>{t('invoices.total')}</span>
              <span className="font-mono text-base">{fmt(Number(data.total), company.currency)}</span>
            </div>
          </div>
        </div>

        <NotesTermsBlock data={data} t={t} custom={custom} />
        <SignatureStampBox custom={custom} isRtl={isRtl} />
      </div>
    </div>
  );
}

// ─── 2. Modern Accent Template ────────────────────────────────────────────────

function ModernTemplate({ data, lang, fmt, fmtDate, t, customizationOverride }: InvoiceTemplateProps) {
  const { company, customer, items } = data;
  const custom = customizationOverride || getInvoiceCustomization(company as any);
  const isRtl = lang === 'ar';
  const customerName = isRtl ? (customer?.name_ar || customer?.name) : customer?.name;
  const companyName = isRtl ? (company.name_ar || company.name) : company.name;
  const a = accent(custom.primaryColor || company.primary_color);
  const fontClass = resolveFontClass(custom.fontFamily, isRtl);
  const fontSizeClass = resolveFontSizeClass(custom.fontSize);

  return (
    <div className={`bg-white text-gray-900 ${fontClass} ${fontSizeClass} p-8 sm:p-12`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <CompanyLogo company={company} custom={custom} solidColor={a.solid} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{companyName}</h1>
            {custom.showTaxNumber && company.tax_number && (
              <p className="text-xs text-gray-500 font-mono">{t('invoices.vatNumber')}: {company.tax_number}</p>
            )}
          </div>
        </div>
        <div className={isRtl ? 'text-start' : 'text-end'}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-2 text-white" style={{ backgroundColor: a.solid }}>
            {t('invoices.invoiceOf')} #{data.number}
          </div>
          <p className="text-xs text-gray-500">{fmtDate(data.issue_date)}</p>
          {custom.showStatusBadge && (
            <div className="mt-2">
              <StatusChip status={data.status} t={t} />
            </div>
          )}
        </div>
      </div>

      {/* Addresses Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">{isRtl ? 'من:' : 'From:'}</p>
          <p className="text-sm font-bold text-gray-800">{companyName}</p>
          {custom.showAddress && company.address && <p className="text-xs text-gray-500 mt-1">{company.address}</p>}
          {custom.showPhone && company.phone && <p className="text-xs text-gray-500">{company.phone}</p>}
        </div>
        <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">{isRtl ? 'إلى:' : 'Bill To:'}</p>
          <p className="text-sm font-bold text-gray-800">{customerName || '—'}</p>
          {custom.showAddress && customer?.address && <p className="text-xs text-gray-500 mt-1">{customer.address}</p>}
          {custom.showTaxNumber && customer?.tax_number && (
            <p className="text-xs text-gray-600 font-mono mt-1">{t('invoices.vatNumber')}: {customer.tax_number}</p>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className={`${isRtl ? 'text-end' : 'text-start'} py-3 text-gray-500 font-bold uppercase`}>{t('invoices.itemDescription')}</th>
              <th className="py-3 text-center text-gray-500 font-bold uppercase w-16">{t('invoices.itemQuantity')}</th>
              <th className={`${isRtl ? 'text-start' : 'text-end'} py-3 text-gray-500 font-bold uppercase`}>{t('invoices.itemPrice')}</th>
              <th className={`${isRtl ? 'text-start' : 'text-end'} py-3 text-gray-500 font-bold uppercase`}>{t('invoices.itemTotal')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className={`${isRtl ? 'text-end' : 'text-start'} py-3.5 text-gray-800 font-medium`}>{item.description}</td>
                <td className="py-3.5 text-center text-gray-600 font-mono">{item.quantity}</td>
                <td className={`${isRtl ? 'text-start' : 'text-end'} py-3.5 text-gray-600 font-mono`}>{fmt(Number(item.unit_price), company.currency)}</td>
                <td className={`${isRtl ? 'text-start' : 'text-end'} py-3.5 font-bold text-gray-900 font-mono`}>{fmt(Number(item.line_total), company.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals Box */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t border-gray-200 pt-6">
        <div>
          {custom.qrPosition !== 'hide' && (data.zatca_qr_data || (data as any).qr_code_data) && (
            <div className="p-2 border border-gray-200 rounded-xl inline-block bg-white shadow-xs">
              <ZatcaQrCode qrData={data.zatca_qr_data || (data as any).qr_code_data || ''} size={84} />
            </div>
          )}
        </div>
        <div className="w-full sm:w-64 space-y-2 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>{t('invoices.subtotal')}</span>
            <span className="font-mono font-semibold">{fmt(Number(data.subtotal), company.currency)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>{t('invoices.vat')}</span>
            <span className="font-mono font-semibold">{fmt(Number(data.tax_total), company.currency)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200" style={{ color: a.solid }}>
            <span>{t('invoices.total')}</span>
            <span className="font-mono text-base">{fmt(Number(data.total), company.currency)}</span>
          </div>
        </div>
      </div>

      <NotesTermsBlock data={data} t={t} custom={custom} />
      <SignatureStampBox custom={custom} isRtl={isRtl} />
    </div>
  );
}

// ─── 3. Saudi ZATCA Professional Bilingual Template ──────────────────────────

function SaudiProfessionalTemplate({ data, lang, fmt, fmtDate, t, customizationOverride }: InvoiceTemplateProps) {
  const { company, customer, items } = data;
  const custom = customizationOverride || getInvoiceCustomization(company as any);
  const isRtl = lang === 'ar';
  const a = accent(custom.primaryColor || company.primary_color || '#16a34a');
  const fontClass = resolveFontClass(custom.fontFamily, isRtl);
  const fontSizeClass = resolveFontSizeClass(custom.fontSize);

  const qrData = data.zatca_qr_data || (data as any).qr_code_data || '';

  return (
    <div className={`bg-white text-gray-900 ${fontClass} ${fontSizeClass} p-8 sm:p-12 border border-gray-200`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pb-6 border-b-2 border-gray-900">
        <div className="flex items-center gap-4">
          <CompanyLogo company={company} custom={custom} solidColor={a.solid} />
          <div>
            <h1 className="text-xl font-black text-gray-900">{company.name_ar || company.name}</h1>
            <p className="text-xs text-gray-600">{company.name}</p>
          </div>
        </div>
        <div className="text-center sm:text-end">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">فاتورة ضريبية</h2>
          <p className="text-xs font-bold text-gray-600 tracking-widest uppercase">TAX INVOICE</p>
          <div className="mt-2 text-xs font-mono font-bold">
            <span>{data.number}</span>
          </div>
        </div>
      </div>

      {/* Tax & National Address Grid (ZATCA Requirement) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6 text-xs">
        {/* Seller Info */}
        <div className="p-4 rounded-lg border border-gray-300 bg-gray-50/70">
          <p className="font-bold text-gray-900 border-b border-gray-200 pb-1 mb-2">
            بيانات المورد / Seller Details
          </p>
          <div className="space-y-1">
            <p><span className="text-gray-500">الاسم / Name:</span> <span className="font-semibold">{company.name_ar || company.name}</span></p>
            {company.tax_number && (
              <p><span className="text-gray-500">الرقم الضريبي / VAT No:</span> <span className="font-mono font-bold">{company.tax_number}</span></p>
            )}
            {company.commercial_registration && (
              <p><span className="text-gray-500">السجل التجاري / CR No:</span> <span className="font-mono">{company.commercial_registration}</span></p>
            )}
            {company.address && (
              <p><span className="text-gray-500">العنوان / Address:</span> {company.address}</p>
            )}
          </div>
        </div>

        {/* Buyer Info */}
        <div className="p-4 rounded-lg border border-gray-300 bg-gray-50/70">
          <p className="font-bold text-gray-900 border-b border-gray-200 pb-1 mb-2">
            بيانات العميل / Buyer Details
          </p>
          <div className="space-y-1">
            <p><span className="text-gray-500">الاسم / Name:</span> <span className="font-semibold">{customer?.name_ar || customer?.name || '—'}</span></p>
            {customer?.tax_number ? (
              <p><span className="text-gray-500">الرقم الضريبي / VAT No:</span> <span className="font-mono font-bold">{customer.tax_number}</span></p>
            ) : (
              <p className="text-gray-400 text-[11px]">عميل أفراد / Individual (B2C)</p>
            )}
            {customer?.address && (
              <p><span className="text-gray-500">العنوان / Address:</span> {customer.address}</p>
            )}
          </div>
        </div>
      </div>

      {/* Dates & Status Strip */}
      <div className="flex flex-wrap justify-between items-center gap-4 px-4 py-2.5 rounded-lg bg-gray-100 text-xs mb-6 font-medium">
        <div><span className="text-gray-500">تاريخ الإصدار / Issue Date:</span> <span className="font-mono font-bold">{fmtDate(data.issue_date)}</span></div>
        <div><span className="text-gray-500">تاريخ الاستحقاق / Due Date:</span> <span className="font-mono font-bold">{fmtDate(data.due_date)}</span></div>
        {custom.showStatusBadge && <StatusChip status={data.status} t={t} />}
      </div>

      {/* ZATCA Compliant Items Table */}
      <div className="overflow-x-auto mb-6 border border-gray-300 rounded-lg">
        <table className="w-full text-xs">
          <thead className="bg-gray-100 border-b border-gray-300 font-bold text-gray-800">
            <tr>
              <th className="px-3 py-2.5 text-start">البند / Description</th>
              <th className="px-2 py-2.5 text-center w-14">الكمية<br/>Qty</th>
              <th className="px-2 py-2.5 text-end">سعر الوحدة<br/>Unit Price</th>
              <th className="px-2 py-2.5 text-end">الخصم<br/>Discount</th>
              <th className="px-2 py-2.5 text-end">نسبة الضريبة<br/>VAT %</th>
              <th className="px-3 py-2.5 text-end">المجموع شامل الضريبة<br/>Total (Inc. VAT)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, idx) => (
              <tr key={item.id || idx}>
                <td className="px-3 py-2.5 font-medium text-gray-900">{item.description}</td>
                <td className="px-2 py-2.5 text-center font-mono">{item.quantity}</td>
                <td className="px-2 py-2.5 text-end font-mono">{fmt(Number(item.unit_price), company.currency)}</td>
                <td className="px-2 py-2.5 text-end font-mono text-orange-600">{item.discount > 0 ? `${item.discount}%` : '0%'}</td>
                <td className="px-2 py-2.5 text-end font-mono">{item.tax_rate}%</td>
                <td className="px-3 py-2.5 text-end font-bold font-mono text-gray-900">{fmt(Number(item.line_total), company.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals & ZATCA QR Code */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 border-t-2 border-gray-900 pt-6">
        <div className="flex items-center gap-4">
          {qrData ? (
            <div className="p-2 border-2 border-gray-900 rounded-lg bg-white">
              <ZatcaQrCode qrData={qrData} size={110} />
            </div>
          ) : null}
          <div className="text-[11px] text-gray-500 max-w-xs">
            <p className="font-bold text-gray-800">فاتورة إلكترونية معتمدة</p>
            <p>Compliant with ZATCA Phase 2 E-Invoicing Regulations in KSA.</p>
          </div>
        </div>

        <div className="w-full sm:w-72 space-y-1.5 text-xs">
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span className="text-gray-600">المجموع الفرعي (غير شامل الضريبة)</span>
            <span className="font-mono font-bold">{fmt(Number(data.subtotal), company.currency)}</span>
          </div>
          {data.discount_total > 0 && (
            <div className="flex justify-between py-1 text-orange-600 border-b border-gray-200">
              <span>إجمالي الخصم / Discount</span>
              <span className="font-mono font-bold">- {fmt(Number(data.discount_total), company.currency)}</span>
            </div>
          )}
          <div className="flex justify-between py-1 border-b border-gray-200">
            <span className="text-gray-600">ضريبة القيمة المضافة / VAT 15%</span>
            <span className="font-mono font-bold">{fmt(Number(data.tax_total), company.currency)}</span>
          </div>
          <div className="flex justify-between py-2 bg-gray-900 text-white px-3 rounded-lg font-bold text-sm">
            <span>الإجمالي المستحق / Total Due</span>
            <span className="font-mono text-base">{fmt(Number(data.total), company.currency)}</span>
          </div>
        </div>
      </div>

      <NotesTermsBlock data={data} t={t} custom={custom} />
      <SignatureStampBox custom={custom} isRtl={isRtl} />
    </div>
  );
}

// ─── 4. Minimalist Clean Template ─────────────────────────────────────────────

function MinimalTemplate({ data, lang, fmt, fmtDate, t, customizationOverride }: InvoiceTemplateProps) {
  const { company, customer, items } = data;
  const custom = customizationOverride || getInvoiceCustomization(company as any);
  const isRtl = lang === 'ar';
  const customerName = isRtl ? (customer?.name_ar || customer?.name) : customer?.name;
  const companyName = isRtl ? (company.name_ar || company.name) : company.name;
  const a = accent(custom.primaryColor || company.primary_color);
  const fontClass = resolveFontClass(custom.fontFamily, isRtl);
  const fontSizeClass = resolveFontSizeClass(custom.fontSize);

  return (
    <div className={`bg-white text-gray-900 ${fontClass} ${fontSizeClass} px-8 sm:px-14 py-12`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="flex justify-between items-start mb-12">
        <div>
          <CompanyLogo company={company} custom={custom} solidColor={a.solid} />
          <h1 className="text-lg font-light text-gray-800 tracking-wide mt-3">{companyName}</h1>
        </div>
        <div className={isRtl ? 'text-start' : 'text-end'}>
          <p className="text-2xl font-light text-gray-400 tracking-widest uppercase">Invoice</p>
          <p className="font-mono text-sm text-gray-700 mt-1">{data.number}</p>
          <p className="text-xs text-gray-400 mt-1">{fmtDate(data.issue_date)}</p>
        </div>
      </div>

      <div className="mb-8 text-xs text-gray-500">
        <p className="uppercase tracking-widest text-[10px] text-gray-400 mb-1">{isRtl ? 'إلى العميل' : 'Billed To'}</p>
        <p className="text-sm font-medium text-gray-900">{customerName || '—'}</p>
        {custom.showAddress && customer?.address && <p className="mt-0.5">{customer.address}</p>}
      </div>

      <table className="w-full text-xs mb-8">
        <thead>
          <tr className="border-b border-gray-200 text-gray-400 uppercase tracking-widest text-[10px]">
            <th className={`${isRtl ? 'text-end' : 'text-start'} py-2`}>Item</th>
            <th className="py-2 text-center w-16">Qty</th>
            <th className={`${isRtl ? 'text-start' : 'text-end'} py-2`}>Price</th>
            <th className={`${isRtl ? 'text-start' : 'text-end'} py-2`}>Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((i, idx) => (
            <tr key={i.id || idx}>
              <td className={`${isRtl ? 'text-end' : 'text-start'} py-3 text-gray-700`}>{i.description}</td>
              <td className="py-3 text-center text-gray-500 font-mono">{i.quantity}</td>
              <td className={`${isRtl ? 'text-start' : 'text-end'} py-3 text-gray-500 font-mono`}>{fmt(Number(i.unit_price), company.currency)}</td>
              <td className={`${isRtl ? 'text-start' : 'text-end'} py-3 font-medium text-gray-900 font-mono`}>{fmt(Number(i.line_total), company.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <div className="w-56 space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span className="font-mono">{fmt(Number(data.subtotal), company.currency)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Tax</span>
            <span className="font-mono">{fmt(Number(data.tax_total), company.currency)}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-gray-900 pt-2 border-t border-gray-200">
            <span>Total</span>
            <span className="font-mono">{fmt(Number(data.total), company.currency)}</span>
          </div>
        </div>
      </div>

      <NotesTermsBlock data={data} t={t} custom={custom} />
      <SignatureStampBox custom={custom} isRtl={isRtl} />
    </div>
  );
}

// ─── 5. Corporate Executive Template (NEW) ────────────────────────────────────

function CorporateTemplate({ data, lang, fmt, fmtDate, t, customizationOverride }: InvoiceTemplateProps) {
  const { company, customer, items } = data;
  const custom = customizationOverride || getInvoiceCustomization(company as any);
  const isRtl = lang === 'ar';
  const customerName = isRtl ? (customer?.name_ar || customer?.name) : customer?.name;
  const companyName = isRtl ? (company.name_ar || company.name) : company.name;
  const a = accent(custom.primaryColor || '#1e293b');
  const fontClass = resolveFontClass(custom.fontFamily, isRtl);
  const fontSizeClass = resolveFontSizeClass(custom.fontSize);

  return (
    <div className={`bg-white text-gray-900 ${fontClass} ${fontSizeClass}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Executive Dark Header Banner */}
      <div className="bg-slate-900 text-white p-8 sm:p-10">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
          <div className="flex items-center gap-4">
            <CompanyLogo company={company} custom={custom} solidColor="#3b82f6" />
            <div>
              <h1 className="text-2xl font-black tracking-tight">{companyName}</h1>
              {custom.showTaxNumber && company.tax_number && (
                <p className="text-xs text-slate-300 font-mono mt-1">VAT: {company.tax_number}</p>
              )}
            </div>
          </div>
          <div className={isRtl ? 'text-start' : 'text-end'}>
            <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">{t('invoices.invoiceOf')}</p>
            <p className="text-2xl font-bold font-mono text-white mt-0.5">{data.number}</p>
            <p className="text-xs text-slate-300 mt-1">{t('invoices.issueDate')}: {fmtDate(data.issue_date)}</p>
          </div>
        </div>
      </div>

      <div className="p-8 sm:p-10">
        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 p-4 rounded-xl bg-slate-50 border border-slate-200 mb-8 text-xs">
          <div>
            <p className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mb-1">{t('invoices.billTo')}</p>
            <p className="font-bold text-slate-900 text-sm">{customerName || '—'}</p>
            {custom.showAddress && customer?.address && <p className="text-slate-600 mt-1">{customer.address}</p>}
            {custom.showTaxNumber && customer?.tax_number && <p className="text-slate-700 font-mono mt-1">VAT: {customer.tax_number}</p>}
          </div>
          <div>
            <p className="font-bold text-slate-500 uppercase tracking-wider text-[11px] mb-1">{isRtl ? 'تفاصيل السداد' : 'Payment Details'}</p>
            <p className="text-slate-700"><span className="text-slate-500">{t('invoices.dueDate')}:</span> <span className="font-mono font-bold">{fmtDate(data.due_date)}</span></p>
            <p className="text-slate-700 mt-1"><span className="text-slate-500">{isRtl ? 'الحالة' : 'Status'}:</span> <span className="font-bold">{t(`status.${data.status}`) || data.status}</span></p>
          </div>
          <div className="flex flex-col items-start sm:items-end justify-center">
            {custom.qrPosition !== 'hide' && (data.zatca_qr_data || (data as any).qr_code_data) && (
              <ZatcaQrCode qrData={data.zatca_qr_data || (data as any).qr_code_data || ''} size={76} />
            )}
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-xs mb-8">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold uppercase border-y border-slate-200">
              <th className={`${isRtl ? 'text-end' : 'text-start'} px-4 py-3`}>{t('invoices.itemDescription')}</th>
              <th className="px-3 py-3 text-center w-16">{t('invoices.itemQuantity')}</th>
              <th className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3`}>{t('invoices.itemPrice')}</th>
              <th className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3`}>{t('invoices.itemTax')}</th>
              <th className={`${isRtl ? 'text-start' : 'text-end'} px-4 py-3`}>{t('invoices.itemTotal')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, idx) => (
              <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                <td className={`${isRtl ? 'text-end' : 'text-start'} px-4 py-3 font-medium text-slate-800`}>{item.description}</td>
                <td className="px-3 py-3 text-center font-mono text-slate-600">{item.quantity}</td>
                <td className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3 font-mono text-slate-600`}>{fmt(Number(item.unit_price), company.currency)}</td>
                <td className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3 font-mono text-slate-600`}>{item.tax_rate}%</td>
                <td className={`${isRtl ? 'text-start' : 'text-end'} px-4 py-3 font-bold font-mono text-slate-900`}>{fmt(Number(item.line_total), company.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Summary */}
        <div className="flex justify-end mb-6">
          <div className="w-72 border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="p-3 bg-slate-50 flex justify-between border-b border-slate-200">
              <span className="text-slate-600">{t('invoices.subtotal')}</span>
              <span className="font-mono font-bold text-slate-800">{fmt(Number(data.subtotal), company.currency)}</span>
            </div>
            <div className="p-3 bg-slate-50 flex justify-between border-b border-slate-200">
              <span className="text-slate-600">{t('invoices.vat')}</span>
              <span className="font-mono font-bold text-slate-800">{fmt(Number(data.tax_total), company.currency)}</span>
            </div>
            <div className="p-3 bg-slate-900 text-white flex justify-between font-bold text-sm">
              <span>{t('invoices.total')}</span>
              <span className="font-mono text-base">{fmt(Number(data.total), company.currency)}</span>
            </div>
          </div>
        </div>

        <NotesTermsBlock data={data} t={t} custom={custom} />
        <SignatureStampBox custom={custom} isRtl={isRtl} />
      </div>
    </div>
  );
}

// ─── 6. Emerald Business Template (NEW) ───────────────────────────────────────

function EmeraldTemplate({ data, lang, fmt, fmtDate, t, customizationOverride }: InvoiceTemplateProps) {
  const { company, customer, items } = data;
  const custom = customizationOverride || getInvoiceCustomization(company as any);
  const isRtl = lang === 'ar';
  const customerName = isRtl ? (customer?.name_ar || customer?.name) : customer?.name;
  const companyName = isRtl ? (company.name_ar || company.name) : company.name;
  const a = accent(custom.primaryColor || '#059669');
  const fontClass = resolveFontClass(custom.fontFamily, isRtl);
  const fontSizeClass = resolveFontSizeClass(custom.fontSize);

  return (
    <div className={`bg-white text-gray-900 ${fontClass} ${fontSizeClass} p-8 sm:p-12`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Top emerald badge and details */}
      <div className="flex justify-between items-start pb-6 border-b border-emerald-100">
        <div>
          <CompanyLogo company={company} custom={custom} solidColor="#059669" />
          <h1 className="text-xl font-black text-gray-900 mt-3">{companyName}</h1>
          {custom.showTaxNumber && company.tax_number && (
            <p className="text-xs text-emerald-700 font-semibold font-mono mt-1">VAT: {company.tax_number}</p>
          )}
        </div>
        <div className={isRtl ? 'text-start' : 'text-end'}>
          <span className="inline-block bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
            {t('invoices.invoiceOf')}
          </span>
          <p className="text-2xl font-black font-mono text-gray-900">{data.number}</p>
          <p className="text-xs text-gray-500 mt-1">{fmtDate(data.issue_date)}</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="my-6 p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/60 text-xs">
        <p className="text-emerald-800 font-bold uppercase text-[11px] mb-1">{t('invoices.billTo')}</p>
        <p className="text-sm font-bold text-gray-900">{customerName || '—'}</p>
        {custom.showAddress && customer?.address && <p className="text-gray-600 mt-0.5">{customer.address}</p>}
        {custom.showTaxNumber && customer?.tax_number && (
          <p className="text-emerald-700 font-mono mt-1 font-semibold">VAT: {customer.tax_number}</p>
        )}
      </div>

      {/* Items Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-emerald-600 text-white font-bold">
              <th className={`${isRtl ? 'text-end' : 'text-start'} px-4 py-3 rounded-s-lg`}>{t('invoices.itemDescription')}</th>
              <th className="px-3 py-3 text-center w-16">Qty</th>
              <th className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3`}>Price</th>
              <th className={`${isRtl ? 'text-start' : 'text-end'} px-4 py-3 rounded-e-lg`}>Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((i, idx) => (
              <tr key={i.id || idx}>
                <td className={`${isRtl ? 'text-end' : 'text-start'} px-4 py-3 font-medium text-gray-800`}>{i.description}</td>
                <td className="px-3 py-3 text-center font-mono text-gray-600">{i.quantity}</td>
                <td className={`${isRtl ? 'text-start' : 'text-end'} px-3 py-3 font-mono text-gray-600`}>{fmt(Number(i.unit_price), company.currency)}</td>
                <td className={`${isRtl ? 'text-start' : 'text-end'} px-4 py-3 font-bold font-mono text-gray-900`}>{fmt(Number(i.line_total), company.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals & QR */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-4 border-t border-gray-100">
        <div>
          {custom.qrPosition !== 'hide' && (data.zatca_qr_data || (data as any).qr_code_data) && (
            <div className="p-2 border border-emerald-200 rounded-xl bg-emerald-50/30">
              <ZatcaQrCode qrData={data.zatca_qr_data || (data as any).qr_code_data || ''} size={84} />
            </div>
          )}
        </div>
        <div className="w-full sm:w-64 space-y-1.5 text-xs">
          <div className="flex justify-between text-gray-600">
            <span>{t('invoices.subtotal')}</span>
            <span className="font-mono font-semibold">{fmt(Number(data.subtotal), company.currency)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>{t('invoices.vat')}</span>
            <span className="font-mono font-semibold">{fmt(Number(data.tax_total), company.currency)}</span>
          </div>
          <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-600 text-white font-bold text-sm">
            <span>{t('invoices.total')}</span>
            <span className="font-mono text-base">{fmt(Number(data.total), company.currency)}</span>
          </div>
        </div>
      </div>

      <NotesTermsBlock data={data} t={t} custom={custom} />
      <SignatureStampBox custom={custom} isRtl={isRtl} />
    </div>
  );
}

// ─── 7. Compact Retail / Thermal POS Template (NEW) ───────────────────────────

function CompactRetailTemplate({ data, lang, fmt, fmtDate, t, customizationOverride }: InvoiceTemplateProps) {
  const { company, customer, items } = data;
  const custom = customizationOverride || getInvoiceCustomization(company as any);
  const isRtl = lang === 'ar';
  const customerName = isRtl ? (customer?.name_ar || customer?.name) : customer?.name;
  const companyName = isRtl ? (company.name_ar || company.name) : company.name;
  const fontClass = resolveFontClass(custom.fontFamily, isRtl);

  return (
    <div className={`bg-white text-gray-900 ${fontClass} text-xs p-6 max-w-xl mx-auto border border-dashed border-gray-300 font-mono`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="text-center pb-4 border-b border-dashed border-gray-300">
        <div className="flex justify-center mb-2">
          <CompanyLogo company={company} custom={custom} solidColor="#111827" />
        </div>
        <p className="text-base font-black text-gray-900">{companyName}</p>
        {custom.showTaxNumber && company.tax_number && (
          <p className="text-[11px] text-gray-600">VAT: {company.tax_number}</p>
        )}
        <p className="text-[11px] text-gray-500 mt-1">{t('invoices.invoiceOf')} #{data.number}</p>
        <p className="text-[11px] text-gray-500">{fmtDate(data.issue_date)}</p>
      </div>

      {/* Customer Info */}
      {customer && (
        <div className="py-2 border-b border-dashed border-gray-300 text-[11px]">
          <p><span className="text-gray-500">{t('invoices.billTo')}:</span> {customerName}</p>
          {custom.showTaxNumber && customer.tax_number && <p><span className="text-gray-500">VAT:</span> {customer.tax_number}</p>}
        </div>
      )}

      {/* Items list */}
      <div className="py-3 border-b border-dashed border-gray-300 space-y-2">
        {items.map((i, idx) => (
          <div key={i.id || idx} className="flex justify-between items-center text-[11px]">
            <div className="flex-1 pe-2">
              <p className="font-bold text-gray-800">{i.description}</p>
              <p className="text-gray-500">{i.quantity} x {fmt(Number(i.unit_price), company.currency)}</p>
            </div>
            <span className="font-bold text-gray-900">{fmt(Number(i.line_total), company.currency)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="py-3 border-b border-dashed border-gray-300 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('invoices.subtotal')}</span>
          <span>{fmt(Number(data.subtotal), company.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('invoices.vat')}</span>
          <span>{fmt(Number(data.tax_total), company.currency)}</span>
        </div>
        <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-200">
          <span>{t('invoices.total')}</span>
          <span>{fmt(Number(data.total), company.currency)}</span>
        </div>
      </div>

      {/* QR Code in center */}
      {(data.zatca_qr_data || (data as any).qr_code_data) && (
        <div className="flex justify-center py-4">
          <ZatcaQrCode qrData={data.zatca_qr_data || (data as any).qr_code_data || ''} size={96} />
        </div>
      )}

      <p className="text-center text-[10px] text-gray-400 mt-2">
        {isRtl ? 'شكراً لزيارتكم' : 'Thank you for your visit.'}
      </p>
    </div>
  );
}

// ─── 8. Creative Tech & Slate Template (NEW) ──────────────────────────────────

function CreativeTechTemplate({ data, lang, fmt, fmtDate, t, customizationOverride }: InvoiceTemplateProps) {
  const { company, customer, items } = data;
  const custom = customizationOverride || getInvoiceCustomization(company as any);
  const isRtl = lang === 'ar';
  const customerName = isRtl ? (customer?.name_ar || customer?.name) : customer?.name;
  const companyName = isRtl ? (company.name_ar || company.name) : company.name;
  const a = accent(custom.primaryColor || '#7c3aed');
  const fontClass = resolveFontClass(custom.fontFamily, isRtl);
  const fontSizeClass = resolveFontSizeClass(custom.fontSize);

  return (
    <div className={`bg-white text-gray-900 ${fontClass} ${fontSizeClass} p-8 sm:p-12`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Tech Header with Gradient Border */}
      <div className="p-6 rounded-2xl bg-slate-900 text-white mb-8 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
          <div className="flex items-center gap-4">
            <CompanyLogo company={company} custom={custom} solidColor="#7c3aed" />
            <div>
              <p className="text-xs uppercase tracking-widest text-purple-400 font-mono font-bold">INVOICE</p>
              <h1 className="text-xl font-bold tracking-tight text-white mt-0.5">{companyName}</h1>
            </div>
          </div>
          <div className={isRtl ? 'text-start' : 'text-end'}>
            <span className="font-mono text-purple-300 text-xs bg-purple-950/60 px-3 py-1 rounded-md border border-purple-800/50">
              #{data.number}
            </span>
            <p className="text-xs text-slate-400 mt-2">{fmtDate(data.issue_date)}</p>
          </div>
        </div>
      </div>

      {/* Metadata Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 text-xs">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
          <p className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-1">{t('invoices.billTo')}</p>
          <p className="text-sm font-bold text-slate-800">{customerName || '—'}</p>
          {custom.showAddress && customer?.address && <p className="text-slate-600 mt-1">{customer.address}</p>}
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex justify-between items-center">
          <div>
            <p className="text-slate-400 uppercase tracking-widest text-[10px] font-bold mb-1">{isRtl ? 'تاريخ الاستحقاق' : 'Payment Due'}</p>
            <p className="text-sm font-bold text-slate-800">{fmtDate(data.due_date)}</p>
          </div>
          {custom.qrPosition !== 'hide' && (data.zatca_qr_data || (data as any).qr_code_data) && (
            <ZatcaQrCode qrData={data.zatca_qr_data || (data as any).qr_code_data || ''} size={64} />
          )}
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-xs mb-8">
        <thead>
          <tr className="border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
            <th className={`${isRtl ? 'text-end' : 'text-start'} py-3`}>{t('invoices.itemDescription')}</th>
            <th className="py-3 text-center w-16">Qty</th>
            <th className={`${isRtl ? 'text-start' : 'text-end'} py-3`}>Rate</th>
            <th className={`${isRtl ? 'text-start' : 'text-end'} py-3`}>Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((i, idx) => (
            <tr key={i.id || idx}>
              <td className={`${isRtl ? 'text-end' : 'text-start'} py-3.5 font-medium text-slate-800`}>{i.description}</td>
              <td className="py-3.5 text-center font-mono text-slate-600">{i.quantity}</td>
              <td className={`${isRtl ? 'text-start' : 'text-end'} py-3.5 font-mono text-slate-600`}>{fmt(Number(i.unit_price), company.currency)}</td>
              <td className={`${isRtl ? 'text-start' : 'text-end'} py-3.5 font-bold font-mono text-slate-900`}>{fmt(Number(i.line_total), company.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end pt-4 border-t border-slate-200">
        <div className="w-64 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="font-mono font-semibold">{fmt(Number(data.subtotal), company.currency)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>VAT</span>
            <span className="font-mono font-semibold">{fmt(Number(data.tax_total), company.currency)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-purple-700 pt-2 border-t border-slate-200">
            <span>Total Due</span>
            <span className="font-mono text-base">{fmt(Number(data.total), company.currency)}</span>
          </div>
        </div>
      </div>

      <NotesTermsBlock data={data} t={t} custom={custom} />
      <SignatureStampBox custom={custom} isRtl={isRtl} />
    </div>
  );
}

// ─── Shared Notes / Terms Block ───────────────────────────────────────────────

function NotesTermsBlock({
  data,
  t,
  custom,
}: {
  data: InvoiceRenderData;
  t: (k: string) => string;
  custom?: InvoiceCustomization;
}) {
  const showNotes = custom ? custom.showNotes : true;
  const showTerms = custom ? custom.showTerms : true;

  if ((!data.notes || !showNotes) && (!data.terms || !showTerms)) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100 text-xs">
      {data.notes && showNotes && (
        <div>
          <p className="font-bold uppercase tracking-wider text-[11px] text-gray-400 mb-1">{t('invoices.notes')}</p>
          <p className="text-gray-600 leading-relaxed whitespace-pre-line">{data.notes}</p>
        </div>
      )}
      {data.terms && showTerms && (
        <div>
          <p className="font-bold uppercase tracking-wider text-[11px] text-gray-400 mb-1">{t('invoices.terms')}</p>
          <p className="text-gray-600 leading-relaxed whitespace-pre-line">{data.terms}</p>
        </div>
      )}
    </div>
  );
}

// ─── Exported Template Switcher ───────────────────────────────────────────────

export function InvoiceTemplate(props: InvoiceTemplateProps) {
  const custom = props.customizationOverride || (props.data as any).customization || getInvoiceCustomization(props.data.company as any);
  const template = custom?.template || props.data.template || 'classic';

  const extendedProps: InvoiceTemplateProps = {
    ...props,
    customizationOverride: custom,
  };

  switch (template) {
    case 'modern':
      return <ModernTemplate {...extendedProps} />;
    case 'saudi_professional':
      return <SaudiProfessionalTemplate {...extendedProps} />;
    case 'minimal':
      return <MinimalTemplate {...extendedProps} />;
    case 'corporate':
      return <CorporateTemplate {...extendedProps} />;
    case 'emerald':
      return <EmeraldTemplate {...extendedProps} />;
    case 'compact_retail':
      return <CompactRetailTemplate {...extendedProps} />;
    case 'creative_tech':
      return <CreativeTechTemplate {...extendedProps} />;
    case 'classic':
    default:
      return <ClassicTemplate {...extendedProps} />;
  }
}
