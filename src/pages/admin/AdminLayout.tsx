import { type ReactNode, useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { FullPageLoader } from '../../components/ui/Feedback';
import {
  ShieldCheck, LayoutDashboard, Building2, Users,
  DollarSign, ClipboardList, Activity, LogOut,
  Menu, X, Moon, Sun, ArrowLeft, BookOpen, Package,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const NAV_ITEMS = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/admin/companies', label: 'Companies', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/revenue', label: 'Revenue', icon: DollarSign },
  { to: '/admin/plans', label: 'Plans', icon: Package },
  { to: '/admin/audit', label: 'Audit Logs', icon: ClipboardList },
  { to: '/admin/health', label: 'System Health', icon: Activity },
];

function AccessDenied() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-danger-50 dark:bg-danger-900/20 text-danger-500">
            <ShieldCheck size={40} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100">Access Denied</h1>
          <p className="mt-2 text-secondary-500 dark:text-secondary-400">
            You don't have permission to access the admin panel.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            <ArrowLeft size={15} /> Go to App
          </button>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-200 text-sm font-semibold hover:bg-secondary-200 dark:hover:bg-secondary-700 transition-colors"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      setCheckingAdmin(false);
      return;
    }
    supabase
      .from('user_profiles')
      .select('is_platform_admin')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(data?.is_platform_admin ?? false);
        setCheckingAdmin(false);
      });
  }, [user]);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  if (authLoading || checkingAdmin) return <FullPageLoader />;
  if (!user) {
    navigate('/');
    return null;
  }
  if (!isAdmin) return <AccessDenied />;

  const pageName = NAV_ITEMS.find((n) =>
    n.exact ? location.pathname === n.to : location.pathname.startsWith(n.to)
  )?.label ?? 'Admin';

  const SidebarContent = (
    <div className="flex h-full flex-col bg-secondary-900 dark:bg-secondary-950">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 shrink-0 border-b border-secondary-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-500 text-white shadow-lg">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h1 className="text-base font-bold text-white tracking-tight">Admin Panel</h1>
          <p className="text-xs text-secondary-400 font-medium">Platform Management</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-secondary-500">
          Management
        </p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-warning-500/20 text-warning-400 border border-warning-500/30'
                    : 'text-secondary-400 hover:bg-secondary-800 hover:text-secondary-100'
                }`
              }
            >
              <Icon size={17} className="shrink-0" />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      {/* Back to App */}
      <div className="px-3 py-3 shrink-0 border-t border-secondary-800">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-secondary-400 hover:bg-secondary-800 hover:text-secondary-100 transition-colors"
        >
          <ArrowLeft size={17} className="shrink-0" />
          Back to App
        </button>

        {/* User info */}
        <div className="mt-2 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary-800">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-500 text-white text-sm font-bold">
            {(user.email?.[0] ?? 'A').toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-secondary-100 truncate">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </p>
            <p className="text-xs text-secondary-400 truncate">{user.email}</p>
          </div>
        </div>

        <button
          onClick={signOut}
          className="mt-1 w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-secondary-400 hover:bg-secondary-800 hover:text-danger-400 transition-colors"
        >
          <LogOut size={17} className="shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 start-0 w-64 z-30 flex-col">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-secondary-900/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 start-0 w-64 z-50 flex flex-col animate-slide-in-right">
            {SidebarContent}
          </aside>
        </>
      )}

      {/* Main content */}
      <div className="lg:ps-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-16 bg-white dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-800 flex items-center justify-between px-4 sm:px-6 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 -m-2 rounded-lg text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-warning-500 bg-warning-50 dark:bg-warning-900/20 px-2 py-0.5 rounded-lg border border-warning-100 dark:border-warning-900/30">
                Admin
              </span>
              <h2 className="text-lg font-bold text-secondary-800 dark:text-secondary-100">{pageName}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
            >
              <BookOpen size={13} /> App
            </button>
            <button
              onClick={toggle}
              className="p-2 rounded-xl text-secondary-500 hover:text-secondary-700 dark:hover:text-secondary-200 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-screen-2xl mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
