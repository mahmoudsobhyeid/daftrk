import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useCurrency, useFormatDate } from '../lib/format';
import { Button } from './ui/Button';
import { Spinner } from './ui/Feedback';
import { InvoiceTemplate } from './InvoiceTemplate';
import { ZatcaInfoPanel } from './zatca/ZatcaStatus';
import { ReturnModal } from './ReturnModal';
import { ReturnsSection } from './ReturnsSection';
import { issueZatcaInvoice, regenerateZatcaData } from '../lib/zatca/invoice-service';
import { exportElementToPdf } from '../lib/pdf-export';
import { buildInvoiceRenderData, INVOICE_PDF_SELECT } from '../lib/invoice-render';
import {
  ArrowLeft, Printer, Pencil, Copy, Link2, Download,
  LayoutTemplate, Check, Zap, Lock, RotateCcw,
} from 'lucide-react';
import type { InvoiceWithDetails, InvoiceRenderData } from '../lib/types';

interface InvoiceViewProps {
  invoiceId: string;
  onBack: () => void;
  onEdit: () => void;
  onDuplicate?: (id: string) => void;
  onRefund?: () => void;
}

import { getInvoiceCustomization } from '../lib/invoice-customization';

const TEMPLATES = [
  'classic',
  'modern',
  'saudi_professional',
  'minimal',
  'corporate',
  'emerald',
  'compact_retail',
  'creative_tech',
] as const;

const TEMPLATE_LABELS: Record<string, { en: string; ar: string }> = {
  classic: { en: 'Classic', ar: 'الكلاسيكي' },
  modern: { en: 'Modern', ar: 'العصري' },
  saudi_professional: { en: 'Saudi ZATCA', ar: 'السعودي ZATCA' },
  minimal: { en: 'Minimal', ar: 'البسيط' },
  corporate: { en: 'Corporate Executive', ar: 'المؤسسي الفاخر' },
  emerald: { en: 'Emerald Business', ar: 'الزمردي التجاري' },
  compact_retail: { en: 'Compact POS', ar: 'المدمج كاشير' },
  creative_tech: { en: 'Tech Slate', ar: 'التقني الحديث' },
};

export function InvoiceView({ invoiceId, onBack, onEdit, onDuplicate, onRefund }: InvoiceViewProps) {
  const { t, lang } = useLanguage();
  const { company } = useCompany();
  const fmt = useCurrency();
  const fmtDate = useFormatDate();
  const { toast } = useToast();

  const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState('classic');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnsRefreshKey, setReturnsRefreshKey] = useState(0);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const loadInvoice = async () => {
    if (!invoiceId) return;
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select(INVOICE_PDF_SELECT)
      .eq('id', invoiceId)
      .maybeSingle();
    const inv = data as InvoiceWithDetails | null;
    setInvoice(inv);
    if (inv?.template) {
      setActiveTemplate(inv.template);
    } else if (company) {
      const custom = getInvoiceCustomization(company);
      setActiveTemplate(custom.template || 'classic');
    }
    setLoading(false);
  };

  useEffect(() => { loadInvoice(); }, [invoiceId]);

  const handlePrint = () => { window.print(); };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('invoice-print-area');
    if (!el) {
      toast(lang === 'ar' ? 'تعذر العثور على منطقة طباعة الفاتورة' : 'Invoice print area not found', 'error');
      return;
    }
    setDownloadingPdf(true);
    try {
      const fileName = `${invoice?.number || 'invoice'}.pdf`;
      await exportElementToPdf(el, {
        filename: fileName,
        marginMm: [8, 8, 8, 8],
      });
      toast(lang === 'ar' ? 'تم تحميل الفاتورة بصيغة PDF بنجاح' : 'Invoice PDF downloaded successfully', 'success');
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast(lang === 'ar' ? 'حدث خطأ أثناء تصدير PDF، جاري التحويل للطباعة المباشرة' : 'Error generating PDF, switching to print dialog', 'error');
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleShareLink = () => {
    if (!invoice?.share_token) return;
    const url = `${window.location.origin}?inv=${invoice.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setLinkCopied(true);
      toast(t('invoices.linkCopied'));
      setTimeout(() => setLinkCopied(false), 2500);
    });
  };

  const handleDuplicate = async () => {
    if (!invoice || !company) return;
    setDuplicating(true);
    const year = new Date().getFullYear();
    const seq = Math.floor(1000 + Math.random() * 9000);
    const newNumber = `INV-${year}-${seq}`;

    const { data: newInv, error } = await supabase.from('invoices').insert({
      company_id: company.id,
      customer_id: invoice.customer_id,
      number: newNumber,
      status: 'draft',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: invoice.due_date,
      subtotal: invoice.subtotal,
      discount_total: invoice.discount_total,
      tax_total: invoice.tax_total,
      total: invoice.total,
      notes: invoice.notes,
      terms: invoice.terms,
      template: invoice.template,
    }).select('id').single();

    if (error || !newInv) { toast(error?.message ?? 'Error', 'error'); setDuplicating(false); return; }

    if (invoice.items.length > 0) {
      await supabase.from('invoice_items').insert(
        invoice.items.map((it) => ({
          invoice_id: newInv.id,
          product_id: it.product_id,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          discount: it.discount,
          tax_rate: it.tax_rate,
          line_total: it.line_total,
        }))
      );
    }

    toast(t('invoices.duplicated'));
    setDuplicating(false);
    onDuplicate?.(newInv.id);
  };

  const handleIssueZatca = async () => {
    if (!invoice || !company || issuing) return;
    setIssuing(true);
    try {
      const now = new Date();
      const issueTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

      const result = await issueZatcaInvoice({
        invoiceId: invoice.id,
        company: company as any,
        customer: (invoice.customer ?? {}) as any,
        invoiceNumber: invoice.number,
        invoiceType: (invoice as any).invoice_type ?? 'simplified',
        typeCode: (invoice as any).invoice_type_code ?? '388',
        subtype: (invoice as any).invoice_subtype ?? '0200000',
        issueDate: invoice.issue_date,
        issueTime: (invoice as any).issue_time ?? issueTime,
        deliveryDate: (invoice as any).delivery_date ?? undefined,
        currencyCode: (invoice as any).currency_code ?? 'SAR',
        exchangeRate: (invoice as any).exchange_rate ?? 1,
        paymentMeansCode: (invoice as any).payment_means_code ?? '10',
        paymentAccountId: (invoice as any).payment_account_id ?? undefined,
        notes: invoice.notes ?? undefined,
        terms: invoice.terms ?? undefined,
        purchaseOrder: (invoice as any).purchase_order ?? undefined,
        referenceNumber: (invoice as any).reference_number ?? undefined,
        salesperson: (invoice as any).salesperson ?? undefined,
        items: invoice.items as any,
        subtotal: invoice.subtotal,
        taxTotal: invoice.tax_total,
        discountTotal: invoice.discount_total ?? 0,
        total: invoice.total,
      });

      if (result.success) {
        toast('Invoice issued successfully — ZATCA data generated', 'success');
        await loadInvoice();
      } else {
        const msg = result.validationErrors?.join('; ') ?? result.error ?? 'Issuance failed';
        toast(msg, 'error');
      }
    } finally {
      setIssuing(false);
    }
  };

  const handleRegenerate = async () => {
    if (!invoice || regenerating) return;
    setRegenerating(true);
    const result = await regenerateZatcaData(invoice.id);
    if (result.success) {
      toast('ZATCA data regenerated', 'success');
      await loadInvoice();
    } else {
      toast(result.error ?? 'Regeneration failed', 'error');
    }
    setRegenerating(false);
  };

  const handleDownloadXml = () => {
    const xml = (invoice as any)?.zatca_xml;
    if (!xml) return;
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice?.number ?? 'invoice'}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  if (!invoice || !company) return null;

  const isLocked = !!(invoice as any).is_locked;
  const hasZatcaData = !!(invoice as any).zatca_qr_data;

  const renderData: InvoiceRenderData = buildInvoiceRenderData(invoice, company, activeTemplate);

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl text-secondary-500 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors">
            <ArrowLeft size={20} className="rtl:rotate-180" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-secondary-800 dark:text-secondary-100 leading-tight">{invoice.number}</h1>
            {isLocked && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success-600 dark:text-success-400">
                <Lock size={10} /> ZATCA Issued
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ZATCA Issue button — only if not yet locked */}
          {!isLocked && (
            <Button
              size="sm"
              onClick={handleIssueZatca}
              loading={issuing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
            >
              <Zap size={15} />
              Issue (ZATCA)
            </Button>
          )}

          {/* Template picker toggle */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowTemplatePicker(!showTemplatePicker)}
            >
              <LayoutTemplate size={15} />
              {lang === 'ar'
                ? (TEMPLATE_LABELS[activeTemplate]?.ar || activeTemplate)
                : (TEMPLATE_LABELS[activeTemplate]?.en || activeTemplate)}
            </Button>
            {showTemplatePicker && (
              <div className="absolute end-0 top-full mt-1 z-50 bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-700 rounded-xl shadow-xl p-2 min-w-[200px]">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl}
                    onClick={() => { setActiveTemplate(tpl); setShowTemplatePicker(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                      activeTemplate === tpl
                        ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                        : 'text-secondary-600 hover:bg-secondary-50 dark:text-secondary-300 dark:hover:bg-secondary-800'
                    }`}
                  >
                    <span>
                      {lang === 'ar' ? TEMPLATE_LABELS[tpl]?.ar : TEMPLATE_LABELS[tpl]?.en}
                    </span>
                    {activeTemplate === tpl && <Check size={13} className="text-primary-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={handleShareLink}>
            {linkCopied ? <Check size={15} className="text-success-500" /> : <Link2 size={15} />}
            {t('invoices.shareLink')}
          </Button>

          <Button variant="outline" size="sm" onClick={handleDuplicate} loading={duplicating}>
            <Copy size={15} />
            {t('invoices.duplicate')}
          </Button>

          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer size={15} />
            {t('invoices.print')}
          </Button>

          <Button variant="outline" size="sm" onClick={handleDownloadPdf} loading={downloadingPdf}>
            <Download size={15} />
            {t('invoices.downloadPdf')}
          </Button>

          {invoice.status === 'draft' && (
            <Button size="sm" onClick={onEdit}>
              <Pencil size={15} />
              {t('common.edit')}
            </Button>
          )}

          {invoice.status !== 'draft' && invoice.status !== 'cancelled' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => { if (onRefund) onRefund(); else setReturnModalOpen(true); }}
              className="border-warning-300 text-warning-700 hover:bg-warning-50 dark:border-warning-700 dark:text-warning-400 dark:hover:bg-warning-900/20"
            >
              <RotateCcw size={15} />
              {t('refunds.refund')}
            </Button>
          )}
        </div>
      </div>

      {/* ZATCA Info Panel */}
      {hasZatcaData && (
        <div className="no-print print:hidden">
          <ZatcaInfoPanel
            invoice={invoice as any}
            onRegenerate={handleRegenerate}
            onDownloadXml={handleDownloadXml}
            regenerating={regenerating}
          />
        </div>
      )}

      {/* Invoice render area */}
      <div className="rounded-2xl overflow-hidden shadow-lg border border-secondary-200 dark:border-secondary-700">
        <div id="invoice-print-area">
          <InvoiceTemplate data={renderData} lang={lang} fmt={fmt} fmtDate={fmtDate} t={t} />
        </div>
      </div>

      {/* Returns section */}
      <ReturnsSection
        invoiceId={invoice.id}
        invoiceTotal={invoice.total}
        items={invoice.items}
        refreshKey={returnsRefreshKey}
      />

      {/* Return modal */}
      <ReturnModal
        open={returnModalOpen}
        invoiceId={invoice.id}
        onClose={() => setReturnModalOpen(false)}
        onReturnCreated={() => {
          setReturnsRefreshKey((k) => k + 1);
          loadInvoice();
        }}
      />
    </div>
  );
}
