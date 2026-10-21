import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { InvoiceTemplate } from '../components/InvoiceTemplate';
import { Spinner } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { formatCurrency, formatDate } from '../lib/format';
import { translations } from '../lib/i18n';
import { FileText, Printer, Download } from 'lucide-react';
import { exportElementToPdf } from '../lib/pdf-export';
import type { InvoiceRenderData } from '../lib/types';
import type { Language } from '../lib/i18n';

interface PublicInvoicePageProps {
  shareToken: string;
}

export function PublicInvoicePage({ shareToken }: PublicInvoicePageProps) {
  const [data, setData] = useState<InvoiceRenderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (!shareToken) { setNotFound(true); setLoading(false); return; }
    (async () => {
      const { data: result, error } = await supabase.rpc('get_public_invoice', { p_token: shareToken });
      if (error || !result) { setNotFound(true); setLoading(false); return; }
      setData(result as InvoiceRenderData);
      setLoading(false);
    })();
  }, [shareToken]);

  const storedLang = localStorage.getItem('daftrk-lang');
  const lang: Language = storedLang === 'en' || storedLang === 'ar' ? storedLang : 'ar';
  const fmt = (amount: number, currency = 'USD') => formatCurrency(amount, currency, lang);
  const fmtDate = (dateStr: string) => formatDate(dateStr, lang);
  const t = (key: string) => translations[lang][key] ?? translations.en[key] ?? key;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('invoice-print-area');
    if (!el || !data) return;
    setDownloadingPdf(true);
    try {
      await exportElementToPdf(el, {
        filename: `${data.number}.pdf`,
        marginMm: [8, 8, 8, 8],
      });
    } catch (err) {
      console.error('PDF export error:', err);
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-950">
        <Spinner size={32} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-secondary-50 dark:bg-secondary-950 gap-4 p-8">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary-100 dark:bg-secondary-800 text-secondary-400">
          <FileText size={28} />
        </div>
        <h1 className="text-xl font-bold text-secondary-700 dark:text-secondary-200">
          {lang === 'ar' ? 'الفاتورة غير موجودة' : 'Invoice not found'}
        </h1>
        <p className="text-sm text-secondary-400 text-center max-w-sm">
          {lang === 'ar'
            ? 'قد تكون رابط هذه الفاتورة منتهية الصلاحية أو أن الفاتورة لم تعد موجودة.'
            : 'This invoice link may have expired or the invoice no longer exists.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-100 dark:bg-secondary-950 py-8 px-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Actions header */}
        <div className="flex items-center justify-between bg-white dark:bg-secondary-900 px-6 py-3.5 rounded-2xl shadow-sm border border-secondary-200 dark:border-secondary-800 no-print print:hidden">
          <span className="font-bold text-secondary-800 dark:text-secondary-100">
            {data.number}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer size={15} />
              {lang === 'ar' ? 'طباعة' : 'Print'}
            </Button>
            <Button size="sm" onClick={handleDownloadPdf} loading={downloadingPdf}>
              <Download size={15} />
              {lang === 'ar' ? 'تحميل PDF' : 'Download PDF'}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden shadow-2xl">
          <div id="invoice-print-area">
            <InvoiceTemplate data={data} lang={lang} fmt={fmt} fmtDate={fmtDate} t={t} />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-secondary-400 no-print print:hidden">
          Powered by Daftrk
        </p>
      </div>
    </div>
  );
}
