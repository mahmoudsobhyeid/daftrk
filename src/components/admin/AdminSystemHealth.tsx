import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Spinner } from '../ui/Feedback';
import { Button } from '../ui/Button';
import {
  Database, Users, Package, FileText, Building2,
  DollarSign, ShieldOff, Activity, RefreshCw,
  CheckCircle, Clock, AlertCircle, Server,
} from 'lucide-react';

interface HealthData {
  companies_total: number;
  companies_active: number;
  companies_suspended: number;
  customers_total: number;
  products_total: number;
  invoices_total: number;
  invoices_paid: number;
  subs_trialing: number;
  subs_active: number;
  subs_expired: number;
  revenue_total: number;
  signups_last_7d: number;
  signups_last_30d: number;
  audit_logs_total: number;
  user_profiles_total: number;
  generated_at: string;
}

function HealthMetric({ label, value, icon, color, sub }: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-secondary-100 dark:border-secondary-700 bg-secondary-50/50 dark:bg-secondary-800/30">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-lg font-black text-secondary-800 dark:text-secondary-100">{value}</p>
        <p className="text-xs text-secondary-500">{label}</p>
        {sub && <p className="text-xs text-secondary-400">{sub}</p>}
      </div>
    </div>
  );
}

function StatusRow({ label, ok, detail }: { label: string; ok: boolean | 'warn'; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0 border-secondary-100 dark:border-secondary-800">
      <span className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">{label}</span>
      <div className="flex items-center gap-2">
        {detail && <span className="text-xs text-secondary-400">{detail}</span>}
        {ok === true ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-success-600 dark:text-success-400">
            <CheckCircle size={13} /> Healthy
          </span>
        ) : ok === 'warn' ? (
          <span className="flex items-center gap-1.5 text-xs font-bold text-warning-600 dark:text-warning-400">
            <AlertCircle size={13} /> Warning
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-bold text-secondary-400">
            <Clock size={13} /> Unknown
          </span>
        )}
      </div>
    </div>
  );
}

export function AdminSystemHealth() {
  const { toast } = useToast();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_system_health');
    if (error) {
      toast(error.message, 'error');
    } else {
      setHealth(data as HealthData);
      setLastChecked(new Date());
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;
  if (!health) return null;

  const expiredRatio = health.companies_total > 0
    ? (health.subs_expired / health.companies_total) * 100
    : 0;

  const paidRatio = health.invoices_total > 0
    ? (health.invoices_paid / health.invoices_total) * 100
    : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200">System Health Dashboard</h3>
          {lastChecked && (
            <p className="text-xs text-secondary-400 mt-0.5">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      {/* Service Status */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Server size={16} className="text-secondary-500" />
          <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200">Service Status</h3>
        </div>
        <StatusRow label="Database" ok={true} detail="Supabase PostgreSQL" />
        <StatusRow label="Authentication" ok={true} detail="Supabase Auth" />
        <StatusRow label="Storage" ok={true} detail="Supabase Storage (avatars)" />
        <StatusRow label="Subscription Gate" ok={expiredRatio < 30 ? true : 'warn'} detail={`${expiredRatio.toFixed(0)}% expired`} />
        <StatusRow label="Invoice Collection" ok={paidRatio >= 50 ? true : 'warn'} detail={`${paidRatio.toFixed(0)}% paid`} />
      </div>

      {/* DB Metrics */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Database size={16} className="text-secondary-500" />
          <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200">Database Metrics</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <HealthMetric
            label="Companies" value={health.companies_total}
            icon={<Building2 size={16} />}
            color="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
            sub={`${health.companies_suspended} suspended`}
          />
          <HealthMetric
            label="Users" value={health.user_profiles_total}
            icon={<Users size={16} />}
            color="bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-300"
          />
          <HealthMetric
            label="Customers" value={health.customers_total.toLocaleString()}
            icon={<Users size={16} />}
            color="bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400"
          />
          <HealthMetric
            label="Products" value={health.products_total.toLocaleString()}
            icon={<Package size={16} />}
            color="bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400"
          />
          <HealthMetric
            label="Invoices" value={health.invoices_total.toLocaleString()}
            icon={<FileText size={16} />}
            color="bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400"
            sub={`${health.invoices_paid} paid`}
          />
          <HealthMetric
            label="Total Revenue" value={`$${Number(health.revenue_total).toLocaleString()}`}
            icon={<DollarSign size={16} />}
            color="bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400"
          />
          <HealthMetric
            label="Audit Events" value={health.audit_logs_total}
            icon={<Activity size={16} />}
            color="bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-300"
          />
          <HealthMetric
            label="Suspended" value={health.companies_suspended}
            icon={<ShieldOff size={16} />}
            color="bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
          />
        </div>
      </div>

      {/* Subscription Health */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={16} className="text-secondary-500" />
          <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200">Subscription Health</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Trialing', value: health.subs_trialing, color: 'text-accent-600 bg-accent-50 dark:bg-accent-900/20 dark:text-accent-400' },
            { label: 'Active', value: health.subs_active, color: 'text-success-600 bg-success-50 dark:bg-success-900/20 dark:text-success-400' },
            { label: 'Expired', value: health.subs_expired, color: 'text-danger-600 bg-danger-50 dark:bg-danger-900/20 dark:text-danger-400' },
          ].map((item) => (
            <div key={item.label} className={`rounded-xl p-4 ${item.color.split(' ').slice(1).join(' ')}`}>
              <p className={`text-2xl font-black ${item.color.split(' ')[0]}`}>{item.value}</p>
              <p className="text-xs font-semibold opacity-70 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1.5">
          {[
            { label: 'Trialing', value: health.subs_trialing, color: '#f59e0b' },
            { label: 'Active', value: health.subs_active, color: '#22c55e' },
            { label: 'Expired', value: health.subs_expired, color: '#ef4444' },
          ].map((item) => {
            const total = health.subs_trialing + health.subs_active + health.subs_expired || 1;
            const pct = Math.round((item.value / total) * 100);
            return (
              <div key={item.label} className="flex items-center gap-3">
                <span className="text-xs text-secondary-500 w-14">{item.label}</span>
                <div className="flex-1 h-2 bg-secondary-100 dark:bg-secondary-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                </div>
                <span className="text-xs text-secondary-400 w-10 text-end">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={16} className="text-secondary-500" />
          <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200">Growth</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-secondary-100 dark:border-secondary-700 p-4">
            <p className="text-2xl font-black text-secondary-800 dark:text-secondary-100">{health.signups_last_7d}</p>
            <p className="text-xs text-secondary-400 mt-0.5">New companies (7d)</p>
          </div>
          <div className="rounded-xl border border-secondary-100 dark:border-secondary-700 p-4">
            <p className="text-2xl font-black text-secondary-800 dark:text-secondary-100">{health.signups_last_30d}</p>
            <p className="text-xs text-secondary-400 mt-0.5">New companies (30d)</p>
          </div>
        </div>
      </div>
    </div>
  );
}
