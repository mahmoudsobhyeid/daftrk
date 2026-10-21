import { useCallback, useEffect, useState } from 'react';
import {
  UserPlus, Trash2, Shield, Crown, UserCog, Mail, Copy, Clock,
  CheckCircle, XCircle, Send, Settings, Edit3, AlertTriangle, Check,
  KeyRound, Share2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import type { TeamMember, TeamRole, PermissionSet } from '../lib/types';
import {
  PERMISSION_MODULES_META,
  ACTION_META,
  ROLE_META,
  getDefaultPermissions,
  formatPermissionsSummary,
} from '../lib/team-permissions';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableHead, TableBody, TableRow, Th, Td } from '../components/ui/Table';
import { useLanguage } from '../contexts/LanguageContext';

function WhatsAppMiniIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}

function GmailIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L12 9.545l8.073-6.052C21.69 2.28 24 3.434 24 5.457z"/>
    </svg>
  );
}

const roleIcon: Record<TeamRole, typeof Crown | typeof UserCog | typeof Shield | typeof Settings> = {
  owner: Crown,
  admin: UserCog,
  agent: Shield,
  accountant: UserCog,
  employee: Shield,
  custom: Settings,
};

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  status: string;
  token?: string;
  created_at: string;
  accepted_at: string | null;
  expires_at?: string;
  permissions?: PermissionSet;
}

interface InviteResult {
  ok: boolean;
  error?: string;
  user_id?: string;
  already_registered?: boolean;
  token?: string;
  temp_password?: string;
  email?: string;
  permissions?: PermissionSet;
  role?: TeamRole;
}

export function TeamPage() {
  const { company } = useCompany();
  const { toast } = useToast();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('employee');
  const [invitePermissions, setInvitePermissions] = useState<PermissionSet>(getDefaultPermissions('employee'));
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteResult | null>(null);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  // Share member modal
  const [shareMember, setShareMember] = useState<TeamMember | null>(null);

  // Reset member password modal
  const [resetMember, setResetMember] = useState<TeamMember | null>(null);
  const [_resettingPassword, setResettingPassword] = useState(false);
  const [resetUrl, setResetUrl] = useState<string>('');

  const getSetupUrl = (token: string) => `${window.location.origin}/auth?view=setup&token=${token}`;
  const getLoginUrl = () => `${window.location.origin}/auth?view=login`;
  const getDefaultResetUrl = () => `${window.location.origin}/auth?view=reset`;

  const getInviteEmailSubject = (role: TeamRole) => {
    const comp = company?.name || 'دفترك';
    const roleTitle = lang === 'ar' ? ROLE_META[role]?.titleAr || role : ROLE_META[role]?.titleEn || role;
    return lang === 'ar'
      ? `دعوة للانضمام إلى فريق عمل ${comp} على منصة دفترك (${roleTitle})`
      : `Invitation to join ${comp} team on Daftrk (${roleTitle})`;
  };

  const getInviteEmailBody = (email: string, role: TeamRole, token: string, permissions?: PermissionSet) => {
    const comp = company?.name || 'فريقنا';
    const url = getSetupUrl(token);
    const permSummary = formatPermissionsSummary(permissions, role, lang);

    if (lang === 'ar') {
      return `مرحباً،\n\nتمت دعوتك للانضمام إلى فريق عمل "${comp}" على منصة دفترك (Daftrk).\n\n${permSummary}\n\nيرجى النقر على الرابط التالي لتعيين كلمة المرور وتفعيل حسابك:\n${url}\n\n(ملاحظة: هذا الرابط آمن وخاص بك وصالح لمدة 72 ساعة).\n\nنتمنى لك عملاً موفقاً،\nفريق دفترك\n${window.location.origin}`;
    }
    return `Hello,\n\nYou have been invited to join "${comp}" on Daftrk.\n\n${permSummary}\n\nPlease click the link below to set your password and activate your account:\n${url}\n\n(Note: This link is secure and valid for 72 hours).\n\nBest regards,\nDaftrk Team\n${window.location.origin}`;
  };

  const getExistingUserEmailBody = (email: string, role: TeamRole, permissions?: PermissionSet) => {
    const comp = company?.name || 'فريقنا';
    const url = getLoginUrl();
    const permSummary = formatPermissionsSummary(permissions, role, lang);

    if (lang === 'ar') {
      return `مرحباً،\n\nتمت إضافتك بنجاح إلى فريق عمل "${comp}" على منصة دفترك.\n\n${permSummary}\n\nيمكنك تسجيل الدخول مباشرة بحسابك المسجل عبر الرابط التالي للوصول لبيئة العمل:\n${url}\n\nفريق دفترك`;
    }
    return `Hello,\n\nYou have been added to "${comp}" on Daftrk.\n\n${permSummary}\n\nYou can log in with your existing account at:\n${url}\n\nDaftrk Team`;
  };

  const openInGmail = (email: string, subject: string, body: string) => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noopener,noreferrer');
  };

  const openInMailto = (email: string, subject: string, body: string) => {
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

  const shareViaWhatsApp = (body: string) => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(body)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const { data: profiles } = await supabase.rpc('get_team_member_profiles', {
      p_tenant_id: company.id,
    });
    type ProfileEntry = { user_id: string; email: string; full_name: string | null; role: TeamRole };
    const profileList = (profiles ?? []) as ProfileEntry[];

    const { data: teamRows } = await supabase
      .from('team_members')
      .select('id, tenant_id, user_id, role, created_at, permissions')
      .eq('tenant_id', company.id)
      .eq('active', true as any);

    const teamMap = new Map<string, { id: string; created_at: string; permissions?: PermissionSet }>();
    for (const r of teamRows ?? []) {
      teamMap.set(r.user_id, { id: r.id, created_at: r.created_at, permissions: r.permissions });
    }

    const enriched: TeamMember[] = profileList.map((p) => {
      const tm = teamMap.get(p.user_id);
      return {
        id: tm?.id ?? p.user_id,
        tenant_id: company.id,
        user_id: p.user_id,
        role: p.role,
        created_at: tm?.created_at ?? new Date().toISOString(),
        full_name: p.full_name,
        email: p.email,
        permissions: tm?.permissions,
      };
    });
    setMembers(enriched);

    const { data: invites } = await supabase.rpc('get_pending_invitations', { p_tenant_id: company.id });
    setPendingInvites((invites ?? []) as PendingInvite[]);

    setLoading(false);
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const sendInviteEmail = async (
    email: string,
    token?: string,
    isExistingUser = false,
    permissionsToUse?: PermissionSet,
    roleToUse: TeamRole = inviteRole
  ) => {
    setEmailStatus('sending');
    setEmailNotice(null);
    const setupUrl = token ? getSetupUrl(token) : undefined;
    const loginUrl = getLoginUrl();

    try {
      const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
      const { data, error } = await supabase.functions.invoke('send-team-invitation', {
        body: {
          email,
          companyName: company?.name ?? '',
          inviterName: user?.user_metadata?.full_name ?? user?.email ?? '',
          role: roleToUse,
          setupUrl,
          loginUrl,
          token,
          expiresAt,
          permissions: permissionsToUse || invitePermissions,
          isExistingUser,
          lang,
        },
      });

      if (error || (data && data.error)) {
        setEmailStatus('failed');
        setEmailNotice(
          data?.code === 'RESEND_API_KEY_MISSING'
            ? (lang === 'ar'
                ? 'خادم البريد التلقائي غير مفعل حالياً (لم يتم إعداد مفتاح RESEND_API_KEY في Supabase). يمكنك إرسال الدعوة بالصلاحيات مباشرة بنقرة واحدة عبر Gmail أو تطبيق البريد أو واتساب.'
                : 'Automated email server is not configured in Supabase. You can send the invitation with permissions directly via Gmail, Email App, or WhatsApp.')
            : (data?.error || (lang === 'ar' ? 'تعذر تسليم البريد التلقائي. يرجى إرسال تفاصيل الصلاحيات عبر الخيارات المباشرة أدناه.' : 'Could not deliver email automatically. Please send via options below.'))
        );
      } else {
        setEmailStatus('sent');
        toast(
          lang === 'ar'
            ? 'تم إرسال البريد الإلكتروني بالصلاحيات بنجاح إلى العضو!'
            : 'Email with permissions sent successfully!',
          'success'
        );
      }
    } catch {
      setEmailStatus('failed');
      setEmailNotice(
        lang === 'ar'
          ? 'تعذر الاتصال بخادم البريد التلقائي. يمكنك إرسال الدعوة بالصلاحيات فوراً بنقرة واحدة عبر أزرار الإرسال المباشر أدناه.'
          : 'Could not connect to automated mail server. You can send directly via Gmail, Email App, or WhatsApp below.'
      );
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !inviteEmail.trim()) return;
    setSaving(true);
    setInviteResult(null);
    setEmailStatus('idle');
    setEmailNotice(null);

    const targetEmail = inviteEmail.trim().toLowerCase();
    const effectivePermissions = invitePermissions || getDefaultPermissions(inviteRole);

    const { data, error } = await supabase.rpc('invite_team_member', {
      p_tenant_id: company.id,
      p_email: targetEmail,
      p_role: inviteRole,
      p_permissions: JSON.stringify(effectivePermissions),
    });

    if (error) {
      toast(error.message, 'error');
    } else {
      const result = data as InviteResult;
      if (result?.ok) {
        if (result.already_registered === false && result.token) {
          setInviteResult({
            ...result,
            email: targetEmail,
            permissions: effectivePermissions,
            role: inviteRole,
          });
          await sendInviteEmail(targetEmail, result.token, false, effectivePermissions, inviteRole);
        } else if (result.already_registered === true) {
          setInviteResult({
            ...result,
            email: targetEmail,
            already_registered: true,
            permissions: effectivePermissions,
            role: inviteRole,
          });
          await sendInviteEmail(targetEmail, undefined, true, effectivePermissions, inviteRole);
          toast(
            lang === 'ar'
              ? 'المستخدم مسجل مسبقاً وتمت إضافته وإرسال تفاصيل الصلاحيات إليه'
              : 'User was added to the team and sent permissions details',
            'success'
          );
        } else {
          toast(t('team.memberAdded'), 'success');
          setModalOpen(false);
          setInviteEmail('');
          setInviteRole('employee');
        }
        load();
      } else if (result?.error === 'already_member') {
        toast(t('team.alreadyMember'), 'error');
      } else {
        toast(t('team.inviteFailed'), 'error');
      }
    }
    setSaving(false);
  };

  // Permissions editor modal
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<PermissionSet>({});

  const openEditPermissions = (m: TeamMember) => {
    setEditingMember(m);
    setEditingPermissions(m.permissions || getDefaultPermissions(m.role));
    setPermissionsOpen(true);
  };

  const savePermissions = async () => {
    if (!editingMember) return;
    const { error } = await supabase.from('team_members').update({ permissions: editingPermissions }).eq('id', editingMember.id);
    if (error) {
      toast(error.message, 'error');
    } else {
      toast(t('team.permissionsSaved'), 'success');
      setPermissionsOpen(false);
      load();
    }
  };

  // Update invite permissions when role changes
  useEffect(() => {
    setInvitePermissions(getDefaultPermissions(inviteRole));
  }, [inviteRole]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast(lang === 'ar' ? 'تم النسخ إلى الحافظة' : 'Copied to clipboard', 'success');
  };

  const closeInviteModal = () => {
    setModalOpen(false);
    setInviteEmail('');
    setInviteRole('employee');
    setInvitePermissions(getDefaultPermissions('employee'));
    setInviteResult(null);
  };

  const changeRole = async (member: TeamMember, role: TeamRole) => {
    const newDefaults = getDefaultPermissions(role);
    const { error } = await supabase.from('team_members').update({ role, permissions: newDefaults }).eq('id', member.id);
    if (error) {
      toast(error.message, 'error');
    } else {
      toast(t('team.roleUpdated'), 'success');
      load();
    }
  };

  const removeMember = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.rpc('deactivate_team_member', { p_member_id: deleteTarget.id });
    if (error) toast(error.message, 'error');
    else { toast(t('team.memberRemoved'), 'success'); setDeleteTarget(null); load(); }
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase.rpc('revoke_invitation', { p_invitation_id: inviteId });
    if (error) toast(error.message, 'error');
    else { toast(lang === 'ar' ? 'تم إلغاء الدعوة' : 'Invitation revoked', 'success'); load(); }
  };

  const resendInvite = async (inv: PendingInvite) => {
    setSaving(true);
    const { data, error } = await supabase.rpc('invite_team_member', {
      p_tenant_id: company!.id,
      p_email: inv.email,
      p_role: inv.role,
      p_permissions: JSON.stringify(inv.permissions || getDefaultPermissions(inv.role as TeamRole)),
    });
    if (!error && (data as InviteResult)?.ok && (data as InviteResult)?.token) {
      const result = data as InviteResult;
      setInviteEmail(inv.email);
      setInviteRole(inv.role as TeamRole);
      setInvitePermissions(inv.permissions || getDefaultPermissions(inv.role as TeamRole));
      setInviteResult({
        ...result,
        email: inv.email,
        permissions: inv.permissions || getDefaultPermissions(inv.role as TeamRole),
        role: inv.role as TeamRole,
      });
      setModalOpen(true);
      await sendInviteEmail(inv.email, result.token!, false, inv.permissions, inv.role as TeamRole);
      load();
    } else if (error) {
      toast(error.message, 'error');
    }
    setSaving(false);
  };

  // Password Reset for Member
  const handleTriggerMemberReset = async (member: TeamMember) => {
    if (!member.email) return;
    setResetMember(member);
    setResettingPassword(true);
    setResetUrl(getDefaultResetUrl());

    try {
      await supabase.auth.resetPasswordForEmail(member.email, {
        redirectTo: getDefaultResetUrl(),
      });
      // Also try edge function
      try {
        supabase.functions.invoke('send-password-reset', {
          body: {
            email: member.email,
            resetUrl: getDefaultResetUrl(),
            userName: member.full_name || '',
            lang,
          },
        }).catch(() => {});
      } catch {
        // ignore
      }
      toast(
        lang === 'ar'
          ? `تم إرسال بريد استعادة كلمة المرور إلى ${member.email}`
          : `Password reset email sent to ${member.email}`,
        'success'
      );
    } catch (err: any) {
      toast(err.message || 'Error triggering reset', 'error');
    } finally {
      setResettingPassword(false);
    }
  };

  const getResetMessageBody = (member: TeamMember) => {
    const comp = company?.name || 'دفترك';
    const name = member.full_name || 'عزيزي العضو';
    if (lang === 'ar') {
      return `مرحباً ${name}،\n\nإليك رابط إعادة تعيين كلمة المرور لحسابك في فريق عمل "${comp}" على منصة دفترك:\n${getDefaultResetUrl()}\n\nيمكنك فتح الرابط وتعيين كلمة مرور جديدة لتسجيل الدخول فوراً.\n\nتحياتنا،\n${comp}`;
    }
    return `Hello ${name},\n\nHere is your password reset link for "${comp}" on Daftrk:\n${getDefaultResetUrl()}\n\nYou can open this link to set a new password and log in.\n\nBest regards,\n${comp}`;
  };

  if (loading) return <div className="flex justify-center py-20"><div className="spinner" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100">{t('team.title')}</h1>
          <p className="text-sm text-secondary-500 mt-1">{t('team.subtitle')}</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <UserPlus size={16} /> {t('team.inviteMember')}
        </Button>
      </div>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock size={18} className="text-warning-500" />
              {lang === 'ar' ? 'دعوات معلقة' : 'Pending Invitations'} ({pendingInvites.filter(i => i.status === 'pending').length})
            </CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <Th>{t('team.email')}</Th>
                  <Th>{t('team.role')}</Th>
                  <Th>{lang === 'ar' ? 'الصلاحيات' : 'Permissions'}</Th>
                  <Th>{lang === 'ar' ? 'الحالة' : 'Status'}</Th>
                  <Th>{lang === 'ar' ? 'أُرسلت' : 'Sent'}</Th>
                  <Th className="text-end">{t('team.actions')}</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingInvites.map((inv) => {
                  const roleKey = inv.role as TeamRole;
                  const roleMeta = ROLE_META[roleKey];
                  const permSummary = formatPermissionsSummary(inv.permissions, roleKey, lang);

                  return (
                    <TableRow key={inv.id}>
                      <Td className="text-secondary-800 dark:text-secondary-200 font-medium">{inv.email}</Td>
                      <Td>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                          {(() => { const Icon = roleIcon[roleKey] ?? Shield; return <Icon size={12} />; })()}
                          {lang === 'ar' ? roleMeta?.titleAr || inv.role : roleMeta?.titleEn || inv.role}
                        </span>
                      </Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => {
                            copyToClipboard(permSummary);
                          }}
                          className="text-[11px] text-primary-600 hover:underline dark:text-primary-400 font-medium inline-flex items-center gap-1"
                          title={lang === 'ar' ? 'عرض ونسخ الصلاحيات' : 'View & copy permissions'}
                        >
                          <Shield size={12} />
                          <span>{lang === 'ar' ? 'محددة (نسخ)' : 'Configured (Copy)'}</span>
                        </button>
                      </Td>
                      <Td>
                        {inv.status === 'pending' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warning-600 dark:text-warning-400">
                            <Clock size={12} /> {lang === 'ar' ? 'معلقة' : 'Pending'}
                          </span>
                        ) : inv.status === 'accepted' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-600 dark:text-success-400">
                            <CheckCircle size={12} /> {lang === 'ar' ? 'مقبولة' : 'Accepted'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary-400">
                            <XCircle size={12} /> {inv.status}
                          </span>
                        )}
                      </Td>
                      <Td className="text-secondary-500 text-xs">{new Date(inv.created_at).toLocaleDateString()}</Td>
                      <Td className="text-end">
                        {inv.status === 'pending' && (
                          <div className="flex justify-end items-center gap-1">
                            {inv.token && (
                              <>
                                <button
                                  onClick={() => copyToClipboard(getSetupUrl(inv.token!))}
                                  className="p-1.5 rounded-lg text-secondary-500 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
                                  title={lang === 'ar' ? 'نسخ رابط التفعيل' : 'Copy setup link'}
                                >
                                  <Copy size={15} />
                                </button>
                                <button
                                  onClick={() =>
                                    openInGmail(
                                      inv.email,
                                      getInviteEmailSubject(roleKey),
                                      getInviteEmailBody(inv.email, roleKey, inv.token!, inv.permissions)
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                  title={lang === 'ar' ? 'إرسال بالصلاحيات عبر Gmail' : 'Send with permissions via Gmail'}
                                >
                                  <GmailIcon size={15} />
                                </button>
                                <button
                                  onClick={() =>
                                    openInMailto(
                                      inv.email,
                                      getInviteEmailSubject(roleKey),
                                      getInviteEmailBody(inv.email, roleKey, inv.token!, inv.permissions)
                                    )
                                  }
                                  className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                                  title={lang === 'ar' ? 'إرسال عبر تطبيق البريد' : 'Send via Email App'}
                                >
                                  <Mail size={15} />
                                </button>
                                <button
                                  onClick={() =>
                                    shareViaWhatsApp(getInviteEmailBody(inv.email, roleKey, inv.token!, inv.permissions))
                                  }
                                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                                  title={lang === 'ar' ? 'مشاركة بالصلاحيات عبر واتساب' : 'Share with permissions via WhatsApp'}
                                >
                                  <WhatsAppMiniIcon size={15} />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => resendInvite(inv)}
                              className="p-1.5 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                              title={lang === 'ar' ? 'إعادة الإرسال عبر الخادم' : 'Resend via server'}
                            >
                              <Send size={15} />
                            </button>
                            <button
                              onClick={() => revokeInvite(inv.id)}
                              className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                              title={lang === 'ar' ? 'إلغاء' : 'Revoke'}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        )}
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      {/* Active Team Members */}
      <Card>
        <CardHeader>
          <CardTitle>{t('team.activeMembers')}</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {members.length === 0 ? (
            <div className="p-8 text-center text-secondary-500">{t('team.noMembers')}</div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <Th>{t('team.name')}</Th>
                  <Th>{t('team.email')}</Th>
                  <Th>{t('team.role')}</Th>
                  <Th>{lang === 'ar' ? 'الصلاحيات' : 'Permissions'}</Th>
                  <Th>{t('team.joined')}</Th>
                  <Th className="text-end">{t('team.actions')}</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((m) => {
                  const Icon = roleIcon[m.role];
                  const ownerCount = members.filter((x) => x.role === 'owner').length;
                  const isCurrent = m.user_id === user?.id;

                  return (
                    <TableRow key={m.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-300 text-sm font-bold">
                            {(m.full_name?.[0] ?? m.email?.[0] ?? 'U').toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium text-secondary-800 dark:text-secondary-100 block">
                              {m.full_name ?? t('team.unknown')}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] text-primary-600 font-semibold">
                                {lang === 'ar' ? '(أنت)' : '(You)'}
                              </span>
                            )}
                          </div>
                        </div>
                      </Td>
                      <Td className="text-secondary-500 font-mono text-xs">{m.email ?? '—'}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-secondary-400" />
                          <Select
                            value={m.role}
                            onChange={(e) => changeRole(m, e.target.value as TeamRole)}
                            className="w-auto text-xs py-1.5"
                            disabled={isCurrent && m.role === 'owner' && ownerCount <= 1}
                          >
                            <option value="owner">{t('team.owner')}</option>
                            <option value="admin">{lang === 'ar' ? 'مدير النظام' : 'Admin'}</option>
                            <option value="accountant">{lang === 'ar' ? 'محاسب' : 'Accountant'}</option>
                            <option value="agent">{lang === 'ar' ? 'مندوب مبيعات' : 'Agent'}</option>
                            <option value="employee">{lang === 'ar' ? 'موظف' : 'Employee'}</option>
                            <option value="custom">{lang === 'ar' ? 'دور مخصص' : 'Custom Role'}</option>
                          </Select>
                        </div>
                      </Td>
                      <Td>
                        <button
                          type="button"
                          onClick={() => setShareMember(m)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/40 dark:text-primary-300 border border-primary-200 dark:border-primary-800 transition-colors"
                          title={lang === 'ar' ? 'عرض ومشاركة الصلاحيات' : 'View & Share Permissions'}
                        >
                          <Share2 size={13} />
                          <span>{lang === 'ar' ? 'إرسال الصلاحيات' : 'Share Perms'}</span>
                        </button>
                      </Td>
                      <Td className="text-secondary-500 text-xs">{new Date(m.created_at).toLocaleDateString()}</Td>
                      <Td className="text-end">
                        <div className="flex justify-end items-center gap-1">
                          {/* Send Password Reset Link */}
                          {m.email && (
                            <button
                              onClick={() => handleTriggerMemberReset(m)}
                              title={
                                lang === 'ar'
                                  ? 'إرسال رابط استعادة / إعادة تعيين كلمة المرور للعضو'
                                  : 'Send password reset link to member'
                              }
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                            >
                              <KeyRound size={15} />
                            </button>
                          )}

                          {/* Edit Permissions */}
                          <button
                            onClick={() => openEditPermissions(m)}
                            title={lang === 'ar' ? 'تعديل الصلاحيات' : 'Edit permissions'}
                            className="p-1.5 rounded-lg text-secondary-500 hover:bg-secondary-50 dark:hover:bg-secondary-900/20 transition-colors"
                          >
                            <Edit3 size={15} />
                          </button>

                          {/* Delete */}
                          {!isCurrent && !(m.role === 'owner' && ownerCount <= 1) && (
                            <button
                              onClick={() => setDeleteTarget(m)}
                              className="p-1.5 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                              title={lang === 'ar' ? 'إزالة من الفريق' : 'Remove member'}
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Invite Modal */}
      <Modal open={modalOpen} onClose={closeInviteModal} title={t('team.inviteTitle')} size="lg">
        {inviteResult ? (
          <div className="space-y-4">
            {inviteResult.already_registered ? (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <CheckCircle size={22} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-900 dark:text-blue-200">
                    {lang === 'ar' ? 'تمت إضافة العضو وتعيين الصلاحيات بنجاح!' : 'Member Added & Permissions Assigned!'}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1 leading-relaxed">
                    {lang === 'ar'
                      ? 'هذا المستخدم يمتلك حساباً مسجلاً مسبقاً في دفترك. تمت إضافته إلى شركتك وتم إرسال تفاصيل الصلاحيات إليه ويمكنه تسجيل الدخول فوراً ببياناته الحالية.'
                      : 'This user already has an account. They were added to the company, notified of their permissions, and can log in now.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-success-50 dark:bg-success-950/30 border border-success-200 dark:border-success-800">
                <CheckCircle size={22} className="text-success-600 dark:text-success-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-success-900 dark:text-success-200">
                    {lang === 'ar' ? 'تم إنشاء الدعوة وتحديد الصلاحيات بنجاح!' : 'Invitation Created with Permissions!'}
                  </p>
                  <p className="text-xs text-success-700 dark:text-success-300 mt-1 leading-relaxed">
                    {lang === 'ar'
                      ? 'تم تجهيز رابط آمن وتفاصيل الصلاحيات للعضو المدعو لتعيين كلمة المرور وتفعيل حسابه.'
                      : 'A secure setup link and permissions breakdown have been generated for the member.'}
                  </p>
                </div>
              </div>
            )}

            {/* Email delivery status banner */}
            {emailStatus === 'sending' && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 text-xs text-primary-700 dark:text-primary-300">
                <Send size={14} className="animate-pulse shrink-0" />
                <span>{lang === 'ar' ? 'جارٍ إرسال البريد الإلكتروني بالصلاحيات عبر الخادم...' : 'Sending email with permissions via server...'}</span>
              </div>
            )}

            {emailStatus === 'sent' && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                <Check size={14} className="shrink-0 text-emerald-600" />
                <span>{lang === 'ar' ? 'تم إرسال البريد الإلكتروني مع جدول الصلاحيات بنجاح!' : 'Email with permissions delivered successfully!'}</span>
              </div>
            )}

            {emailStatus === 'failed' && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={15} className="shrink-0 text-amber-600" />
                  <span>{lang === 'ar' ? 'تنبيه تسليم البريد التلقائي' : 'Automated Delivery Notice'}</span>
                </div>
                <p className="leading-relaxed text-secondary-700 dark:text-secondary-300">
                  {emailNotice}
                </p>
                <p className="font-semibold text-primary-700 dark:text-primary-300 text-[11px]">
                  {lang === 'ar'
                    ? '💡 لا تقلق! يمكنك إرسال الدعوة وجدول الصلاحيات للعضو فوراً بنقرة واحدة عبر أزرار الإرسال المباشرة أدناه:'
                    : '💡 You can send the invitation and permissions directly in 1-click below:'}
                </p>
              </div>
            )}

            {/* Permissions Summary Card */}
            <div className="p-3.5 rounded-xl bg-secondary-50 dark:bg-secondary-800/60 border border-secondary-200 dark:border-secondary-700 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-secondary-800 dark:text-secondary-200 flex items-center gap-1.5">
                  <Shield size={14} className="text-primary-500" />
                  {lang === 'ar' ? 'الصلاحيات المضمنة في الدعوة:' : 'Permissions included in invitation:'}
                </span>
                <span className="text-[11px] font-semibold text-primary-600 dark:text-primary-400">
                  {ROLE_META[inviteResult.role || inviteRole]?.titleAr}
                </span>
              </div>
              <pre className="text-[11px] font-sans whitespace-pre-wrap text-secondary-600 dark:text-secondary-300 leading-relaxed bg-white dark:bg-secondary-900 p-2.5 rounded-lg border border-secondary-200 dark:border-secondary-700">
                {formatPermissionsSummary(inviteResult.permissions || invitePermissions, inviteResult.role || inviteRole, lang)}
              </pre>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-secondary-500 mb-1 block">
                  {lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </label>
                <div className="flex items-center gap-2">
                  <Input value={inviteEmail} readOnly className="flex-1 bg-secondary-50 dark:bg-secondary-800" />
                  <button
                    onClick={() => copyToClipboard(inviteEmail)}
                    className="p-2.5 rounded-xl bg-secondary-100 dark:bg-secondary-700 text-secondary-600 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors"
                    title={lang === 'ar' ? 'نسخ البريد' : 'Copy email'}
                  >
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              {!inviteResult.already_registered && inviteResult.token && (
                <div>
                  <label className="text-xs font-semibold text-secondary-500 mb-1 block">
                    {lang === 'ar' ? 'رابط التفعيل وتعيين كلمة المرور (صالح 72 ساعة)' : 'Setup & Password Link (Valid 72h)'}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input value={getSetupUrl(inviteResult.token)} readOnly className="flex-1 bg-secondary-50 dark:bg-secondary-800 text-xs font-mono" />
                    <button
                      onClick={() => copyToClipboard(getSetupUrl(inviteResult.token!))}
                      className="p-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors shrink-0"
                      title={lang === 'ar' ? 'نسخ الرابط' : 'Copy link'}
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              )}

              {inviteResult.already_registered && (
                <div>
                  <label className="text-xs font-semibold text-secondary-500 mb-1 block">
                    {lang === 'ar' ? 'رابط تسجيل الدخول' : 'Login Link'}
                  </label>
                  <div className="flex items-center gap-2">
                    <Input value={getLoginUrl()} readOnly className="flex-1 bg-secondary-50 dark:bg-secondary-800 text-xs font-mono" />
                    <button
                      onClick={() => copyToClipboard(getLoginUrl())}
                      className="p-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors shrink-0"
                      title={lang === 'ar' ? 'نسخ الرابط' : 'Copy link'}
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* 1-Click Direct Delivery Buttons with Permissions */}
              <div className="pt-2">
                <p className="text-xs font-bold text-secondary-800 dark:text-secondary-100 mb-2">
                  {lang === 'ar' ? 'إرسال تفاصيل الدعوة والصلاحيات مباشرة بنقرة واحدة:' : 'Send invite & permissions directly in 1 click:'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const subject = getInviteEmailSubject(inviteRole);
                      const body = inviteResult.already_registered
                        ? getExistingUserEmailBody(inviteEmail, inviteRole, invitePermissions)
                        : getInviteEmailBody(inviteEmail, inviteRole, inviteResult.token ?? '', invitePermissions);
                      openInGmail(inviteEmail, subject, body);
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs shadow-sm transition-transform active:scale-95"
                  >
                    <GmailIcon size={15} />
                    <span>{lang === 'ar' ? 'إرسال عبر Gmail' : 'Send via Gmail'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const subject = getInviteEmailSubject(inviteRole);
                      const body = inviteResult.already_registered
                        ? getExistingUserEmailBody(inviteEmail, inviteRole, invitePermissions)
                        : getInviteEmailBody(inviteEmail, inviteRole, inviteResult.token ?? '', invitePermissions);
                      openInMailto(inviteEmail, subject, body);
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs shadow-sm transition-transform active:scale-95"
                  >
                    <Mail size={15} />
                    <span>{lang === 'ar' ? 'تطبيق البريد' : 'Email App'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const body = inviteResult.already_registered
                        ? getExistingUserEmailBody(inviteEmail, inviteRole, invitePermissions)
                        : getInviteEmailBody(inviteEmail, inviteRole, inviteResult.token ?? '', invitePermissions);
                      shareViaWhatsApp(body);
                    }}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs shadow-sm transition-transform active:scale-95"
                  >
                    <WhatsAppMiniIcon size={15} />
                    <span>{lang === 'ar' ? 'عبر واتساب' : 'Via WhatsApp'}</span>
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => {
                    const body = inviteResult.already_registered
                      ? getExistingUserEmailBody(inviteEmail, inviteRole, invitePermissions)
                      : getInviteEmailBody(inviteEmail, inviteRole, inviteResult.token ?? '', invitePermissions);
                    copyToClipboard(body);
                  }}
                  className="w-full text-center py-2 text-xs font-semibold text-secondary-600 dark:text-secondary-400 hover:text-primary-600 dark:hover:text-primary-400 border border-dashed border-secondary-300 dark:border-secondary-700 rounded-xl hover:border-primary-400 transition-colors"
                >
                  {lang === 'ar' ? '📋 نسخ نص رسالة الصلاحيات والدعوة بالكامل' : '📋 Copy full permissions message'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-secondary-100 dark:border-secondary-800">
              <Button onClick={closeInviteModal}>{t('common.done')}</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={invite} className="space-y-4">
            <Input
              label={t('team.emailAddress')}
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="member@example.com"
              required
              icon={<Mail size={16} />}
            />

            <div>
              <Select
                label={t('team.role')}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as TeamRole)}
              >
                <option value="employee">{lang === 'ar' ? 'موظف / عضو فريق' : 'Employee'}</option>
                <option value="accountant">{lang === 'ar' ? 'محاسب مالي' : 'Accountant'}</option>
                <option value="agent">{lang === 'ar' ? 'مندوب مبيعات' : 'Sales Agent'}</option>
                <option value="admin">{lang === 'ar' ? 'مدير النظام' : 'System Admin'}</option>
                <option value="owner">{t('team.ownerOption')}</option>
                <option value="custom">{lang === 'ar' ? 'صلاحيات مخصصة' : 'Custom Role'}</option>
              </Select>
              <p className="text-[11px] text-secondary-400 mt-1">
                {ROLE_META[inviteRole]?.descAr}
              </p>
            </div>

            {/* Permissions Matrix */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-secondary-700 dark:text-secondary-200">
                  {lang === 'ar' ? 'تخصيص الصلاحيات الممنوحة للعضو:' : 'Permissions granted to member:'}
                </label>
                <button
                  type="button"
                  onClick={() => setInvitePermissions(getDefaultPermissions(inviteRole))}
                  className="text-[11px] text-primary-600 hover:underline font-semibold"
                >
                  {lang === 'ar' ? 'استعادة الافتراضي' : 'Reset Defaults'}
                </button>
              </div>

              <div className="overflow-x-auto border border-secondary-200 dark:border-secondary-700 rounded-xl">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-secondary-50 dark:bg-secondary-800/80 text-secondary-600 dark:text-secondary-300 border-b border-secondary-200 dark:border-secondary-700">
                      <th className="text-start py-2.5 px-3 font-bold">{lang === 'ar' ? 'الوحدة / القسم' : 'Module'}</th>
                      <th className="text-center py-2.5 px-2 font-bold w-14">{ACTION_META.view.labelAr}</th>
                      <th className="text-center py-2.5 px-2 font-bold w-14">{ACTION_META.create.labelAr}</th>
                      <th className="text-center py-2.5 px-2 font-bold w-14">{ACTION_META.edit.labelAr}</th>
                      <th className="text-center py-2.5 px-2 font-bold w-14">{ACTION_META.delete.labelAr}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                    {PERMISSION_MODULES_META.map((mod) => {
                      const p = invitePermissions[mod.key] ?? {};
                      return (
                        <tr key={mod.key} className="hover:bg-secondary-50/50 dark:hover:bg-secondary-800/40 transition-colors">
                          <td className="py-2 px-3 font-medium text-secondary-800 dark:text-secondary-200">
                            {lang === 'ar' ? mod.labelAr : mod.labelEn}
                          </td>
                          {(['view', 'create', 'edit', 'delete'] as const).map((act) => (
                            <td key={act} className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={!!p[act]}
                                onChange={(e) => {
                                  setInvitePermissions((prev) => ({
                                    ...prev,
                                    [mod.key]: { ...(prev[mod.key] ?? {}), [act]: e.target.checked },
                                  }));
                                }}
                                className="rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-secondary-400 leading-relaxed">
              {lang === 'ar'
                ? 'ℹ️ سيتم إرسال بريد إلكتروني يحتوي على تفاصيل هذه الصلاحيات ورابط آمن لتفعيل الحساب وتعيين كلمة المرور.'
                : 'An invitation email will be sent containing these detailed permissions and an activation link.'}
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={closeInviteModal}>{t('common.cancel')}</Button>
              <Button type="submit" loading={saving}>{t('team.sendInvite')}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Permissions Modal for editing existing member */}
      <Modal open={permissionsOpen} onClose={() => setPermissionsOpen(false)} title={t('team.editPermissions')} size="lg">
        <div className="space-y-4">
          <div className="p-3 bg-secondary-50 dark:bg-secondary-800 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-secondary-800 dark:text-secondary-100">
                {editingMember?.full_name ?? editingMember?.email}
              </p>
              <p className="text-xs text-secondary-500 font-mono">{editingMember?.email}</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
              {editingMember ? ROLE_META[editingMember.role]?.titleAr : ''}
            </span>
          </div>

          <div className="overflow-x-auto border border-secondary-200 dark:border-secondary-700 rounded-xl">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-secondary-50 dark:bg-secondary-800/80 text-secondary-600 dark:text-secondary-300 border-b border-secondary-200 dark:border-secondary-700">
                  <th className="text-start py-2.5 px-3 font-bold">{lang === 'ar' ? 'الوحدة / القسم' : 'Module'}</th>
                  <th className="text-center py-2.5 px-2 font-bold w-14">{ACTION_META.view.labelAr}</th>
                  <th className="text-center py-2.5 px-2 font-bold w-14">{ACTION_META.create.labelAr}</th>
                  <th className="text-center py-2.5 px-2 font-bold w-14">{ACTION_META.edit.labelAr}</th>
                  <th className="text-center py-2.5 px-2 font-bold w-14">{ACTION_META.delete.labelAr}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                {PERMISSION_MODULES_META.map((mod) => {
                  const p = editingPermissions[mod.key] ?? {};
                  return (
                    <tr key={mod.key} className="hover:bg-secondary-50/50 dark:hover:bg-secondary-800/40 transition-colors">
                      <td className="py-2 px-3 font-medium text-secondary-800 dark:text-secondary-200">
                        {lang === 'ar' ? mod.labelAr : mod.labelEn}
                      </td>
                      {(['view', 'create', 'edit', 'delete'] as const).map((act) => (
                        <td key={act} className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={!!p[act]}
                            onChange={(e) => {
                              setEditingPermissions((prev) => ({
                                ...prev,
                                [mod.key]: { ...(prev[mod.key] ?? {}), [act]: e.target.checked },
                              }));
                            }}
                            className="rounded text-primary-600 focus:ring-primary-500 cursor-pointer"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setPermissionsOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={savePermissions}>{t('common.save')}</Button>
          </div>
        </div>
      </Modal>

      {/* Share / Send Permissions Modal for Active Member */}
      <Modal
        open={!!shareMember}
        onClose={() => setShareMember(null)}
        title={lang === 'ar' ? 'مشاركة وإرسال تفاصيل الصلاحيات' : 'Share Permissions Details'}
        size="md"
      >
        {shareMember && (
          <div className="space-y-4">
            <div className="p-3 bg-secondary-50 dark:bg-secondary-800 rounded-xl">
              <p className="text-sm font-bold text-secondary-800 dark:text-secondary-100">
                {shareMember.full_name || shareMember.email}
              </p>
              <p className="text-xs text-secondary-500 font-mono mt-0.5">{shareMember.email}</p>
              <div className="mt-2 text-xs font-semibold text-primary-600">
                {ROLE_META[shareMember.role]?.titleAr}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-secondary-50 dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-700">
              <label className="text-xs font-bold text-secondary-700 dark:text-secondary-300 block mb-1">
                {lang === 'ar' ? 'نص الصلاحيات الممنوحة:' : 'Granted Permissions Summary:'}
              </label>
              <pre className="text-xs font-sans whitespace-pre-wrap text-secondary-600 dark:text-secondary-300 leading-relaxed max-h-48 overflow-y-auto">
                {formatPermissionsSummary(shareMember.permissions, shareMember.role, lang)}
              </pre>
            </div>

            <div className="space-y-2 pt-1">
              <p className="text-xs font-bold text-secondary-800 dark:text-secondary-200">
                {lang === 'ar' ? 'إرسال الصلاحيات إلى العضو عبر:' : 'Send permissions via:'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (shareMember.email) {
                      const subject = getInviteEmailSubject(shareMember.role);
                      const body = getExistingUserEmailBody(shareMember.email, shareMember.role, shareMember.permissions);
                      openInGmail(shareMember.email, subject, body);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs shadow-sm"
                >
                  <GmailIcon size={15} />
                  <span>{lang === 'ar' ? 'عبر Gmail' : 'Via Gmail'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (shareMember.email) {
                      const subject = getInviteEmailSubject(shareMember.role);
                      const body = getExistingUserEmailBody(shareMember.email, shareMember.role, shareMember.permissions);
                      openInMailto(shareMember.email, subject, body);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs shadow-sm"
                >
                  <Mail size={15} />
                  <span>{lang === 'ar' ? 'تطبيق البريد' : 'Email App'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const body = getExistingUserEmailBody(shareMember.email || '', shareMember.role, shareMember.permissions);
                    shareViaWhatsApp(body);
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs shadow-sm"
                >
                  <WhatsAppMiniIcon size={15} />
                  <span>{lang === 'ar' ? 'عبر واتساب' : 'Via WhatsApp'}</span>
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  const body = getExistingUserEmailBody(shareMember.email || '', shareMember.role, shareMember.permissions);
                  copyToClipboard(body);
                }}
              >
                📋 {lang === 'ar' ? 'نسخ نص الصلاحيات للحافظة' : 'Copy Permissions Text'}
              </Button>
            </div>

            <div className="flex justify-end pt-2 border-t border-secondary-100 dark:border-secondary-800">
              <Button onClick={() => setShareMember(null)}>{t('common.done')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Member Password Reset Modal */}
      <Modal
        open={!!resetMember}
        onClose={() => setResetMember(null)}
        title={lang === 'ar' ? 'استعادة وإعادة تعيين كلمة مرور العضو' : 'Reset Member Password'}
        size="md"
      >
        {resetMember && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-900 dark:text-amber-200">
              <p className="font-bold flex items-center gap-1.5 mb-1">
                <KeyRound size={14} className="text-amber-600" />
                {lang === 'ar' ? 'تم طلب إعادة تعيين كلمة المرور' : 'Password Reset Requested'}
              </p>
              <p className="leading-relaxed">
                {lang === 'ar'
                  ? `تم إرسال بريد تلقائي إلى (${resetMember.email}). كما يمكنك مشاركة رابط استعادة كلمة المرور مباشرة مع العضو عبر الخيارات أدناه لضمان وصوله الفوري دون انتظار.`
                  : `An automated email was sent to ${resetMember.email}. You can also share the recovery link directly via WhatsApp or email.`}
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-secondary-500 mb-1 block">
                {lang === 'ar' ? 'رابط إعادة التعيين المباشر:' : 'Direct Reset Link:'}
              </label>
              <div className="flex items-center gap-2">
                <Input value={resetUrl || getDefaultResetUrl()} readOnly className="flex-1 bg-secondary-50 dark:bg-secondary-800 text-xs font-mono" />
                <button
                  onClick={() => copyToClipboard(resetUrl || getDefaultResetUrl())}
                  className="p-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 hover:bg-primary-100 transition-colors shrink-0"
                  title={lang === 'ar' ? 'نسخ الرابط' : 'Copy link'}
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="pt-1">
              <p className="text-xs font-bold text-secondary-800 dark:text-secondary-100 mb-2">
                {lang === 'ar' ? 'إرسال الرابط مباشرة للعضو:' : 'Send link directly to member:'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => shareViaWhatsApp(getResetMessageBody(resetMember))}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs shadow-sm"
                >
                  <WhatsAppMiniIcon size={15} />
                  <span>{lang === 'ar' ? 'إرسال عبر واتساب' : 'Via WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (resetMember.email) {
                      openInGmail(
                        resetMember.email,
                        lang === 'ar' ? 'رابط استعادة كلمة المرور — دفترك' : 'Password Reset Link — Daftrk',
                        getResetMessageBody(resetMember)
                      );
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs shadow-sm"
                >
                  <GmailIcon size={15} />
                  <span>{lang === 'ar' ? 'إرسال عبر Gmail' : 'Via Gmail'}</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-secondary-100 dark:border-secondary-800">
              <Button onClick={() => setResetMember(null)}>{t('common.done')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Member Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('team.removeTitle')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={removeMember}>{t('team.remove')}</Button>
          </>
        }
      >
        <p className="text-sm text-secondary-600 dark:text-secondary-300">
          {t('team.removeConfirm')} <span className="font-semibold">{deleteTarget?.full_name ?? deleteTarget?.email}</span>?
        </p>
      </Modal>
    </div>
  );
}
