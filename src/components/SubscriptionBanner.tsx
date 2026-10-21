import { useEffect, useState } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, XCircle, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import type { LemonSubscription } from '../lib/types';

const LEMON_CHECKOUT_URL = 'https://store.lemonsqueezy.com/checkout';

export function SubscriptionBanner() {
  const { company } = useCompany();
  const [sub, setSub] = useState<LemonSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!company) { setLoading(false); return; }
    supabase
      .from('lemon_subscriptions')
      .select('*')
      .eq('tenant_id', company.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { setSub(data as LemonSubscription | null); setLoading(false); });
  }, [company]);

  if (loading) return null;

  const checkout = (variant: string) => {
    window.open(`${LEMON_CHECKOUT_URL}?variant=${variant}`, '_blank', 'noopener,noreferrer');
  };

  if (!sub || sub.status === 'cancelled') {
    return (
      <div className="mx-3 mb-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 px-3 py-2.5 text-white">
        <div className="flex items-center gap-2 mb-1.5">
          <Zap size={13} className="shrink-0" />
          <p className="text-xs font-bold">Upgrade to Pro</p>
        </div>
        <p className="text-[11px] text-white/80 mb-2">$70/mo or $300/yr</p>
        <div className="flex gap-1.5">
          <button onClick={() => checkout('monthly_variant_id')} className="flex-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-[11px] font-bold py-1.5">Monthly</button>
          <button onClick={() => checkout('yearly_variant_id')} className="flex-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-[11px] font-bold py-1.5">Yearly</button>
        </div>
      </div>
    );
  }

  const config = sub.status === 'active'
    ? { icon: CheckCircle2, color: 'bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-300 border-success-100 dark:border-success-900/30' }
    : sub.status === 'past_due'
    ? { icon: AlertCircle, color: 'bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300 border-warning-100 dark:border-warning-900/30' }
    : { icon: XCircle, color: 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 border-danger-100 dark:border-danger-900/30' };

  const Icon = config.icon;

  return (
    <div className={`mx-3 mb-2 flex items-center gap-2 rounded-xl border px-3 py-2 ${config.color}`}>
      <Icon size={13} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold capitalize">{sub.status}</p>
        {sub.current_period_end && (
          <p className="text-[10px] opacity-80">Renews {new Date(sub.current_period_end).toLocaleDateString()}</p>
        )}
      </div>
      <button onClick={() => checkout('manage_variant_id')} className="shrink-0 rounded-lg bg-current/10 px-2 py-1 text-[10px] font-bold hover:bg-current/20 transition-colors">
        <CreditCard size={11} className="inline mb-0.5" /> Manage
      </button>
    </div>
  );
}
