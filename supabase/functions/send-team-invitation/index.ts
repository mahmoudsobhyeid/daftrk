const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PermissionActionMap {
  view?: boolean;
  create?: boolean;
  edit?: boolean;
  delete?: boolean;
}

type PermissionSet = Record<string, PermissionActionMap>;

const MODULE_NAMES: Record<string, { ar: string; en: string }> = {
  invoices: { ar: 'الفواتير وعروض الأسعار', en: 'Invoices & Quotes' },
  sales: { ar: 'المبيعات والعقود', en: 'Sales & Orders' },
  purchases: { ar: 'المشتريات وفواتير الشراء', en: 'Purchases & Bills' },
  inventory: { ar: 'المخزون وإدارة المستودعات', en: 'Inventory & Warehouses' },
  customers: { ar: 'دليل العملاء', en: 'Customers Directory' },
  suppliers: { ar: 'دليل الموردين', en: 'Suppliers Directory' },
  expenses: { ar: 'المصروفات وسندات الصرف', en: 'Expenses & Vouchers' },
  reports: { ar: 'التقارير المالية والضريبية', en: 'Reports & Analytics' },
  user_management: { ar: 'إدارة فريق العمل والأعضاء', en: 'Team & Member Management' },
};

const ROLE_LABELS: Record<string, { en: string; ar: string }> = {
  owner: { en: "Owner (Full Access)", ar: "مالك الشركة (كامل الصلاحيات)" },
  admin: { en: "System Administrator", ar: "مدير النظام" },
  agent: { en: "Sales Agent", ar: "وكيل / مندوب مبيعات" },
  accountant: { en: "Financial Accountant", ar: "محاسب مالي" },
  employee: { en: "Staff Member", ar: "عضو فريق / موظف" },
  custom: { en: "Custom Permissions", ar: "صلاحيات مخصصة" },
};

function generatePermissionsHtmlTable(permissions: PermissionSet | undefined, role: string, isAr: boolean): string {
  const roleLabel = (isAr ? ROLE_LABELS[role]?.ar : ROLE_LABELS[role]?.en) || role;

  if (role === 'owner') {
    return `
      <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 16px; margin: 20px 0; text-align: ${isAr ? 'right' : 'left'};">
        <strong style="color: #065f46; font-size: 15px;">🛡️ ${isAr ? 'الدور الوظيفي: ' : 'Assigned Role: '} ${roleLabel}</strong>
        <p style="color: #047857; font-size: 13px; margin: 8px 0 0 0; line-height: 1.5;">
          ${isAr ? 'تم منحك كامل الصلاحيات دون قيود (عرض، إضافة، تعديل، حذف) لكافة أقسام النظام.' : 'You have been granted full unrestricted administrative access to all modules.'}
        </p>
      </div>
    `;
  }

  const effective = permissions || {};
  let rows = '';

  for (const [key, meta] of Object.entries(MODULE_NAMES)) {
    const p = effective[key];
    const modTitle = isAr ? meta.ar : meta.en;

    const renderBadge = (active: boolean | undefined, label: string) => {
      if (active) {
        return `<span style="display: inline-block; padding: 2px 7px; margin: 1px; font-size: 11px; font-weight: 600; border-radius: 5px; background-color: #dcfce7; color: #166534; border: 1px solid #bbf7d0;">✓ ${label}</span>`;
      }
      return `<span style="display: inline-block; padding: 2px 7px; margin: 1px; font-size: 11px; border-radius: 5px; background-color: #f1f5f9; color: #94a3b8;">✕</span>`;
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
    <div style="margin: 24px 0; text-align: ${isAr ? 'right' : 'left'};">
      <div style="margin-bottom: 10px; padding: 10px 14px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <span style="font-size: 12px; color: #64748b; font-weight: 600;">${isAr ? 'الدور الوظيفي:' : 'Assigned Role:'}</span>
        <strong style="font-size: 14px; color: #1e293b; margin-${isAr ? 'right' : 'left'}: 8px;">${roleLabel}</strong>
      </div>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; font-size: 13px;">
        <thead>
          <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
            <th style="padding: 10px 12px; text-align: ${isAr ? 'right' : 'left'}; color: #334155; font-weight: 700;">${isAr ? 'القسم / الصلاحية' : 'Module'}</th>
            <th style="padding: 10px 6px; text-align: center; color: #334155; font-weight: 700; width: 55px;">${isAr ? 'عرض' : 'View'}</th>
            <th style="padding: 10px 6px; text-align: center; color: #334155; font-weight: 700; width: 55px;">${isAr ? 'إضافة' : 'Create'}</th>
            <th style="padding: 10px 6px; text-align: center; color: #334155; font-weight: 700; width: 55px;">${isAr ? 'تعديل' : 'Edit'}</th>
            <th style="padding: 10px 6px; text-align: center; color: #334155; font-weight: 700; width: 55px;">${isAr ? 'حذف' : 'Delete'}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      email,
      companyName,
      inviterName,
      role = 'employee',
      setupUrl,
      loginUrl,
      token,
      expiresAt,
      permissions,
      isExistingUser = false,
      lang = 'ar',
    } = await req.json();

    const isAr = lang !== 'en';
    const targetUrl = isExistingUser ? (loginUrl || setupUrl) : setupUrl;

    if (!email || !targetUrl) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, setupUrl/loginUrl" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Daftrk <onboarding@resend.dev>";

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({
          error: "RESEND_API_KEY secret not configured in Supabase. You can send the invitation directly via Gmail, Email Client, or WhatsApp using the link provided.",
          code: "RESEND_API_KEY_MISSING",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const roleLabel = (isAr ? ROLE_LABELS[role]?.ar : ROLE_LABELS[role]?.en) || role;
    const permissionsTableHtml = generatePermissionsHtmlTable(permissions, role, isAr);
    const ctaText = isExistingUser
      ? (isAr ? 'تسجيل الدخول إلى بيئة العمل' : 'Log In to Workspace')
      : (isAr ? 'تفعيل الحساب وتعيين كلمة المرور' : 'Activate Account & Set Password');

    const subject = isExistingUser
      ? (isAr
          ? `تمت إضافتك إلى فريق عمل ${companyName || 'الشركة'} على منصة دفترك (تفاصيل الصلاحيات)`
          : `You've been added to ${companyName || 'the team'} on Daftrk (Permissions Details)`)
      : (isAr
          ? `دعوة للانضمام إلى فريق عمل ${companyName || 'الشركة'} على منصة دفترك (تفاصيل الصلاحيات)`
          : `Invitation to join ${companyName || 'the team'} on Daftrk (Permissions Details)`);

    const htmlBody = `
      <!DOCTYPE html>
      <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 32px 18px; background-color: #f8fafc; color: #1e293b; direction: ${isAr ? 'rtl' : 'ltr'}; text-align: ${isAr ? 'right' : 'left'};">
        <div style="background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px 24px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- Header -->
          <div style="text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9;">
            <h1 style="color: #2563eb; font-size: 26px; margin: 0 0 6px 0; font-weight: 800;">دفترك — Daftrk</h1>
            <p style="color: #64748b; font-size: 13px; margin: 0;">منصة الفواتير وإدارة الأعمال الذكية</p>
          </div>

          <!-- Title -->
          <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 14px 0; font-weight: 700;">
            ${isExistingUser
              ? (isAr ? `مرحباً، تمت إضافتك إلى بيئة عمل "${companyName || 'فريق العمل'}"` : `Hi there, you have been added to "${companyName || 'the team'}"`)
              : (isAr ? `دعوة للانضمام إلى فريق عمل "${companyName || 'الشركة'}"` : `Invitation to join "${companyName || 'the team'}"`)}
          </h2>

          <p style="color: #334155; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">
            ${isAr
              ? `قام <strong>${inviterName || 'مسؤول الشركة'}</strong> بإضافتك إلى فريق عمل <strong>${companyName || 'الشركة'}</strong> بصلاحية: <span style="color: #2563eb; font-weight: 700;">${roleLabel}</span>.`
              : `<strong>${inviterName || 'Team administrator'}</strong> has added you to <strong>${companyName || 'the team'}</strong> as: <span style="color: #2563eb; font-weight: 700;">${roleLabel}</span>.`}
          </p>

          <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
            ${isAr ? 'فيما يلي جدول الصلاحيات الممنوحة لحسابك في بيئة العمل:' : 'Below is the detailed list of permissions granted to your account:'}
          </p>

          <!-- Permissions Breakdown -->
          ${permissionsTableHtml}

          <!-- Action Button -->
          <div style="text-align: center; margin: 32px 0 24px 0;">
            <a href="${targetUrl}"
               style="background-color: #2563eb; color: #ffffff; padding: 14px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">
              ${ctaText}
            </a>
          </div>

          <!-- Direct Link -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-top: 20px;">
            <p style="color: #64748b; font-size: 12px; margin: 0 0 6px 0;">
              ${isAr ? 'أو يمكنك نسخ الرابط التالي مباشرة إلى المتصفح:' : 'Or copy and paste this link into your browser:'}
            </p>
            <a href="${targetUrl}" style="color: #2563eb; word-break: break-all; font-size: 12px; text-decoration: underline;">
              ${targetUrl}
            </a>
          </div>

          ${!isExistingUser ? `
            <p style="color: #94a3b8; font-size: 12px; margin-top: 14px; text-align: center;">
              ${isAr ? '⚠️ هذا الرابط آمن وصالح لمدة 72 ساعة لإتمام إعداد كلمة المرور الخاصة بك.' : '⚠️ This secure link is valid for 72 hours to set your initial password.'}
            </p>
          ` : ''}

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 28px 0 20px 0;">

          <!-- Footer -->
          <p style="color: #94a3b8; font-size: 12px; margin: 0 0 6px 0; text-align: center;">
            ${isAr ? 'إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذه الرسالة بأمان.' : 'If you did not expect this invitation, you can safely ignore this email.'}
          </p>
          <p style="color: #94a3b8; font-size: 12px; margin: 0; text-align: center;">
            © 2026 Daftrk — منصة دفترك
          </p>

        </div>
      </body>
      </html>
    `;

    console.log('send-team-invitation: attempting to send invite', { email, companyName, role, isExistingUser });
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject,
        html: htmlBody,
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('send-team-invitation: provider error', { status: res.status, body: text });
      return new Response(
        JSON.stringify({ error: `Email provider error (${res.status}): ${text}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
