import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useCurrency } from '../lib/format';
import { generatePreliminaryQr } from '../lib/zatca/invoice-service';
import { Card } from './ui/Card';
import { Input, Textarea, Select } from './ui/Input';
import { Button } from './ui/Button';
import { Spinner } from './ui/Feedback';
import { ArrowLeft, Plus, Trash2, LayoutTemplate } from 'lucide-react';
import type { Customer, Product, Invoice, InvoiceItem } from '../lib/types';

interface InvoiceFormProps {
  invoiceId: string | null;
  customers: Customer[];
  onBack: () => void;
}

interface DraftItem {
  id?: string;
  localId: string;
  product_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  discount: string;
  tax_rate: string;
}

let localIdCounter = 0;
const nextLocalId = () => `draft-${++localIdCounter}`;

const TEMPLATES = ['classic', 'modern', 'minimal'] as const;

export function InvoiceForm({ invoiceId, customers, onBack }: InvoiceFormProps) {
  const { t, lang } = useLanguage();
  const { company } = useCompany();
  const { toast } = useToast();
  const fmt = useCurrency();

  const [loading, setLoading] = useState(!!invoiceId);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [number, setNumber] = useState('');
  const [status, setStatus] = useState('draft');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [template, setTemplate] = useState('classic');
  const [items, setItems] = useState<DraftItem[]>([]);

  useEffect(() => {
    if (!company) return;
    supabase.from('products').select('*').eq('company_id', company.id).order('name').then(({ data }) => {
      setProducts((data as Product[]) ?? []);
    });
  }, [company]);

  useEffect(() => {
    if (!invoiceId || !company) return;
    setLoading(true);
    (async () => {
      const { data: inv } = await supabase.from('invoices').select('*').eq('id', invoiceId).maybeSingle();
      if (inv) {
        const i = inv as Invoice;
        setCustomerId(i.customer_id);
        setNumber(i.number);
        setStatus(i.status);
        setIssueDate(i.issue_date);
        setDueDate(i.due_date);
        setNotes(i.notes ?? '');
        setTerms(i.terms ?? '');
        setTemplate(i.template ?? 'classic');
      }
      const { data: dbItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoiceId);
      setItems((dbItems as InvoiceItem[] ?? []).map((it) => ({
        id: it.id,
        localId: nextLocalId(),
        product_id: it.product_id,
        description: it.description,
        quantity: String(it.quantity),
        unit_price: String(it.unit_price),
        discount: String(it.discount ?? 0),
        tax_rate: String(it.tax_rate),
      })));
      setLoading(false);
    })();
  }, [invoiceId, company]);

  useEffect(() => {
    if (!invoiceId && company && !number) {
      const prefix = company.invoice_prefix || 'INV';
      const year = new Date().getFullYear();
      const seq = Math.floor(1000 + Math.random() * 9000);
      setNumber(`${prefix}-${year}-${seq}`);
      setTemplate(company.invoice_theme || 'classic');
    }
  }, [invoiceId, company, number]);

  const addItem = () => {
    setItems([...items, { localId: nextLocalId(), product_id: null, description: '', quantity: '1', unit_price: '0', discount: '0', tax_rate: '0' }]);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const updateItem = (index: number, field: keyof DraftItem, value: string) => {
    const updated = [...items];
    (updated[index] as Record<string, string>)[field] = value;
    setItems(updated);
  };

  const onProductSelect = (index: number, productId: string) => {
    if (!productId) { updateItem(index, 'product_id', ''); return; }
    const product = products.find((p) => p.id === productId);
    if (product) {
      const updated = [...items];
      updated[index] = {
        ...updated[index],
        product_id: productId,
        description: lang === 'ar' ? (product.name_ar || product.name) : product.name,
        unit_price: String(product.price),
        tax_rate: String(product.tax_rate),
        discount: '0',
      };
      setItems(updated);
    }
  };

  const calcLine = (it: DraftItem) => {
    const qty = parseFloat(it.quantity) || 0;
    const price = parseFloat(it.unit_price) || 0;
    const disc = parseFloat(it.discount) || 0;
    const tax = parseFloat(it.tax_rate) || 0;
    const lineBase = qty * price;
    const discountAmt = lineBase * (disc / 100);
    const lineNet = lineBase - discountAmt;
    const taxAmt = lineNet * (tax / 100);
    return { lineBase, discountAmt, lineNet, taxAmt, lineTotal: lineNet + taxAmt };
  };

  const subtotal = items.reduce((s, it) => s + calcLine(it).lineNet, 0);
  const discountTotal = items.reduce((s, it) => s + calcLine(it).discountAmt, 0);
  const taxTotal = items.reduce((s, it) => s + calcLine(it).taxAmt, 0);
  const total = subtotal + taxTotal;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    if (!customerId) return toast(t('invoices.noCustomerSelected'));
    if (items.length === 0) return toast(t('invoices.noItems'));

    setSaving(true);

    const invoicePayload = {
      company_id: company.id,
      customer_id: customerId,
      number,
      status,
      issue_date: issueDate,
      due_date: dueDate,
      subtotal,
      discount_total: discountTotal,
      tax_total: taxTotal,
      total,
      notes: notes.trim() || null,
      terms: terms.trim() || null,
      template,
    };

    let savedInvoiceId = invoiceId;

    if (invoiceId) {
      const { error } = await supabase.from('invoices').update(invoicePayload).eq('id', invoiceId);
      if (error) { toast(error.message, 'error'); setSaving(false); return; }
      await supabase.from('invoice_items').delete().eq('invoice_id', invoiceId);
    } else {
      const { data, error } = await supabase.from('invoices').insert(invoicePayload).select('id').single();
      if (error) { toast(error.message, 'error'); setSaving(false); return; }
      savedInvoiceId = data.id;
      
      // Auto-generate preliminary QR for new invoices
      await generatePreliminaryQr(savedInvoiceId, company, issueDate, total, taxTotal);
    }

    const itemPayloads = items.map((it) => {
      const { lineNet, taxAmt } = calcLine(it);
      return {
        invoice_id: savedInvoiceId,
        product_id: it.product_id || null,
        description: it.description,
        quantity: parseFloat(it.quantity) || 0,
        unit_price: parseFloat(it.unit_price) || 0,
        discount: parseFloat(it.discount) || 0,
        tax_rate: parseFloat(it.tax_rate) || 0,
        line_total: lineNet + taxAmt,
      };
    });

    if (itemPayloads.length > 0) {
      const { error: itemError } = await supabase.from('invoice_items').insert(itemPayloads);
      if (itemError) { toast(itemError.message, 'error'); setSaving(false); return; }
    }

    // Deduct quantities from default warehouse for each product
    for (const item of items) {
      if (!item.product_id) continue;

      const product = products.find((p) => p.id === item.product_id);
      if (!product || !product.default_warehouse_id) continue;

      const qty = parseFloat(item.quantity) || 0;
      if (qty <= 0) continue;

      // Check if inventory record exists
      const { data: existingInv } = await supabase
        .from('warehouse_inventory')
        .select('*')
        .eq('warehouse_id', product.default_warehouse_id)
        .eq('product_id', item.product_id)
        .maybeSingle();

      if (existingInv) {
        // Update existing inventory
        const newQty = Math.max(0, (existingInv.quantity_available || 0) - qty);
        await supabase
          .from('warehouse_inventory')
          .update({ quantity_available: newQty })
          .eq('id', existingInv.id);
      } else {
        // Create new inventory record
        await supabase
          .from('warehouse_inventory')
          .insert({
            warehouse_id: product.default_warehouse_id,
            product_id: item.product_id,
            quantity_available: Math.max(0, product.stock_quantity - qty),
            reorder_quantity: product.min_stock || 20,
          });
      }
    }

    toast(invoiceId ? t('invoices.updated') : t('invoices.created'));
    setSaving(false);
    onBack();
  };

  if (loading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;

  const hasDiscount = items.some((it) => parseFloat(it.discount) > 0);

  return (
    <form onSubmit={save} className="space-y-5 max-w-4xl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-xl text-secondary-500 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors">
          <ArrowLeft size={20} className="rtl:rotate-180" />
        </button>
        <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100 tracking-tight">
          {invoiceId ? t('invoices.edit') : t('invoices.add')}
        </h1>
      </div>

      {/* Invoice meta */}
      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input label={`${t('invoices.number')} *`} value={number} onChange={(e) => setNumber(e.target.value)} required />
          <Select label={`${t('invoices.customer')} *`} value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
            <option value="">{t('invoices.selectCustomer')}</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{lang === 'ar' ? (c.name_ar || c.name) : c.name}</option>
            ))}
          </Select>
          <Input label={t('invoices.issueDate')} type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          <Input label={t('invoices.dueDate')} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label={t('invoices.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="draft">{t('status.draft')}</option>
            <option value="sent">{t('status.sent')}</option>
            <option value="paid">{t('status.paid')}</option>
            <option value="overdue">{t('status.overdue')}</option>
            <option value="cancelled">{t('status.cancelled')}</option>
          </Select>
          {/* Template picker */}
          <div>
            <label className="block text-xs font-semibold text-secondary-600 dark:text-secondary-400 mb-1.5">
              <LayoutTemplate size={12} className="inline me-1" />
              {t('invoices.template')}
            </label>
            <div className="flex gap-2">
              {TEMPLATES.map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setTemplate(tpl)}
                  className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                    template === tpl
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'border-secondary-200 dark:border-secondary-700 text-secondary-500 hover:border-secondary-300 dark:hover:border-secondary-600'
                  }`}
                >
                  {t(`invoices.template${tpl.charAt(0).toUpperCase() + tpl.slice(1)}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Line items */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-200 dark:border-secondary-800">
          <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100">{t('invoices.items')}</h3>
          <Button type="button" variant="secondary" size="sm" onClick={addItem}><Plus size={14} /> {t('invoices.addItem')}</Button>
        </div>

        {items.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-secondary-400 mb-3">{t('invoices.noItems')}</p>
            <Button type="button" variant="secondary" size="sm" onClick={addItem}><Plus size={14} /> {t('invoices.addItem')}</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50">
                  <th className="text-start px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500 min-w-[200px]">{t('invoices.itemDescription')}</th>
                  <th className="text-start px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500 w-20">{t('invoices.itemQuantity')}</th>
                  <th className="text-start px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500 w-28">{t('invoices.itemPrice')}</th>
                  <th className="text-start px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500 w-24">{t('invoices.discount')}</th>
                  <th className="text-start px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500 w-20 hidden sm:table-cell">{t('invoices.itemTax')}</th>
                  <th className="text-start px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-secondary-500 w-28">{t('invoices.itemTotal')}</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                {items.map((it, i) => {
                  const { lineTotal } = calcLine(it);
                  return (
                    <tr key={it.localId}>
                      <td className="px-3 py-2">
                        <select
                          className="input mb-1.5 text-xs"
                          value={it.product_id ?? ''}
                          onChange={(e) => onProductSelect(i, e.target.value)}
                        >
                          <option value="">{t('invoices.selectProduct')}</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{lang === 'ar' ? (p.name_ar || p.name) : p.name}</option>)}
                        </select>
                        <input
                          className="input text-sm"
                          placeholder={t('invoices.itemDescription')}
                          value={it.description}
                          onChange={(e) => updateItem(i, 'description', e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input className="input text-sm" type="number" step="0.01" min="0" value={it.quantity} onChange={(e) => updateItem(i, 'quantity', e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="input text-sm" type="number" step="0.01" min="0" value={it.unit_price} onChange={(e) => updateItem(i, 'unit_price', e.target.value)} />
                      </td>
                      <td className="px-3 py-2">
                        <input className="input text-sm" type="number" step="0.01" min="0" max="100" value={it.discount} onChange={(e) => updateItem(i, 'discount', e.target.value)} placeholder="0" />
                      </td>
                      <td className="px-3 py-2 hidden sm:table-cell">
                        <input className="input text-sm" type="number" step="0.01" min="0" max="100" value={it.tax_rate} onChange={(e) => updateItem(i, 'tax_rate', e.target.value)} />
                      </td>
                      <td className="px-3 py-2 font-bold text-secondary-800 dark:text-secondary-100 whitespace-nowrap">
                        {fmt(lineTotal, company?.currency)}
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => removeItem(i)} className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30 dark:hover:text-danger-400 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals summary */}
        <div className="px-5 py-4 border-t border-secondary-200 dark:border-secondary-800 flex justify-end">
          <div className="w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-secondary-500 dark:text-secondary-400">
              <span>{t('invoices.subtotal')}</span>
              <span className="font-semibold text-secondary-700 dark:text-secondary-300">{fmt(subtotal, company?.currency)}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-orange-500">
                <span>{t('invoices.discountTotal')}</span>
                <span className="font-semibold">- {fmt(discountTotal, company?.currency)}</span>
              </div>
            )}
            <div className="flex justify-between text-secondary-500 dark:text-secondary-400">
              <span>{t('invoices.tax')}</span>
              <span className="font-semibold text-secondary-700 dark:text-secondary-300">{fmt(taxTotal, company?.currency)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-secondary-800 dark:text-secondary-100 pt-2.5 border-t border-secondary-200 dark:border-secondary-800">
              <span>{t('invoices.total')}</span>
              <span>{fmt(total, company?.currency)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Notes & Terms */}
      <Card className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Textarea label={t('invoices.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} hint={t('common.optional')} rows={4} />
          <Textarea label={t('invoices.terms')} value={terms} onChange={(e) => setTerms(e.target.value)} hint={t('common.optional')} rows={4} />
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>{t('invoices.cancel')}</Button>
        <Button type="submit" loading={saving}>{t('invoices.save')}</Button>
      </div>
    </form>
  );
}
