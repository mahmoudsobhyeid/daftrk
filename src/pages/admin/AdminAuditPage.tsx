import { AdminAuditLogs } from '../../components/admin/AdminAuditLogs';

export function AdminAuditPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100 tracking-tight">Audit Logs</h1>
        <p className="text-xs text-secondary-400 mt-0.5">Track all admin actions and platform events</p>
      </div>
      <AdminAuditLogs />
    </div>
  );
}
