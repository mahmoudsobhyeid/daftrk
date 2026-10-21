import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { InvoiceTemplate } from './InvoiceTemplate';
import {
  type InvoiceCustomization,
  type InvoiceTemplateId,
  type InvoiceFontFamily,
  type InvoiceFontSize,
  type InvoiceLogoPosition,
  type InvoiceLogoSize,
  type InvoiceHeaderLayout,
  type InvoiceQrPosition,
  TEMPLATE_DEFINITIONS,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LOGO_POSITIONS,
  LOGO_SIZES,
  HEADER_LAYOUTS,
  QR_POSITIONS,
  getInvoiceCustomization,
  saveInvoiceCustomization,
} from '../lib/invoice-customization';
import type { Company, InvoiceRenderData } from '../lib/types';
import {
  Palette,
  Type,
  Image as ImageIcon,
  Layout,
  Eye,
  Check,
  Save,
  RotateCcw,
  Sparkles,
  Layers,
  Maximize2,
  FileText,
  Sliders,
  CheckCircle2,
  Upload,
  X,
  Loader2,
} from 'lucide-react';

const PRESET_COLORS = [
  '#2563eb', // Royal Blue
  '#0ea5e9', // Sky Blue
  '#10b981', // Emerald
  '#059669', // Deep Emerald
  '#16a34a', // ZATCA Green
  '#f59e0b', // Amber / Gold
  '#ef4444', // Crimson
  '#7c3aed', // Purple Tech
  '#1e293b', // Slate Navy
  '#0f172a', // Jet Black
];

interface InvoiceCustomizerPanelProps {
  company: Company;
  onCompanyUpdated: () => void;
  lang: string;
  t: (key: string) => string;
  fmt: (amount: number, currency?: string) => string;
  fmtDate: (date: string) => string;
}

const MOCK_ITEMS: InvoiceRenderData['items'] = [
  { id: '1', description: 'Professional Consulting Services / استشارات مهنية', quantity: 1, unit_price: 1500, discount: 0, tax_rate: 15, line_total: 1725 },
  { id: '2', description: 'Annual Software License / ترخيص نظام سنوي', quantity: 2, unit_price: 450, discount: 50, tax_rate: 15, line_total: 977.5 },
  { id: '3', description: 'Technical Implementation & Support / دعم فني وتدريب', quantity: 1, unit_price: 300, discount: 0, tax_rate: 15, line_total: 345 },
];

export function InvoiceCustomizerPanel({
  company,
  onCompanyUpdated,
  lang,
  t,
  fmt,
  fmtDate,
}: InvoiceCustomizerPanelProps) {
  const { toast } = useToast();
  const isRtl = lang === 'ar';

  // Customization state initialized from DB / localStorage
  const [customization, setCustomization] = useState<InvoiceCustomization>(() =>
    getInvoiceCustomization(company)
  );
  const [colorHex, setColorHex] = useState(customization.primaryColor);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeSection, setActiveSection] = useState<'template' | 'typography' | 'logo' | 'layout' | 'fields' | 'footer'>('template');
  const [previewLang, setPreviewLang] = useState<'ar' | 'en'>(isRtl ? 'ar' : 'en');
  const [fullScreenPreview, setFullScreenPreview] = useState(false);

  // Logo upload state
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [invoicePrefixVal, setInvoicePrefixVal] = useState(company.invoice_prefix || 'INV');

  // Keep reference to last saved configuration
  const savedCustomizationRef = useRef<InvoiceCustomization>(getInvoiceCustomization(company));

  // Only sync from company prop if user has no pending unsaved edits
  useEffect(() => {
    if (!hasUnsavedChanges) {
      const loaded = getInvoiceCustomization(company);
      setCustomization(loaded);
      setColorHex(loaded.primaryColor);
      setInvoicePrefixVal(company.invoice_prefix || 'INV');
      savedCustomizationRef.current = loaded;
    }
  }, [company, hasUnsavedChanges]);

  // Manual save handler triggered ONLY when the user clicks Save
  const handleSave = useCallback(
    async () => {
      setSaving(true);
      try {
        // Save invoice customization object
        const res = await saveInvoiceCustomization(company.id, customization, supabase);

        // Also update invoice_prefix if changed
        if (invoicePrefixVal && invoicePrefixVal !== company.invoice_prefix) {
          await supabase
            .from('companies')
            .update({ invoice_prefix: invoicePrefixVal })
            .eq('id', company.id);
        }

        setSaving(false);
        if (res.success) {
          setSaveSuccess(true);
          setHasUnsavedChanges(false);
          savedCustomizationRef.current = customization;
          setTimeout(() => setSaveSuccess(false), 3000);
          toast(
            isRtl ? 'تم حفظ إعدادات وتصميم الفاتورة بنجاح' : 'Invoice design settings saved successfully',
            'success'
          );
          onCompanyUpdated();
        } else {
          toast(res.error || (isRtl ? 'حدث خطأ أثناء الحفظ' : 'Failed to save settings'), 'error');
        }
      } catch (err: any) {
        setSaving(false);
        toast(err.message || (isRtl ? 'حدث خطأ أثناء الحفظ' : 'Failed to save settings'), 'error');
      }
    },
    [company.id, company.invoice_prefix, customization, invoicePrefixVal, isRtl, onCompanyUpdated, toast]
  );

  // Discard changes and revert to last saved state
  const handleDiscard = useCallback(() => {
    setCustomization(savedCustomizationRef.current);
    setColorHex(savedCustomizationRef.current.primaryColor);
    setInvoicePrefixVal(company.invoice_prefix || 'INV');
    setHasUnsavedChanges(false);
    toast(
      isRtl ? 'تم التراجع عن التعديلات غير المحفوظة' : 'Unsaved changes discarded',
      'info'
    );
  }, [company.invoice_prefix, isRtl, toast]);

  const updateCustomization = (patch: Partial<InvoiceCustomization>) => {
    setCustomization((prev) => ({
      ...prev,
      ...patch,
    }));
    setHasUnsavedChanges(true);
  };

  const handleColorChange = (hex: string) => {
    setColorHex(hex);
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      updateCustomization({ primaryColor: hex });
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      toast(isRtl ? 'يجب أن يكون الملف صورة PNG أو JPG أو SVG' : 'File must be PNG, JPG, or SVG', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast(isRtl ? 'حجم الشعار يتجاوز 2 ميجابايت' : 'Logo file size exceeds 2MB', 'error');
      return;
    }

    setLogoUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${company.id}/logo.${ext}`;

    const { error } = await supabase.storage.from('company-logos').upload(path, file, { upsert: true });
    if (error) {
      toast(error.message, 'error');
      setLogoUploading(false);
      return;
    }

    await supabase.from('companies').update({ logo_path: path }).eq('id', company.id);
    setLogoUploading(false);
    toast(isRtl ? 'تم رفع الشعار بنجاح' : 'Logo uploaded successfully', 'success');
    onCompanyUpdated();
  };

  const handleRemoveLogo = async () => {
    if (!company.logo_path) return;
    await supabase.storage.from('company-logos').remove([company.logo_path]);
    await supabase.from('companies').update({ logo_path: null }).eq('id', company.id);
    toast(isRtl ? 'تمت إزالة الشعار' : 'Logo removed', 'success');
    onCompanyUpdated();
  };

  // Mock invoice data for live preview
  const livePreviewData: InvoiceRenderData = {
    id: 'preview',
    number: `${company.invoice_prefix || 'INV'}-2024-0042`,
    status: 'paid',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10),
    subtotal: 2600,
    tax_total: 390,
    discount_total: 50,
    total: 2940,
    notes: isRtl
      ? 'شكراً لتعاملكم معنا. الدفع عبر التحويل البنكي أو مدى.'
      : 'Thank you for your business. Wire transfer or Mada payment accepted.',
    terms: customization.footerText || company.invoice_footer || (isRtl ? 'السداد مستحق خلال 15 يوماً من تاريخ الفاتورة.' : 'Payment is due within 15 days.'),
    template: customization.template,
    customization,
    share_token: 'preview-token',
    zatca_qr_data: 'AQdEYWZ0cmsgQXJhYmlhAg8zMDAwMDAwMDAwMDAwMDMDFDIwMjYtMTAtMTlUMTA6MzA6MDBaBAYyOTQwLjAwBQUzOTAuMDA=',
    zatca_clearance_status: 'cleared',
    company: {
      id: company.id,
      name: company.name || 'Daftrk Business Solutions',
      name_ar: company.name_ar || 'حلول دفترك للأعمال المتقدمة',
      address: company.address || (isRtl ? 'طريق الملك فهد، حي الصحافة، الرياض' : 'King Fahd Road, Al-Sahafa, Riyadh'),
      city: company.city || 'Riyadh',
      city_ar: company.city_ar || 'الرياض',
      district: company.district || (isRtl ? 'حي الصحافة' : 'Al Sahafa'),
      building_number: company.building_number || '3421',
      additional_number: company.additional_number || '8832',
      postal_code: company.postal_code || '13315',
      phone: company.phone || '+966 11 234 5678',
      email: company.email || 'billing@daftrk.com',
      tax_number: company.tax_number || '300000000000003',
      commercial_registration: company.commercial_registration || '1010000001',
      logo_path: company.logo_path,
      currency: company.currency || 'SAR',
      primary_color: customization.primaryColor,
      invoice_footer: customization.footerText || company.invoice_footer,
      invoice_customization: customization,
    },
    customer: {
      id: 'cust-1',
      name: 'Advanced Trading Co.',
      name_ar: 'شركة التجارة المتقدمة المحدودة',
      address: isRtl ? 'طريق الأمير تركي، حي النخيل، الرياض' : 'Prince Turki Rd, Al Nakheel, Riyadh',
      phone: '+966 50 123 4567',
      email: 'accounting@advancedtrading.sa',
      tax_number: '310000000000003',
      cr_number: '1010999999',
    },
    items: MOCK_ITEMS,
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Bar */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 rounded-2xl p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="p-1.5 bg-white/20 rounded-lg backdrop-blur-xs">
                <Sparkles size={18} className="text-yellow-300" />
              </span>
              <h2 className="text-xl font-black tracking-tight">{t('settings.invoiceCustomizer')}</h2>
            </div>
            <p className="text-sm text-primary-100 max-w-2xl leading-relaxed">
              {t('settings.invoiceCustomizerDesc')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {hasUnsavedChanges && (
              <span className="flex items-center gap-1.5 bg-amber-400/20 border border-amber-300/40 text-amber-100 px-3 py-1.5 rounded-xl text-xs font-bold animate-pulse">
                <span className="h-2 w-2 rounded-full bg-amber-300" />
                {isRtl ? 'يوجد تعديلات غير محفوظة' : 'Unsaved changes'}
              </span>
            )}
            {saveSuccess && (
              <span className="flex items-center gap-1.5 bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 px-3 py-1.5 rounded-xl text-xs font-bold animate-in fade-in duration-200">
                <CheckCircle2 size={14} className="text-emerald-300" />
                {isRtl ? 'تم حفظ التعديلات بنجاح' : 'Saved successfully'}
              </span>
            )}
            {hasUnsavedChanges && (
              <Button
                type="button"
                variant="outline"
                onClick={handleDiscard}
                className="text-xs bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-xs font-medium"
              >
                <RotateCcw size={14} />
                {isRtl ? 'تراجع' : 'Discard'}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleSave}
              loading={saving}
              className={`shadow-md border-0 font-bold text-sm px-4 py-2 transition-all ${
                hasUnsavedChanges
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white ring-2 ring-emerald-300/50 shadow-emerald-900/30'
                  : 'bg-white text-primary-700 hover:bg-primary-50 shadow-sm'
              }`}
            >
              <Save size={16} />
              {isRtl ? 'حفظ تصميم الفاتورة' : 'Save Invoice Design'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Grid: Controls on Left/Right & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Controls Column (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Sub-tabs / Navigation */}
          <div className="bg-white dark:bg-secondary-900 rounded-xl border border-secondary-200 dark:border-secondary-800 p-1.5 flex flex-wrap gap-1 shadow-xs">
            <button
              type="button"
              onClick={() => setActiveSection('template')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSection === 'template'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
              }`}
            >
              <Layout size={14} />
              {isRtl ? 'القالب' : 'Template'}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('typography')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSection === 'typography'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
              }`}
            >
              <Type size={14} />
              {isRtl ? 'الخط والألوان' : 'Fonts & Colors'}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('logo')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSection === 'logo'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
              }`}
            >
              <ImageIcon size={14} />
              {isRtl ? 'الشعار' : 'Logo'}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('fields')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSection === 'fields'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
              }`}
            >
              <Sliders size={14} />
              {isRtl ? 'العناصر' : 'Fields'}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('footer')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                activeSection === 'footer'
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-secondary-600 dark:text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800'
              }`}
            >
              <FileText size={14} />
              {isRtl ? 'التذييل' : 'Footer'}
            </button>
          </div>

          {/* Section 1: Template Selection */}
          {activeSection === 'template' && (
            <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-800 p-5 space-y-3.5 shadow-xs">
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-bold text-sm text-secondary-900 dark:text-secondary-100 flex items-center gap-2">
                  <Layout size={16} className="text-primary-600" />
                  {t('settings.templateSelection')}
                </h3>
                <span className="text-[11px] bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-bold px-2 py-0.5 rounded-full">
                  8 {isRtl ? 'قوالب احترافية' : 'Templates'}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pe-1">
                {TEMPLATE_DEFINITIONS.map((tpl) => {
                  const isSelected = customization.template === tpl.id;
                  return (
                    <div
                      key={tpl.id}
                      onClick={() => updateCustomization({ template: tpl.id })}
                      className={`relative p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary-600 bg-primary-50/40 dark:bg-primary-950/20 shadow-sm ring-1 ring-primary-500/20'
                          : 'border-secondary-200 dark:border-secondary-800 hover:border-secondary-300 dark:hover:border-secondary-700 bg-white dark:bg-secondary-900'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0"
                            style={{ backgroundColor: tpl.previewAccent }}
                          />
                          <p className="font-bold text-xs text-secondary-900 dark:text-secondary-100">
                            {isRtl ? tpl.nameAr : tpl.name}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-300">
                          {isRtl ? tpl.tagAr : tpl.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-secondary-500 dark:text-secondary-400 leading-relaxed mb-1">
                        {isRtl ? tpl.descriptionAr : tpl.description}
                      </p>
                      {isSelected && (
                        <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-primary-600 dark:text-primary-400">
                          <Check size={13} />
                          {isRtl ? 'القالب المحدد حالياً' : 'Active Selection'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Fonts & Colors */}
          {activeSection === 'typography' && (
            <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-800 p-5 space-y-5 shadow-xs">
              <h3 className="font-bold text-sm text-secondary-900 dark:text-secondary-100 flex items-center gap-2">
                <Type size={16} className="text-primary-600" />
                {t('settings.fontOptions')}
              </h3>

              {/* Font Family Selection */}
              <div>
                <label className="label mb-2 block">{t('settings.fontFamily')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {FONT_OPTIONS.map((f) => {
                    const isSelected = customization.fontFamily === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => updateCustomization({ fontFamily: f.id })}
                        className={`p-3 rounded-xl border text-start transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 text-primary-900 dark:bg-primary-900/30 dark:text-primary-200 ring-2 ring-primary-500/20'
                            : 'border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-800 text-secondary-700 dark:text-secondary-300'
                        }`}
                      >
                        <p className="font-bold text-xs">{isRtl ? f.nameAr : f.name}</p>
                        <p className="text-[10px] text-secondary-400 mt-1 truncate">{f.sample}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Size Selection */}
              <div>
                <label className="label mb-2 block">{t('settings.fontSize')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {FONT_SIZE_OPTIONS.map((s) => {
                    const isSelected = customization.fontSize === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => updateCustomization({ fontSize: s.id })}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 text-primary-900 dark:bg-primary-900/30 dark:text-primary-200 ring-2 ring-primary-500/20 font-bold'
                            : 'border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-800 text-secondary-600 dark:text-secondary-400 text-xs'
                        }`}
                      >
                        <p className="text-xs font-bold">{isRtl ? s.nameAr : s.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Brand Accent Color */}
              <div className="pt-2 border-t border-secondary-100 dark:border-secondary-800">
                <label className="label mb-2 block">{t('settings.primaryColor')}</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleColorChange(c)}
                      title={c}
                      className="relative h-8 w-8 rounded-full border-2 transition-all hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: customization.primaryColor === c ? 'white' : c,
                        boxShadow: customization.primaryColor === c ? `0 0 0 3px ${c}` : 'none',
                      }}
                    >
                      {customization.primaryColor === c && (
                        <Check size={13} className="absolute inset-0 m-auto text-white" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={customization.primaryColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-secondary-200 dark:border-secondary-700 p-0.5 bg-transparent"
                  />
                  <input
                    type="text"
                    value={colorHex}
                    onChange={(e) => handleColorChange(e.target.value)}
                    maxLength={7}
                    className="w-28 rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 px-3 py-2 text-sm font-mono text-secondary-700 dark:text-secondary-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="#2563eb"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Logo & Header */}
          {activeSection === 'logo' && (
            <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-800 p-5 space-y-5 shadow-xs">
              <h3 className="font-bold text-sm text-secondary-900 dark:text-secondary-100 flex items-center gap-2">
                <ImageIcon size={16} className="text-primary-600" />
                {t('settings.logoOptions')}
              </h3>

              {/* Show / Hide Logo Toggle */}
              <label className="flex items-center justify-between p-3 rounded-xl border border-secondary-200 dark:border-secondary-700 cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-800/50">
                <span className="text-xs font-bold text-secondary-800 dark:text-secondary-200">
                  {t('settings.showLogo')}
                </span>
                <input
                  type="checkbox"
                  checked={customization.showLogo}
                  onChange={(e) => updateCustomization({ showLogo: e.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                />
              </label>

              {/* Logo Position */}
              <div>
                <label className="label mb-2 block">{t('settings.logoPosition')}</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {LOGO_POSITIONS.map((pos) => {
                    const isSelected = customization.logoPosition === pos.id;
                    return (
                      <button
                        key={pos.id}
                        type="button"
                        onClick={() => updateCustomization({ logoPosition: pos.id })}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 text-primary-900 dark:bg-primary-900/30 dark:text-primary-200 ring-2 ring-primary-500/20 font-bold'
                            : 'border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-800 text-secondary-600 dark:text-secondary-400 text-xs'
                        }`}
                      >
                        <p className="text-xs font-bold">{isRtl ? pos.nameAr : pos.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Logo Size */}
              <div>
                <label className="label mb-2 block">{t('settings.logoSize')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {LOGO_SIZES.map((sz) => {
                    const isSelected = customization.logoSize === sz.id;
                    return (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => updateCustomization({ logoSize: sz.id })}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 text-primary-900 dark:bg-primary-900/30 dark:text-primary-200 ring-2 ring-primary-500/20 font-bold'
                            : 'border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-800 text-secondary-600 dark:text-secondary-400 text-xs'
                        }`}
                      >
                        <p className="text-xs font-bold">{isRtl ? sz.nameAr : sz.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Upload or Change Logo Button */}
              <div className="pt-2 border-t border-secondary-100 dark:border-secondary-800">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    loading={logoUploading}
                    className="text-xs"
                  >
                    <Upload size={14} />
                    {company.logo_path ? t('settings.changeLogo') : t('settings.uploadLogo')}
                  </Button>
                  {company.logo_path && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleRemoveLogo}
                      className="text-xs text-danger-600 hover:text-danger-700"
                    >
                      <X size={14} />
                      {t('settings.removeLogo')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Element Visibility */}
          {activeSection === 'fields' && (
            <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-800 p-5 space-y-4 shadow-xs">
              <h3 className="font-bold text-sm text-secondary-900 dark:text-secondary-100 flex items-center gap-2">
                <Sliders size={16} className="text-primary-600" />
                {t('settings.elementVisibility')}
              </h3>

              <div className="space-y-2">
                {[
                  { key: 'showTaxNumber', label: t('settings.showTaxNumber') },
                  { key: 'showCommercialReg', label: t('settings.showCommercialReg') },
                  { key: 'showAddress', label: t('settings.showAddress') },
                  { key: 'showPhone', label: t('settings.showPhone') },
                  { key: 'showEmail', label: t('settings.showEmail') },
                  { key: 'showStatusBadge', label: t('settings.showStatusBadge') },
                  { key: 'showSignatureBox', label: t('settings.showSignatureBox') },
                  { key: 'showNotes', label: t('settings.showNotes') },
                  { key: 'showTerms', label: t('settings.showTerms') },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-secondary-200 dark:border-secondary-700 cursor-pointer hover:bg-secondary-50 dark:hover:bg-secondary-800/50"
                  >
                    <span className="text-xs font-medium text-secondary-800 dark:text-secondary-200">
                      {item.label}
                    </span>
                    <input
                      type="checkbox"
                      checked={(customization as any)[item.key] ?? true}
                      onChange={(e) => updateCustomization({ [item.key]: e.target.checked })}
                      className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                    />
                  </label>
                ))}
              </div>

              {/* QR Code Position */}
              <div className="pt-2 border-t border-secondary-100 dark:border-secondary-800">
                <label className="label mb-2 block">{t('settings.qrPosition')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {QR_POSITIONS.map((q) => {
                    const isSelected = customization.qrPosition === q.id;
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => updateCustomization({ qrPosition: q.id })}
                        className={`p-2 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50 text-primary-900 dark:bg-primary-900/30 dark:text-primary-200 ring-2 ring-primary-500/20 font-bold'
                            : 'border-secondary-200 dark:border-secondary-700 hover:bg-secondary-50 dark:hover:bg-secondary-800 text-secondary-600 dark:text-secondary-400 text-xs'
                        }`}
                      >
                        <p className="text-[11px] font-bold">{isRtl ? q.nameAr : q.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Section 5: Footer & Signature Details */}
          {activeSection === 'footer' && (
            <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-800 p-5 space-y-4 shadow-xs">
              <h3 className="font-bold text-sm text-secondary-900 dark:text-secondary-100 flex items-center gap-2">
                <FileText size={16} className="text-primary-600" />
                {isRtl ? 'التذييل والتوقيع والبادئة' : 'Footer & Numbering'}
              </h3>

              <div>
                <label className="label mb-1 block">{t('settings.invoicePrefix')}</label>
                <input
                  type="text"
                  value={invoicePrefixVal}
                  onChange={(e) => {
                    setInvoicePrefixVal(e.target.value.toUpperCase());
                    setHasUnsavedChanges(true);
                  }}
                  maxLength={10}
                  className="w-full rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 px-3.5 py-2 text-sm text-secondary-800 dark:text-secondary-200 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="label mb-1 block">{t('settings.invoiceFooter')}</label>
                <textarea
                  value={customization.footerText || ''}
                  onChange={(e) => updateCustomization({ footerText: e.target.value })}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 px-3.5 py-2.5 text-xs text-secondary-700 dark:text-secondary-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder={isRtl ? 'بيانات الحساب البنكي / شروط السداد...' : 'Bank details, payment terms, or thank you note...'}
                />
              </div>

              <div>
                <label className="label mb-1 block">{t('settings.signatureLabel')}</label>
                <input
                  type="text"
                  value={isRtl ? customization.signatureLabelAr || '' : customization.signatureLabel || ''}
                  onChange={(e) => {
                    if (isRtl) {
                      updateCustomization({ signatureLabelAr: e.target.value });
                    } else {
                      updateCustomization({ signatureLabel: e.target.value });
                    }
                  }}
                  placeholder={isRtl ? 'التوقيع والختم المعتمد' : 'Authorized Signature & Stamp'}
                  className="w-full rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-800 px-3.5 py-2 text-xs text-secondary-800 dark:text-secondary-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* Quick Action Bar for Controls Column */}
          <div className="bg-white dark:bg-secondary-900 rounded-xl border border-secondary-200 dark:border-secondary-800 p-3.5 flex items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-2 text-xs">
              {hasUnsavedChanges ? (
                <span className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  {isRtl ? 'تعديلات غير محفوظة' : 'Unsaved changes'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-medium text-secondary-500 dark:text-secondary-400">
                  <Check size={14} className="text-emerald-500" />
                  {isRtl ? 'جميع التعديلات محفوظة' : 'All changes saved'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {hasUnsavedChanges && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  className="text-xs"
                >
                  <RotateCcw size={13} />
                  {isRtl ? 'تراجع' : 'Discard'}
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                loading={saving}
                disabled={!hasUnsavedChanges && !saving}
                className={`text-xs font-bold ${
                  hasUnsavedChanges
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                    : 'opacity-60 cursor-not-allowed'
                }`}
              >
                <Save size={13} />
                {isRtl ? 'حفظ تصميم الفاتورة' : 'Save Invoice Design'}
              </Button>
            </div>
          </div>
        </div>

        {/* Live Preview Column (7 cols) */}
        <div className="lg:col-span-7 space-y-3 sticky top-4">
          {/* Preview Toolbar */}
          <div className="bg-white dark:bg-secondary-900 rounded-xl border border-secondary-200 dark:border-secondary-800 px-4 py-2.5 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold text-secondary-800 dark:text-secondary-200">
                {t('settings.livePreview')}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Language Switcher for Preview */}
              <div className="flex rounded-lg border border-secondary-200 dark:border-secondary-700 p-0.5 bg-secondary-50 dark:bg-secondary-800">
                <button
                  type="button"
                  onClick={() => setPreviewLang('ar')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    previewLang === 'ar'
                      ? 'bg-white dark:bg-secondary-700 text-primary-600 shadow-xs'
                      : 'text-secondary-500 hover:text-secondary-800'
                  }`}
                >
                  {t('settings.viewArabic')}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewLang('en')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                    previewLang === 'en'
                      ? 'bg-white dark:bg-secondary-700 text-primary-600 shadow-xs'
                      : 'text-secondary-500 hover:text-secondary-800'
                  }`}
                >
                  {t('settings.viewEnglish')}
                </button>
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={() => setFullScreenPreview(true)}
                className="p-1.5 rounded-lg border border-secondary-200 dark:border-secondary-700 text-secondary-500 hover:bg-secondary-100 dark:hover:bg-secondary-800"
                title="Full Screen Preview"
              >
                <Maximize2 size={14} />
              </button>
            </div>
          </div>

          {/* Live Preview Paper Canvas */}
          <div className="rounded-2xl border border-secondary-200 dark:border-secondary-700 overflow-hidden shadow-sm bg-white">
            <div className="transform origin-top scale-[0.98] sm:scale-100">
              <InvoiceTemplate
                data={livePreviewData}
                lang={previewLang}
                fmt={fmt}
                fmtDate={fmtDate}
                t={t}
                customizationOverride={customization}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Preview Modal */}
      {fullScreenPreview && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFullScreenPreview(false);
          }}
        >
          <div className="w-full max-w-4xl my-6">
            <div className="flex items-center justify-between mb-3 px-2">
              <div className="flex items-center gap-2 text-white text-sm font-bold">
                <Eye size={16} />
                {t('settings.livePreview')} ({previewLang === 'ar' ? 'العربية' : 'English'})
              </div>
              <button
                type="button"
                onClick={() => setFullScreenPreview(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden shadow-2xl bg-white">
              <InvoiceTemplate
                data={livePreviewData}
                lang={previewLang}
                fmt={fmt}
                fmtDate={fmtDate}
                t={t}
                customizationOverride={customization}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
