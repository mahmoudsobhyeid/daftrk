import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from './CompanyContext';
import { useAuth } from './AuthContext';
import type { Plan, Subscription, PlanId } from '../lib/types';

export interface UsageData {
  customers: number;
  products: number;
  invoices: number;
}

interface SubscriptionContextValue {
  subscription: Subscription | null;
  plan: Plan | null;
  plans: Plan[];
  usage: UsageData;
  loading: boolean;
  isTrialing: boolean;
  isExpired: boolean;
  isActive: boolean;
  isPlatformAdmin: boolean;
  daysLeft: number | null;
  canAdd: (resource: 'customers' | 'products' | 'invoices') => boolean;
  limitOf: (resource: 'customers' | 'products' | 'invoices') => number | null;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { company } = useCompany();
  const { user } = useAuth();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<UsageData>({ customers: 0, products: 0, invoices: 0 });
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!company || !user) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const [subRes, plansRes, usageRes, profileRes] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('plans').select('*').order('sort_order'),
      Promise.all([
        supabase.from('customers').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
      ]),
      supabase.from('user_profiles').select('is_platform_admin').eq('id', user.id).maybeSingle(),
    ]);

    const DEFAULT_PRO_PLAN: Plan = {
      id: 'pro',
      name: 'Daftrk All-in-One',
      name_ar: 'خطة دفترك الشاملة',
      price_monthly: 525,
      price_yearly: 5250,
      max_customers: null,
      max_products: null,
      max_invoices: null,
      features: [
        'Unlimited customers & suppliers',
        'Unlimited invoices & quotes',
        'ZATCA Phase 2 e-Invoicing compliance',
        'Multi-warehouse inventory & tracking',
        'Advanced financial reports & analytics',
        'Team collaboration & custom permissions',
        '24/7 Priority technical support',
      ],
      highlight: true,
      sort_order: 1,
      is_active: true,
    };

    const sub = subRes.data as Subscription | null;
    const rawPlans = (plansRes.data ?? []) as Plan[];
    const allPlans = (rawPlans.length > 0 ? rawPlans : [DEFAULT_PRO_PLAN]).map((p) => ({
      ...p,
      price_monthly: p.id === 'pro' ? 525 : p.price_monthly,
      price_yearly: p.id === 'pro' ? 5250 : p.price_yearly,
      features: Array.isArray(p.features) ? p.features : (typeof p.features === 'string' ? JSON.parse(p.features) : []),
    }));
    const [custRes, prodRes, invRes] = usageRes;

    setSubscription(sub);
    setPlans(allPlans);
    setPlan(allPlans.find((p) => p.id === sub?.plan_id) ?? allPlans.find((p) => p.id === 'pro') ?? null);
    setUsage({
      customers: custRes.count ?? 0,
      products: prodRes.count ?? 0,
      invoices: invRes.count ?? 0,
    });
    setIsPlatformAdmin(!!(profileRes.data as any)?.is_platform_admin);
    setLoading(false);
  }, [company, user]);

  useEffect(() => { load(); }, [load]);

  const isTrialing = subscription?.status === 'trialing';
  const isActive = subscription?.status === 'active';

  const isExpired = (() => {
    if (!subscription) return false;
    if (subscription.status === 'expired' || subscription.status === 'cancelled') return true;
    if (subscription.status === 'trialing') {
      const trialEnd = subscription.trial_ends_at ? new Date(subscription.trial_ends_at) : null;
      return trialEnd ? trialEnd < new Date() : false;
    }
    if (subscription.status === 'active') {
      const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : null;
      return periodEnd ? periodEnd < new Date() : false;
    }
    return false;
  })();

  const daysLeft = (() => {
    if (!subscription) return null;
    const endDate = isTrialing ? subscription.trial_ends_at : subscription.current_period_end;
    if (!endDate) return null;
    const diff = new Date(endDate).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const limitOf = (resource: 'customers' | 'products' | 'invoices'): number | null => {
    if (!plan) return 100;
    const key = `max_${resource}` as keyof Plan;
    return plan[key] as number | null;
  };

  const canAdd = (resource: 'customers' | 'products' | 'invoices'): boolean => {
    if (isExpired) return false;
    const limit = limitOf(resource);
    if (limit === null) return true;
    return usage[resource] < limit;
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        plan,
        plans,
        usage,
        loading,
        isTrialing,
        isExpired,
        isActive,
        isPlatformAdmin,
        daysLeft,
        canAdd,
        limitOf,
        refresh: load,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}

/** Shared plan ID → display color mapping */
export const PLAN_COLORS: Record<PlanId, string> = {
  free_trial: 'text-secondary-600 bg-secondary-100 dark:text-secondary-300 dark:bg-secondary-800',
  starter: 'text-accent-700 bg-accent-50 dark:text-accent-300 dark:bg-accent-900/20',
  pro: 'text-primary-700 bg-primary-50 dark:text-primary-300 dark:bg-primary-900/20',
  business: 'text-success-700 bg-success-50 dark:text-success-300 dark:bg-success-900/20',
  enterprise: 'text-warning-700 bg-warning-50 dark:text-warning-300 dark:bg-warning-900/20',
};

export const STATUS_COLORS: Record<string, string> = {
  trialing: 'text-accent-700 bg-accent-50 dark:text-accent-300 dark:bg-accent-900/20',
  active: 'text-success-700 bg-success-50 dark:text-success-300 dark:bg-success-900/20',
  expired: 'text-danger-700 bg-danger-50 dark:text-danger-300 dark:bg-danger-900/20',
  cancelled: 'text-secondary-600 bg-secondary-100 dark:text-secondary-400 dark:bg-secondary-800',
  past_due: 'text-warning-700 bg-warning-50 dark:text-warning-300 dark:bg-warning-900/20',
};
