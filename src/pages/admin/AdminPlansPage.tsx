import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Spinner } from '../../components/ui/Feedback';
import { Package, RefreshCw, Pencil, Check, Star, DollarSign } from 'lucide-react';
import type { Plan, PlanId } from '../../lib/types';

export function AdminPlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editMonthly, setEditMonthly] = useState('');
  const [editYearly, setEditYearly] = useState('');
  const [editMaxCustomers, setEditMaxCustomers] = useState('');
  const [editMaxProducts, setEditMaxProducts] = useState('');
  const [editMaxInvoices, setEditMaxInvoices] = useState('');
  const [editHighlight, setEditHighlight] = useState(false);
  const [editActive, setEditActive] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('plans').select('*').order('sort_order');
    if (error) toast(error.message, 'error');
    else setPlans((data as Plan[]).map((p) => ({
      ...p,
      features: Array.isArray(p.features) ? p.features : JSON.parse(p.features as unknown as string),
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (p: Plan) => {
    setEditPlan(p);
    setEditMonthly(String(p.price_monthly));
    setEditYearly(String(p.price_yearly));
    setEditMaxCustomers(p.max_customers === null ? '' : String(p.max_customers));
    setEditMaxProducts(p.max_products === null ? '' : String(p.max_products));
    setEditMaxInvoices(p.max_invoices === null ? '' : String(p.max_invoices));
    setEditHighlight(p.highlight);
    setEditActive(p.is_active);
  };

  const handleSave = async () => {
    if (!editPlan) return;
    setSaving(true);
    const { error } = await supabase.from('plans').update({
      price_monthly: parseFloat(editMonthly) || 0,
      price_yearly: parseFloat(editYearly) || 0,
      max_customers: editMaxCustomers === '' ? null : parseInt(editMaxCustomers),
      max_products: editMaxProducts === '' ? null : parseInt(editMaxProducts),
      max_invoices: editMaxInvoices === '' ? null : parseInt(editMaxInvoices),
      highlight: editHighlight,
      is_active: editActive,
    }).eq('id', editPlan.id);
    if (error) toast(error.message, 'error');
    else { toast('Plan updated'); setEditPlan(null); await load(); }
    setSaving(false);
  };

  const PLAN_COLORS: Record<PlanId, string> = {
    free_trial: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300',
    starter: 'bg-accent-50 text-accent-700 dark:bg-accent-900/20 dark:text-accent-400',
    pro: 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400',
    business: 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400',
    enterprise: 'bg-warning-50 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400">
            <Package size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100 tracking-tight">Plans</h1>
            <p className="text-xs text-secondary-400 mt-0.5">{plans.length} plans configured</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.id}
              className={`relative bg-white dark:bg-secondary-900 rounded-2xl border overflow-hidden ${
                p.highlight
                  ? 'border-primary-300 dark:border-primary-700 shadow-lg shadow-primary-100 dark:shadow-none'
                  : 'border-secondary-200 dark:border-secondary-700'
              } ${!p.is_active ? 'opacity-60' : ''}`}
            >
              {p.highlight && (
                <div className="absolute top-3 end-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-primary-500 text-white">
                    <Star size={9} /> Popular
                  </span>
                </div>
              )}
              {!p.is_active && (
                <div className="absolute top-3 start-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-secondary-200 text-secondary-600 dark:bg-secondary-700 dark:text-secondary-400">
                    Inactive
                  </span>
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${PLAN_COLORS[p.id as PlanId] ?? ''}`}>
                      {p.id.replace('_', ' ')}
                    </span>
                    <h3 className="mt-2 text-lg font-black text-secondary-800 dark:text-secondary-100">{p.name}</h3>
                    {p.name_ar && <p className="text-sm text-secondary-400" dir="rtl">{p.name_ar}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-secondary-50 dark:bg-secondary-800">
                    <p className="text-xs text-secondary-400 font-medium">Monthly</p>
                    <p className="text-xl font-black text-secondary-800 dark:text-secondary-100">
                      {p.price_monthly === 0 ? 'Free' : `${p.price_monthly} EGP`}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary-50 dark:bg-secondary-800">
                    <p className="text-xs text-secondary-400 font-medium">Yearly</p>
                    <p className="text-xl font-black text-secondary-800 dark:text-secondary-100">
                      {p.price_yearly === 0 ? 'Free' : `${p.price_yearly} EGP`}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {[
                    { label: 'Max Customers', value: p.max_customers },
                    { label: 'Max Products', value: p.max_products },
                    { label: 'Max Invoices', value: p.max_invoices },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-xs">
                      <span className="text-secondary-500">{item.label}</span>
                      <span className="font-semibold text-secondary-700 dark:text-secondary-300">
                        {item.value === null ? 'Unlimited' : item.value.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(p)}>
                  <Pencil size={13} /> Edit Plan
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={!!editPlan} onClose={() => setEditPlan(null)} title={`Edit Plan — ${editPlan?.name ?? ''}`} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Monthly Price ($)"
              value={editMonthly}
              onChange={(e) => setEditMonthly(e.target.value)}
              icon={<DollarSign size={15} />}
            />
            <Input
              type="number"
              label="Yearly Price ($)"
              value={editYearly}
              onChange={(e) => setEditYearly(e.target.value)}
              icon={<DollarSign size={15} />}
            />
          </div>
          <p className="text-xs text-secondary-400">Leave limits blank for unlimited.</p>
          <div className="grid grid-cols-3 gap-3">
            <Input
              type="number"
              label="Max Customers"
              value={editMaxCustomers}
              onChange={(e) => setEditMaxCustomers(e.target.value)}
              placeholder="Unlimited"
            />
            <Input
              type="number"
              label="Max Products"
              value={editMaxProducts}
              onChange={(e) => setEditMaxProducts(e.target.value)}
              placeholder="Unlimited"
            />
            <Input
              type="number"
              label="Max Invoices"
              value={editMaxInvoices}
              onChange={(e) => setEditMaxInvoices(e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editHighlight}
                onChange={(e) => setEditHighlight(e.target.checked)}
                className="h-4 w-4 rounded accent-primary-500"
              />
              <span className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">Mark as Popular</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                className="h-4 w-4 rounded accent-success-500"
              />
              <span className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">Active</span>
            </label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditPlan(null)}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              <Check size={15} /> Save Changes
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
