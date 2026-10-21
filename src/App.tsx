import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompanyProvider, useCompany } from './contexts/CompanyContext';
import { SubscriptionProvider, useSubscription } from './contexts/SubscriptionContext';
import { ToastProvider } from './contexts/ToastContext';
import { AppLayout, type PageKey } from './components/AppLayout';
import { FullPageLoader } from './components/ui/Feedback';
import { supabase } from './lib/supabase';
import { AuthPage, CompanyRegistrationPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { ProductsPage } from './pages/ProductsPage';
import { WarehousePage } from './pages/WarehousePage';
import { InvoicesPage } from './pages/InvoicesPage';
import { TeamPage } from './pages/TeamPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { LeasesPage } from './pages/LeasesPage';
import { REInvoicesPage } from './pages/REInvoicesPage';
import { ReportsHubPage } from './pages/ReportsHubPage';
import { SettingsPage } from './pages/SettingsPage';
import { LandingPage } from './pages/LandingPage';
import { PublicInvoicePage } from './pages/PublicInvoicePage';
import { ProfilePage } from './pages/ProfilePage';
import { UpgradePage } from './pages/UpgradePage';
import { TermsPage } from './pages/TermsPage';
import { AdminRouter } from './pages/admin/AdminRouter';
import { ShieldOff } from 'lucide-react';
import { initializeCapacitor, updateNativeStatusBar } from './lib/capacitor';
import { OfflineNotice } from './components/OfflineNotice';
import { useTheme } from './contexts/ThemeContext';

type AuthView = 'landing' | 'auth' | 'terms';

function SuspendedScreen({ reason }: { reason: string | null }) {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-secondary-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-danger-50 dark:bg-danger-900/20 text-danger-500">
            <ShieldOff size={40} />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100">Account Suspended</h1>
          <p className="mt-2 text-secondary-500 dark:text-secondary-400">
            Your account has been suspended and access is currently restricted.
          </p>
          {reason && (
            <div className="mt-4 rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-100 dark:border-danger-800 px-4 py-3 text-sm text-danger-700 dark:text-danger-400">
              <span className="font-semibold">Reason: </span>{reason}
            </div>
          )}
        </div>
        <p className="text-sm text-secondary-400">
          Please contact support to resolve this issue and regain access to your account.
        </p>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-secondary-800 dark:bg-secondary-700 text-white text-sm font-semibold hover:bg-secondary-700 dark:hover:bg-secondary-600 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

function AppRouter() {
  const { theme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const { loading: companyLoading, needsOnboarding, isSuspended, company } = useCompany();
  const { isExpired, isPlatformAdmin, loading: subLoading } = useSubscription();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [authView, setAuthView] = useState<AuthView>('landing');
  const [initialAuthView, setInitialAuthView] = useState<'login' | 'reset' | 'setup' | undefined>(undefined);

  // Initialize native Capacitor on mobile mount
  useEffect(() => {
    initializeCapacitor({
      isDark: theme === 'dark',
    });
  }, []);

  // Update native status bar when theme switches
  useEffect(() => {
    updateNativeStatusBar(theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const hasRecovery = window.location.hash.includes('type=recovery') || params.get('type') === 'recovery';
    if (view === 'terms' || window.location.pathname === '/terms') {
      setAuthView('terms');
    } else if (view === 'reset' || view === 'setup' || hasRecovery) {
      setInitialAuthView(view === 'setup' ? 'setup' : 'reset');
      setAuthView('auth');
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setInitialAuthView('reset');
        setAuthView('auth');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const shareToken = new URLSearchParams(window.location.search).get('inv');
  if (shareToken) return <PublicInvoicePage shareToken={shareToken} />;

  // If password reset or invitation setup view is targeted, always show AuthPage
  if (initialAuthView === 'reset' || initialAuthView === 'setup') {
    return (
      <AuthPage
        onBack={() => {
          setInitialAuthView(undefined);
          setAuthView('landing');
        }}
        initialView={initialAuthView}
      />
    );
  }

  if (authLoading || (user && (companyLoading || subLoading))) return <FullPageLoader />;

  return (
    <>
      <OfflineNotice />
      {!user ? (
        authView === 'auth' ? (
          <AuthPage onBack={() => setAuthView('landing')} initialView={initialAuthView} />
        ) : authView === 'terms' ? (
          <TermsPage onBack={() => setAuthView('landing')} />
        ) : (
          <LandingPage
            onGetStarted={() => setAuthView('auth')}
            onSignIn={() => setAuthView('auth')}
            onTerms={() => setAuthView('terms')}
          />
        )
      ) : needsOnboarding ? (
        <CompanyRegistrationPage />
      ) : isSuspended && !isPlatformAdmin ? (
        <SuspendedScreen reason={company?.suspension_reason ?? null} />
      ) : isExpired && !isPlatformAdmin ? (
        <UpgradePage />
      ) : (
        <AppLayout current={page} onNavigate={setPage}>
          {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
          {page === 'customers' && <CustomersPage />}
          {page === 'products' && <ProductsPage />}
          {page === 'warehouse' && <WarehousePage />}
          {page === 'invoices' && <InvoicesPage />}
          {page === 'team' && <TeamPage />}
          {page === 'properties' && <PropertiesPage />}
          {page === 'leases' && <LeasesPage />}
          {page === 're-invoices' && <REInvoicesPage />}
          {page === 'reports-hub' && <ReportsHubPage />}
          {page === 'settings' && <SettingsPage />}
          {page === 'profile' && <ProfilePage />}
          {page === 'admin' && <DashboardPage onNavigate={setPage} />}
        </AppLayout>
      )}
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <CompanyProvider>
                <SubscriptionProvider>
                  <Routes>
                    <Route path="/admin/*" element={<AdminRouter />} />
                    <Route path="/terms" element={<TermsPage onBack={() => { window.location.href = '/'; }} />} />
                    <Route path="/*" element={<AppRouter />} />
                  </Routes>
                </SubscriptionProvider>
              </CompanyProvider>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
