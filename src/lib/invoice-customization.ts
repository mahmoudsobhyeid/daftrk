import type { Company } from './types';

export type InvoiceTemplateId =
  | 'classic'
  | 'modern'
  | 'saudi_professional'
  | 'minimal'
  | 'corporate'
  | 'emerald'
  | 'compact_retail'
  | 'creative_tech';

export type InvoiceFontFamily = 'cairo' | 'tajawal' | 'noto' | 'inter';
export type InvoiceFontSize = 'small' | 'medium' | 'large';
export type InvoiceLogoPosition = 'start' | 'center' | 'end';
export type InvoiceLogoSize = 'small' | 'medium' | 'large';
export type InvoiceHeaderLayout = 'split' | 'stacked' | 'banner';
export type InvoiceQrPosition = 'header' | 'footer' | 'hide';

export interface InvoiceCustomization {
  template: InvoiceTemplateId;
  primaryColor: string;
  fontFamily: InvoiceFontFamily;
  fontSize: InvoiceFontSize;
  logoPosition: InvoiceLogoPosition;
  logoSize: InvoiceLogoSize;
  showLogo: boolean;
  headerLayout: InvoiceHeaderLayout;
  qrPosition: InvoiceQrPosition;
  showTaxNumber: boolean;
  showCommercialReg: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showBankDetails: boolean;
  showTerms: boolean;
  showNotes: boolean;
  showStatusBadge: boolean;
  showSignatureBox: boolean;
  footerText?: string;
  signatureLabel?: string;
  signatureLabelAr?: string;
  defaultLang?: 'ar' | 'en' | 'bilingual';
}

export const DEFAULT_INVOICE_CUSTOMIZATION: InvoiceCustomization = {
  template: 'classic',
  primaryColor: '#2563eb',
  fontFamily: 'cairo',
  fontSize: 'medium',
  logoPosition: 'start',
  logoSize: 'medium',
  showLogo: true,
  headerLayout: 'split',
  qrPosition: 'header',
  showTaxNumber: true,
  showCommercialReg: true,
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showBankDetails: true,
  showTerms: true,
  showNotes: true,
  showStatusBadge: true,
  showSignatureBox: true,
  footerText: '',
  signatureLabel: 'Authorized Signature & Stamp',
  signatureLabelAr: 'التوقيع والختم المعتمد',
  defaultLang: 'bilingual',
};

export interface TemplateDefinition {
  id: InvoiceTemplateId;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  tag: string;
  tagAr: string;
  langSuitability: 'ar' | 'en' | 'bilingual';
  previewAccent: string;
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    id: 'classic',
    name: 'Classic Standard',
    nameAr: 'الكلاسيكي القياسي',
    description: 'Clean balanced corporate format with colored accent line and clear table hierarchy.',
    descriptionAr: 'تصميم متوازن وواضح مع خط علوي ملون وجدول منسق يناسب جميع الأنشطة.',
    tag: 'Standard',
    tagAr: 'قياسي',
    langSuitability: 'bilingual',
    previewAccent: '#2563eb',
  },
  {
    id: 'modern',
    name: 'Modern Accent',
    nameAr: 'العصري الاحترافي',
    description: 'Contemporary card layout with soft background fills, badge accents, and sharp typography.',
    descriptionAr: 'قالب عصري مع بطاقات هادئة وخطوط حادة ومؤشرات ملونة متميزة.',
    tag: 'Popular',
    tagAr: 'الأكثر استخداماً',
    langSuitability: 'bilingual',
    previewAccent: '#0ea5e9',
  },
  {
    id: 'saudi_professional',
    name: 'Saudi ZATCA Tax Invoice',
    nameAr: 'الفاتورة الضريبية السعودية (ZATCA)',
    description: 'Compliant bilingual tax invoice format with side-by-side Arabic/English labels, QR verification, and VAT tables.',
    descriptionAr: 'نموذج الفاتورة الضريبية المعتمد ثنائي اللغة المتوافق مع متطلبات هيئة الزكاة والضريبة والجمارك (ZATCA Phase 2).',
    tag: 'ZATCA Phase 2',
    tagAr: 'معتمد زكاة وضريبة',
    langSuitability: 'bilingual',
    previewAccent: '#16a34a',
  },
  {
    id: 'minimal',
    name: 'Minimalist Clean',
    nameAr: 'البسيط الهادئ (مينيمال)',
    description: 'Spacious, elegant aesthetic with reduced borders and subtle typography for boutique brands.',
    descriptionAr: 'تصميم بسيط وراقي بخطوط ناعمة ومساحات بيضاء مريحة للعين يناسب الخدمات والشركات الإبداعية.',
    tag: 'Elegant',
    tagAr: 'أنيق وبسيط',
    langSuitability: 'bilingual',
    previewAccent: '#64748b',
  },
  {
    id: 'corporate',
    name: 'Corporate Executive',
    nameAr: 'المؤسسي الفاخر (Executive)',
    description: 'Bold corporate dark header banner with official reference block and structured formal grid.',
    descriptionAr: 'ترويسة عريضة فخمة مع شبكة بيانات رسمية وجدول بنود معزز بالأرقام يناسب الشركات الكبرى.',
    tag: 'Executive',
    tagAr: 'رسمي وفاخر',
    langSuitability: 'bilingual',
    previewAccent: '#1e293b',
  },
  {
    id: 'emerald',
    name: 'Emerald Business',
    nameAr: 'الزمردي التجاري (Emerald)',
    description: 'Fresh emerald-toned design with card summaries, highlighted tax badges, and high readability.',
    descriptionAr: 'تصميم أخضر زمردي جذاب يبرز المبالغ والضريبة بطريقة احترافية مع هوية بصرية مريحة.',
    tag: 'Business',
    tagAr: 'تجاري حديث',
    langSuitability: 'bilingual',
    previewAccent: '#059669',
  },
  {
    id: 'compact_retail',
    name: 'Compact Retail / Thermal',
    nameAr: 'المدمج السريع (نقاط البيع والتجزئة)',
    description: 'High-density receipt and compact invoice format optimized for fast reading and POS printing.',
    descriptionAr: 'تنسيق مدمج عالي الكثافة مثالي للمبيعات السريعة وفواتير نقاط البيع والطباعة المدمجة.',
    tag: 'POS / Compact',
    tagAr: 'مدمج / كاشير',
    langSuitability: 'bilingual',
    previewAccent: '#d97706',
  },
  {
    id: 'creative_tech',
    name: 'Creative Tech & Slate',
    nameAr: 'التقني الحديث (Tech Slate)',
    description: 'Tech-inspired modular design with rounded info blocks, border accents, and pill tags.',
    descriptionAr: 'تصميم تقني عصري كروكي مع إطارات ناعمة وخانات بيانات سريعة القراءة لشركات التكنولوجيا.',
    tag: 'Tech',
    tagAr: 'عصري وتقني',
    langSuitability: 'en',
    previewAccent: '#7c3aed',
  },
];

export const FONT_OPTIONS: { id: InvoiceFontFamily; name: string; nameAr: string; sample: string }[] = [
  { id: 'cairo', name: 'Cairo', nameAr: 'خط القاهرة (موصى به)', sample: 'أبجد هوز 123 - Daftrk Invoice' },
  { id: 'tajawal', name: 'Tajawal', nameAr: 'خط تجوّل (عصري وحديث)', sample: 'أبجد هوز 123 - Daftrk Invoice' },
  { id: 'noto', name: 'Noto Sans Arabic', nameAr: 'نوتو سانس (واضح ودقيق)', sample: 'أبجد هوز 123 - Daftrk Invoice' },
  { id: 'inter', name: 'Inter', nameAr: 'خط إنتر (قياسي للإنجليزية والأرقام)', sample: 'ABC 123 - Daftrk Invoice' },
];

export const FONT_SIZE_OPTIONS: { id: InvoiceFontSize; name: string; nameAr: string; scale: string }[] = [
  { id: 'small', name: 'Small (Compact)', nameAr: 'صغير (مضغوط 12-13px)', scale: 'text-xs sm:text-sm' },
  { id: 'medium', name: 'Medium (Balanced)', nameAr: 'متوسط (متوازن 14px)', scale: 'text-sm' },
  { id: 'large', name: 'Large (Spacious)', nameAr: 'كبير (واضح جداً 15-16px)', scale: 'text-base' },
];

export const LOGO_POSITIONS: { id: InvoiceLogoPosition; name: string; nameAr: string }[] = [
  { id: 'start', name: 'Right in Arabic / Left in English', nameAr: 'البداية (يمين بالعربي / يسار بالإنجليزي)' },
  { id: 'center', name: 'Centered on Top', nameAr: 'في المنتصف بالأعلى' },
  { id: 'end', name: 'Left in Arabic / Right in English', nameAr: 'النهاية (يسار بالعربي / يمين بالإنجليزي)' },
];

export const LOGO_SIZES: { id: InvoiceLogoSize; name: string; nameAr: string; px: number }[] = [
  { id: 'small', name: 'Small (44px)', nameAr: 'صغير (44 بكسل)', px: 44 },
  { id: 'medium', name: 'Medium (64px)', nameAr: 'متوسط (64 بكسل)', px: 64 },
  { id: 'large', name: 'Large (88px)', nameAr: 'كبير (88 بكسل)', px: 88 },
];

export const HEADER_LAYOUTS: { id: InvoiceHeaderLayout; name: string; nameAr: string }[] = [
  { id: 'split', name: 'Split (Company & Invoice side-by-side)', nameAr: 'متوازي جانبي (الشركة والبيانات متقابلان)' },
  { id: 'stacked', name: 'Centered Stacked (Centered logo above details)', nameAr: 'متمركز عمودي (اللوجو بالمنتصف ثم البيانات)' },
  { id: 'banner', name: 'Full Banner Bar (Brand color top bar)', nameAr: 'شريط ترويسة عريض بلون الهوية' },
];

export const QR_POSITIONS: { id: InvoiceQrPosition; name: string; nameAr: string }[] = [
  { id: 'header', name: 'In Header (Top)', nameAr: 'في الترويسة العلوية' },
  { id: 'footer', name: 'In Totals / Footer (Bottom)', nameAr: 'بجوار الإجماليات أسفل الفاتورة' },
  { id: 'hide', name: 'Hidden', nameAr: 'إخفاء رمز QR' },
];

const LOCAL_STORAGE_KEY_PREFIX = 'daftrk_invoice_customization_';

/**
 * Loads the active customization for a company.
 * Reads from company.invoice_customization in DB or localStorage, falling back to defaults.
 */
export function getInvoiceCustomization(company?: Company | null): InvoiceCustomization {
  const defaults: InvoiceCustomization = {
    ...DEFAULT_INVOICE_CUSTOMIZATION,
    template: (company?.invoice_theme as InvoiceTemplateId) || 'classic',
    primaryColor: company?.primary_color || '#2563eb',
    footerText: company?.invoice_footer || '',
  };

  if (!company) return defaults;

  // 1. Check DB field if present on company
  const dbCustomization = (company as any).invoice_customization;
  if (dbCustomization && typeof dbCustomization === 'object') {
    return {
      ...defaults,
      ...dbCustomization,
      // Ensure color & template from company takes precedence if explicitly set
      template: (dbCustomization.template || company.invoice_theme || defaults.template) as InvoiceTemplateId,
      primaryColor: dbCustomization.primaryColor || company.primary_color || defaults.primaryColor,
    };
  }

  // 2. Check localStorage fallback
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${company.id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...defaults,
          ...parsed,
          template: (parsed.template || company.invoice_theme || defaults.template) as InvoiceTemplateId,
          primaryColor: parsed.primaryColor || company.primary_color || defaults.primaryColor,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to read invoice customization from localStorage', err);
  }

  return defaults;
}

/**
 * Persists invoice customization to both localStorage (immediate cache) and Supabase DB.
 */
export async function saveInvoiceCustomization(
  companyId: string,
  customization: InvoiceCustomization,
  supabaseClient: any
): Promise<{ success: boolean; error?: string }> {
  // 1. Immediately save to localStorage
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_KEY_PREFIX}${companyId}`,
      JSON.stringify(customization)
    );
  } catch (err) {
    console.warn('LocalStorage save failed', err);
  }

  // 2. Save to Supabase companies table
  try {
    const updatePayload: Record<string, any> = {
      invoice_theme: customization.template,
      primary_color: customization.primaryColor,
      invoice_footer: customization.footerText ?? null,
      invoice_customization: customization,
    };

    const { error } = await supabaseClient
      .from('companies')
      .update(updatePayload)
      .eq('id', companyId);

    if (error) {
      // If column invoice_customization doesn't exist yet, retry without that column
      if (error.message?.includes('invoice_customization') || error.code === '42703') {
        const fallbackPayload = {
          invoice_theme: customization.template,
          primary_color: customization.primaryColor,
          invoice_footer: customization.footerText ?? null,
        };
        const { error: fallbackErr } = await supabaseClient
          .from('companies')
          .update(fallbackPayload)
          .eq('id', companyId);

        if (fallbackErr) {
          return { success: false, error: fallbackErr.message };
        }
      } else {
        return { success: false, error: error.message };
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown save error' };
  }
}
