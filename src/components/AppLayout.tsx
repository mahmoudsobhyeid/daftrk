import { type ReactNode, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSubscription, PLAN_COLORS } from '../contexts/SubscriptionContext';

type TeamRole = 'owner' | 'admin' | 'agent';

const ROLE_NAV_ACCESS: Record<PageKey, TeamRole[]> = {
  dashboard: ['owner', 'admin', 'agent'],
  customers: ['owner', 'admin', 'agent'],
  products: ['owner', 'admin', 'agent'],
  warehouse: ['owner', 'admin', 'agent'],
  invoices: ['owner', 'admin', 'agent'],
  team: ['owner', 'admin'],
  properties: ['owner', 'admin', 'agent'],
  leases: ['owner', 'admin', 'agent'],
  're-invoices': ['owner', 'admin', 'agent'],
  'reports-hub': ['owner', 'admin', 'agent'],
  settings: ['owner', 'admin'],
  profile: ['owner', 'admin', 'agent'],
  admin: ['owner', 'admin', 'agent'],
};
import {
  BookOpen, LayoutDashboard, Users, Package, FileText,
  Settings, Moon, Sun, LogOut, Menu, ChevronRight,
  UserCircle, ShieldCheck, Clock, AlertTriangle, Zap, Eye, X,
  ExternalLink, Building2, ClipboardList, Receipt, Warehouse, BarChart3,
} from 'lucide-react';
import { LowStockNotificationBell } from './LowStockNotificationBell';
import { SubscriptionBanner } from './SubscriptionBanner';
import { OnboardingTour } from './OnboardingTour';
import { SupportHub } from './SupportHub';

export type PageKey = 'dashboard' | 'customers' | 'products' | 'warehouse' | 'invoices' | 'settings' | 'profile' | 'admin' | 'team' | 'properties' | 'leases' | 're-invoices' | 'reports-hub';

interface LayoutProps {
  current: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
}

export function AppLayout({ current, onNavigate, children }: LayoutProps) {
  const { t, lang, setLang } = useLanguage();
  const { theme, toggle } = useTheme();
  const { signOut, user } = useAuth();
  const { company, adminViewAs, exitViewAs, teamRole, isPlatformAdmin: isCompanyAdmin } = useCompany();
  const { subscription, plan, isTrialing, isExpired, daysLeft, isPlatformAdmin } = useSubscription();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: { key: PageKey; label: string; icon: typeof LayoutDashboard; group?: string }[] = [
    { key: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { key: 'customers', label: t('nav.customers'), icon: Users },
    { key: 'products', label: t('nav.products'), icon: Package },
    { key: 'warehouse', label: t('nav.warehouse') || 'المستودع', icon: Package },
    { key: 'invoices', label: t('nav.invoices'), icon: FileText },
    { key: 'team', label: t('nav.team'), icon: Users },
    // Rental module group: إدارة الإيجارات والوحدات
    { key: 'properties', label: t('rental.units'), icon: Building2, group: 'rental' },
    { key: 'leases', label: t('rental.leaseContracts'), icon: FileText, group: 'rental' },
    { key: 're-invoices', label: t('nav.reInvoices'), icon: Receipt },
    // Reports & Analytics group: التقارير والتحليلات
    { key: 'reports-hub', label: t('nav.reports') || 'Reports & Analytics', icon: BarChart3, group: 'reports' },
    { key: 'settings', label: t('nav.settings'), icon: Settings },
  ];

  const handleNav = (page: PageKey) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  const pageTitle = () => {
    if (current === 'profile') return t('profile.title');
    if (current === 'admin') return t('admin.title');
    return navItems.find((n) => n.key === current)?.label ?? '';
  };

  // Trial / plan banner shown in sidebar
  const trialBanner = () => {
    if (!subscription || isExpired) return null;
    if (isTrialing && daysLeft !== null) {
      const urgent = daysLeft <= 3;
      return (
        <div
          className={`mx-3 mb-2 flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-colors ${
            urgent
              ? 'bg-danger-50 dark:bg-danger-900/20 border border-danger-100 dark:border-danger-900/30 text-danger-700 dark:text-danger-400'
              : 'bg-warning-50 dark:bg-warning-900/20 border border-warning-100 dark:border-warning-900/30 text-warning-700 dark:text-warning-400'
          }`}
          onClick={() => handleNav('settings')}
        >
          {urgent ? <AlertTriangle size={13} className="shrink-0" /> : <Clock size={13} className="shrink-0" />}
          <p className="text-xs font-semibold leading-tight">
            {daysLeft === 0
              ? t('plans.trialExpires')
              : `${daysLeft} ${t('plans.trialDaysLeft')}`}
          </p>
        </div>
      );
    }
    if (plan && plan.id !== 'free_trial') {
      const colors = PLAN_COLORS[plan.id] ?? '';
      return (
        <div className={`mx-3 mb-2 flex items-center gap-2 rounded-xl px-3 py-2 ${colors} border border-current/10`}>
          <Zap size={13} className="shrink-0" />
          <p className="text-xs font-bold">{lang === 'ar' && plan.name_ar ? plan.name_ar : plan.name}</p>
          {/* Plan name already handles bilingual via name_ar field */}
        </div>
      );
    }
    return null;
  };

  const SidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 h-16 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-primary shrink-0">
            <BookOpen size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-secondary-800 dark:text-white tracking-tight">{t('app.name')}</h1>
            <p className="text-xs text-secondary-400 truncate max-w-[130px] font-medium">{company?.name}</p>
            {company?.account_id && (
              <p className="text-[10px] text-secondary-400 dark:text-secondary-500 font-bold tracking-wide truncate max-w-[130px]">
                {company.account_id}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-secondary-400 hover:text-secondary-600 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mx-5 divider" />

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-secondary-400 dark:text-secondary-500">
          {t('nav.menu')}
        </p>
        {navItems.filter((item) => {
          const allowed = ROLE_NAV_ACCESS[item.key] ?? ['owner', 'admin', 'agent'];
          if (isCompanyAdmin || teamRole === 'owner' || teamRole === 'admin') return true;
          return allowed.includes(teamRole ?? 'agent');
        }).map((item, idx) => {
          const Icon = item.icon;
          const active = current === item.key;
          const showRentalHeader = item.group === 'rental' && (idx === 0 || navItems[idx - 1].group !== 'rental');
          const showReportsHeader = item.group === 'reports' && (idx === 0 || navItems[idx - 1].group !== 'reports');
          const tourKey = item.key === 'properties' ? 'nav-properties' : item.key === 're-invoices' ? 'nav-re-invoices' : item.key === 'team' ? 'nav-team' : '';
          return (
            <div key={item.key}>
              {showRentalHeader && (
                <>
                  <div className="mx-3 my-3 divider" />
                  <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-primary-500 dark:text-primary-400">
                    {t('nav.rentalGroup')}
                  </p>
                </>
              )}
              {showReportsHeader && (
                <>
                  <div className="mx-3 my-3 divider" />
                  <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-primary-500 dark:text-primary-400">
                    {t('nav.reportsGroup') || 'Reports & Analytics'}
                  </p>
                </>
              )}
              <button
                onClick={() => handleNav(item.key)}
                data-tour={tourKey || undefined}
                className={`nav-item ${active ? 'nav-item-active' : 'nav-item-idle'} group`}
              >
                <Icon
                  size={18}
                  className={`shrink-0 transition-colors ${active ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-400 group-hover:text-secondary-600 dark:group-hover:text-secondary-200'}`}
                />
                <span className="flex-1 text-start">{item.label}</span>
                {active && <ChevronRight size={14} className="text-primary-500 rtl:rotate-180" />}
              </button>
            </div>
          );
        })}

        {/* Admin panel link (platform admins only) */}
        {isPlatformAdmin && (
          <>
            <div className="mx-3 my-3 divider" />
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-warning-500 dark:text-warning-400">
              {t('admin.title')}
            </p>
            <a
              href="/admin"
              className="nav-item nav-item-idle group"
            >
              <ShieldCheck
                size={18}
                className="shrink-0 text-warning-500 dark:text-warning-400"
              />
              <span className="flex-1 text-start">{t('admin.title')}</span>
              <ExternalLink size={13} className="text-secondary-400 group-hover:text-secondary-600" />
            </a>
          </>
        )}
      </nav>

      {/* Lemon Squeezy subscription banner */}
      <SubscriptionBanner />

      {/* Trial / plan banner */}
      {trialBanner()}

      {/* User card */}
      <div className="px-3 py-3 shrink-0">
        <div className="divider mb-3" />
        <button
          onClick={() => handleNav('profile')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
            current === 'profile'
              ? 'bg-primary-50 dark:bg-primary-900/20'
              : 'hover:bg-secondary-50 dark:hover:bg-secondary-800'
          }`}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-secondary-400 to-secondary-600 text-white text-sm font-bold shrink-0">
            {(user?.email?.[0] ?? 'U').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1 text-start">
            <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-200 truncate">
              {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
            </p>
            <p className="text-xs text-secondary-400 truncate">{user?.email}</p>
          </div>
          <UserCircle size={15} className="shrink-0 text-secondary-400" />
        </button>
        <button onClick={signOut} className="nav-item nav-item-idle mt-1">
          <LogOut size={18} className="shrink-0" />
          {t('auth.logout')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950">
      {/* Admin View As banner */}
      {adminViewAs && (
        <div className="fixed top-0 inset-x-0 z-50 flex items-center justify-between gap-4 px-4 py-2 bg-warning-500 text-white text-sm font-semibold shadow-lg">
          <div className="flex items-center gap-2">
            <Eye size={15} className="shrink-0" />
            <span>Admin View: <span className="font-black">{adminViewAs.name}</span></span>
          </div>
          <button
            onClick={exitViewAs}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors text-xs font-bold"
          >
            <X size={13} /> Exit View As
          </button>
        </div>
      )}
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 start-0 w-64 bg-white dark:bg-secondary-900 border-e border-secondary-200 dark:border-secondary-800 z-30">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-secondary-900/40 backdrop-blur-md animate-fade-in-fast" onClick={() => setMobileOpen(false)} />
          <aside className="lg:hidden fixed inset-y-0 start-0 w-72 max-w-[85vw] bg-white dark:bg-secondary-900 border-e border-secondary-200 dark:border-secondary-800 z-50 animate-slide-in-right flex flex-col pt-safe pb-safe shadow-2xl">
            {SidebarContent}
          </aside>
        </>
      )}

      {/* Main */}
      <div className={`lg:ps-64${adminViewAs ? ' pt-10' : ''}`}>
        {/* Topbar */}
        <header
          className="sticky top-0 z-20 glass-strong border-b border-secondary-200/60 dark:border-secondary-800/60 flex items-center justify-between px-4 sm:px-6 transition-all"
          style={{
            paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)',
            paddingBottom: '0.75rem',
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -ms-1.5 rounded-xl text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <h2 className="text-lg font-bold text-secondary-800 dark:text-secondary-100">{pageTitle()}</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <LowStockNotificationBell />
          </div>
        </header>

        {/* Content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in pb-28 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (iOS / Android Native Navigation) */}
      <nav
        aria-label="Mobile Navigation Bar"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-secondary-900/95 backdrop-blur-lg border-t border-secondary-200/80 dark:border-secondary-800/80 flex items-center justify-around px-1 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.5rem)',
          paddingTop: '0.4rem',
        }}
      >
        <button
          onClick={() => handleNav('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 ${
            current === 'dashboard'
              ? 'text-primary-600 dark:text-primary-400 font-bold'
              : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700'
          }`}
        >
          <LayoutDashboard size={20} className={current === 'dashboard' ? 'scale-110 text-primary-600 dark:text-primary-400 transition-transform' : ''} />
          <span className="text-[10px] mt-1 font-medium truncate max-w-[62px]">{t('nav.dashboard')}</span>
        </button>

        <button
          onClick={() => handleNav('invoices')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 ${
            current === 'invoices'
              ? 'text-primary-600 dark:text-primary-400 font-bold'
              : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700'
          }`}
        >
          <FileText size={20} className={current === 'invoices' ? 'scale-110 text-primary-600 dark:text-primary-400 transition-transform' : ''} />
          <span className="text-[10px] mt-1 font-medium truncate max-w-[62px]">{t('nav.invoices')}</span>
        </button>

        <button
          onClick={() => handleNav('products')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 ${
            current === 'products'
              ? 'text-primary-600 dark:text-primary-400 font-bold'
              : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700'
          }`}
        >
          <Package size={20} className={current === 'products' ? 'scale-110 text-primary-600 dark:text-primary-400 transition-transform' : ''} />
          <span className="text-[10px] mt-1 font-medium truncate max-w-[62px]">{t('nav.products')}</span>
        </button>

        <button
          onClick={() => handleNav('customers')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 ${
            current === 'customers'
              ? 'text-primary-600 dark:text-primary-400 font-bold'
              : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700'
          }`}
        >
          <Users size={20} className={current === 'customers' ? 'scale-110 text-primary-600 dark:text-primary-400 transition-transform' : ''} />
          <span className="text-[10px] mt-1 font-medium truncate max-w-[62px]">{t('nav.customers')}</span>
        </button>

        <button
          onClick={() => setMobileOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-1 rounded-xl transition-all active:scale-95 ${
            mobileOpen || !['dashboard', 'invoices', 'products', 'customers'].includes(current)
              ? 'text-primary-600 dark:text-primary-400 font-bold'
              : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700'
          }`}
        >
          <Menu size={20} />
          <span className="text-[10px] mt-1 font-medium truncate max-w-[62px]">{lang === 'ar' ? 'المزيد' : 'More'}</span>
        </button>
      </nav>

      {/* Onboarding tour for first-time users */}
      <OnboardingTour />

      {/* Floating support widget */}
      <SupportHub />
    </div>
  );
}
