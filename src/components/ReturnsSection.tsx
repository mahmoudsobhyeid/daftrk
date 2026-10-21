import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency, useFormatDate } from '../lib/format';
import { Card } from './ui/Card';
import { Spinner, EmptyState } from './ui/Feedback';
import { Badge } from './ui/Badge';
import { RotateCcw, History, FileText, TrendingDown, Calculator, ShieldCheck } from 'lucide-react';
import type { InvoiceReturnWithItems, InvoiceReturnAuditEntry, InvoiceItem } from '../lib/types';

interface ReturnsSectionProps {
  invoiceId: string;
  invoiceTotal: number;
  items: InvoiceItem[];
  refreshKey: number;
}

interface ItemReturnSummary {
  item: InvoiceItem;
  originalQty: number;
  returnedQty: number;
  remainingQty: number;
}

export function ReturnsSection({ invoiceId, invoiceTotal, items, refreshKey }: ReturnsSectionProps) {
  const { t, lang } = useLanguage();
  const fmt = useCurrency();
  const fmtDate = useFormatDate();

  const [returns, setReturns] = useState<InvoiceReturnWithItems[]>([]);
  const [auditEntries, setAuditEntries] = useState<InvoiceReturnAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!invoiceId) return;
    loadData();
  }, [invoiceId, refreshKey]);

  const loadData = async () => {
    setLoading(true);
    const [returnsRes, auditRes] = await Promise.all([
      supabase
        .from('invoice_returns')
        .select(`
          *,
          items:invoice_return_items(*),
          created_by_user:auth.users!invoice_returns_created_by_fkey(email)
        `)
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false }),
      supabase
        .from('invoice_return_audit')
        .select(`
          *,
          performed_by_user:auth.users!invoice_return_audit_performed_by_fkey(email)
        `)
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false }),
    ]);

    setReturns((returnsRes.data as InvoiceReturnWithItems[]) ?? []);
    setAuditEntries((auditRes.data as InvoiceReturnAuditEntry[]) ?? []);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex justify-center py-8"><Spinner size={24} /></div>
      </Card>
    );
  }

  const totalReturnedValue = returns.reduce((sum, r) => sum + Number(r.total), 0);
  const netValue = Number(invoiceTotal) - totalReturnedValue;

  // Per-item return summary
  const returnedMap: Record<string, number> = {};
  for (const ret of returns) {
    for (const ri of ret.items) {
      returnedMap[ri.invoice_item_id] = (returnedMap[ri.invoice_item_id] ?? 0) + Number(ri.quantity);
    }
  }

  const itemSummaries: ItemReturnSummary[] = items.map((it) => ({
    item: it,
    originalQty: Number(it.quantity),
    returnedQty: returnedMap[it.id] ?? 0,
    remainingQty: Number(it.quantity) - (returnedMap[it.id] ?? 0),
  }));

  const allFullyReturned = itemSummaries.length > 0 && itemSummaries.every((s) => s.remainingQty <= 0);
  const anyReturned = totalReturnedValue > 0;
  const returnStatus = allFullyReturned
    ? t('refunds.fullyRefunded')
    : anyReturned
      ? t('refunds.partiallyRefunded')
      : t('refunds.noRefund');

  const statusColor = allFullyReturned
    ? 'danger'
    : anyReturned
      ? 'warning'
      : 'secondary';

  return (
    <div className="space-y-4 print:hidden">
      {/* Return Summary */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator size={18} className="text-secondary-500 dark:text-secondary-400" />
          <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100">{t('returns.summary')}</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="rounded-xl bg-secondary-50 dark:bg-secondary-800/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-secondary-500 uppercase tracking-wider mb-1">
              <FileText size={12} />
              {t('refunds.originalTotal')}
            </div>
            <p className="text-lg font-bold text-secondary-800 dark:text-secondary-100">{fmt(Number(invoiceTotal))}</p>
          </div>

          <div className="rounded-xl bg-danger-50 dark:bg-danger-900/20 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-danger-600 dark:text-danger-400 uppercase tracking-wider mb-1">
              <TrendingDown size={12} />
              {t('refunds.totalRefunded')}
            </div>
            <p className="text-lg font-bold text-danger-700 dark:text-danger-300">{fmt(totalReturnedValue)}</p>
          </div>

          <div className="rounded-xl bg-success-50 dark:bg-success-900/20 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-success-600 dark:text-success-400 uppercase tracking-wider mb-1">
              <ShieldCheck size={12} />
              {t('refunds.netValue')}
            </div>
            <p className="text-lg font-bold text-success-700 dark:text-success-300">{fmt(netValue)}</p>
          </div>
        </div>

        {/* Return status badge */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-secondary-600 dark:text-secondary-400">{t('refunds.refundStatus')}:</span>
          <Badge variant={statusColor as any}>{returnStatus}</Badge>
        </div>
      </Card>

      {/* Per-item return summary */}
      {anyReturned && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <RotateCcw size={18} className="text-secondary-500 dark:text-secondary-400" />
            <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100">{t('refunds.perItemSummary')}</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-200 dark:border-secondary-800">
                  <th className="text-start px-3 py-2 text-xs font-bold uppercase tracking-wider text-secondary-500">{t('returns.item')}</th>
                  <th className="text-center px-3 py-2 text-xs font-bold uppercase tracking-wider text-secondary-500">{t('returns.originalQty')}</th>
                  <th className="text-center px-3 py-2 text-xs font-bold uppercase tracking-wider text-secondary-500">{t('returns.returnedQty')}</th>
                  <th className="text-center px-3 py-2 text-xs font-bold uppercase tracking-wider text-secondary-500">{t('returns.remainingQty')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                {itemSummaries.map((s) => (
                  <tr key={s.item.id}>
                    <td className="px-3 py-2.5 text-secondary-700 dark:text-secondary-300 font-medium">{s.item.description}</td>
                    <td className="px-3 py-2.5 text-center text-secondary-500">{s.originalQty}</td>
                    <td className="px-3 py-2.5 text-center text-danger-600 dark:text-danger-400 font-semibold">{s.returnedQty}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`font-semibold ${s.remainingQty <= 0 ? 'text-danger-500' : 'text-success-600 dark:text-success-400'}`}>
                        {s.remainingQty}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Return History */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <History size={18} className="text-secondary-500 dark:text-secondary-400" />
          <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100">{t('refunds.history')}</h3>
        </div>

        {returns.length === 0 ? (
          <EmptyState
            icon={<RotateCcw size={24} />}
            title={t('refunds.noRefunds')}
            description=""
          />
        ) : (
          <div className="space-y-3">
            {returns.map((ret) => (
              <div key={ret.id} className="rounded-xl border border-secondary-200 dark:border-secondary-700 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-secondary-800 dark:text-secondary-100">{ret.return_number}</span>
                    <Badge variant={ret.return_type === 'full' ? 'danger' : 'warning'}>
                      {ret.return_type === 'full' ? t('refunds.fullRefund') : t('refunds.partialRefund')}
                    </Badge>
                  </div>
                  <span className="text-xs text-secondary-500">{fmtDate(ret.created_at)}</span>
                </div>

                <div className="space-y-1.5">
                  {ret.items.map((ri) => (
                    <div key={ri.id} className="flex items-center justify-between text-sm">
                      <span className="text-secondary-600 dark:text-secondary-400">
                        {ri.description}
                        <span className="ms-2 text-xs text-secondary-400">× {Number(ri.quantity)}</span>
                      </span>
                      <span className="font-semibold text-secondary-700 dark:text-secondary-300">{fmt(Number(ri.line_total))}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-secondary-100 dark:border-secondary-800">
                  <span className="text-xs text-secondary-500">
                    {t('returns.createdBy')}: {(ret as any).created_by_user?.email ?? '—'}
                  </span>
                  <span className="font-bold text-danger-700 dark:text-danger-300">{fmt(Number(ret.total))}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Audit Log */}
      {auditEntries.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={18} className="text-secondary-500 dark:text-secondary-400" />
            <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100">{t('refunds.auditLog')}</h3>
          </div>

          <div className="space-y-2">
            {auditEntries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded-lg bg-secondary-50 dark:bg-secondary-800/50 p-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shrink-0">
                  <RotateCcw size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-secondary-700 dark:text-secondary-300">
                      {(entry.details as any)?.return_number ?? '—'}
                    </span>
                    <span className="text-xs text-secondary-500">{fmtDate(entry.created_at)}</span>
                  </div>
                  <p className="text-xs text-secondary-500 mt-0.5">
                    {(entry as any).performed_by_user?.email ?? '—'} · {t('returns.value')}: {fmt(Number((entry.details as any)?.total ?? 0))}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
