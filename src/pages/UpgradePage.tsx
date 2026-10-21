import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSubscription, PLAN_COLORS } from '../contexts/SubscriptionContext';
import { Check, Zap, Star, Building2, Globe, Mail } from 'lucide-react';
import type { Plan } from '../lib/types';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free_trial: <Zap size={20} />,
  starter: <Star size={20} />,
  pro: <Zap size={20} />,
  business: <Building2 size={20} />,
  enterprise: <Globe size={20} />,
};

function PlanCard({
  plan,
  billing,
  isCurrent,
  t,
  lang,
}: {
  plan: Plan;
  billing: 'monthly' | 'yearly';
  isCurrent: boolean;
  t: (k: string) => string;
  lang: string;
}) {
  const planName = lang === 'ar' && plan.name_ar ? plan.name_ar : plan.name;
  const isEnterprise = plan.id === 'enterprise';
  const isFree = plan.id === 'free_trial';

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-6 transition-all ${
        plan.highlight
          ? 'border-primary-500 shadow-xl shadow-primary-500/10'
          : isCurrent
          ? 'border-secondary-300 dark:border-secondary-600'
          : 'border-secondary-200 dark:border-secondary-700 hover:border-secondary-300 dark:hover:border-secondary-600'
      } bg-white dark:bg-secondary-900`}
    >
      {plan.highlight && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-600 text-white text-xs font-bold">
            <Star size={11} fill="currentColor" />
            {t('plans.mostPopular')}
          </span>
        </div>
      )}
      {isCurrent && (
        <div className="absolute -top-3.5 start-4">
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-success-600 text-white text-xs font-bold">
            <Check size={11} />
            {t('plans.currentPlan')}
          </span>
        </div>
      )}

      {/* Plan header */}
      <div className="mb-5">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl mb-3 ${PLAN_COLORS[plan.id]}`}>
          {PLAN_ICONS[plan.id]}
        </div>
        <h3 className="text-lg font-bold text-secondary-800 dark:text-secondary-100">{planName}</h3>

        <div className="mt-3">
          {isEnterprise ? (
            <p className="text-3xl font-black text-secondary-800 dark:text-secondary-100">{t('plans.customLabel')}</p>
          ) : isFree ? (
            <p className="text-3xl font-black text-secondary-800 dark:text-secondary-100">{t('plans.freeLabel')}</p>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2 flex-wrap">
                {billing === 'monthly' && (
                  <span className="text-base text-secondary-400 line-through font-medium">
                    1,052 {lang === 'ar' ? 'ج.م' : 'EGP'}
                  </span>
                )}
                <span className="text-3xl font-black text-secondary-800 dark:text-secondary-100">
                  {billing === 'yearly' ? '5,250' : '525'} {lang === 'ar' ? 'ج.م' : 'EGP'}
                </span>
                <span className="text-sm text-secondary-400">
                  {billing === 'monthly' ? t('plans.perMonth') : t('plans.perYear')}
                </span>
              </div>
              {billing === 'yearly' && (
                <p className="text-xs text-success-600 dark:text-success-400 font-semibold mt-1">
                  {lang === 'ar' ? 'وفّر 1050 ج.م (~438 ج.م / شهر)' : 'Save 1,050 EGP (~438 EGP / mo)'}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Features */}
      <ul className="space-y-2.5 flex-1 mb-6">
        {plan.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-secondary-600 dark:text-secondary-300">
            <Check size={15} className="mt-0.5 shrink-0 text-success-500" />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <a
        href="mailto:mahmoud.sobhy36@gmail.com?subject=Upgrade%20Request"
        className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
          plan.highlight
            ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-500/30'
            : isCurrent
            ? 'bg-secondary-100 dark:bg-secondary-800 text-secondary-500 cursor-default pointer-events-none'
            : 'bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-200 hover:bg-secondary-200 dark:hover:bg-secondary-700'
        }`}
      >
        {isCurrent ? (
          t('plans.currentPlan')
        ) : isEnterprise ? (
          <><Mail size={15} />{t('plans.contactSales')}</>
        ) : (
          t('plans.getStarted')
        )}
      </a>
    </div>
  );
}

export function UpgradePage() {
  const { t, lang } = useLanguage();
  const { plans, subscription, plan: currentPlan } = useSubscription();
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  const fallbackProPlan: Plan = {
    id: 'pro',
    name: 'Daftrk All-in-One',
    name_ar: 'خطة دفترك الشاملة',
    price_monthly: 525,
    price_yearly: 5250,
    max_customers: null,
    max_products: null,
    max_invoices: null,
    features: [
      lang === 'ar' ? 'عملاء وموردين غير محدودين' : 'Unlimited customers & suppliers',
      lang === 'ar' ? 'فواتير غير محدودة وطباعة مهنية' : 'Unlimited invoices & professional print',
      lang === 'ar' ? 'نظام الفاتورة الإلكترونية ZATCA' : 'ZATCA Phase 2 e-Invoicing integration',
      lang === 'ar' ? 'إدارة المستودعات وحركات المخزون' : 'Multi-warehouse inventory & tracking',
      lang === 'ar' ? 'تقارير مالية وتحليلات متقدمة' : 'Advanced reports & business analytics',
      lang === 'ar' ? 'دعم فني ذو أولوية 24/7' : '24/7 Priority technical support',
    ],
    highlight: true,
    sort_order: 1,
    is_active: true,
  };

  const proPlans = plans.filter((p) => p.id === 'pro' && p.is_active);
  const visiblePlans = proPlans.length > 0 ? proPlans : [fallbackProPlan];

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 via-white to-primary-50/30 dark:from-secondary-950 dark:via-secondary-900 dark:to-primary-950/20 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-center h-16 border-b border-secondary-200 dark:border-secondary-800 bg-white/80 dark:bg-secondary-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
            <Zap size={16} />
          </div>
          <span className="text-base font-bold text-secondary-800 dark:text-secondary-100">Daftrk</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-start py-12 px-4">
        {/* Hero text */}
        <div className="text-center mb-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 text-xs font-bold mb-4 border border-danger-100 dark:border-danger-900/30">
            <span className="h-1.5 w-1.5 rounded-full bg-danger-500 animate-pulse" />
            {t('plans.trialExpired')}
          </div>
          <h1 className="text-3xl font-black text-secondary-800 dark:text-secondary-100 mb-3 tracking-tight">
            {t('plans.upgradeTitle')}
          </h1>
          <p className="text-secondary-500 dark:text-secondary-400">{t('plans.upgradeSubtitle')}</p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center gap-3 mb-10 p-1 bg-secondary-100 dark:bg-secondary-800 rounded-xl">
          {(['monthly', 'yearly'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                billing === b
                  ? 'bg-white dark:bg-secondary-700 text-secondary-800 dark:text-secondary-100 shadow-sm'
                  : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700'
              }`}
            >
              {t(`plans.${b}`)}
              {b === 'yearly' && (
                <span className="px-1.5 py-0.5 bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400 text-xs rounded-md font-bold">
                  {t('plans.yearlyDiscount')}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Plan grid */}
        <div className={`grid grid-cols-1 ${visiblePlans.length > 1 ? 'sm:grid-cols-2 max-w-3xl' : 'max-w-md'} gap-5 w-full mx-auto`}>
          {visiblePlans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              billing={billing}
              isCurrent={currentPlan?.id === p.id}
              t={t}
              lang={lang}
            />
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-10 text-xs text-secondary-400 text-center max-w-sm">
          {lang === 'ar'
            ? 'جميع بياناتك محفوظة بأمان. تواصل معنا لترقية حسابك.'
            : 'All your data is safely preserved. Contact us to upgrade your account.'}
        </p>
      </div>
    </div>
  );
}
