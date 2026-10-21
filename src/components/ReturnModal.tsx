import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useCurrency } from '../lib/format';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Spinner } from './ui/Feedback';
import { RotateCcw, Check, DollarSign } from 'lucide-react';
import type { InvoiceItem, InvoiceReturnWithItems } from '../lib/types';

interface ReturnModalProps {
  open: boolean;
  invoiceId: string;
  onClose: () => void;
  onReturnCreated: () => void;
}

interface ItemWithReturned extends InvoiceItem {
  returned_qty: number;
}

type PartialMode = 'items' | 'amount';

export function ReturnModal({ open, invoiceId, onClose, onReturnCreated }: ReturnModalProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const fmt = useCurrency();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ItemWithReturned[]>([]);
  const [returnType, setReturnType] = useState<'full' | 'partial'>('full');
  const [partialMode, setPartialMode] = useState<PartialMode>('items');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [customAmount, setCustomAmount] = useState('');
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [totalRefunded, setTotalRefunded] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [existingReturns, setExistingReturns] = useState<InvoiceReturnWithItems[]>([]);

  useEffect(() => {
    if (!open || !invoiceId) return;
    loadData();
  }, [open, invoiceId]);

  const loadData = async () => {
    setLoading(true);
    const [itemsRes, returnsRes, invRes] = await Promise.all([
      supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId),
      supabase
        .from('invoice_returns')
        .select('*, items:invoice_return_items(*)')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false }),
      supabase.from('invoices').select('total').eq('id', invoiceId).maybeSingle(),
    ]);

    const dbItems = (itemsRes.data as InvoiceItem[]) ?? [];
    const returns = (returnsRes.data as InvoiceReturnWithItems[]) ?? [];
    setExistingReturns(returns);
    setInvoiceTotal(Number((invRes.data as any)?.total ?? 0));

    const refundedTotal = returns.reduce((s, r) => s + Number(r.total), 0);
    setTotalRefunded(refundedTotal);

    const returnedMap: Record<string, number> = {};
    for (const ret of returns) {
      for (const ri of ret.items) {
        returnedMap[ri.invoice_item_id] = (returnedMap[ri.invoice_item_id] ?? 0) + Number(ri.quantity);
      }
    }

    const itemsWithReturned = dbItems.map((it) => ({
      ...it,
      returned_qty: returnedMap[it.id] ?? 0,
    }));
    setItems(itemsWithReturned);

    const initialQty: Record<string, string> = {};
    for (const it of itemsWithReturned) {
      initialQty[it.id] = '';
    }
    setQuantities(initialQty);
    setReturnType('full');
    setPartialMode('items');
    setCustomAmount('');
    setLoading(false);
  };

  const availableQty = (it: ItemWithReturned) => Number(it.quantity) - it.returned_qty;
  const remainingBalance = invoiceTotal - totalRefunded;

  useEffect(() => {
    if (returnType === 'full') {
      const fullQty: Record<string, string> = {};
      for (const it of items) {
        const avail = availableQty(it);
        fullQty[it.id] = avail > 0 ? String(avail) : '0';
      }
      setQuantities(fullQty);
    } else if (partialMode === 'items') {
      const partialQty: Record<string, string> = {};
      for (const it of items) {
        partialQty[it.id] = '0';
      }
      setQuantities(partialQty);
    }
  }, [returnType, items, partialMode]);

  const returnItems = useMemo(() => {
    return items
      .filter((it) => {
        const qty = parseFloat(quantities[it.id] ?? '0') || 0;
        return qty > 0 && qty <= availableQty(it);
      })
      .map((it) => ({
        invoice_item_id: it.id,
        quantity: parseFloat(quantities[it.id] ?? '0') || 0,
      }));
  }, [items, quantities]);

  const itemsRefundValue = useMemo(() => {
    return items.reduce((sum, it) => {
      const qty = parseFloat(quantities[it.id] ?? '0') || 0;
      if (qty <= 0 || qty > availableQty(it)) return sum;
      const lineSubtotal = qty * Number(it.unit_price);
      const lineTax = lineSubtotal * (Number(it.tax_rate) / 100);
      return sum + lineSubtotal + lineTax;
    }, 0);
  }, [items, quantities]);

  const customAmountNum = parseFloat(customAmount) || 0;
  const totalReturnValue = returnType === 'partial' && partialMode === 'amount'
    ? customAmountNum
    : itemsRefundValue;

  const exceedsBalance = totalReturnValue > remainingBalance;
  const hasReturnableItems = items.some((it) => availableQty(it) > 0);
  const canSubmit = returnType === 'full'
    ? returnItems.length > 0
    : partialMode === 'items'
      ? returnItems.length > 0
      : customAmountNum > 0 && !exceedsBalance;

  const handleSubmit = async () => {
    if (returnType === 'partial' && partialMode === 'amount') {
      if (customAmountNum <= 0) {
        toast(t('refunds.refundAmountExceeds'), 'error');
        return;
      }
      if (customAmountNum > remainingBalance) {
        toast(t('refunds.refundAmountExceeds'), 'error');
        return;
      }

      setSubmitting(true);
      const { data, error } = await supabase.rpc('create_invoice_return', {
        p_invoice_id: invoiceId,
        p_return_type: 'partial',
        p_items: JSON.stringify(buildItemsForCustomAmount(customAmountNum)),
      });

      if (error) {
        toast(t('common.error'), 'error');
        console.error('Refund failed', error);
        setSubmitting(false);
        return;
      }

      const result = data as { success: boolean; error?: string };
      if (result?.success === false) {
        toast(t('common.error'), 'error');
        setSubmitting(false);
        return;
      }

      toast(t('refunds.success'), 'success');
      setSubmitting(false);
      onReturnCreated();
      onClose();
      return;
    }

    if (returnItems.length === 0) {
      toast(t('returns.selectAtLeastOne'), 'error');
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.rpc('create_invoice_return', {
      p_invoice_id: invoiceId,
      p_return_type: returnType,
      p_items: JSON.stringify(returnItems),
    });

    if (error) {
      toast(t('common.error'), 'error');
      console.error('Refund failed', error);
      setSubmitting(false);
      return;
    }

    const result = data as { success: boolean; error?: string };
    if (result?.success === false) {
      toast(t('common.error'), 'error');
      setSubmitting(false);
      return;
    }

    toast(t('refunds.success'), 'success');
    setSubmitting(false);
    onReturnCreated();
    onClose();
  };

  const buildItemsForCustomAmount = (amount: number) => {
    const result: { invoice_item_id: string; quantity: number }[] = [];
    let remaining = amount;

    for (const it of items) {
      if (remaining <= 0) break;
      const avail = availableQty(it);
      if (avail <= 0) continue;

      const unitPrice = Number(it.unit_price);
      const taxRate = Number(it.tax_rate) / 100;
      const unitTotal = unitPrice * (1 + taxRate);

      const maxQtyByAmount = unitTotal > 0 ? remaining / unitTotal : 0;
      const qty = Math.min(avail, Math.floor(maxQtyByAmount * 100) / 100);
      if (qty > 0) {
        result.push({ invoice_item_id: it.id, quantity: qty });
        remaining -= qty * unitTotal;
      }
    }

    return result;
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-900/20 dark:text-warning-400">
            <RotateCcw size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-secondary-800 dark:text-secondary-100">{t('refunds.title')}</h2>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size={28} /></div>
        ) : !hasReturnableItems || remainingBalance <= 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-secondary-500 dark:text-secondary-400">{t('refunds.allRefunded')}</p>
          </div>
        ) : (
          <>
            {/* Remaining balance banner */}
            <div className="rounded-xl bg-secondary-50 dark:bg-secondary-800/50 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-secondary-600 dark:text-secondary-300">
                <DollarSign size={16} />
                {t('refunds.remainingBalance')}
              </div>
              <span className="text-lg font-bold text-secondary-800 dark:text-secondary-100">{fmt(remainingBalance)}</span>
            </div>

            {/* Refund type selector */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReturnType('full')}
                className={`rounded-xl border-2 p-4 text-start transition-all ${
                  returnType === 'full'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-secondary-200 dark:border-secondary-700 hover:border-secondary-300 dark:hover:border-secondary-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  {returnType === 'full' && <Check size={16} className="text-primary-600 dark:text-primary-400" />}
                  <span className="font-semibold text-secondary-800 dark:text-secondary-100">{t('refunds.fullRefund')}</span>
                </div>
                <p className="mt-1.5 text-xs text-secondary-500 dark:text-secondary-400">{t('refunds.fullRefundDesc')}</p>
              </button>

              <button
                type="button"
                onClick={() => setReturnType('partial')}
                className={`rounded-xl border-2 p-4 text-start transition-all ${
                  returnType === 'partial'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-secondary-200 dark:border-secondary-700 hover:border-secondary-300 dark:hover:border-secondary-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  {returnType === 'partial' && <Check size={16} className="text-primary-600 dark:text-primary-400" />}
                  <span className="font-semibold text-secondary-800 dark:text-secondary-100">{t('refunds.partialRefund')}</span>
                </div>
                <p className="mt-1.5 text-xs text-secondary-500 dark:text-secondary-400">{t('refunds.partialRefundDesc')}</p>
              </button>
            </div>

            {/* Partial mode toggle */}
            {returnType === 'partial' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPartialMode('items')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                    partialMode === 'items'
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'border-secondary-200 dark:border-secondary-700 text-secondary-500 hover:border-secondary-300 dark:hover:border-secondary-600'
                  }`}
                >
                  {t('refunds.byItems')}
                </button>
                <button
                  type="button"
                  onClick={() => setPartialMode('amount')}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold border-2 transition-all ${
                    partialMode === 'amount'
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'border-secondary-200 dark:border-secondary-700 text-secondary-500 hover:border-secondary-300 dark:hover:border-secondary-600'
                  }`}
                >
                  {t('refunds.byAmount')}
                </button>
              </div>
            )}

            {/* Custom amount input */}
            {returnType === 'partial' && partialMode === 'amount' && (
              <div>
                <label className="block text-xs font-semibold text-secondary-600 dark:text-secondary-400 mb-1.5">
                  {t('refunds.customAmount')}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={remainingBalance}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="0.00"
                  className={`input ${exceedsBalance ? 'border-danger-500 ring-1 ring-danger-500' : ''}`}
                />
                <p className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">{t('refunds.customAmountHint')}</p>
                {exceedsBalance && (
                  <p className="mt-1 text-xs text-danger-600 dark:text-danger-400 font-semibold">{t('refunds.refundAmountExceeds')}</p>
                )}
              </div>
            )}

            {/* Items table */}
            {returnType === 'full' || (returnType === 'partial' && partialMode === 'items') ? (
              <div className="overflow-x-auto rounded-xl border border-secondary-200 dark:border-secondary-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50">
                      <th className="text-start px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500">{t('returns.item')}</th>
                      <th className="text-center px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500 hidden sm:table-cell">{t('returns.originalQty')}</th>
                      <th className="text-center px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500 hidden sm:table-cell">{t('returns.returnedQty')}</th>
                      <th className="text-center px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500">{t('returns.availableQty')}</th>
                      <th className="text-center px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500">{t('returns.returnQty')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                    {items.map((it) => {
                      const avail = availableQty(it);
                      const isFullyReturned = avail <= 0;
                      const qtyVal = quantities[it.id] ?? '0';
                      const enteredQty = parseFloat(qtyVal) || 0;
                      const exceeds = enteredQty > avail;

                      return (
                        <tr key={it.id} className={isFullyReturned ? 'opacity-40' : ''}>
                          <td className="px-4 py-2.5 text-secondary-700 dark:text-secondary-300 font-medium">{it.description}</td>
                          <td className="px-4 py-2.5 text-center text-secondary-500 hidden sm:table-cell">{Number(it.quantity)}</td>
                          <td className="px-4 py-2.5 text-center text-secondary-500 hidden sm:table-cell">{it.returned_qty}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`font-semibold ${isFullyReturned ? 'text-danger-500' : 'text-success-600 dark:text-success-400'}`}>{avail}</span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={avail}
                              disabled={isFullyReturned || returnType === 'full'}
                              value={quantities[it.id] ?? '0'}
                              onChange={(e) => setQuantities({ ...quantities, [it.id]: e.target.value })}
                              className={`input text-sm w-20 text-center ${exceeds ? 'border-danger-500 ring-1 ring-danger-500' : ''}`}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {/* Total */}
            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-2 text-sm">
                <div className={`flex justify-between text-lg font-bold pt-2.5 border-t border-secondary-200 dark:border-secondary-800 ${exceedsBalance ? 'text-danger-600 dark:text-danger-400' : 'text-secondary-800 dark:text-secondary-100'}`}>
                  <span>{t('refunds.totalRefundValue')}</span>
                  <span>{fmt(totalReturnValue)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={onClose} disabled={submitting}>{t('returns.cancel')}</Button>
              <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
                <RotateCcw size={16} />
                {t('refunds.confirm')}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
