import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency, useFormatDate } from '../lib/format';
import { Card } from '../components/ui/Card';
import { Skeleton, EmptyState } from '../components/ui/Feedback';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import {
  DollarSign, FileText, Users, Package, Plus, UserPlus,
  AlertTriangle, ArrowUpRight, ArrowDownRight, TrendingUp, Activity, Award,
} from 'lucide-react';
import type { InvoiceWithCustomer, InvoiceStatus, Customer } from '../lib/types';
import type { PageKey } from '../components/AppLayout';

interface DashboardProps {
  onNavigate: (page: PageKey) => void;
}

interface Stats {
  totalRevenue: number;
  paidCount: number;
  outstanding: number;
  customerCount: number;
  productCount: number;
  invoiceCount: number;
  overdueCount: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  statusBreakdown: Record<InvoiceStatus, number>;
  monthlySales: { month: string; total: number }[];
  topCustomers: { id: string; name: string; name_ar: string | null; total: number; count: number }[];
  latestCustomers: Customer[];
  recentInvoices: InvoiceWithCustomer[];
  activity: ActivityItem[];
}

interface ActivityItem {
  id: string;
  type: 'customer' | 'invoice' | 'paid' | 'product';
  label: string;
  sub: string;
  created_at: string;
}

const monthLabelsEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabelsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function DashboardPage({ onNavigate }: DashboardProps) {
  const { t, lang } = useLanguage();
  const { company } = useCompany();
  const { user } = useAuth();
  const fmt = useCurrency();
  const fmtDate = useFormatDate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const [invRes, custRes, prodRes, recentCustRes] = await Promise.all([
        supabase.from('invoices').select('id, number, status, issue_date, created_at, total, customer_id, customer:customers(id,name,name_ar,email)').eq('company_id', company.id).order('created_at', { ascending: false }),
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('customers').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(5),
      ]);

      if (cancelled) return;

      const invoices = (invRes.data ?? []) as InvoiceWithCustomer[];
      const latestCustomers = (recentCustRes.data ?? []) as Customer[];

      const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0);
      const outstanding = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + Number(i.total), 0);
      const paidCount = invoices.filter((i) => i.status === 'paid').length;
      const overdueCount = invoices.filter((i) => i.status === 'overdue').length;

      const statusBreakdown: Record<InvoiceStatus, number> = { draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0 };
      invoices.forEach((i) => { statusBreakdown[i.status]++; });

      const now = new Date();
      const monthlySales: { month: string; total: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const total = invoices
          .filter((inv) => inv.status === 'paid' && inv.issue_date.startsWith(key))
          .reduce((s, inv) => s + Number(inv.total), 0);
        const labels = lang === 'ar' ? monthLabelsAr : monthLabelsEn;
        monthlySales.push({ month: labels[d.getMonth()], total });
      }

      const thisKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const lastD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastKey = `${lastD.getFullYear()}-${String(lastD.getMonth() + 1).padStart(2, '0')}`;
      const thisMonthRevenue = invoices.filter((i) => i.status === 'paid' && i.issue_date.startsWith(thisKey)).reduce((s, i) => s + Number(i.total), 0);
      const lastMonthRevenue = invoices.filter((i) => i.status === 'paid' && i.issue_date.startsWith(lastKey)).reduce((s, i) => s + Number(i.total), 0);

      const custMap = new Map<string, { name: string; name_ar: string | null; total: number; count: number }>();
      invoices.filter((i) => i.status === 'paid').forEach((inv) => {
        if (!inv.customer) return;
        const existing = custMap.get(inv.customer_id) ?? { name: inv.customer.name, name_ar: inv.customer.name_ar, total: 0, count: 0 };
        existing.total += Number(inv.total);
        existing.count += 1;
        custMap.set(inv.customer_id, existing);
      });
      const topCustomers = Array.from(custMap.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const activity: ActivityItem[] = [
        ...latestCustomers.map((c) => ({
          id: `c-${c.id}`, type: 'customer' as const,
          label: lang === 'ar' ? (c.name_ar || c.name) : c.name,
          sub: t('dashboard.customerAdded'),
          created_at: c.created_at,
        })),
        ...invoices.slice(0, 8).map((inv) => ({
          id: `i-${inv.id}`,
          type: inv.status === 'paid' ? 'paid' as const : 'invoice' as const,
          label: inv.number,
          sub: inv.status === 'paid' ? t('dashboard.invoicePaid') : t('dashboard.invoiceCreated'),
          created_at: inv.created_at,
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8);

      setStats({
        totalRevenue, paidCount, outstanding,
        customerCount: custRes.count ?? 0,
        productCount: prodRes.count ?? 0,
        invoiceCount: invoices.length,
        overdueCount,
        thisMonthRevenue, lastMonthRevenue,
        statusBreakdown, monthlySales, topCustomers,
        latestCustomers, recentInvoices: invoices.slice(0, 5), activity,
      });
      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [company, lang, t]);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

  const revenueDelta = useMemo(() => {
    if (!stats) return 0;
    if (stats.lastMonthRevenue === 0) return stats.thisMonthRevenue > 0 ? 100 : 0;
    return ((stats.thisMonthRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue) * 100;
  }, [stats]);

  if (loading) return <DashboardSkeleton />;

  const statCards = [
    { label: t('dashboard.totalRevenue'), value: fmt(stats?.totalRevenue ?? 0, company?.currency), icon: DollarSign, bg: 'bg-success-50 dark:bg-success-900/20', text: 'text-success-600 dark:text-success-400', delta: revenueDelta, showDelta: true },
    { label: t('dashboard.totalCustomers'), value: String(stats?.customerCount ?? 0), icon: Users, bg: 'bg-primary-50 dark:bg-primary-900/20', text: 'text-primary-600 dark:text-primary-400' },
    { label: t('dashboard.totalProducts'), value: String(stats?.productCount ?? 0), icon: Package, bg: 'bg-accent-50 dark:bg-accent-900/20', text: 'text-accent-600 dark:text-accent-400' },
    { label: t('dashboard.totalInvoices'), value: String(stats?.invoiceCount ?? 0), icon: FileText, bg: 'bg-warning-50 dark:bg-warning-900/20', text: 'text-warning-600 dark:text-warning-400' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100 tracking-tight">
            {t('dashboard.welcome')}, {userName}
          </h1>
          <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">{t('app.tagline')}</p>
        </div>
        <Button onClick={() => onNavigate('invoices')}>
          <Plus size={16} /> {t('dashboard.newInvoice')}
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} variant="hover" className="p-5 animate-slide-up">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">{s.label}</p>
                  <p className="mt-2.5 text-2xl font-bold text-secondary-800 dark:text-secondary-100 truncate">{s.value}</p>
                  {s.showDelta && (
                    <div className="mt-1.5 flex items-center gap-1">
                      {s.delta >= 0 ? (
                        <ArrowUpRight size={14} className="text-success-500" />
                      ) : (
                        <ArrowDownRight size={14} className="text-danger-500" />
                      )}
                      <span className={`text-xs font-semibold ${s.delta >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'}`}>
                        {Math.abs(s.delta).toFixed(0)}%
                      </span>
                      <span className="text-xs text-secondary-400">{t('dashboard.vsLastMonth')}</span>
                    </div>
                  )}
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.bg} ${s.text} shrink-0`}>
                  <Icon size={20} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div>
        <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-300 mb-3">{t('dashboard.quickActions')}</h3>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => onNavigate('invoices')}>
            <Plus size={16} /> {t('dashboard.newInvoice')}
          </Button>
          <Button variant="secondary" onClick={() => onNavigate('customers')}>
            <UserPlus size={16} /> {t('dashboard.newCustomer')}
          </Button>
          <Button variant="secondary" onClick={() => onNavigate('products')}>
            <Plus size={16} /> {t('dashboard.newProduct')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100">{t('dashboard.salesChart')}</h3>
              <p className="text-xs text-secondary-400 mt-0.5">{t('dashboard.revenue')} · {t('dashboard.thisMonth')}: {fmt(stats?.thisMonthRevenue ?? 0, company?.currency)}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
              <TrendingUp size={18} />
            </div>
          </div>
          <SalesChart data={stats?.monthlySales ?? []} fmt={fmt} lang={lang} />
        </Card>

        <Card className="p-5">
          <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100 mb-4">{t('dashboard.invoiceStatusBreakdown')}</h3>
          <DonutChart breakdown={stats?.statusBreakdown ?? { draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0 }} total={stats?.invoiceCount ?? 0} t={t} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-200 dark:border-secondary-800">
            <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100">{t('dashboard.recentInvoices')}</h3>
            <button onClick={() => onNavigate('invoices')} className="flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors">
              {t('dashboard.viewAll')}
              <ArrowUpRight size={14} className="rtl:rotate-90" />
            </button>
          </div>
          {stats && stats.recentInvoices.length === 0 ? (
            <EmptyState
              icon={<FileText size={28} />}
              title={t('invoices.empty')}
              description={t('dashboard.noInvoices')}
              action={<Button size="sm" onClick={() => onNavigate('invoices')}><Plus size={14} /> {t('invoices.add')}</Button>}
            />
          ) : (
            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              {stats?.recentInvoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-secondary-50/70 dark:hover:bg-secondary-800/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary-100 dark:bg-secondary-800 text-secondary-500 shrink-0">
                      <FileText size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-secondary-800 dark:text-secondary-100 truncate">{inv.number}</p>
                      <p className="text-xs text-secondary-400 truncate">
                        {lang === 'ar' ? (inv.customer?.name_ar || inv.customer?.name) : (inv.customer?.name || inv.customer?.name_ar) || '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={inv.status} />
                    <p className="text-sm font-bold text-secondary-800 dark:text-secondary-100 hidden sm:block w-20 text-end">{fmt(Number(inv.total), company?.currency)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award size={18} className="text-accent-500" />
            <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100">{t('dashboard.topCustomers')}</h3>
          </div>
          {stats && stats.topCustomers.length === 0 ? (
            <p className="text-sm text-secondary-400 py-8 text-center">{t('dashboard.noTopCustomers')}</p>
          ) : (
            <div className="space-y-3">
              {stats?.topCustomers.map((c, i) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary-100 dark:bg-secondary-800 text-xs font-bold text-secondary-500 shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-secondary-800 dark:text-secondary-100 truncate">{lang === 'ar' ? (c.name_ar || c.name) : c.name}</p>
                    <p className="text-xs text-secondary-400">{c.count} {t('invoices.title').toLowerCase()}</p>
                  </div>
                  <p className="text-sm font-bold text-secondary-800 dark:text-secondary-100 shrink-0">{fmt(c.total, company?.currency)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-200 dark:border-secondary-800">
            <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100">{t('dashboard.latestCustomers')}</h3>
            <button onClick={() => onNavigate('customers')} className="flex items-center gap-1 text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors">
              {t('dashboard.viewAll')}
              <ArrowUpRight size={14} className="rtl:rotate-90" />
            </button>
          </div>
          {stats && stats.latestCustomers.length === 0 ? (
            <EmptyState
              icon={<Users size={28} />}
              title={t('customers.empty')}
              action={<Button size="sm" onClick={() => onNavigate('customers')}><UserPlus size={14} /> {t('customers.add')}</Button>}
            />
          ) : (
            <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
              {stats?.latestCustomers.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3 hover:bg-secondary-50/70 dark:hover:bg-secondary-800/40 transition-colors">
                  <Avatar name={lang === 'ar' ? (c.name_ar || c.name) : c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-secondary-800 dark:text-secondary-100 truncate">{lang === 'ar' ? (c.name_ar || c.name) : c.name}</p>
                    <p className="text-xs text-secondary-400 truncate">{c.email || c.phone || '—'}</p>
                  </div>
                  <p className="text-xs text-secondary-400 shrink-0">{fmtDate(c.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-secondary-200 dark:border-secondary-800">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-primary-500" />
              <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-100">{t('dashboard.recentActivity')}</h3>
            </div>
          </div>
          {stats && stats.activity.length === 0 ? (
            <p className="text-sm text-secondary-400 py-12 text-center">{t('dashboard.noActivity')}</p>
          ) : (
            <div className="p-5 space-y-4">
              {stats?.activity.map((a) => {
                const icon = a.type === 'customer' ? Users : a.type === 'paid' ? DollarSign : a.type === 'product' ? Package : FileText;
                const Icon = icon;
                const color = a.type === 'paid' ? 'bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-400'
                  : a.type === 'customer' ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400'
                  : a.type === 'product' ? 'bg-accent-50 text-accent-600 dark:bg-accent-900/20 dark:text-accent-400'
                  : 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400';
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color} shrink-0 mt-0.5`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-secondary-800 dark:text-secondary-100 truncate">{a.label}</p>
                      <p className="text-xs text-secondary-400">{a.sub} · {fmtDate(a.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {stats && stats.overdueCount > 0 && (
        <Card className="p-5 border-danger-200 dark:border-danger-800/50 bg-danger-50/50 dark:bg-danger-900/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-100 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-secondary-800 dark:text-secondary-100">{t('dashboard.overdueInvoices')}</p>
              <p className="text-xs text-secondary-500">{stats.overdueCount} {t('invoices.title').toLowerCase()}</p>
            </div>
            <Button variant="danger" size="sm" onClick={() => onNavigate('invoices')}>
              {t('dashboard.viewAll')}
              <ArrowUpRight size={14} className="rtl:rotate-90" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function SalesChart({ data, fmt, lang }: { data: { month: string; total: number }[]; fmt: (n: number, c?: string) => string; lang: string }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const chartHeight = 180;

  return (
    <div>
      <div className="flex items-end justify-between gap-2" style={{ height: chartHeight }}>
        {data.map((d, i) => {
          const h = (d.total / max) * (chartHeight - 30);
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2 group">
              <div className="relative w-full flex justify-center">
                <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-secondary-800 dark:bg-secondary-700 text-white text-xs font-semibold px-2 py-1 rounded-md whitespace-nowrap z-10">
                  {fmt(d.total)}
                </div>
                <div
                  className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-primary-500 to-primary-400 transition-all duration-500 ease-out-expo hover:from-primary-600 hover:to-primary-500"
                  style={{ height: `${Math.max(h, 4)}px` }}
                />
              </div>
              <span className="text-xs font-medium text-secondary-400">{d.month}</span>
            </div>
          );
        })}
      </div>
      {data.every((d) => d.total === 0) && (
        <p className="text-center text-sm text-secondary-400 -mt-32 pt-32">{lang === 'ar' ? 'لا توجد مبيعات مسجلة بعد' : 'No sales recorded yet'}</p>
      )}
    </div>
  );
}

function DonutChart({ breakdown, total, t }: {
  breakdown: Record<InvoiceStatus, number>;
  total: number;
  t: (k: string) => string;
}) {
  const statusColors: Record<InvoiceStatus, string> = {
    draft: '#94a3b8', sent: '#f59e0b', paid: '#10b981', overdue: '#ef4444', cancelled: '#f97316',
  };
  const statuses = Object.keys(breakdown) as InvoiceStatus[];
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative">
        <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
          <circle cx="80" cy="80" r={radius} fill="none" stroke="currentColor" strokeWidth="16" className="text-secondary-100 dark:text-secondary-800" />
          {total > 0 && statuses.map((s) => {
            const count = breakdown[s];
            if (count === 0) return null;
            const pct = count / total;
            const dash = pct * circumference;
            const seg = (
              <circle
                key={s}
                cx="80" cy="80" r={radius} fill="none"
                stroke={statusColors[s]} strokeWidth="16"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
                className="transition-all duration-500 ease-out-expo"
              />
            );
            offset += dash;
            return seg;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-secondary-800 dark:text-secondary-100">{total}</span>
          <span className="text-xs text-secondary-400">{t('dashboard.totalInvoices')}</span>
        </div>
      </div>
      <div className="w-full space-y-2">
        {statuses.map((s) => (
          <div key={s} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColors[s] }} />
              <span className="text-sm font-medium text-secondary-600 dark:text-secondary-400">{t(`status.${s}`)}</span>
            </div>
            <span className="text-sm font-bold text-secondary-800 dark:text-secondary-100">{breakdown[s]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </div>
              <Skeleton className="h-11 w-11 rounded-xl" />
            </div>
          </Card>
        ))}
      </div>

      <Skeleton className="h-10 w-48 rounded-xl" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5 space-y-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-44 w-full rounded-lg" />
        </Card>
        <Card className="p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-40 w-40 rounded-full mx-auto" />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </Card>
        <Card className="p-5 space-y-3">
          <Skeleton className="h-5 w-28" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </Card>
      </div>
    </div>
  );
}
