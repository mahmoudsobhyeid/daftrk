import type { PermissionModule, PermissionAction, PermissionSet, TeamRole } from './types';

export interface ModuleMeta {
  key: PermissionModule;
  labelAr: string;
  labelEn: string;
  descAr: string;
  descEn: string;
}

export const PERMISSION_MODULES_META: ModuleMeta[] = [
  {
    key: 'invoices',
    labelAr: 'الفواتير وعروض الأسعار',
    labelEn: 'Invoices & Quotations',
    descAr: 'إصدار الفواتير الإلكترونية وعروض الأسعار',
    descEn: 'Issue electronic invoices & quotes',
  },
  {
    key: 'sales',
    labelAr: 'المبيعات والعقود',
    labelEn: 'Sales & Orders',
    descAr: 'إدارة أوامر المبيعات ومعاملات البيع',
    descEn: 'Manage sales transactions & orders',
  },
  {
    key: 'purchases',
    labelAr: 'المشتريات وأوامر الشراء',
    labelEn: 'Purchases & Bills',
    descAr: 'فواتير المشتريات ومتابعة الموردين',
    descEn: 'Purchase bills & supplier tracking',
  },
  {
    key: 'inventory',
    labelAr: 'المخزون والمستودعات',
    labelEn: 'Inventory & Warehouses',
    descAr: 'إدارة كميات المنتجات والتحويلات المخزنية',
    descEn: 'Manage stock levels & transfers',
  },
  {
    key: 'customers',
    labelAr: 'دليل العملاء',
    labelEn: 'Customers Directory',
    descAr: 'إدارة سجلات العملاء وأرصدتهم',
    descEn: 'Manage customer records & balances',
  },
  {
    key: 'suppliers',
    labelAr: 'دليل الموردين',
    labelEn: 'Suppliers Directory',
    descAr: 'بيانات الموردين والمستحقات المالية',
    descEn: 'Supplier details & payables',
  },
  {
    key: 'expenses',
    labelAr: 'المصروفات وسندات الصرف',
    labelEn: 'Expenses & Payments',
    descAr: 'تسجيل النفقات وسندات الصرف والقبض',
    descEn: 'Track expenditures & vouchers',
  },
  {
    key: 'reports',
    labelAr: 'التقارير المالية والمحاسبية',
    labelEn: 'Reports & Analytics',
    descAr: 'الاطلاع على تقارير الأرباح والضريبة والإيرادات',
    descEn: 'View profit, VAT & revenue reports',
  },
  {
    key: 'user_management',
    labelAr: 'إدارة فريق العمل والأعضاء',
    labelEn: 'Team & User Management',
    descAr: 'إضافة وتعديل صلاحيات أعضاء الشركة',
    descEn: 'Invite & manage company team members',
  },
];

export const ACTION_META: Record<PermissionAction, { labelAr: string; labelEn: string }> = {
  view: { labelAr: 'عرض', labelEn: 'View' },
  create: { labelAr: 'إضافة', labelEn: 'Create' },
  edit: { labelAr: 'تعديل', labelEn: 'Edit' },
  delete: { labelAr: 'حذف', labelEn: 'Delete' },
};

export const ROLE_META: Record<TeamRole, { titleAr: string; titleEn: string; descAr: string; descEn: string }> = {
  owner: {
    titleAr: 'مالك الشركة (كامل الصلاحيات)',
    titleEn: 'Company Owner (Full Access)',
    descAr: 'صلاحيات مطلقة لإدارة الشركة والاشتراك وكافة العمليات',
    descEn: 'Full permissions over company, settings, and team',
  },
  admin: {
    titleAr: 'مدير النظام',
    titleEn: 'System Administrator',
    descAr: 'إدارة العمليات الرئيسية وفريق العمل والإعدادات',
    descEn: 'Manage core business operations, team & settings',
  },
  agent: {
    titleAr: 'وكيل / مندوب مبيعات',
    titleEn: 'Agent / Sales Rep',
    descAr: 'إصدار الفواتير ومتابعة العملاء والمبيعات',
    descEn: 'Issue invoices and follow up with customers',
  },
  accountant: {
    titleAr: 'محاسب مالي',
    titleEn: 'Financial Accountant',
    descAr: 'إدارة الفواتير، المصروفات، والاطلاع على التقارير',
    descEn: 'Manage invoices, expenses, and financial reports',
  },
  employee: {
    titleAr: 'عضو فريق / موظف',
    titleEn: 'Employee / Staff Member',
    descAr: 'صلاحيات محددة حسب متطلبات العمل',
    descEn: 'Custom scoped permissions according to job needs',
  },
  custom: {
    titleAr: 'دور مخصص',
    titleEn: 'Custom Role',
    descAr: 'صلاحيات مخصصة تم تحديدها يدوياً',
    descEn: 'Individually assigned permissions',
  },
};

export function getDefaultPermissions(role: TeamRole): PermissionSet {
  if (role === 'owner') {
    const p: PermissionSet = {};
    for (const m of PERMISSION_MODULES_META) {
      p[m.key] = { view: true, create: true, edit: true, delete: true };
    }
    return p;
  }
  if (role === 'admin') {
    const p: PermissionSet = {};
    for (const m of PERMISSION_MODULES_META) {
      p[m.key] = { view: true, create: true, edit: true, delete: m.key !== 'user_management' };
    }
    return p;
  }
  if (role === 'accountant') {
    const p: PermissionSet = {};
    for (const m of PERMISSION_MODULES_META) {
      p[m.key] = { view: false, create: false, edit: false, delete: false };
    }
    p['invoices'] = { view: true, create: true, edit: true, delete: false };
    p['expenses'] = { view: true, create: true, edit: true, delete: false };
    p['reports'] = { view: true, create: false, edit: false, delete: false };
    p['customers'] = { view: true, create: true, edit: false, delete: false };
    p['suppliers'] = { view: true, create: true, edit: false, delete: false };
    return p;
  }
  if (role === 'agent') {
    const p: PermissionSet = {};
    for (const m of PERMISSION_MODULES_META) {
      p[m.key] = { view: false, create: false, edit: false, delete: false };
    }
    p['invoices'] = { view: true, create: true, edit: false, delete: false };
    p['sales'] = { view: true, create: true, edit: false, delete: false };
    p['customers'] = { view: true, create: true, edit: true, delete: false };
    return p;
  }
  return {};
}

/**
 * Formats permissions as clean readable plain text (Arabic / English)
 * Perfect for WhatsApp, Email body, SMS, and clipboard copying.
 */
export function formatPermissionsSummary(
  permissions: PermissionSet | undefined,
  role: TeamRole,
  lang: 'ar' | 'en' = 'ar'
): string {
  const isAr = lang === 'ar';
  const roleName = isAr ? ROLE_META[role]?.titleAr ?? role : ROLE_META[role]?.titleEn ?? role;

  if (role === 'owner') {
    return isAr
      ? `• الدور: ${roleName}\n• الصلاحيات: كامل الصلاحيات لجميع الأقسام (عرض، إضافة، تعديل، حذف).`
      : `• Role: ${roleName}\n• Permissions: Full Access to all modules (View, Create, Edit, Delete).`;
  }

  const effective = permissions || getDefaultPermissions(role);
  const lines: string[] = [];
  lines.push(isAr ? `• الدور الوظيفي: ${roleName}` : `• Role: ${roleName}`);
  lines.push(isAr ? `• تفاصيل الصلاحيات الممنوحة:` : `• Detailed Permissions:`);

  let hasAny = false;
  for (const mod of PERMISSION_MODULES_META) {
    const p = effective[mod.key];
    const modTitle = isAr ? mod.labelAr : mod.labelEn;
    const allowedActions: string[] = [];

    if (p?.view) allowedActions.push(isAr ? 'عرض' : 'View');
    if (p?.create) allowedActions.push(isAr ? 'إضافة' : 'Create');
    if (p?.edit) allowedActions.push(isAr ? 'تعديل' : 'Edit');
    if (p?.delete) allowedActions.push(isAr ? 'حذف' : 'Delete');

    if (allowedActions.length > 0) {
      hasAny = true;
      lines.push(`   - ${modTitle}: ${allowedActions.join(' | ')}`);
    }
  }

  if (!hasAny) {
    lines.push(isAr ? `   - لم يتم تحديد صلاحيات نشطة بعد` : `   - No active permissions assigned yet`);
  }

  return lines.join('\n');
}

/**
 * Builds HTML table of permissions for rich emails
 */
export function formatPermissionsHtml(
  permissions: PermissionSet | undefined,
  role: TeamRole,
  lang: 'ar' | 'en' = 'ar'
): string {
  const isAr = lang === 'ar';
  const roleName = isAr ? ROLE_META[role]?.titleAr ?? role : ROLE_META[role]?.titleEn ?? role;

  if (role === 'owner') {
    return `
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px; margin: 18px 0; text-align: ${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'};">
        <strong style="color: #065f46; font-size: 15px;">${isAr ? 'الدور الوظيفي: ' : 'Assigned Role: '} ${roleName}</strong>
        <p style="color: #047857; font-size: 13px; margin: 6px 0 0 0;">
          ${isAr ? 'تم منحك كامل الصلاحيات دون أي قيود لإدارة النظام وكافة أقسام وفواتير الشركة.' : 'You have been granted full unrestricted administrative permissions across all company modules.'}
        </p>
      </div>
    `;
  }

  const effective = permissions || getDefaultPermissions(role);

  let rows = '';
  for (const mod of PERMISSION_MODULES_META) {
    const p = effective[mod.key];
    const modTitle = isAr ? mod.labelAr : mod.labelEn;

    const renderBadge = (active: boolean | undefined, label: string) => {
      if (active) {
        return `<span style="display: inline-block; padding: 2px 7px; margin: 1px; font-size: 11px; font-weight: 600; border-radius: 6px; background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;">✓ ${label}</span>`;
      }
      return `<span style="display: inline-block; padding: 2px 7px; margin: 1px; font-size: 11px; border-radius: 6px; background-color: #f1f5f9; color: #94a3b8;">✕</span>`;
    };

    const hasAny = p?.view || p?.create || p?.edit || p?.delete;
    const rowBg = hasAny ? '#ffffff' : '#f8fafc';

    rows += `
      <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 10px 12px; font-weight: 600; color: ${hasAny ? '#1e293b' : '#64748b'}; font-size: 13px;">${modTitle}</td>
        <td style="padding: 8px 6px; text-align: center;">${renderBadge(p?.view, isAr ? 'عرض' : 'View')}</td>
        <td style="padding: 8px 6px; text-align: center;">${renderBadge(p?.create, isAr ? 'إضافة' : 'Create')}</td>
        <td style="padding: 8px 6px; text-align: center;">${renderBadge(p?.edit, isAr ? 'تعديل' : 'Edit')}</td>
        <td style="padding: 8px 6px; text-align: center;">${renderBadge(p?.delete, isAr ? 'حذف' : 'Delete')}</td>
      </tr>
    `;
  }

  return `
    <div style="margin: 20px 0; text-align: ${isAr ? 'right' : 'left'}; direction: ${isAr ? 'rtl' : 'ltr'};">
      <div style="margin-bottom: 10px;">
        <span style="font-size: 12px; color: #64748b; font-weight: 600;">${isAr ? 'الدور الوظيفي:' : 'Assigned Role:'}</span>
        <strong style="font-size: 14px; color: #1e293b; margin-${isAr ? 'right' : 'left'}: 6px;">${roleName}</strong>
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 13px;">
        <thead>
          <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
            <th style="padding: 10px 12px; text-align: ${isAr ? 'right' : 'left'}; color: #475569; font-weight: 700;">${isAr ? 'القسم / الوحدة' : 'Module'}</th>
            <th style="padding: 10px 6px; text-align: center; color: #475569; font-weight: 700; width: 60px;">${isAr ? 'عرض' : 'View'}</th>
            <th style="padding: 10px 6px; text-align: center; color: #475569; font-weight: 700; width: 60px;">${isAr ? 'إضافة' : 'Create'}</th>
            <th style="padding: 10px 6px; text-align: center; color: #475569; font-weight: 700; width: 60px;">${isAr ? 'تعديل' : 'Edit'}</th>
            <th style="padding: 10px 6px; text-align: center; color: #475569; font-weight: 700; width: 60px;">${isAr ? 'حذف' : 'Delete'}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}
