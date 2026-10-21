import { AdminSystemHealth } from '../../components/admin/AdminSystemHealth';

export function AdminHealthPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100 tracking-tight">System Health</h1>
        <p className="text-xs text-secondary-400 mt-0.5">Platform metrics and real-time health indicators</p>
      </div>
      <AdminSystemHealth />
    </div>
  );
}
