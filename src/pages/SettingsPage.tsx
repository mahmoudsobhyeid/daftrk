import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import { useCurrency, useFormatDate } from '../lib/format';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { InvoiceTemplate } from '../components/InvoiceTemplate';
import { InvoiceCustomizerPanel } from '../components/InvoiceCustomizerPanel';
import { ZatcaSettingsPanel } from '../components/zatca/ZatcaSettingsPanel';
import {
  Building2, FileText, Palette, Globe, Moon, Sun, Check,
  Upload, X, Eye, Loader2, LayoutTemplate, Shield, Save,
} from 'lucide-react';
import { currencySymbols } from '../lib/i18n';
import type { InvoiceRenderData } from '../lib/types';

const currencies = Object.keys(currencySymbols);

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kuwait', 'Asia/Baghdad',
  'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
  'Africa/Cairo', 'Africa/Johannesburg',
];

const COUNTRIES = [
  'Saudi Arabia', 'United Arab Emirates', 'Kuwait', 'Qatar', 'Bahrain', 'Oman',
  'Jordan', 'Lebanon', 'Egypt', 'Iraq', 'Syria', 'Yemen', 'Libya', 'Tunisia',
  'Morocco', 'Algeria', 'United States', 'United Kingdom', 'Germany', 'France',
  'Canada', 'Australia', 'India', 'Singapore', 'Turkey', 'Other',
];

const PRESET_COLORS = [
  '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#64748b',
];

type Tab = 'company' | 'invoice' | 'zatca' | 'preferences';
type SaveStatus = 'idle' | 'saving' | 'saved';

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-secondary-100 dark:border-secondary-800">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
        {icon}
      </div>
      <h2 className="text-base font-bold text-secondary-700 dark:text-secondary-200">{title}</h2>
    </div>
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

function SaveIndicator({ status, t }: { status: SaveStatus; t: (k: string) => string }) {
  if (status === 'idle') return null;
  return (
    <span className={`flex items-center gap-1.5 text-xs font-semibold transition-all ${
      status === 'saving' ? 'text-secondary-400' : 'text-success-600 dark:text-success-400'
    }`}>
      {status === 'saving'
        ? <><Loader2 size={12} className="animate-spin" />{t('settings.savingStatus')}</>
        : <><Check size={12} />{t('settings.savedStatus')}</>
      }
    </span>
  );
}

const MOCK_ITEMS: InvoiceRenderData['items'] = [
  { id: '1', description: 'Professional Services', quantity: 5, unit_price: 200, discount: 10, tax_rate: 15, line_total: 900 },
  { id: '2', description: 'Software License', quantity: 1, unit_price: 500, discount: 0, tax_rate: 15, line_total: 575 },
];

export function SettingsPage() {
  const { t, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { company, refresh } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const fmt = useCurrency();
  const fmtDate = useFormatDate();

  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [showPreview, setShowPreview] = useState(false);

  // Company fields
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [commercialReg, setCommercialReg] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');

  // ZATCA national address fields
  const [city, setCity] = useState('');
  const [cityAr, setCityAr] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [additionalNumber, setAdditionalNumber] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [district, setDistrict] = useState('');
  const [website, setWebsite] = useState('');

  // Invoice fields
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [invoiceFooter, setInvoiceFooter] = useState('');
  const [invoiceTheme, setInvoiceTheme] = useState('classic');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [colorHex, setColorHex] = useState('#2563eb');

  // Logo
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialized = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!company) return;
    setName(company.name);
    setNameAr(company.name_ar ?? '');
    setCommercialReg((company as any).commercial_registration ?? '');
    setTaxNumber(company.tax_number ?? '');
    setPhone(company.phone ?? '');
    setEmail(company.email ?? '');
    setAddress(company.address ?? '');
    setCountry((company as any).country ?? '');
    setCurrency(company.currency);
    setTimezone((company as any).timezone ?? 'UTC');
    setInvoicePrefix((company as any).invoice_prefix ?? 'INV');
    setInvoiceFooter((company as any).invoice_footer ?? '');
    setInvoiceTheme((company as any).invoice_theme ?? 'classic');
    const color = company.primary_color || '#2563eb';
    setPrimaryColor(color);
    setColorHex(color);
    setLogoPath(company.logo_path ?? null);
    if (company.logo_path) {
      const { data } = supabase.storage.from('company-logos').getPublicUrl(company.logo_path);
      setLogoPreview(data.publicUrl);
    }
    // ZATCA national address
    setCity((company as any).city ?? '');
    setCityAr((company as any).city_ar ?? '');
    setBuildingNumber((company as any).building_number ?? '');
    setAdditionalNumber((company as any).additional_number ?? '');
    setPostalCode((company as any).postal_code ?? '');
    setDistrict((company as any).district ?? '');
    setWebsite((company as any).website ?? '');
    setHasCompanyChanges(false);
  }, [company]);

  const [hasCompanyChanges, setHasCompanyChanges] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);

  // Manual save handler triggered ONLY when the user clicks Save
  const handleSaveCompanySettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!company) return;
    setSavingCompany(true);
    setSaveStatus('saving');
    try {
      const fields = {
        name: name.trim() || company.name,
        name_ar: nameAr.trim() || null,
        commercial_registration: commercialReg.trim() || null,
        tax_number: taxNumber.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        country: country || null,
        currency,
        timezone,
        city: city.trim() || null,
        city_ar: cityAr.trim() || null,
        building_number: buildingNumber.trim() || null,
        additional_number: additionalNumber.trim() || null,
        postal_code: postalCode.trim() || null,
        district: district.trim() || null,
        website: website.trim() || null,
      };
      const { error } = await supabase.from('companies').update(fields).eq('id', company.id);
      setSavingCompany(false);
      if (!error) {
        setHasCompanyChanges(false);
        setSaveStatus('saved');
        toast(
          lang === 'ar' ? 'تم حفظ إعدادات وبيانات الشركة بنجاح' : 'Company settings saved successfully',
          'success'
        );
        refresh();
        setTimeout(() => setSaveStatus('idle'), 2500);
      } else {
        setSaveStatus('idle');
        toast(error.message, 'error');
      }
    } catch (err: any) {
      setSavingCompany(false);
      setSaveStatus('idle');
      toast(err.message || (lang === 'ar' ? 'حدث خطأ أثناء الحفظ' : 'Failed to save settings'), 'error');
    }
  };

  const handleLogoFile = async (file: File) => {
    if (!company) return;
    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) { 
      toast('يجب أن يكون الملف صورة PNG أو JPG أو SVG', 'error'); 
      return; 
    }
    if (file.size > 2 * 1024 * 1024) { toast(t('auth.logoTooLarge'), 'error'); return; }
    setLogoUploading(true);
    
    // Delete old logo if exists
    if (logoPath) {
      await supabase.storage.from('company-logos').remove([logoPath]);
    }
    
    const ext = file.name.split('.').pop();
    const path = `${company.id}/logo.${ext}`;
    console.log('📤 Uploading logo to path:', path);
    const { error } = await supabase.storage.from('company-logos').upload(path, file);
    if (error) { 
      console.error('❌ Logo upload error:', error);
      toast(`خطأ في الرفع: ${error.message}`, 'error'); 
      setLogoUploading(false); 
      return; 
    }
    
    console.log('✅ Logo uploaded successfully, updating DB');
    await supabase.from('companies').update({ logo_path: path }).eq('id', company.id);
    const { data } = supabase.storage.from('company-logos').getPublicUrl(path);
    setLogoPath(path);
    setLogoPreview(data.publicUrl);
    setLogoUploading(false);
    toast(t('settings.savedStatus'));
    refresh();
  };

  const handleRemoveLogo = async () => {
    if (!company || !logoPath) return;
    await supabase.storage.from('company-logos').remove([logoPath]);
    await supabase.from('companies').update({ logo_path: null }).eq('id', company.id);
    setLogoPath(null);
    setLogoPreview(null);
    refresh();
  };

  const previewData: InvoiceRenderData = {
    id: 'preview',
    number: `${invoicePrefix}-2024-0001`,
    status: 'paid',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    subtotal: 1400,
    tax_total: 175,
    discount_total: 100,
    total: 1475,
    notes: 'Thank you for your business.',
    terms: invoiceFooter || null,
    template: invoiceTheme,
    share_token: 'preview',
    company: {
      id: company?.id ?? '',
      name: name || company?.name || 'Your Company',
      name_ar: nameAr || null,
      address: address || null,
      phone: phone || null,
      email: email || null,
      tax_number: taxNumber || null,
      logo_path: logoPath,
      currency,
      primary_color: primaryColor,
      invoice_footer: invoiceFooter || null,
    },
    customer: {
      id: 'c1',
      name: 'Sample Customer',
      name_ar: 'عميل تجريبي',
      address: '123 Customer Street, City',
      phone: '+1 555 0100',
      email: 'customer@example.com',
      tax_number: 'TAX-12345',
    },
    items: MOCK_ITEMS,
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'company', label: t('settings.tabCompany'), icon: <Building2 size={15} /> },
    { id: 'invoice', label: t('settings.tabInvoice'), icon: <FileText size={15} /> },
    { id: 'zatca', label: t('settings.tabEInvoicing'), icon: <Shield size={15} /> },
    { id: 'preferences', label: t('settings.tabPreferences'), icon: <Palette size={15} /> },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100 tracking-tight">{t('settings.title')}</h1>
        <div className="flex items-center gap-3">
          <SaveIndicator status={saveStatus} t={t} />
          {activeTab === 'company' && (
            <Button
              type="button"
              onClick={() => handleSaveCompanySettings()}
              loading={savingCompany}
              className={`text-xs font-bold px-4 py-2 transition-all ${
                hasCompanyChanges
                  ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-md ring-2 ring-primary-500/20'
                  : 'bg-white dark:bg-secondary-800 text-secondary-700 dark:text-secondary-200 border border-secondary-300 dark:border-secondary-600 hover:bg-secondary-50'
              }`}
            >
              <Save size={14} />
              {hasCompanyChanges
                ? (lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes')
                : (lang === 'ar' ? 'حفظ الإعدادات' : 'Save Settings')}
            </Button>
          )}
        </div>
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
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Company Tab ─────────────────────────────────────── */}
      {activeTab === 'company' && (
        <div className="space-y-6">
          {/* Logo upload */}
          <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
            <SectionHeader icon={<Building2 size={16} />} title={t('settings.logoUpload')} />
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              {/* Preview box */}
              <div
                onClick={() => !logoPreview && fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault(); setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleLogoFile(file);
                }}
                className={`relative flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
                  dragOver
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : logoPreview
                    ? 'border-secondary-200 dark:border-secondary-700'
                    : 'border-secondary-300 dark:border-secondary-600 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-900/10'
                }`}
              >
                {logoUploading ? (
                  <Loader2 size={24} className="animate-spin text-primary-500" />
                ) : logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="h-full w-full object-contain p-2" />
                ) : (
                  <div className="flex flex-col items-center gap-1.5 text-secondary-400">
                    <Upload size={22} />
                    <span className="text-xs font-medium text-center leading-tight">Upload</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-200">
                  {logoPreview ? t('settings.changeLogo') : t('settings.uploadLogo')}
                </p>
                <p className="text-xs text-secondary-400 dark:text-secondary-500">{t('settings.logoHint')}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} loading={logoUploading}>
                    <Upload size={14} />
                    {logoPreview ? t('settings.changeLogo') : t('settings.uploadLogo')}
                  </Button>
                  {logoPreview && (
                    <Button size="sm" variant="ghost" onClick={handleRemoveLogo}>
                      <X size={14} />
                      {t('settings.removeLogo')}
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }}
                />
              </div>
            </div>
          </div>

          {/* Company info */}
          <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
            <SectionHeader icon={<Building2 size={16} />} title={t('settings.companyInfo')} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label={`${t('onboarding.companyName')} *`}
                value={name}
                onChange={(e) => { setName(e.target.value); setHasCompanyChanges(true); }}
              />
              <Input
                label={t('onboarding.companyNameAr')}
                value={nameAr}
                onChange={(e) => { setNameAr(e.target.value); setHasCompanyChanges(true); }}
                dir="rtl"
                hint={t('common.optional')}
              />
              <Input
                label={t('settings.commercialReg')}
                value={commercialReg}
                onChange={(e) => { setCommercialReg(e.target.value); setHasCompanyChanges(true); }}
                hint={t('common.optional')}
              />
              <Input
                label={t('settings.taxNumber')}
                value={taxNumber}
                onChange={(e) => { setTaxNumber(normalizeSaudiVat(e.target.value)); setHasCompanyChanges(true); }}
                maxLength={15}
                hint={t('common.optional')}
              />
              <Input
                label={t('onboarding.phone')}
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setHasCompanyChanges(true); }}
                hint={t('common.optional')}
              />
              <Input
                label={t('auth.email')}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setHasCompanyChanges(true); }}
                hint={t('common.optional')}
              />
              <Select
                label={t('settings.country')}
                value={country}
                onChange={(e) => { setCountry(e.target.value); setHasCompanyChanges(true); }}
              >
                <option value="">{t('common.optional')}</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select
                label={t('settings.currency')}
                value={currency}
                onChange={(e) => { setCurrency(e.target.value); setHasCompanyChanges(true); }}
              >
                {currencies.map((c) => <option key={c} value={c}>{c} — {currencySymbols[c]}</option>)}
              </Select>
              <Select
                label={t('settings.timezone')}
                value={timezone}
                onChange={(e) => { setTimezone(e.target.value); setHasCompanyChanges(true); }}
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </Select>
            </div>
            <div className="mt-4">
              <Input
                label={t('onboarding.address')}
                value={address}
                onChange={(e) => { setAddress(e.target.value); setHasCompanyChanges(true); }}
                hint={t('common.optional')}
              />
            </div>

            {/* Bottom Save Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-5 mt-6 border-t border-secondary-100 dark:border-secondary-800">
              <div className="text-xs">
                {hasCompanyChanges ? (
                  <span className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    {lang === 'ar' ? 'يوجد تعديلات غير محفوظة — انقر حفظ لاعتمادها' : 'Unsaved changes pending — click Save to apply'}
                  </span>
                ) : (
                  <span className="text-secondary-400 dark:text-secondary-500">
                    {lang === 'ar' ? 'جميع إعدادات الشركة محفوظة' : 'All company settings saved'}
                  </span>
                )}
              </div>
              <Button
                type="button"
                onClick={() => handleSaveCompanySettings()}
                loading={savingCompany}
                className="w-full sm:w-auto px-6 font-bold shadow-md"
              >
                <Save size={16} />
                {lang === 'ar' ? 'حفظ إعدادات وبيانات الشركة' : 'Save Company Settings'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice Tab ─────────────────────────────────────── */}
      {activeTab === 'invoice' && company && (
        <InvoiceCustomizerPanel
          company={company}
          onCompanyUpdated={refresh}
          lang={lang}
          t={t}
          fmt={fmt}
          fmtDate={fmtDate}
        />
      )}

      {/* ── ZATCA Tab ───────────────────────────────────────── */}
      {activeTab === 'zatca' && company && <ZatcaSettingsPanel company={company} />}

      {/* ── Preferences Tab ─────────────────────────────────── */}
      {activeTab === 'preferences' && (        <div className="space-y-6">
          <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
            <SectionHeader icon={<Palette size={16} />} title={t('settings.preferences')} />
            <div className="space-y-6">
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

          {/* Account info */}
          {user && (
            <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-700 p-5 sm:p-6">
              <SectionHeader icon={<Building2 size={16} />} title={t('settings.account')} />
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-secondary-400 to-secondary-600 text-white font-bold shrink-0">
                  {(user.email?.[0] ?? 'U').toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-secondary-800 dark:text-secondary-100">{user.email}</p>
                  <p className="text-xs text-secondary-500">{t('settings.memberSince')} {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Preview Modal ────────────────────────────────────── */}
      {showPreview && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
        >
          <div className="w-full max-w-4xl my-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white/80">{t('settings.previewInvoice')}</p>
              <button
                onClick={() => setShowPreview(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <InvoiceTemplate data={previewData} lang={lang} fmt={fmt} fmtDate={fmtDate} t={t} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const normalizeSaudiVat = (value: string) => value.replace(/\D/g, '').slice(0, 15);
