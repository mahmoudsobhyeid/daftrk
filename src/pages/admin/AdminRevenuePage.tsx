import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../../components/ui/Button';
import { AdminRevenue } from '../../components/admin/AdminRevenue';
import type { CompanyRow } from '../../components/admin/AdminCompanies';
import { RefreshCw } from 'lucide-react';

export function AdminRevenuePage() {
  const { toast } = useToast();
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_admin_overview');
    if (error) toast(error.message, 'error');
    else setCompanies((data as CompanyRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100 tracking-tight">Revenue</h1>
          <p className="text-xs text-secondary-400 mt-0.5">
            ${companies.reduce((s, c) => s + (c.amount_paid ?? 0), 0).toLocaleString()} total collected
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw size={13} /> Refresh
        </Button>
      </div>
      {!loading && <AdminRevenue companies={companies} />}
    </div>
  );
}
