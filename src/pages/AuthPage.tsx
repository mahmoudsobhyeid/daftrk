import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { PhoneInput, ALL_COUNTRIES, buildE164, isValidE164, type CountryCode } from '../components/ui/PhoneInput';
import { BookOpen, Moon, Sun, Languages, ShieldCheck, Zap, Globe, ArrowLeft, MailCheck, KeyRound, Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { currencySymbols } from '../lib/i18n';

type AuthView = 'login' | 'signup' | 'forgot' | 'reset' | 'verify' | 'setup';

const businessTypes = ['Retail', 'Services', 'Freelance', 'Manufacturing', 'Food & Beverage', 'Consulting', 'Other'];
const countries = ['Egypt', 'Saudi Arabia', 'United Arab Emirates', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Jordan', 'United States', 'United Kingdom', 'Other'];
const timezones = ['Africa/Cairo', 'Asia/Riyadh', 'Asia/Dubai', 'Asia/Kuwait', 'Asia/Qatar', 'UTC', 'Europe/London', 'America/New_York'];
const currencies = Object.keys(currencySymbols);
const languages = [{ code: 'en', label: 'English' }, { code: 'ar', label: 'العربية' }];

export function AuthPage({ onBack, initialView = 'login' }: { onBack?: () => void; initialView?: AuthView }) {
  const { t, lang, setLang } = useLanguage();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const { signIn, signUp, resetPassword, updatePassword, resendVerification } = useAuth();
  const [view, setView] = useState<AuthView>(initialView);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupToken, setSetupToken] = useState<string | null>(null);

  // Signup phone state
  const [signupPhone, setSignupPhone] = useState('');
  const [signupCountry, setSignupCountry] = useState<CountryCode>(ALL_COUNTRIES[0]);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const switchView = (v: AuthView) => {
    setView(v);
    setError(null);
    setInfo(null);
    if (v !== 'forgot') setForgotSent(false);
  };

  // Cooldown countdown for resending reset password email
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('reset_token');
    const hash = window.location.hash;

    // Detect invitation setup link
    if (params.get('view') === 'setup' && token) {
      setSetupToken(token);
      setView('setup');
      return;
    }

    // Detect password reset link from email (query or Supabase hash)
    if (
      params.get('view') === 'reset' ||
      hash.includes('type=recovery') ||
      hash.includes('access_token') ||
      params.get('type') === 'recovery'
    ) {
      setView('reset');
      toast(
        lang === 'ar'
          ? 'تم التحقق من رابط الاستعادة. يرجى إدخال كلمة المرور الجديدة.'
          : 'Recovery link verified. Please enter your new password.',
        'success'
      );
    }

    // Listen to Supabase PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('reset');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [lang, toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    setLoading(true);
    const { error } = await signIn(email, password, remember);
    setLoading(false);
    if (error) setError(t('auth.invalidCredentials'));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!fullName.trim()) return setError(t('auth.nameRequired'));
    if (password.length < 6) return setError(t('auth.passwordTooShort'));
    if (password !== confirmPassword) return setError(t('auth.passwordMismatch'));

    const digits = signupPhone.replace(/\D/g, '');
    if (!digits) return setError(t('auth.phoneRequired'));
    const fullPhone = buildE164(signupCountry.dial, signupPhone);
    if (!isValidE164(fullPhone)) return setError(t('auth.phoneInvalid'));

    setLoading(true);
    const { error } = await signUp(email, password, fullName, fullPhone);
    setLoading(false);
    if (error) {
      const isRateLimit = /rate limit|too many|over the limit/i.test(error);
      const msg = isRateLimit
        ? (lang === 'ar' ? 'تم إرسال الكثير من رسائل التأكيد. يرجى الانتظار بضع دقائق قبل المحاولة مرة أخرى.' : 'Too many confirmation emails sent. Please wait a few minutes before trying again.')
        : error.includes('already') ? t('auth.userExists') : error;
      setError(msg);
      toast(msg, 'error');
    } else {
      setInfo(t('auth.verifySubtitle'));
      toast(t('auth.signupSuccess'), 'success');
      switchView('verify');
    }
  };

  const handleForgot = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email.trim()) {
      setError(lang === 'ar' ? 'يرجى إدخال البريد الإلكتروني أولاً' : 'Please enter your email first');
      return;
    }
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) {
      const isRateLimit = /rate limit|too many|over the limit/i.test(error);
      setError(
        isRateLimit
          ? (lang === 'ar' ? 'تم إرسال الكثير من طلبات إعادة التعيين. يرجى الانتظار بضع دقائق قبل المحاولة مرة أخرى.' : 'Too many reset requests. Please wait a few minutes before trying again.')
          : error
      );
    } else {
      setForgotSent(true);
      setResendCooldown(60);
      toast(
        lang === 'ar' ? 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني' : 'Password reset link sent to your email',
        'success'
      );
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (password.length < 6) return setError(t('auth.passwordTooShort'));
    if (password !== confirmPassword) return setError(t('auth.passwordMismatch'));
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      toast(
        lang === 'ar'
          ? 'تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.'
          : 'Password changed successfully! You can now log in.',
        'success'
      );
      setPassword('');
      setConfirmPassword('');
      switchView('login');
    }
  };

  const handleResend = async () => {
    setError(null); setInfo(null);
    setLoading(true);
    const { error } = await resendVerification(email);
    setLoading(false);
    if (error) {
      const isRateLimit = /rate limit|too many|over the limit/i.test(error);
      const msg = isRateLimit
        ? (lang === 'ar' ? 'تم إرسال الكثير من رسائل التأكيد. يرجى الانتظار بضع دقائق.' : 'Too many confirmation emails sent. Please wait a few minutes before trying again.')
        : error;
      setError(msg);
      toast(msg, 'error');
    } else {
      setInfo(t('auth.verifyResent'));
      toast(t('auth.confirmEmailSent'), 'success');
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null);
    if (password.length < 6) return setError(t('auth.passwordTooShort'));
    if (password !== confirmPassword) return setError(t('auth.passwordMismatch'));
    if (!setupToken) return setError(lang === 'ar' ? 'رمز الإعداد غير صالح' : 'Invalid setup token');
    setLoading(true);
    const { data, error } = await supabase.rpc('accept_team_invitation', {
      p_token: setupToken,
      p_new_password: password,
    });
    setLoading(false);
    if (error) {
      setError(lang === 'ar' ? 'فشل إعداد الحساب. قد يكون الرابط منتهياً.' : 'Setup failed. The link may have expired.');
    } else {
      const result = data as { ok: boolean; email: string };
      if (result?.ok) {
        setInfo(lang === 'ar' ? 'تم إعداد حسابك! يمكنك الآن تسجيل الدخول.' : 'Account set up! You can now log in.');
        setEmail(result.email);
        setPassword('');
        setConfirmPassword('');
        setSetupToken(null);
        toast(lang === 'ar' ? 'تم إعداد الحساب بنجاح' : 'Account set up successfully', 'success');
        switchView('login');
      }
    }
  };

  const features = [
    { icon: ShieldCheck, title: lang === 'ar' ? 'بيانات معزولة' : 'Isolated Data', desc: lang === 'ar' ? 'كل شركة آمنة ومحمية' : 'Every company is secure & protected' },
    { icon: Zap, title: lang === 'ar' ? 'فواتير فورية' : 'Instant Invoicing', desc: lang === 'ar' ? 'أنشئ وأرسل في ثوانٍ' : 'Create and send in seconds' },
    { icon: Globe, title: lang === 'ar' ? 'ثنائي اللغة' : 'Bilingual', desc: lang === 'ar' ? 'عربي وإنجليزي' : 'Arabic & English, RTL & LTR' },
  ];

  const titles: Record<AuthView, string> = {
    login: t('auth.loginTitle'),
    signup: t('auth.signupTitle'),
    forgot: t('auth.forgotTitle'),
    reset: t('auth.resetTitle'),
    verify: t('auth.verifyTitle'),
    setup: lang === 'ar' ? 'إعداد حسابك' : 'Set Up Your Account',
  };
  const subtitles: Record<AuthView, string> = {
    login: t('auth.loginSubtitle'),
    signup: t('auth.signupSubtitle'),
    forgot: t('auth.forgotSubtitle'),
    reset: t('auth.resetSubtitle'),
    verify: t('auth.verifySubtitle'),
    setup: lang === 'ar' ? 'اختر كلمة مرور جديدة للوصول إلى حسابك' : 'Choose a new password to access your account',
  };

  return (
    <div className="min-h-screen flex bg-secondary-50 dark:bg-secondary-950">
      {/* Top controls */}
      <div className="absolute top-4 inset-x-4 flex items-center justify-between z-10">
        {onBack ? (
          <button onClick={onBack} className="glass flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-secondary-600 dark:text-secondary-300 hover:scale-105 transition-transform">
            <ArrowLeft size={16} className="rtl:rotate-180" />
            {lang === 'ar' ? 'الرئيسية' : 'Home'}
          </button>
        ) : <div />}
        <div className="flex items-center gap-2">
          <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="glass flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-secondary-600 dark:text-secondary-300 hover:scale-105 transition-transform">
            <Languages size={16} />
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
          <button onClick={toggle} className="glass p-2 rounded-xl text-secondary-600 dark:text-secondary-300 hover:scale-105 transition-transform">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary-700 via-primary-800 to-secondary-900 text-white p-12 flex-col justify-between">
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
        <div className="absolute -top-24 -end-24 h-96 w-96 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -start-24 h-96 w-96 rounded-full bg-primary-400/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
              <BookOpen size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{t('app.name')}</h1>
              <p className="text-sm text-primary-200 font-medium">{t('app.tagline')}</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-8">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            {lang === 'ar' ? 'إدارة أعمالك ببساطة وأناقة' : 'Run your business with simplicity & elegance'}
          </h2>
          <p className="text-primary-200 text-lg leading-relaxed max-w-md">
            {lang === 'ar'
              ? 'العملاء، المنتجات، والفواتير الاحترافية — كل ما تحتاجه لإدارة نشاطك في مكان واحد.'
              : 'Customers, products, and professional invoices — everything you need to run your business in one place.'}
          </p>
          <div className="space-y-3 pt-2">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="flex items-center gap-3.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 backdrop-blur border border-white/15 shrink-0">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{f.title}</p>
                    <p className="text-xs text-primary-200">{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="relative text-sm text-primary-300/70 font-medium">© 2026 Daftrk — دفترك</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-primary">
              <BookOpen size={24} />
            </div>
            <h1 className="text-2xl font-bold text-secondary-800 dark:text-white tracking-tight">{t('app.name')}</h1>
          </div>

          <h2 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100 tracking-tight">{titles[view]}</h2>
          <p className="mt-1.5 text-sm text-secondary-500 dark:text-secondary-400">{subtitles[view]}</p>

          {/* LOGIN */}
          {view === 'login' && (
            <form onSubmit={handleLogin} className="mt-8 space-y-4">
              <Input label={t('auth.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              <Input label={t('auth.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-secondary-600 dark:text-secondary-300 cursor-pointer select-none">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500" />
                  {t('auth.rememberMe')}
                </label>
                <button type="button" onClick={() => switchView('forgot')} className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400">
                  {t('auth.forgotPassword')}
                </button>
              </div>
              {error && <ErrorBox text={error} />}
              {info && <InfoBox text={info} />}
              <Button type="submit" size="lg" className="w-full" loading={loading}>{t('auth.login')}</Button>
            </form>
          )}

          {/* SIGNUP */}
          {view === 'signup' && (
            <form onSubmit={handleSignup} className="mt-8 space-y-4">
              <Input label={t('auth.fullName')} type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={lang === 'ar' ? 'محمد أحمد' : 'John Doe'} required />
              <Input label={t('auth.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />

              {/* Phone with searchable global country selector */}
              <PhoneInput
                label={t('auth.phoneLabel')}
                value={signupPhone}
                onChange={(_full, localDigits, _country) => {
                  setSignupPhone(localDigits);
                  setPhoneTouched(true);
                }}
                onCountryChange={setSignupCountry}
                country={signupCountry}
                required
                error={phoneTouched && signupPhone && !isValidE164(buildE164(signupCountry.dial, signupPhone)) ? t('auth.phoneInvalid') : undefined}
              />

              <Input label={t('auth.password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              <Input label={t('auth.confirmPassword')} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
              {error && <ErrorBox text={error} />}
              {info && <InfoBox text={info} />}
              <Button type="submit" size="lg" className="w-full" loading={loading}>{t('auth.signup')}</Button>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {view === 'forgot' && (
            <div className="mt-8 space-y-5">
              {!forgotSent ? (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 text-xs text-primary-800 dark:text-primary-300 leading-relaxed">
                    {lang === 'ar'
                      ? 'أدخل عنوان بريدك الإلكتروني المسجل وسنرسل لك رابطاً آمناً لإعادة تعيين كلمة المرور الخاصة بك.'
                      : 'Enter your registered email address and we will send you a secure link to reset your password.'}
                  </div>
                  <Input
                    label={t('auth.email')}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                  {error && <ErrorBox text={error} />}
                  {info && <InfoBox text={info} />}
                  <Button type="submit" size="lg" className="w-full" loading={loading}>
                    {t('auth.forgotSubmit')}
                  </Button>
                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    className="w-full text-sm font-semibold text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 py-1"
                  >
                    {t('auth.forgotBack')}
                  </button>
                </form>
              ) : (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex items-center justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                      <MailCheck size={32} />
                    </div>
                  </div>

                  <div className="text-center space-y-1">
                    <h3 className="font-bold text-lg text-secondary-800 dark:text-secondary-100">
                      {lang === 'ar' ? 'تم إرسال رابط إعادة التعيين' : 'Password Reset Link Sent'}
                    </h3>
                    <p className="text-xs text-secondary-500 font-mono bg-secondary-100 dark:bg-secondary-800 py-1 px-3 rounded-lg inline-block">
                      {email}
                    </p>
                  </div>

                  {/* High visibility spam & delivery warning */}
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
                      <span className="text-base">⚠️</span>
                      <span>{lang === 'ar' ? 'هام جداً: تفقد مجلد الرسائل غير المرغوب فيها (Spam / Junk)' : 'Important: Check your Spam / Junk folder'}</span>
                    </div>
                    <p className="leading-relaxed text-secondary-700 dark:text-secondary-300">
                      {lang === 'ar'
                        ? 'إذا لم تجد الرسالة في صندوق الوارد خلال دقيقة، تفقد مجلد الرسائل غير المرغوب فيها (Spam / Junk) أو الترويجية (Promotions) حيث قد تقوم بعض خوادم البريد بتصنيفها تلقائياً هناك.'
                        : 'If you do not see the email in your primary inbox, please check your Spam, Junk, or Promotions folder.'}
                    </p>
                  </div>

                  {/* Gmail quick shortcut */}
                  <a
                    href="https://mail.google.com/mail/u/0/#search/Daftrk"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs transition-colors"
                  >
                    <span>{lang === 'ar' ? 'فتح Gmail والبحث عن الرسالة' : 'Open Gmail & Search for Reset Email'}</span>
                  </a>

                  {/* Resend button */}
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    className="w-full text-xs"
                    loading={loading}
                    disabled={resendCooldown > 0}
                    onClick={() => handleForgot()}
                  >
                    {resendCooldown > 0
                      ? (lang === 'ar' ? `إعادة الإرسال متاحة بعد (${resendCooldown}) ثانية` : `Resend available in ${resendCooldown}s`)
                      : (lang === 'ar' ? 'إعادة إرسال الرابط مرة أخرى' : 'Resend Reset Link')}
                  </Button>

                  {/* Team member hint */}
                  <div className="p-3 rounded-xl bg-secondary-100 dark:bg-secondary-800 text-[11px] text-secondary-600 dark:text-secondary-400 leading-relaxed">
                    💡 {lang === 'ar'
                      ? 'هل أنت عضو في فريق عمل شركة؟ إذا لم تتمكن من تلقي البريد، يمكن لمدير أو مالك شركتك مشاركة رابط استعادة كلمة المرور فوراً معك بنقرة واحدة عبر واتساب أو البريد من صفحة إدارة الفريق.'
                      : 'Team member? If you are having trouble receiving emails, your company manager can share a direct reset link via WhatsApp or email from the Team page.'}
                  </div>

                  <button
                    type="button"
                    onClick={() => switchView('login')}
                    className="w-full text-sm font-semibold text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 py-1"
                  >
                    {t('auth.forgotBack')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* RESET PASSWORD */}
          {view === 'reset' && (
            <form onSubmit={handleReset} className="mt-8 space-y-4">
              <div className="p-3.5 rounded-xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 text-xs text-primary-800 dark:text-primary-300 leading-relaxed">
                {lang === 'ar'
                  ? 'أدخل كلمة المرور الجديدة لتأمين حسابك والتمكن من تسجيل الدخول.'
                  : 'Enter your new password to secure your account and log in.'}
              </div>
              <Input
                label={t('auth.newPassword')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <Input
                label={t('auth.confirmPassword')}
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              {error && <ErrorBox text={error} />}
              {info && <InfoBox text={info} />}
              <Button type="submit" size="lg" className="w-full" loading={loading}>
                {lang === 'ar' ? 'تعيين كلمة المرور والدخول' : 'Save New Password & Log In'}
              </Button>
              <button
                type="button"
                onClick={() => switchView('login')}
                className="w-full text-sm font-semibold text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 py-1"
              >
                {t('auth.forgotBack')}
              </button>
            </form>
          )}

          {/* VERIFY */}
          {view === 'verify' && (
            <div className="mt-8 space-y-4">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                  <MailCheck size={30} />
                </div>
              </div>
              {error && <ErrorBox text={error} />}
              {info && <InfoBox text={info} />}
              <Button onClick={handleResend} variant="outline" size="lg" className="w-full" loading={loading}>
                <KeyRound size={16} />
                {t('auth.verifyResend')}
              </Button>
              <Button onClick={() => switchView('login')} size="lg" className="w-full">{t('auth.verifyContinue')}</Button>
            </div>
          )}

          {/* SETUP (invitation acceptance) */}
          {view === 'setup' && (
            <form onSubmit={handleSetup} className="mt-8 space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                <ShieldCheck size={20} className="text-primary-500 shrink-0" />
                <p className="text-sm text-primary-700 dark:text-primary-300">
                  {lang === 'ar' ? 'تمت دعوتك للانضمام إلى فريق. اضبط كلمة المرور للمتابعة.' : 'You\'ve been invited to join a team. Set your password to continue.'}
                </p>
              </div>
              <Input label={t('auth.newPassword')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
              <Input label={t('auth.confirmPassword')} type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" required />
              {error && <ErrorBox text={error} />}
              {info && <InfoBox text={info} />}
              <Button type="submit" size="lg" className="w-full" loading={loading}>
                {lang === 'ar' ? 'إعداد الحساب' : 'Set Up Account'}
              </Button>
              <button type="button" onClick={() => switchView('login')} className="w-full text-sm font-semibold text-secondary-500 hover:text-secondary-700 dark:text-secondary-400">
                {lang === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to login'}
              </button>
            </form>
          )}

          {/* Switch login/signup */}
          {(view === 'login' || view === 'signup') && (
            <p className="mt-6 text-center text-sm text-secondary-500 dark:text-secondary-400">
              {view === 'login' ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
              <button onClick={() => switchView(view === 'login' ? 'signup' : 'login')} className="font-bold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors">
                {view === 'login' ? t('auth.signup') : t('auth.login')}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm font-medium text-danger-700 dark:bg-danger-900/30 dark:border-danger-800/50 dark:text-danger-300 animate-fade-in-fast">
      {text}
    </div>
  );
}

function InfoBox({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-success-50 border border-success-200 px-4 py-3 text-sm font-medium text-success-700 dark:bg-success-900/30 dark:border-success-800/50 dark:text-success-300 animate-fade-in-fast">
      {text}
    </div>
  );
}

// Company registration is a separate full screen shown after signup
export function CompanyRegistrationPage() {
  const { t, lang } = useLanguage();
  const { signOut } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [companyNameAr, setCompanyNameAr] = useState('');
  const [businessType, setBusinessType] = useState(businessTypes[0]);
  const [country, setCountry] = useState('Egypt');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(ALL_COUNTRIES.find((c) => c.code === 'EG') || ALL_COUNTRIES[0]);
  const [currency, setCurrency] = useState('EGP');
  const [companyLang, setCompanyLang] = useState('ar');
  const [timezone, setTimezone] = useState('Africa/Cairo');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) { 
      setError('يجب أن يكون الملف صورة PNG أو JPG أو SVG'); 
      return; 
    }
    if (file.size > 2 * 1024 * 1024) { setError(t('auth.logoTooLarge')); return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setError(null);
  };

  const removeLogo = () => {
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyName.trim()) return setError(t('auth.companyName'));
    const fullPhone = buildE164(selectedCountry.dial, phone);
    if (!isValidE164(fullPhone)) return setError(t('auth.phoneInvalid'));
    setLoading(true);
    const { data: companyId, error: companyError } = await supabase.rpc('create_company', {
      p_name: companyName.trim(),
      p_name_ar: companyNameAr.trim() || null,
      p_business_type: businessType,
      p_country: country,
      p_phone: fullPhone,
      p_currency: currency,
      p_language: companyLang,
      p_timezone: timezone,
    });

    if (companyError) { setError(companyError.message); setLoading(false); return; }

    if (logoFile && companyId) {
      const ext = logoFile.name.split('.').pop();
      const path = `${companyId}/logo.${ext}`;
      console.log('📤 Uploading company logo for new registration, path:', path);
      const { error: upErr } = await supabase.storage.from('company-logos').upload(path, logoFile);
      if (!upErr) {
        console.log('✅ Logo uploaded, updating company record');
        await supabase.from('companies').update({ logo_path: path }).eq('id', companyId);
      } else {
        console.error('❌ Logo upload error:', upErr);
      }
    }

    setLoading(false);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-secondary-50 dark:bg-secondary-950 relative overflow-hidden">
      <div className="absolute top-0 start-0 w-full h-64 bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-950/40 dark:to-secondary-950 -z-10" />
      <div className="absolute top-0 start-0 w-full h-64 opacity-[0.04]" style={{
        backgroundImage: 'linear-gradient(#2563eb 1px, transparent 1px), linear-gradient(90deg, #2563eb 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />

      <button
        type="button"
        onClick={signOut}
        className="absolute top-4 end-4 flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold text-secondary-500 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800 transition-colors"
      >
        <ArrowLeft size={15} className="rtl:rotate-180" />
        {lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
      </button>

      <div className="w-full max-w-lg animate-slide-up">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="relative mb-5">
            <div className="absolute inset-0 rounded-2xl bg-primary-500/30 blur-xl" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-primary">
              <BookOpen size={30} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100 tracking-tight">{t('auth.companyTitle')}</h1>
          <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">{t('auth.companySubtitle')}</p>
        </div>

        <div className="card p-6 sm:p-8 shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Logo upload */}
            <div className="flex flex-col items-center gap-3 pb-2">
              <div className="relative">
                <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-secondary-300 dark:border-secondary-700 flex items-center justify-center overflow-hidden bg-secondary-50 dark:bg-secondary-900">
                  {logoPreview ? (
                    <img src={logoPreview} alt="logo" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon size={28} className="text-secondary-400" />
                  )}
                </div>
                {logoPreview && (
                  <button type="button" onClick={removeLogo} className="absolute -top-2 -end-2 h-7 w-7 rounded-full bg-danger-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                    <X size={14} />
                  </button>
                )}
              </div>
              <label className="cursor-pointer">
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoChange} />
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50 text-primary-700 text-sm font-semibold hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300 transition-colors">
                  <Upload size={14} />
                  {logoPreview ? t('auth.changeLogo') : t('auth.uploadLogo')}
                </span>
              </label>
              <p className="text-xs text-secondary-400">{t('auth.companyLogoHint')}</p>
            </div>

            <Input label={`${t('auth.companyName')} *`} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={lang === 'ar' ? 'متجري' : 'My Shop'} required />
            <Input label={t('onboarding.companyNameAr')} value={companyNameAr} onChange={(e) => setCompanyNameAr(e.target.value)} placeholder="متجري" dir="rtl" hint={t('common.optional')} />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField label={t('auth.businessType')} value={businessType} onChange={setBusinessType} options={businessTypes} />
              <SelectField label={t('auth.country')} value={country} onChange={setCountry} options={countries} />
            </div>

            <PhoneInput
              label={`${t('auth.phoneLabel')} *`}
              value={phone}
              onChange={(_full, localDigits, _country) => {
                setPhone(localDigits);
              }}
              onCountryChange={setSelectedCountry}
              country={selectedCountry}
              required
              error={phone && !isValidE164(buildE164(selectedCountry.dial, phone)) ? t('auth.phoneInvalid') : undefined}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <SelectField label={t('auth.currency')} value={currency} onChange={setCurrency} options={currencies.map((c) => ({ value: c, label: `${c} — ${currencySymbols[c]}` }))} />
              <SelectField label={t('auth.language')} value={companyLang} onChange={setCompanyLang} options={languages.map((l) => ({ value: l.code, label: l.label }))} />
            </div>

            <SelectField label={t('auth.timezone')} value={timezone} onChange={setTimezone} options={timezones.map((tz) => ({ value: tz, label: tz }))} />

            {error && (
              <div className="rounded-xl bg-danger-50 border border-danger-200 px-4 py-3 text-sm font-medium text-danger-700 dark:bg-danger-900/30 dark:border-danger-800/50 dark:text-danger-300">
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-xl bg-success-50 border border-success-200 px-4 py-3 text-sm font-medium text-success-700 dark:bg-success-900/30 dark:border-success-800/50 dark:text-success-300">
                {info}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              {loading ? t('auth.creatingCompany') : t('auth.createCompany')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[] }) {
  return (
    <div className="w-full">
      <label className="label">{label}</label>
      <div className="relative">
        <select className="input appearance-none cursor-pointer pe-10" value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => {
            const val = typeof o === 'string' ? o : o.value;
            const lbl = typeof o === 'string' ? o : o.label;
            return <option key={val} value={val}>{lbl}</option>;
          })}
        </select>
      </div>
    </div>
  );
}
