import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useToast } from '../../contexts/ToastContext';
import { useCompany } from '../../contexts/CompanyContext';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Feedback';
import { PLAN_COLORS, STATUS_COLORS } from '../../contexts/SubscriptionContext';
import { UsageBar } from './AdminShared';
import {
  Building2, Users, Package, FileText, Search,
  Pencil, Check, X, Eye, Ban, ShieldCheck,
  Trash2, Calendar, CreditCard, AlertTriangle,
  RefreshCw, ChevronDown,
} from 'lucide-react';
import type { Plan, PlanId, SubscriptionStatus } from '../../lib/types';

export interface CompanyRow {
  id: string;
  account_id: string | null;
  name: string;
  name_ar: string | null;
  email: string | null;
  phone: string | null;
  owner_email: string | null;
  created_at: string;
  is_suspended: boolean;
  suspended_at: string | null;
  suspended_reason: string | null;
  subscription_id: string | null;
  plan_id: PlanId | null;
  status: SubscriptionStatus | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  amount_paid: number;
  payment_reference: string | null;
  notes: string | null;
  customer_count: number;
  product_count: number;
  invoice_count: number;
  total_revenue: number;
}

const ALL_PLAN_IDS: PlanId[] = ['free_trial', 'starter', 'pro', 'business', 'enterprise'];
const ALL_STATUSES: SubscriptionStatus[] = ['trialing', 'active', 'expired', 'cancelled', 'past_due'];

async function logAudit(
  performedBy: string,
  action: string,
  row: CompanyRow,
  details?: Record<string, unknown>
) {
  await supabase.from('admin_audit_logs').insert({
    performed_by: performedBy,
    action,
    target_company_id: row.id,
    target_company_name: row.name,
    details: details ?? {},
  });
}

function PlanBadge({ planId }: { planId: PlanId | null }) {
  if (!planId) return <span className="text-secondary-400 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${PLAN_COLORS[planId]}`}>
      {planId.replace('_', ' ')}
    </span>
  );
}

function SubStatusBadge({ status }: { status: SubscriptionStatus | null }) {
  if (!status) return <span className="text-secondary-400 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[status]}`}>
      {status}
    </span>
  );
}

export function AdminCompanies({
  companies,
  plans,
  loading,
  onRefresh,
}: {
  companies: CompanyRow[];
  plans: Plan[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const { toast } = useToast();
  const { viewAsCompany } = useCompany();

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [suspendedFilter, setSuspendedFilter] = useState('');

  // Edit subscription modal
  const [editRow, setEditRow] = useState<CompanyRow | null>(null);
  const [editPlan, setEditPlan] = useState<PlanId>('starter');
  const [editStatus, setEditStatus] = useState<SubscriptionStatus>('active');
  const [editPeriodEnd, setEditPeriodEnd] = useState('');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [editPaymentRef, setEditPaymentRef] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Suspend modal
  const [suspendRow, setSuspendRow] = useState<CompanyRow | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspending, setSuspending] = useState(false);

  // Delete confirm
  const [deleteRow, setDeleteRow] = useState<CompanyRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [actionOpen, setActionOpen] = useState<string | null>(null);

  const planLimits: Record<PlanId, { customers: number | null; products: number | null; invoices: number | null }> = {} as any;
  plans.forEach((p) => {
    planLimits[p.id as PlanId] = { customers: p.max_customers, products: p.max_products, invoices: p.max_invoices };
  });

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || (c.account_id ?? '').toLowerCase().includes(q)
      || c.name.toLowerCase().includes(q)
      || (c.name_ar ?? '').includes(search)
      || (c.email ?? '').toLowerCase().includes(q)
      || (c.owner_email ?? '').toLowerCase().includes(q)
      || (c.phone ?? '').toLowerCase().includes(q);
    const matchPlan = !planFilter || c.plan_id === planFilter;
    const matchStatus = !statusFilter || c.status === statusFilter;
    const matchSuspended =
      suspendedFilter === '' ? true :
      suspendedFilter === 'suspended' ? c.is_suspended :
      !c.is_suspended;
    return matchSearch && matchPlan && matchStatus && matchSuspended;
  });

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '—';

  // Subscription edit
  const openEdit = (row: CompanyRow) => {
    setEditRow(row);
    setEditPlan(row.plan_id ?? 'starter');
    setEditStatus(row.status ?? 'active');
    setEditPeriodEnd(row.current_period_end ? row.current_period_end.slice(0, 10) : '');
    setEditAmountPaid(String(row.amount_paid ?? 0));
    setEditPaymentRef(row.payment_reference ?? '');
    setEditNotes(row.notes ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editRow?.subscription_id || !user) return;
    setEditSaving(true);
    const { error } = await supabase.from('subscriptions').update({
      plan_id: editPlan,
      status: editStatus,
      current_period_end: editPeriodEnd || null,
      amount_paid: parseFloat(editAmountPaid) || 0,
      payment_reference: editPaymentRef || null,
      notes: editNotes || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editRow.subscription_id);
    if (error) { toast(error.message, 'error'); setEditSaving(false); return; }
    await logAudit(user.id, 'change_plan', editRow, { old_plan: editRow.plan_id, new_plan: editPlan, new_status: editStatus });
    toast(t('admin.subscriptionUpdated'));
    setEditSaving(false);
    setEditRow(null);
    onRefresh();
  };

  // Suspend / Activate
  const handleSuspend = async () => {
    if (!suspendRow || !user) return;
    setSuspending(true);
    const { error } = await supabase.from('companies').update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspended_reason: suspendReason || null,
    }).eq('id', suspendRow.id);
    if (error) { toast(error.message, 'error'); setSuspending(false); return; }
    await logAudit(user.id, 'suspend', suspendRow, { reason: suspendReason });
    toast('Company suspended');
    setSuspending(false);
    setSuspendRow(null);
    setSuspendReason('');
    onRefresh();
  };

  const handleActivate = async (row: CompanyRow) => {
    if (!user) return;
    const { error } = await supabase.from('companies').update({
      is_suspended: false,
      suspended_at: null,
      suspended_reason: null,
    }).eq('id', row.id);
    if (error) { toast(error.message, 'error'); return; }
    await logAudit(user.id, 'activate', row, {});
    toast('Company activated');
    onRefresh();
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteRow || !user || deleteConfirm !== deleteRow.name) return;
    setDeleting(true);
    await logAudit(user.id, 'delete', deleteRow, { company_id: deleteRow.id });
    const { error } = await supabase.from('companies').delete().eq('id', deleteRow.id);
    if (error) { toast(error.message, 'error'); setDeleting(false); return; }
    toast('Company deleted');
    setDeleting(false);
    setDeleteRow(null);
    setDeleteConfirm('');
    onRefresh();
  };

  // View As
  const handleViewAs = (row: CompanyRow) => {
    viewAsCompany(row.id, row.name);
    setActionOpen(null);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-52">
            <Input
              placeholder="Search by Account ID, company, phone, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={15} />}
            />
          </div>
          <Select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="w-36">
            <option value="">All Plans</option>
            {ALL_PLAN_IDS.map((id) => <option key={id} value={id}>{id.replace('_', ' ')}</option>)}
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36">
            <option value="">All Statuses</option>
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={suspendedFilter} onChange={(e) => setSuspendedFilter(e.target.value)} className="w-36">
            <option value="">All</option>
            <option value="active">Active Only</option>
            <option value="suspended">Suspended Only</option>
          </Select>
          <div className="text-xs text-secondary-400 self-center">{filtered.length} of {companies.length}</div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw size={13} />
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-secondary-400 gap-3">
            <Building2 size={32} className="opacity-30" />
            <p className="text-sm font-medium">No companies found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50 text-[11px] font-bold text-secondary-500 uppercase tracking-wide">
                  <th className="text-start px-4 py-3">Account ID</th>
                  <th className="text-start px-4 py-3">Company</th>
                  <th className="text-start px-4 py-3">Plan</th>
                  <th className="text-start px-4 py-3">Status</th>
                  <th className="text-start px-4 py-3">Expires</th>
                  <th className="text-start px-4 py-3">Usage</th>
                  <th className="text-start px-4 py-3">Revenue</th>
                  <th className="text-end px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                {filtered.map((row) => {
                  const limits = row.plan_id ? planLimits[row.plan_id] : null;
                  return (
                    <tr key={row.id} className={`transition-colors hover:bg-secondary-50 dark:hover:bg-secondary-800/40 ${row.is_suspended ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary-100 dark:bg-secondary-800 text-xs font-bold text-secondary-600 dark:text-secondary-300 tracking-wide">
                          {row.account_id ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        <div className="flex items-start gap-2">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            row.is_suspended
                              ? 'bg-danger-100 text-danger-600 dark:bg-danger-900/20 dark:text-danger-400'
                              : 'bg-primary-100 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                          }`}>
                            {row.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-secondary-800 dark:text-secondary-100 truncate">{row.name}</p>
                            <p className="text-xs text-secondary-400 truncate">{row.owner_email ?? row.email ?? '—'}</p>
                            {row.phone && (
                              <p className="text-xs text-secondary-400 truncate">{row.phone}</p>
                            )}
                            <p className="text-xs text-secondary-400">{fmtDate(row.created_at)}</p>
                            {row.is_suspended && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-danger-600 dark:text-danger-400">
                                <Ban size={10} /> Suspended
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><PlanBadge planId={row.plan_id} /></td>
                      <td className="px-4 py-3"><SubStatusBadge status={row.status} /></td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-secondary-500">
                          {row.status === 'trialing' ? fmtDate(row.trial_ends_at) : fmtDate(row.current_period_end)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1.5 min-w-[110px]">
                          <div className="flex items-center gap-1.5">
                            <Users size={10} className="text-secondary-400 shrink-0" />
                            <UsageBar value={row.customer_count} max={limits?.customers ?? null} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Package size={10} className="text-secondary-400 shrink-0" />
                            <UsageBar value={row.product_count} max={limits?.products ?? null} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <FileText size={10} className="text-secondary-400 shrink-0" />
                            <UsageBar value={row.invoice_count} max={limits?.invoices ?? null} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">
                          ${(row.amount_paid ?? 0).toLocaleString()}
                        </p>
                        {row.payment_reference && (
                          <p className="text-xs text-secondary-400">{row.payment_reference}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => handleViewAs(row)} title="View As">
                            <Eye size={13} />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openEdit(row)}>
                            <Pencil size={13} />
                            Edit
                          </Button>
                          <div className="relative">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setActionOpen(actionOpen === row.id ? null : row.id)}
                            >
                              <ChevronDown size={13} />
                            </Button>
                            {actionOpen === row.id && (
                              <div className="absolute end-0 top-full mt-1 z-20 bg-white dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-xl shadow-lg py-1 min-w-[160px]">
                                <button
                                  className="w-full text-start px-4 py-2 text-xs font-semibold hover:bg-secondary-50 dark:hover:bg-secondary-700 flex items-center gap-2 text-secondary-700 dark:text-secondary-200"
                                  onClick={() => { handleViewAs(row); }}
                                >
                                  <Eye size={13} /> View As Company
                                </button>
                                {row.is_suspended ? (
                                  <button
                                    className="w-full text-start px-4 py-2 text-xs font-semibold hover:bg-secondary-50 dark:hover:bg-secondary-700 flex items-center gap-2 text-success-600"
                                    onClick={() => { handleActivate(row); setActionOpen(null); }}
                                  >
                                    <ShieldCheck size={13} /> Activate
                                  </button>
                                ) : (
                                  <button
                                    className="w-full text-start px-4 py-2 text-xs font-semibold hover:bg-secondary-50 dark:hover:bg-secondary-700 flex items-center gap-2 text-warning-600"
                                    onClick={() => { setSuspendRow(row); setSuspendReason(''); setActionOpen(null); }}
                                  >
                                    <Ban size={13} /> Suspend
                                  </button>
                                )}
                                <div className="my-1 border-t border-secondary-100 dark:border-secondary-700" />
                                <button
                                  className="w-full text-start px-4 py-2 text-xs font-semibold hover:bg-danger-50 dark:hover:bg-danger-900/20 flex items-center gap-2 text-danger-600"
                                  onClick={() => { setDeleteRow(row); setDeleteConfirm(''); setActionOpen(null); }}
                                >
                                  <Trash2 size={13} /> Delete Company
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Subscription Modal */}
      <Modal open={!!editRow} onClose={() => setEditRow(null)} title={`Edit Subscription — ${editRow?.name ?? ''}`} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Plan</label>
              <Select value={editPlan} onChange={(e) => setEditPlan(e.target.value as PlanId)}>
                {ALL_PLAN_IDS.map((id) => <option key={id} value={id}>{id.replace('_', ' ')}</option>)}
              </Select>
            </div>
            <div>
              <label className="label">Status</label>
              <Select value={editStatus} onChange={(e) => setEditStatus(e.target.value as SubscriptionStatus)}>
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>
          <Input type="date" label="Period End Date" value={editPeriodEnd} onChange={(e) => setEditPeriodEnd(e.target.value)} icon={<Calendar size={15} />} />
          <div className="grid grid-cols-2 gap-4">
            <Input type="number" label="Amount Paid ($)" value={editAmountPaid} onChange={(e) => setEditAmountPaid(e.target.value)} icon={<CreditCard size={15} />} />
            <Input label="Payment Reference" value={editPaymentRef} onChange={(e) => setEditPaymentRef(e.target.value)} placeholder="INV-2026-001" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              className="input w-full resize-none"
              placeholder="Internal notes…"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={handleSaveEdit} loading={editSaving}>
              <Check size={15} /> Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Suspend Modal */}
      <Modal open={!!suspendRow} onClose={() => setSuspendRow(null)} title={`Suspend — ${suspendRow?.name ?? ''}`} size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-warning-50 dark:bg-warning-900/10 border border-warning-100 dark:border-warning-900/30">
            <AlertTriangle size={16} className="text-warning-600 shrink-0 mt-0.5" />
            <p className="text-sm text-warning-700 dark:text-warning-400">
              The company's users will see a suspended notice on login.
            </p>
          </div>
          <Input
            label="Reason (optional)"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            placeholder="e.g. Payment overdue"
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setSuspendRow(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleSuspend} loading={suspending}>
              <Ban size={15} /> Suspend Company
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteRow} onClose={() => setDeleteRow(null)} title={`Delete — ${deleteRow?.name ?? ''}`} size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-danger-50 dark:bg-danger-900/10 border border-danger-100 dark:border-danger-900/30">
            <AlertTriangle size={16} className="text-danger-600 shrink-0 mt-0.5" />
            <p className="text-sm text-danger-700 dark:text-danger-400">
              This permanently deletes the company and ALL its data including customers, products, invoices and subscriptions.
            </p>
          </div>
          <Input
            label={`Type "${deleteRow?.name}" to confirm`}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder={deleteRow?.name}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteRow(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} disabled={deleteConfirm !== deleteRow?.name}>
              <Trash2 size={15} /> Delete Forever
            </Button>
          </div>
        </div>
      </Modal>

      {/* Click-outside handler */}
      {actionOpen && <div className="fixed inset-0 z-10" onClick={() => setActionOpen(null)} />}
    </div>
  );
}
