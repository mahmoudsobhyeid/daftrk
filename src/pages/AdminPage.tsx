import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Button } from '../components/ui/Button';
import { AdminOverview, type OverviewStats, type AnalyticsData } from '../components/admin/AdminOverview';
import type { CompanyRow } from '../components/admin/AdminCompanies';
import { ShieldCheck, RefreshCw } from 'lucide-react';

export function AdminPage() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setAnalyticsLoading(true);

    const [overviewRes, analyticsRes] = await Promise.all([
      supabase.rpc('get_admin_overview'),
      supabase.rpc('get_admin_analytics'),
    ]);

    if (overviewRes.error) toast(overviewRes.error.message, 'error');
    else setCompanies((overviewRes.data as CompanyRow[]) ?? []);
    setLoading(false);

    if (analyticsRes.error) toast(analyticsRes.error.message, 'error');
    else setAnalytics(analyticsRes.data as AnalyticsData);
    setAnalyticsLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats: OverviewStats = {
    total: companies.length,
    active: companies.filter((c) => c.status === 'active').length,
    trialing: companies.filter((c) => c.status === 'trialing').length,
    expired: companies.filter((c) => c.status === 'expired' || c.status === 'cancelled').length,
    suspended: companies.filter((c) => c.is_suspended).length,
    revenue: companies.reduce((s, c) => s + (c.amount_paid ?? 0), 0),
    signupsThisMonth: analytics?.monthly_signups?.slice(-1)[0]?.count ?? 0,
    signupsLastMonth: analytics?.monthly_signups?.slice(-2, -1)[0]?.count ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100 tracking-tight">Overview</h1>
            <p className="text-xs text-secondary-400 mt-0.5">
              {companies.length} companies · ${stats.revenue.toLocaleString()} total revenue
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} loading={loading}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>

      <AdminOverview stats={stats} analytics={analytics} analyticsLoading={analyticsLoading} />
    </div>
  );
}
