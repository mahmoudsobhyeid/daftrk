import { AreaChart, HorizBarChart } from './Charts';
import type { CompanyRow } from './AdminCompanies';

export function AdminRevenue({ companies }: { companies: CompanyRow[] }) {
  const totalRevenue = companies.reduce((s, c) => s + (c.amount_paid ?? 0), 0);
  const paidCount = companies.filter((c) => c.amount_paid > 0).length;
  const avgRevenue = paidCount > 0 ? totalRevenue / paidCount : 0;
  const topCompanies = [...companies].sort((a, b) => (b.amount_paid ?? 0) - (a.amount_paid ?? 0)).slice(0, 10);

  // Revenue by plan
  const revenueByPlan: Record<string, number> = {};
  companies.forEach((c) => {
    if (c.plan_id && c.amount_paid > 0) {
      revenueByPlan[c.plan_id] = (revenueByPlan[c.plan_id] ?? 0) + c.amount_paid;
    }
  });

  const PLAN_COLORS_HEX: Record<string, string> = {
    free_trial: '#94a3b8',
    starter: '#f59e0b',
    pro: '#3b82f6',
    business: '#22c55e',
    enterprise: '#8b5cf6',
  };

  const planRevData = Object.entries(revenueByPlan).map(([plan, revenue]) => ({
    label: plan.replace('_', ' '),
    value: revenue,
    color: PLAN_COLORS_HEX[plan] ?? '#94a3b8',
  })).sort((a, b) => b.value - a.value);

  // Simulated monthly data from companies created_at
  const monthlyData: Record<string, number> = {};
  companies.forEach((c) => {
    if (c.amount_paid > 0) {
      const month = c.created_at.slice(0, 7);
      monthlyData[month] = (monthlyData[month] ?? 0) + c.amount_paid;
    }
  });

  const monthlyChartData = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, total]) => ({ label: month.slice(5), value: total }));

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, sub: 'all time' },
          { label: 'Paying Companies', value: paidCount, sub: `of ${companies.length} total` },
          { label: 'Avg Revenue / Co.', value: `$${avgRevenue.toFixed(0)}`, sub: 'among paying' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5">
            <p className="text-2xl font-black text-secondary-800 dark:text-secondary-100">{kpi.value}</p>
            <p className="text-sm font-semibold text-secondary-500 mt-0.5">{kpi.label}</p>
            <p className="text-xs text-secondary-400">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue trend */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5">
        <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200 mb-4">Revenue Trend</h3>
        {monthlyChartData.length > 1 ? (
          <AreaChart data={monthlyChartData} color="#22c55e" showLabels height={90} formatValue={(v) => `$${v}`} />
        ) : (
          <div className="h-24 flex items-center justify-center text-secondary-400 text-sm">
            Not enough data yet — revenue will appear here once payments are recorded.
          </div>
        )}
      </div>

      {/* Revenue by plan */}
      {planRevData.length > 0 && (
        <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5">
          <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200 mb-4">Revenue by Plan</h3>
          <HorizBarChart data={planRevData} formatValue={(v) => `$${v.toLocaleString()}`} />
        </div>
      )}

      {/* Top companies */}
      <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-secondary-100 dark:border-secondary-800">
          <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200">Top Revenue Companies</h3>
        </div>
        <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
          {topCompanies.filter((c) => c.amount_paid > 0).map((c, i) => (
            <div key={c.id} className="flex items-center gap-4 px-5 py-3">
              <span className="text-sm font-bold text-secondary-400 w-5 shrink-0">{i + 1}</span>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-bold">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-200 truncate">{c.name}</p>
                <p className="text-xs text-secondary-400">{c.plan_id?.replace('_', ' ')}</p>
              </div>
              <div className="text-end shrink-0">
                <p className="text-sm font-bold text-success-600 dark:text-success-400">${c.amount_paid.toLocaleString()}</p>
                {c.payment_reference && <p className="text-xs text-secondary-400">{c.payment_reference}</p>}
              </div>
            </div>
          ))}
          {topCompanies.every((c) => !c.amount_paid) && (
            <div className="px-5 py-12 text-center text-secondary-400 text-sm">
              No revenue recorded yet. Use the Companies tab to record payments.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
