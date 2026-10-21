import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { AdminCompanies, type CompanyRow } from '../../components/admin/AdminCompanies';
import { RefreshCw } from 'lucide-react';
import type { Plan } from '../../lib/types';

export function AdminCompaniesPage() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [overviewRes, plansRes] = await Promise.all([
      supabase.rpc('get_admin_overview'),
      supabase.from('plans').select('*').order('sort_order'),
    ]);
    if (overviewRes.error) toast(overviewRes.error.message, 'error');
    else setCompanies((overviewRes.data as CompanyRow[]) ?? []);
    setPlans((plansRes.data as Plan[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100 tracking-tight">Companies</h1>
          <p className="text-xs text-secondary-400 mt-0.5">{companies.length} total companies</p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>
      <AdminCompanies companies={companies} plans={plans} loading={loading} onRefresh={load} />
    </div>
  );
}
