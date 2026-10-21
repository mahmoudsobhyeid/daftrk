import { Routes, Route } from 'react-router-dom';
import { AdminLayout } from './AdminLayout';
import { AdminPage } from '../AdminPage';
import { AdminUsersPage } from './AdminUsersPage';
import { AdminPlansPage } from './AdminPlansPage';

// These wrap the existing tab-content components into dedicated pages
import { AdminCompaniesPage } from './AdminCompaniesPage';
import { AdminRevenuePage } from './AdminRevenuePage';
import { AdminAuditPage } from './AdminAuditPage';
import { AdminHealthPage } from './AdminHealthPage';

export function AdminRouter() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<AdminPage />} />
        <Route path="companies" element={<AdminCompaniesPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="revenue" element={<AdminRevenuePage />} />
        <Route path="plans" element={<AdminPlansPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
        <Route path="health" element={<AdminHealthPage />} />
      </Routes>
    </AdminLayout>
  );
}
