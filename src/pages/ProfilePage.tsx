import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import {
  UserCircle, ShieldCheck, Bell, Trash2, Upload, X, Check,
  Loader2, Eye, EyeOff, KeyRound, MonitorSmartphone, Globe,
  Sun, Moon, AlertTriangle, LogOut, Smartphone,
} from 'lucide-react';
import { Modal } from '../components/ui/Modal';
import QRCode from 'qrcode';

type Tab = 'personal' | 'security' | 'notifications' | 'danger';
type SaveStatus = 'idle' | 'saving' | 'saved';

interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_path: string | null;
  notify_invoice_paid: boolean;
  notify_invoice_overdue: boolean;
  notify_new_customer: boolean;
  notify_low_stock: boolean;
  notify_marketing: boolean;
  mfa_enabled: boolean;
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-6 pb-4 border-b border-secondary-100 dark:border-secondary-800">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-bold text-secondary-700 dark:text-secondary-200">{title}</h2>
          {subtitle && <p className="text-xs text-secondary-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ status, t }: { status: SaveStatus; t: (k: string) => string }) {
  if (status === 'idle') return null;
  return (
    <span className={`flex items-center gap-1.5 text-xs font-semibold transition-all ${
      status === 'saving' ? 'text-secondary-400' : 'text-success-600 dark:text-success-400'
    }`}>
      {status === 'saving'
        ? <><Loader2 size={12} className="animate-spin" />{t('profile.savingStatus')}</>
        : <><Check size={12} />{t('profile.savedStatus')}</>}
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-primary-600' : 'bg-secondary-200 dark:bg-secondary-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function ToggleButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
        active
          ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 ring-2 ring-primary-500/20'
          : 'border-secondary-200 dark:border-secondary-700 text-secondary-600 dark:text-secondary-400 hover:bg-secondary-50 dark:hover:bg-secondary-800'
      }`}
    >
      {children}
      {active && <Check size={13} className="ms-auto" />}
    </button>
  );
}

export function ProfilePage() {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, updatePassword, signOut } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('personal');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Profile state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification state
  const [notifInvoicePaid, setNotifInvoicePaid] = useState(true);
  const [notifInvoiceOverdue, setNotifInvoiceOverdue] = useState(true);
  const [notifNewCustomer, setNotifNewCustomer] = useState(false);
  const [notifLowStock, setNotifLowStock] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  // 2FA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [show2faSetup, setShow2faSetup] = useState(false);
  const [show2faDisable, setShow2faDisable] = useState(false);
  const [mfaEnrollUri, setMfaEnrollUri] = useState('');
  const [mfaQrDataUrl, setMfaQrDataUrl] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaVerifyCode, setMfaVerifyCode] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState('');

  const initialized = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        const p = data as UserProfile;
        setFullName(p.full_name ?? user.user_metadata?.full_name ?? '');
        setPhone(p.phone ?? '');
        setAvatarPath(p.avatar_path);
        if (p.avatar_path) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(p.avatar_path);
          setAvatarPreview(urlData.publicUrl);
        }
        setNotifInvoicePaid(p.notify_invoice_paid);
        setNotifInvoiceOverdue(p.notify_invoice_overdue);
        setNotifNewCustomer(p.notify_new_customer);
        setNotifLowStock(p.notify_low_stock);
        setNotifMarketing(p.notify_marketing);
        setMfaEnabled(p.mfa_enabled ?? false);
      } else {
        setFullName(user.user_metadata?.full_name ?? '');
      }
      setTimeout(() => { initialized.current = true; }, 50);
    })();
  }, [user]);

  const doSave = useCallback(async (fields: Record<string, unknown>) => {
    if (!user) return;
    setSaveStatus('saving');
    const { error } = await supabase
      .from('user_profiles')
      .upsert({ id: user.id, ...fields }, { onConflict: 'id' });
    if (!error) {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } else {
      setSaveStatus('idle');
      toast(error.message, 'error');
    }
  }, [user, toast]);

  const scheduleAutoSave = useCallback((fields: Record<string, unknown>) => {
    if (!initialized.current) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    setSaveStatus('saving');
    debounceTimer.current = setTimeout(() => doSave(fields), 1000);
  }, [doSave]);

  // Auto-save profile fields
  useEffect(() => { scheduleAutoSave({ full_name: fullName.trim() || null }); }, [fullName]);
  useEffect(() => { scheduleAutoSave({ phone: phone.trim() || null }); }, [phone]);
  useEffect(() => { scheduleAutoSave({ notify_invoice_paid: notifInvoicePaid }); }, [notifInvoicePaid]);
  useEffect(() => { scheduleAutoSave({ notify_invoice_overdue: notifInvoiceOverdue }); }, [notifInvoiceOverdue]);
  useEffect(() => { scheduleAutoSave({ notify_new_customer: notifNewCustomer }); }, [notifNewCustomer]);
  useEffect(() => { scheduleAutoSave({ notify_low_stock: notifLowStock }); }, [notifLowStock]);
  useEffect(() => { scheduleAutoSave({ notify_marketing: notifMarketing }); }, [notifMarketing]);

  const handleAvatarFile = async (file: File) => {
    if (!user) return;
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) { 
      toast('يجب أن تكون الصورة PNG أو JPG أو GIF أو WebP', 'error'); 
      return; 
    }
    if (file.size > 2 * 1024 * 1024) { toast(t('auth.logoTooLarge'), 'error'); return; }
    setAvatarUploading(true);
    
    // Delete old avatar if exists
    if (avatarPath) {
      await supabase.storage.from('avatars').remove([avatarPath]);
    }
    
    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file);
    if (error) { 
      toast(error.message, 'error'); 
      setAvatarUploading(false); 
      return; 
    }
    
    await supabase.from('user_profiles').upsert({ id: user.id, avatar_path: path }, { onConflict: 'id' });
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarPath(path);
    setAvatarPreview(data.publicUrl);
    setAvatarUploading(false);
    toast(t('profile.savedStatus'));
  };

  const handleRemoveAvatar = async () => {
    if (!user || !avatarPath) return;
    await supabase.storage.from('avatars').remove([avatarPath]);
    await supabase.from('user_profiles').upsert({ id: user.id, avatar_path: null }, { onConflict: 'id' });
    setAvatarPath(null);
    setAvatarPreview(null);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (newPassword !== confirmPassword) { setPwError(t('profile.passwordMismatch')); return; }
    if (newPassword.length < 6) { setPwError(t('auth.passwordTooShort')); return; }
    setPwSaving(true);
    const { error } = await updatePassword(newPassword);
    setPwSaving(false);
    if (error) { setPwError(error); return; }
    toast(t('profile.passwordUpdated'));
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSignOutAll = async () => {
    await supabase.auth.signOut({ scope: 'global' });
    toast(t('profile.signedOutAll'));
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    await signOut();
  };

  const start2faEnrollment = async () => {
    setMfaError('');
    setMfaVerifyCode('');
    setMfaLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setMfaFactorId(data.id);
      setMfaEnrollUri(data.totp.uri);
      setMfaSecret(data.totp.secret);
      const qrUrl = await QRCode.toDataURL(data.totp.uri, { width: 200, margin: 1, errorCorrectionLevel: 'M' });
      setMfaQrDataUrl(qrUrl);
      setShow2faSetup(true);
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : 'Failed to start 2FA setup');
    } finally {
      setMfaLoading(false);
    }
  };

  const verifyAndEnable2fa = async () => {
    setMfaError('');
    if (mfaVerifyCode.length !== 6) { setMfaError(t('profile.2faEnabledFailed')); return; }
    setMfaLoading(true);
    try {
      const { error: challengeError } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId });
      if (challengeError) throw challengeError;
      const { data: challengeData, error: challengeDataError } = await supabase.auth.mfa.createChallengeAndVerify({ factorId: mfaFactorId });
      if (challengeDataError) throw challengeDataError;
      const verifyCode = mfaVerifyCode;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challengeData.id, code: verifyCode });
      if (verifyError) throw verifyError;
      await supabase.from('user_profiles').upsert({ id: user!.id, mfa_enabled: true }, { onConflict: 'id' });
      setMfaEnabled(true);
      setShow2faSetup(false);
      setMfaEnrollUri('');
      setMfaQrDataUrl('');
      setMfaSecret('');
      setMfaVerifyCode('');
      toast(t('profile.2faEnabledSuccess'));
    } catch (err) {
      setMfaError(t('profile.2faEnabledFailed'));
    } finally {
      setMfaLoading(false);
    }
  };

  const disable2fa = async () => {
    setMfaError('');
    if (mfaVerifyCode.length !== 6) { setMfaError(t('profile.2faDisableFailed')); return; }
    setMfaLoading(true);
    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError) throw factorsError;
      const totpFactor = factorsData.totp.find(f => f.status === 'verified');
      if (!totpFactor) throw new Error('No verified 2FA factor found');
      const { error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challengeError) throw challengeError;
      const { data: challengeData, error: challengeDataError } = await supabase.auth.mfa.createChallengeAndVerify({ factorId: totpFactor.id });
      if (challengeDataError) throw challengeDataError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: totpFactor.id, challengeId: challengeData.id, code: mfaVerifyCode });
      if (verifyError) throw verifyError;
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
      if (unenrollError) throw unenrollError;
      await supabase.from('user_profiles').upsert({ id: user!.id, mfa_enabled: false }, { onConflict: 'id' });
      setMfaEnabled(false);
      setShow2faDisable(false);
      setMfaVerifyCode('');
      toast(t('profile.2faDisableSuccess'));
    } catch (err) {
      setMfaError(t('profile.2faDisableFailed'));
    } finally {
      setMfaLoading(false);
    }
  };

  const initials = (fullName || user?.email || 'U').charAt(0).toUpperCase();

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'personal', label: t('profile.tabPersonal'), icon: <UserCircle size={15} /> },
    { id: 'security', label: t('profile.tabSecurity'), icon: <ShieldCheck size={15} /> },
    { id: 'notifications', label: t('profile.tabNotifications'), icon: <Bell size={15} /> },
    { id: 'danger', label: t('profile.tabDanger'), icon: <Trash2 size={15} /> },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100 tracking-tight">
          {t('profile.title')}
        </h1>
        <SaveIndicator status={saveStatus} t={t} />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-secondary-100 dark:bg-secondary-800 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white dark:bg-secondary-700 text-secondary-800 dark:text-secondary-100 shadow-sm'
                : 'text-secondary-500 dark:text-secondary-400 hover:text-secondary-700 dark:hover:text-secondary-200'
            } ${tab.id === 'danger' ? (activeTab === 'danger' ? 'text-danger-600 dark:text-danger-400' : 'hover:text-danger-500') : ''}`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Personal Tab ───────────────────────────────────── */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          {/* Avatar */}
          <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
            <SectionHeader icon={<UserCircle size={16} />} title={t('profile.avatarUpload')} />
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              <div
                onClick={() => !avatarPreview && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleAvatarFile(file);
                }}
                className={`relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-dashed transition-all overflow-hidden ${
                  dragOver
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 cursor-copy'
                    : avatarPreview
                    ? 'border-secondary-200 dark:border-secondary-700 cursor-default'
                    : 'border-secondary-300 dark:border-secondary-600 hover:border-primary-400 hover:bg-primary-50/50 cursor-pointer'
                }`}
              >
                {avatarUploading ? (
                  <Loader2 size={24} className="animate-spin text-primary-500" />
                ) : avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-secondary-400">
                    <span className="text-2xl font-bold">{initials}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">
                  {avatarPreview ? t('profile.changeAvatar') : t('profile.uploadAvatar')}
                </p>
                <p className="text-xs text-secondary-400">{t('profile.avatarHint')}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} loading={avatarUploading}>
                    <Upload size={14} />
                    {avatarPreview ? t('profile.changeAvatar') : t('profile.uploadAvatar')}
                  </Button>
                  {avatarPreview && (
                    <Button size="sm" variant="ghost" onClick={handleRemoveAvatar}>
                      <X size={14} />
                      {t('profile.removeAvatar')}
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); }}
                />
              </div>
            </div>
          </div>

          {/* Personal info */}
          <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
            <SectionHeader icon={<UserCircle size={16} />} title={t('profile.personalInfo')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={t('profile.fullName')}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
              />
              <Input
                label={t('profile.phone')}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                hint={t('common.optional')}
                placeholder="+1 555 0100"
              />
              <div className="sm:col-span-2">
                <label className="label">{t('profile.email')}</label>
                <div className="input flex items-center gap-2 bg-secondary-50 dark:bg-secondary-800/50 cursor-not-allowed">
                  <span className="text-secondary-500 text-sm flex-1">{user?.email}</span>
                  <span className="text-xs text-secondary-400 shrink-0">{t('profile.emailHint')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Language & Theme */}
          <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
            <SectionHeader icon={<Globe size={16} />} title={t('profile.languageTheme')} />
            <div className="space-y-5">
              <div>
                <p className="label mb-2">{t('settings.language')}</p>
                <div className="flex flex-wrap gap-3">
                  <ToggleButton active={lang === 'en'} onClick={() => setLang('en')}>
                    <Globe size={15} />
                    {t('settings.english')}
                  </ToggleButton>
                  <ToggleButton active={lang === 'ar'} onClick={() => setLang('ar')}>
                    <Globe size={15} />
                    {t('settings.arabic')}
                  </ToggleButton>
                </div>
              </div>
              <div>
                <p className="label mb-2">{t('settings.theme')}</p>
                <div className="flex flex-wrap gap-3">
                  <ToggleButton active={theme === 'light'} onClick={() => setTheme('light')}>
                    <Sun size={15} />
                    {t('settings.light')}
                  </ToggleButton>
                  <ToggleButton active={theme === 'dark'} onClick={() => setTheme('dark')}>
                    <Moon size={15} />
                    {t('settings.dark')}
                  </ToggleButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Security Tab ──────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* Change password */}
          <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
            <SectionHeader
              icon={<KeyRound size={16} />}
              title={t('profile.changePassword')}
            />
            <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
              <div className="relative">
                <Input
                  label={t('profile.newPassword')}
                  type={showNewPw ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute end-3 top-8 text-secondary-400 hover:text-secondary-600"
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div className="relative">
                <Input
                  label={t('profile.confirmPassword')}
                  type={showConfirmPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  error={pwError}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw(!showConfirmPw)}
                  className="absolute end-3 top-8 text-secondary-400 hover:text-secondary-600"
                >
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength */}
              {newPassword && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((i) => {
                      const strength = Math.min(Math.floor(newPassword.length / 3), 4);
                      return (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i <= strength
                              ? strength <= 1 ? 'bg-danger-500' : strength <= 2 ? 'bg-warning-500' : strength <= 3 ? 'bg-accent-500' : 'bg-success-500'
                              : 'bg-secondary-200 dark:bg-secondary-700'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
              <Button type="submit" loading={pwSaving}>
                {t('profile.updatePassword')}
              </Button>
            </form>
          </div>

          {/* 2FA */}
          <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
            <SectionHeader
              icon={<ShieldCheck size={16} />}
              title={t('profile.twoFactor')}
              subtitle={t('profile.twoFactorDesc')}
            />
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-secondary-50 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                  mfaEnabled
                    ? 'bg-success-50 dark:bg-success-900/20'
                    : 'bg-secondary-200 dark:bg-secondary-700'
                }`}>
                  <ShieldCheck size={20} className={mfaEnabled ? 'text-success-600' : 'text-secondary-500'} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">
                    {mfaEnabled ? t('profile.twoFactorEnabled') : t('profile.twoFactorDisabled')}
                  </p>
                  <p className="text-xs text-secondary-400">TOTP authenticator app</p>
                </div>
              </div>
              {mfaEnabled ? (
                <Button size="sm" variant="outline" onClick={() => { setMfaVerifyCode(''); setMfaError(''); setShow2faDisable(true); }}>
                  {t('profile.disable2FA')}
                </Button>
              ) : (
                <Button size="sm" variant="outline" loading={mfaLoading} onClick={start2faEnrollment}>
                  {t('profile.enable2FA')}
                </Button>
              )}
            </div>
          </div>

          {/* 2FA Setup Modal */}
          <Modal
            open={show2faSetup}
            onClose={() => setShow2faSetup(false)}
            title={t('profile.2faSetupTitle')}
            size="md"
          >
            <div className="space-y-5">
              <div>
                <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-3">{t('profile.2faSetupStep1')}</p>
                <div className="flex justify-center">
                  {mfaQrDataUrl && (
                    <img src={mfaQrDataUrl} alt="2FA QR Code" className="rounded-lg border border-secondary-200 dark:border-secondary-700" />
                  )}
                </div>
              </div>
              {mfaSecret && (
                <div>
                  <p className="text-xs text-secondary-500 mb-1">{t('profile.2faOrManual')}</p>
                  <code className="block text-xs font-mono bg-secondary-100 dark:bg-secondary-800 rounded-lg p-3 break-all text-secondary-700 dark:text-secondary-300">
                    {mfaSecret}
                  </code>
                </div>
              )}
              <div>
                <p className="text-sm text-secondary-600 dark:text-secondary-400 mb-2">{t('profile.2faSetupStep2')}</p>
                <Input
                  label={t('profile.2faVerifyCode')}
                  value={mfaVerifyCode}
                  onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('profile.2faVerifyPlaceholder')}
                  className="font-mono text-center text-lg tracking-widest"
                  maxLength={6}
                />
              </div>
              {mfaError && (
                <p className="text-sm text-danger-600 dark:text-danger-400">{mfaError}</p>
              )}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShow2faSetup(false)}>{t('common.cancel')}</Button>
                <Button onClick={verifyAndEnable2fa} loading={mfaLoading} disabled={mfaVerifyCode.length !== 6}>
                  {t('profile.2faVerify')}
                </Button>
              </div>
            </div>
          </Modal>

          {/* 2FA Disable Modal */}
          <Modal
            open={show2faDisable}
            onClose={() => setShow2faDisable(false)}
            title={t('profile.2faDisableTitle')}
            size="sm"
          >
            <div className="space-y-4">
              <p className="text-sm text-secondary-600 dark:text-secondary-400">{t('profile.2faDisableConfirm')}</p>
              <Input
                label={t('profile.2faVerifyCode')}
                value={mfaVerifyCode}
                onChange={(e) => setMfaVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder={t('profile.2faVerifyPlaceholder')}
                className="font-mono text-center text-lg tracking-widest"
                maxLength={6}
              />
              {mfaError && (
                <p className="text-sm text-danger-600 dark:text-danger-400">{mfaError}</p>
              )}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShow2faDisable(false)}>{t('common.cancel')}</Button>
                <Button variant="danger" onClick={disable2fa} loading={mfaLoading} disabled={mfaVerifyCode.length !== 6}>
                  {t('profile.disable2FA')}
                </Button>
              </div>
            </div>
          </Modal>

          {/* Active sessions */}
          <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
            <SectionHeader
              icon={<MonitorSmartphone size={16} />}
              title={t('profile.activeSessions')}
            />
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-secondary-50 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 dark:bg-success-900/20">
                  <MonitorSmartphone size={20} className="text-success-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">
                    {lang === 'ar' ? 'الجهاز الحالي' : 'Current Device'}
                  </p>
                  <p className="text-xs text-secondary-400">{t('profile.activeSessionsDesc')}</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
                {lang === 'ar' ? 'نشط' : 'Active'}
              </span>
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={handleSignOutAll}>
                <LogOut size={14} />
                {t('profile.signOutAll')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notifications Tab ────────────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
          <SectionHeader
            icon={<Bell size={16} />}
            title={t('profile.notifications')}
            subtitle={t('profile.notifDesc')}
          />
          <div className="space-y-1">
            {([
              { key: 'notifInvoicePaid', value: notifInvoicePaid, set: setNotifInvoicePaid },
              { key: 'notifInvoiceOverdue', value: notifInvoiceOverdue, set: setNotifInvoiceOverdue },
              { key: 'notifNewCustomer', value: notifNewCustomer, set: setNotifNewCustomer },
              { key: 'notifLowStock', value: notifLowStock, set: setNotifLowStock },
              { key: 'notifMarketing', value: notifMarketing, set: setNotifMarketing },
            ] as const).map(({ key, value, set }) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 py-4 border-b last:border-0 border-secondary-100 dark:border-secondary-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">
                    {t(`profile.${key}`)}
                  </p>
                  <p className="text-xs text-secondary-400 mt-0.5">
                    {t(`profile.${key}Desc`)}
                  </p>
                </div>
                <Toggle checked={value} onChange={set} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Danger Tab ───────────────────────────────────── */}
      {activeTab === 'danger' && (
        <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-danger-200 dark:border-danger-900/50 p-5 sm:p-6">
          <SectionHeader
            icon={<AlertTriangle size={16} />}
            title={t('profile.dangerZone')}
          />

          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-danger-50 dark:bg-danger-900/10 border border-danger-100 dark:border-danger-900/30">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-danger-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-danger-700 dark:text-danger-400">{t('profile.deleteAccount')}</p>
                  <p className="text-xs text-danger-600/80 dark:text-danger-500/80 mt-1">{t('profile.deleteAccountWarning')}</p>
                </div>
              </div>
            </div>

            <p className="text-sm text-secondary-600 dark:text-secondary-400">{t('profile.deleteAccountDesc')}</p>

            <div className="space-y-3 max-w-sm">
              <Input
                label={t('profile.deleteAccountConfirm')}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="font-mono"
              />
              <Button
                variant="danger"
                onClick={handleDeleteAccount}
                loading={deleting}
                disabled={deleteConfirm !== 'DELETE'}
              >
                <Trash2 size={15} />
                {t('profile.deleteAccountBtn')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
