import { useState } from 'react';
import {
  Building2, Users, TrendingUp, DollarSign,
  Activity, Clock, ShieldOff, CheckCircle,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { AreaChart, HorizBarChart, DonutChart } from './Charts';
import { PLAN_COLORS, STATUS_COLORS } from '../../contexts/SubscriptionContext';
import type { PlanId, SubscriptionStatus } from '../../lib/types';

interface AnalyticsData {
  monthly_signups: { month: string; count: number }[];
  monthly_revenue: { month: string; total: number }[];
  plan_distribution: { plan_id: PlanId; count: number }[];
  status_distribution: { status: SubscriptionStatus; count: number }[];
}

interface OverviewStats {
  total: number;
  active: number;
  trialing: number;
  expired: number;
  suspended: number;
  revenue: number;
  signupsThisMonth: number;
  signupsLastMonth: number;
}

const PLAN_CHART_COLORS: Record<PlanId, string> = {
  free_trial: '#94a3b8',
  starter: '#f59e0b',
  pro: '#3b82f6',
  business: '#22c55e',
  enterprise: '#8b5cf6',
};
const STATUS_CHART_COLORS: Record<string, string> = {
  trialing: '#f59e0b',
  active: '#22c55e',
  expired: '#ef4444',
  cancelled: '#94a3b8',
  past_due: '#f97316',
};

function KpiCard({
  label, value, sub, icon, color, trend, trendLabel,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}) {
  return (
    <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>{icon}</div>
        {trend && trendLabel && (
          <span className={`flex items-center gap-1 text-xs font-semibold ${
            trend === 'up' ? 'text-success-600 dark:text-success-400' :
            trend === 'down' ? 'text-danger-600 dark:text-danger-400' :
            'text-secondary-400'
          }`}>
            {trend === 'up' ? <ArrowUpRight size={13} /> : trend === 'down' ? <ArrowDownRight size={13} /> : null}
            {trendLabel}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-secondary-800 dark:text-secondary-100 tracking-tight">{value}</p>
        <p className="text-xs text-secondary-400 font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs text-secondary-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function AdminOverview({
  stats,
  analytics,
  analyticsLoading,
}: {
  stats: OverviewStats;
  analytics: AnalyticsData | null;
  analyticsLoading: boolean;
}) {
  const [revTab, setRevTab] = useState<'signups' | 'revenue'>('signups');

  const signupData = (analytics?.monthly_signups ?? []).map((d) => ({
    label: d.month.slice(5),
    value: d.count,
  }));

  const revenueData = (analytics?.monthly_revenue ?? []).map((d) => ({
    label: d.month.slice(5),
    value: Number(d.total),
  }));

  const planData = (analytics?.plan_distribution ?? []).map((d) => ({
    label: d.plan_id.replace('_', ' '),
    value: d.count,
    color: PLAN_CHART_COLORS[d.plan_id] ?? '#94a3b8',
  }));

  const statusData = (analytics?.status_distribution ?? []).map((d) => ({
    label: d.status,
    value: d.count,
    color: STATUS_CHART_COLORS[d.status] ?? '#94a3b8',
  }));

  const totalSubs = statusData.reduce((s, d) => s + d.value, 0);
  const signupTrend = stats.signupsThisMonth > stats.signupsLastMonth ? 'up' : stats.signupsThisMonth < stats.signupsLastMonth ? 'down' : 'neutral';

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Total Companies"
          value={stats.total}
          icon={<Building2 size={18} />}
          color="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
          trend={signupTrend}
          trendLabel={`${stats.signupsThisMonth} this mo`}
        />
        <KpiCard
          label="Active Plans"
          value={stats.active}
          icon={<CheckCircle size={18} />}
          color="bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400"
        />
        <KpiCard
          label="Trialing"
          value={stats.trialing}
          icon={<Clock size={18} />}
          color="bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400"
        />
        <KpiCard
          label="Expired"
          value={stats.expired}
          icon={<Activity size={18} />}
          color="bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
        />
        <KpiCard
          label="Suspended"
          value={stats.suspended}
          icon={<ShieldOff size={18} />}
          color="bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400"
        />
        <KpiCard
          label="Total Revenue"
          value={`$${stats.revenue.toLocaleString()}`}
          icon={<DollarSign size={18} />}
          color="bg-secondary-50 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-300"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Trend chart */}
        <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200">Trends</h3>
            <div className="flex gap-1 p-0.5 bg-secondary-100 dark:bg-secondary-800 rounded-lg">
              {(['signups', 'revenue'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setRevTab(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    revTab === tab
                      ? 'bg-white dark:bg-secondary-700 text-secondary-800 dark:text-secondary-100 shadow-sm'
                      : 'text-secondary-500 hover:text-secondary-700'
                  }`}
                >
                  {tab === 'signups' ? 'Signups' : 'Revenue'}
                </button>
              ))}
            </div>
          </div>
          {analyticsLoading ? (
            <div className="h-20 flex items-center justify-center text-secondary-400 text-xs">Loading…</div>
          ) : revTab === 'signups' ? (
            signupData.length ? (
              <AreaChart data={signupData} color="#3b82f6" showLabels height={80} />
            ) : (
              <div className="h-20 flex items-center justify-center text-secondary-400 text-xs">No data yet</div>
            )
          ) : (
            revenueData.length ? (
              <AreaChart data={revenueData} color="#22c55e" showLabels height={80} formatValue={(v) => `$${v}`} />
            ) : (
              <div className="h-20 flex items-center justify-center text-secondary-400 text-xs">No revenue recorded yet</div>
            )
          )}

          {/* X-axis months labels */}
          {!analyticsLoading && (revTab === 'signups' ? signupData : revenueData).length > 0 && (
            <div className="flex justify-between mt-2">
              {(revTab === 'signups' ? signupData : revenueData).filter((_, i, arr) =>
                i === 0 || i === Math.floor(arr.length / 2) || i === arr.length - 1
              ).map((d, i) => (
                <span key={i} className="text-[10px] text-secondary-400">{d.label}</span>
              ))}
            </div>
          )}
        </div>

        {/* Distributions */}
        <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5">
          <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200 mb-4">Subscription Mix</h3>
          {analyticsLoading ? (
            <div className="h-20 flex items-center justify-center text-secondary-400 text-xs">Loading…</div>
          ) : (
            <div className="flex gap-5 items-start">
              <DonutChart data={statusData.length ? statusData : [{ label: 'none', value: 1, color: '#e2e8f0' }]} size={100} innerLabel={String(totalSubs)} />
              <div className="flex-1 space-y-1.5 pt-1">
                {statusData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="flex-1 capitalize text-secondary-600 dark:text-secondary-400">{d.label}</span>
                    <span className="font-bold text-secondary-700 dark:text-secondary-200">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Plan distribution */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5">
        <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200 mb-4">Plan Distribution</h3>
        {analyticsLoading ? (
          <div className="h-20 flex items-center justify-center text-secondary-400 text-xs">Loading…</div>
        ) : planData.length ? (
          <HorizBarChart data={planData} formatValue={(v) => `${v} companies`} />
        ) : (
          <p className="text-xs text-secondary-400 text-center py-6">No data yet</p>
        )}
      </div>
    </div>
  );
}

export type { OverviewStats, AnalyticsData };
