import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Spinner } from '../ui/Feedback';
import { Select } from '../ui/Input';
import { ClipboardList, ShieldCheck, Eye, Ban, Trash2, CreditCard, Calendar, LogIn } from 'lucide-react';

interface AuditLog {
  id: string;
  performed_by: string;
  action: string;
  target_company_id: string | null;
  target_company_name: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  suspend: <Ban size={13} className="text-warning-500" />,
  activate: <ShieldCheck size={13} className="text-success-500" />,
  delete: <Trash2 size={13} className="text-danger-500" />,
  change_plan: <CreditCard size={13} className="text-primary-500" />,
  extend_subscription: <Calendar size={13} className="text-accent-500" />,
  login_as: <LogIn size={13} className="text-secondary-500" />,
  view_as: <Eye size={13} className="text-secondary-400" />,
};

const ACTION_COLORS: Record<string, string> = {
  suspend: 'bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-400',
  activate: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400',
  delete: 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-400',
  change_plan: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400',
  extend_subscription: 'bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-400',
  view_as: 'bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-400',
};

const PAGE_SIZE = 20;

export function AdminAuditLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');

  const load = async (p = 1) => {
    setLoading(true);
    let q = supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((p - 1) * PAGE_SIZE, p * PAGE_SIZE - 1);
    if (actionFilter) q = q.eq('action', actionFilter);
    const { data, count, error } = await q;
    if (error) { toast(error.message, 'error'); }
    else {
      setLogs((data as AuditLog[]) ?? []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  };

  useEffect(() => { load(page); }, [page, actionFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2 text-secondary-700 dark:text-secondary-200">
            <ClipboardList size={16} />
            <span className="text-sm font-bold">{total} audit events</span>
          </div>
          <Select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="w-44 ms-auto">
            <option value="">All Actions</option>
            {['suspend', 'activate', 'delete', 'change_plan', 'extend_subscription', 'view_as'].map((a) => (
              <option key={a} value={a}>{a.replace('_', ' ')}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-3 text-secondary-400">
            <ClipboardList size={32} className="opacity-30" />
            <p className="text-sm font-medium">No audit logs yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-secondary-100 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50 text-[11px] font-bold text-secondary-500 uppercase tracking-wide">
                    <th className="text-start px-4 py-3">Timestamp</th>
                    <th className="text-start px-4 py-3">Action</th>
                    <th className="text-start px-4 py-3">Company</th>
                    <th className="text-start px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-secondary-50 dark:hover:bg-secondary-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-xs font-mono text-secondary-500 dark:text-secondary-400 whitespace-nowrap">
                          {fmtDate(log.created_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${ACTION_COLORS[log.action] ?? 'bg-secondary-100 dark:bg-secondary-800 text-secondary-600'}`}>
                          {ACTION_ICONS[log.action]}
                          {log.action.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">
                          {log.target_company_name ?? '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {log.details && Object.keys(log.details).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(log.details).slice(0, 3).map(([k, v]) => (
                              <span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary-100 dark:bg-secondary-800 rounded-md text-xs text-secondary-600 dark:text-secondary-400">
                                <span className="font-semibold">{k}:</span>{' '}
                                <span className="max-w-[120px] truncate">{String(v)}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-secondary-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-secondary-100 dark:border-secondary-800">
                <p className="text-xs text-secondary-400">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-secondary-200 dark:border-secondary-700 disabled:opacity-40 hover:bg-secondary-50 dark:hover:bg-secondary-800"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-secondary-200 dark:border-secondary-700 disabled:opacity-40 hover:bg-secondary-50 dark:hover:bg-secondary-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
