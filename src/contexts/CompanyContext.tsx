import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Company } from '../lib/types';

type TeamRole = 'owner' | 'admin' | 'agent';

interface CompanyContextValue {
  company: Company | null;
  loading: boolean;
  needsOnboarding: boolean;
  isPlatformAdmin: boolean;
  isSuspended: boolean;
  teamRole: TeamRole | null;
  adminViewAs: { id: string; name: string } | null;
  refresh: () => Promise<void>;
  setCompany: (c: Company | null) => void;
  viewAsCompany: (id: string, name: string) => void;
  exitViewAs: () => void;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [company, setCompanyState] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [teamRole, setTeamRole] = useState<TeamRole | null>(null);
  const [adminViewAs, setAdminViewAs] = useState<{ id: string; name: string } | null>(null);

  const loadCompany = useCallback(async () => {
    if (!user) {
      setCompanyState(null);
      setIsPlatformAdmin(false);
      setTeamRole(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const [profileRes, teamRes, companyMembershipRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('account_id, is_platform_admin')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('team_members')
        .select('tenant_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('company_members')
        .select('company_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const profile = profileRes.data as { account_id?: string | null; is_platform_admin?: boolean } | null;
    const activeCompanyId = profile?.account_id ?? teamRes.data?.tenant_id ?? companyMembershipRes.data?.company_id ?? null;

    let companyData: Company | null = null;
    if (activeCompanyId) {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('id', activeCompanyId)
        .maybeSingle();
      companyData = data as Company | null;
    }

    const resolvedTeamRole = (teamRes.data?.role ?? companyMembershipRes.data?.role as TeamRole | undefined) ?? null;

    setCompanyState(companyData);
    setIsPlatformAdmin(Boolean(profile?.is_platform_admin));
    setTeamRole((resolvedTeamRole as TeamRole | null) ?? null);
    setLoading(false);
  }, [user]);

  // When viewAs is active, load that company's data
  const loadViewAsCompany = useCallback(async (companyId: string) => {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .maybeSingle();
    if (data) setCompanyState(data as Company);
  }, []);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  useEffect(() => {
    if (adminViewAs && isPlatformAdmin) {
      loadViewAsCompany(adminViewAs.id);
    } else if (!adminViewAs) {
      loadCompany();
    }
  }, [adminViewAs, isPlatformAdmin, loadViewAsCompany, loadCompany]);

  const refresh = async () => {
    if (adminViewAs && isPlatformAdmin) {
      await loadViewAsCompany(adminViewAs.id);
    } else {
      await loadCompany();
    }
  };

  const setCompany = (c: Company | null) => setCompanyState(c);

  const viewAsCompany = (id: string, name: string) => {
    setAdminViewAs({ id, name });
  };

  const exitViewAs = () => {
    setAdminViewAs(null);
  };

  return (
    <CompanyContext.Provider
      value={{
        company,
        loading,
        needsOnboarding: !company && !loading && !!user && !adminViewAs,
        isPlatformAdmin,
        isSuspended: company?.is_suspended ?? false,
        teamRole,
        adminViewAs,
        refresh,
        setCompany,
        viewAsCompany,
        exitViewAs,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
