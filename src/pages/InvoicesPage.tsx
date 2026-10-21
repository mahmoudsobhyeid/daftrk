import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useCurrency, useFormatDate } from '../lib/format';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Spinner, EmptyState } from '../components/ui/Feedback';
import { StatusBadge } from '../components/ui/StatusBadge';
import { ZatcaClearanceBadge } from '../components/zatca/ZatcaStatus';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { InvoiceForm } from '../components/InvoiceForm';
import { InvoiceView } from '../components/InvoiceView';
import { InvoiceTemplate } from '../components/InvoiceTemplate';
import { ReturnModal } from '../components/ReturnModal';
import { buildInvoiceRenderData, INVOICE_PDF_SELECT } from '../lib/invoice-render';
import { pdfPageBreak, PDF_HOST_STYLE, usePdfExport } from '../lib/pdf-export';
import {
  FileText, Plus, Search, Eye, Pencil, Trash2, Download,
  CheckCircle, Send, Copy, RotateCcw,
  DollarSign, Clock, FileCheck, AlertCircle,
} from 'lucide-react';
import type { InvoiceWithCustomer, InvoiceWithDetails, InvoiceRenderData, InvoiceStatus, Customer, ZatcaClearanceStatus } from '../lib/types';

type View = 'list' | 'form' | 'view';

export function InvoicesPage() {
  const { t, lang } = useLanguage();
  const { company } = useCompany();
  const { toast } = useToast();
  const { canAdd, usage, limitOf, refresh: refreshSub } = useSubscription();
  const fmt = useCurrency();
  const fmtDate = useFormatDate();

  const [view, setView] = useState<View>('list');
  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceWithCustomer | null>(null);
  const [refundTarget, setRefundTarget] = useState<InvoiceWithCustomer | null>(null);
  const [pdfDocs, setPdfDocs] = useState<InvoiceRenderData[]>([]);
  const { startExport, exporting: pdfExporting } = usePdfExport();

  const load = async () => {
    if (!company) return;
    setLoading(true);
    const [invRes, custRes] = await Promise.all([
      supabase.from('invoices')
        .select('*, customer:customers(id,name,name_ar,email), zatca_clearance_status, is_locked')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false }),
      supabase.from('customers')
        .select('id, name, name_ar, email, phone, address')
        .eq('company_id', company.id)
        .order('name', { ascending: true }),
    ]);
    setInvoices((invRes.data as InvoiceWithCustomer[]) ?? []);
    setCustomers((custRes.data as Customer[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [company]);

  const filtered = invoices.filter((inv) => {
    const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch =
      inv.number.toLowerCase().includes(q) ||
      (inv.customer?.name ?? '').toLowerCase().includes(q) ||
      (inv.customer?.name_ar ?? '').includes(search);
    return matchStatus && matchSearch;
  });

  // Stats
  const stats = {
    paid: invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0),
    unpaid: invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + Number(i.total), 0),
    draft: invoices.filter((i) => i.status === 'draft').length,
    overdue: invoices.filter((i) => i.status === 'overdue').length,
  };

  const openCreate = () => {
    if (!canAdd('invoices')) {
      toast(t('plans.limitReachedDesc'), 'error');
      return;
    }
    setEditingId(null);
    setView('form');
  };
  const openEdit = (id: string) => { setEditingId(id); setView('form'); };
  const openView = (id: string) => { setViewingId(id); setView('view'); };
  const handleSaved = () => { setView('list'); load(); refreshSub(); };
  const handleDuplicated = (newId: string) => { load(); setViewingId(newId); };

  const doDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('invoices').delete().eq('id', deleteTarget.id);
    if (!error) { toast(t('invoices.deleted')); load(); }
    setDeleteTarget(null);
  };

  const updateStatus = async (id: string, status: InvoiceStatus) => {
    const { error } = await supabase.from('invoices').update({ status }).eq('id', id);
    if (!error) { toast(t('invoices.statusChanged')); load(); }
  };

  /** Loads full invoice data (customer + items) and exports one or many PDFs. */
  const exportInvoices = async (ids: string[]) => {
    if (!company || ids.length === 0 || pdfExporting) return;
    const { data, error } = await supabase
      .from('invoices')
      .select(INVOICE_PDF_SELECT)
      .in('id', ids);
    if (error) {
      toast(lang === 'ar' ? 'تعذر تحميل بيانات الفواتير' : 'Could not load invoice data', 'error');
      return;
    }
    const fetched = (data as InvoiceWithDetails[]) ?? [];
    const ordered = ids
      .map((id) => fetched.find((inv) => inv.id === id))
      .filter((inv): inv is InvoiceWithDetails => Boolean(inv));
    if (ordered.length === 0) {
      toast(lang === 'ar' ? 'لا توجد فواتير للتحميل' : 'No invoices to download', 'error');
      return;
    }
    const docs = ordered.map((inv) => buildInvoiceRenderData(inv, company));
    setPdfDocs(docs);
    startExport({
      hostId: 'invoices-pdf-host',
      filename: docs.length === 1 ? `${docs[0].number || 'invoice'}.pdf` : `invoices-${docs.length}.pdf`,
      onError: () => toast(lang === 'ar' ? 'حدث خطأ أثناء إنشاء PDF' : 'Error generating PDF', 'error'),
    });
  };

  if (view === 'form') {
    return <InvoiceForm invoiceId={editingId} customers={customers} onBack={handleSaved} />;
  }
  if (view === 'view' && viewingId) {
    return (
      <InvoiceView
        invoiceId={viewingId}
        onBack={() => setView('list')}
        onEdit={() => { setEditingId(viewingId); setView('form'); }}
        onDuplicate={handleDuplicated}
        onRefund={() => { setRefundTarget(invoices.find((i) => i.id === viewingId) ?? null); }}
      />
    );
  }

  const statuses: (InvoiceStatus | 'all')[] = ['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100 tracking-tight">{t('invoices.title')}</h1>
          <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">{invoices.length} {t('nav.invoices').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => exportInvoices(filtered.map((inv) => inv.id))}
            loading={pdfExporting}
            disabled={filtered.length === 0}
          >
            <Download size={16} />
            {lang === 'ar' ? 'تحميل الكل PDF' : 'Download all PDF'}
          </Button>
          <Button onClick={openCreate} disabled={!canAdd('invoices')}>
            <Plus size={16} />
            {t('invoices.add')}
            {limitOf('invoices') !== null && (
              <span className="ms-1 text-xs opacity-70">({usage.invoices}/{limitOf('invoices')})</span>
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FileCheck size={18} />}
          label={t('invoices.totalPaid')}
          value={fmt(stats.paid, company?.currency)}
          color="success"
        />
        <StatCard
          icon={<DollarSign size={18} />}
          label={t('invoices.totalUnpaid')}
          value={fmt(stats.unpaid, company?.currency)}
          color="primary"
        />
        <StatCard
          icon={<Clock size={18} />}
          label={t('invoices.totalDraft')}
          value={String(stats.draft)}
          color="secondary"
        />
        <StatCard
          icon={<AlertCircle size={18} />}
          label={t('invoices.totalOverdue')}
          value={String(stats.overdue)}
          color={stats.overdue > 0 ? 'danger' : 'secondary'}
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-secondary-400 pointer-events-none" />
          <input className="input ps-10" placeholder={t('invoices.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input sm:w-48 cursor-pointer" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | 'all')}>
          {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? t('invoices.all') : t(`status.${s}`)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText size={28} />}
            title={t('invoices.empty')}
            description={t('invoices.emptyDesc')}
            action={<Button onClick={openCreate}><Plus size={16} /> {t('invoices.add')}</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50">
                  <th className="text-start px-5 py-3 text-xs font-bold uppercase tracking-wider text-secondary-500 dark:text-secondary-400">{t('invoices.number')}</th>
                  <th className="text-start px-5 py-3 text-xs font-bold uppercase tracking-wider text-secondary-500 dark:text-secondary-400">{t('invoices.customer')}</th>
                  <th className="text-start px-5 py-3 text-xs font-bold uppercase tracking-wider text-secondary-500 dark:text-secondary-400 hidden md:table-cell">{t('invoices.issueDate')}</th>
                  <th className="text-start px-5 py-3 text-xs font-bold uppercase tracking-wider text-secondary-500 dark:text-secondary-400 hidden lg:table-cell">{t('invoices.dueDate')}</th>
                  <th className="text-start px-5 py-3 text-xs font-bold uppercase tracking-wider text-secondary-500 dark:text-secondary-400">{t('invoices.status')}</th>
                  <th className="text-start px-5 py-3 text-xs font-bold uppercase tracking-wider text-secondary-500 dark:text-secondary-400 hidden xl:table-cell">ZATCA</th>
                  <th className="text-start px-5 py-3 text-xs font-bold uppercase tracking-wider text-secondary-500 dark:text-secondary-400">{t('invoices.total')}</th>
                  <th className="text-end px-5 py-3 text-xs font-bold uppercase tracking-wider text-secondary-500 dark:text-secondary-400">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-secondary-50/70 dark:hover:bg-secondary-800/40 transition-colors cursor-pointer" onClick={() => openView(inv.id)}>
                    <td className="px-5 py-3.5 font-semibold text-primary-600 dark:text-primary-400 hover:underline">{inv.number}</td>
                    <td className="px-5 py-3.5 text-secondary-600 dark:text-secondary-300">
                      {lang === 'ar' ? (inv.customer?.name_ar || inv.customer?.name) : (inv.customer?.name || inv.customer?.name_ar) || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-secondary-500 hidden md:table-cell">{fmtDate(inv.issue_date)}</td>
                    <td className="px-5 py-3.5 text-secondary-500 hidden lg:table-cell">{fmtDate(inv.due_date)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={inv.status} /></td>
                    <td className="px-5 py-3.5 hidden xl:table-cell">
                      {(inv as any).zatca_clearance_status ? (
                        <ZatcaClearanceBadge status={(inv as any).zatca_clearance_status as ZatcaClearanceStatus} small />
                      ) : (
                        <span className="text-secondary-300 dark:text-secondary-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-secondary-800 dark:text-secondary-100">{fmt(Number(inv.total), company?.currency)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <ActionBtn onClick={() => openView(inv.id)} title={t('invoices.view')} icon={<Eye size={15} />} />
                        <ActionBtn
                          onClick={() => exportInvoices([inv.id])}
                          title={t('invoices.downloadPdf')}
                          icon={<Download size={15} />}
                        />
                        {inv.status === 'draft' && (
                          <ActionBtn onClick={() => openEdit(inv.id)} title={t('common.edit')} icon={<Pencil size={15} />} />
                        )}
                        {inv.status === 'draft' && (
                          <ActionBtn
                            onClick={() => updateStatus(inv.id, 'sent')}
                            title={t('invoices.markSent')}
                            icon={<Send size={15} />}
                            colorClass="hover:bg-accent-50 hover:text-accent-600 dark:hover:bg-accent-900/30 dark:hover:text-accent-400"
                          />
                        )}
                        {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                          <ActionBtn
                            onClick={() => updateStatus(inv.id, 'paid')}
                            title={t('invoices.markPaid')}
                            icon={<CheckCircle size={15} />}
                            colorClass="hover:bg-success-50 hover:text-success-600 dark:hover:bg-success-900/30 dark:hover:text-success-400"
                          />
                        )}
                        {inv.status !== 'draft' && inv.status !== 'cancelled' && (
                          <ActionBtn
                            onClick={() => setRefundTarget(inv)}
                            title={t('refunds.refund')}
                            icon={<RotateCcw size={15} />}
                            colorClass="hover:bg-warning-50 hover:text-warning-600 dark:hover:bg-warning-900/30 dark:hover:text-warning-400"
                          />
                        )}
                        {inv.status === 'draft' && (
                          <ActionBtn
                            onClick={() => setDeleteTarget(inv)}
                            title={t('common.delete')}
                            icon={<Trash2 size={15} />}
                            colorClass="hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30 dark:hover:text-danger-400"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title={t('invoices.delete')}
        message={t('invoices.deleteConfirm')}
        confirmLabel={t('invoices.delete')}
      />

      {refundTarget && (
        <ReturnModal
          open={!!refundTarget}
          invoiceId={refundTarget.id}
          onClose={() => setRefundTarget(null)}
          onReturnCreated={() => { setRefundTarget(null); load(); }}
        />
      )}

      {/* Off-screen render area used for PDF downloads */}
      {pdfDocs.length > 0 && (
        <div aria-hidden="true" style={PDF_HOST_STYLE}>
          <div id="invoices-pdf-host" className="bg-white" style={{ width: 794 }}>
            {pdfDocs.map((doc, i) => (
              <div key={`${doc.id}-${i}`} style={pdfPageBreak(i)}>
                <InvoiceTemplate data={doc} lang={lang} fmt={fmt} fmtDate={fmtDate} t={t} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  onClick, title, icon,
  colorClass = 'hover:bg-secondary-100 hover:text-secondary-700 dark:hover:bg-secondary-800 dark:hover:text-secondary-200',
}: { onClick: () => void; title: string; icon: React.ReactNode; colorClass?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 transition-colors ${colorClass}`}
    >
      {icon}
    </button>
  );
}

type StatColor = 'primary' | 'success' | 'danger' | 'secondary';
const colorMap: Record<StatColor, { bg: string; icon: string }> = {
  primary: { bg: 'bg-primary-50 dark:bg-primary-900/20', icon: 'text-primary-600 dark:text-primary-400' },
  success: { bg: 'bg-success-50 dark:bg-success-900/20', icon: 'text-success-600 dark:text-success-400' },
  danger: { bg: 'bg-danger-50 dark:bg-danger-900/20', icon: 'text-danger-600 dark:text-danger-400' },
  secondary: { bg: 'bg-secondary-100 dark:bg-secondary-800', icon: 'text-secondary-500 dark:text-secondary-400' },
};

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: StatColor }) {
  const c = colorMap[color];
  return (
    <Card variant="hover" className="p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${c.bg} ${c.icon}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider truncate">{label}</p>
          <p className="text-lg font-bold text-secondary-800 dark:text-secondary-100 truncate">{value}</p>
        </div>
      </div>
    </Card>
  );
}
