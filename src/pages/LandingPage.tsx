import { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useScrollReveal } from '../hooks/useScrollReveal';
import { Button } from '../components/ui/Button';
import {
  BookOpen, Menu, X, Moon, Sun, Languages, ArrowRight, Check, Plus, Minus,
  Users, Package, FileText, Globe, ShieldCheck, Moon as MoonIcon,
  Sparkles, Zap, Building2, CreditCard, Send, BarChart3,
  Star, Quote, Twitter, Linkedin, Facebook, Mail, MapPin,
} from 'lucide-react';

const LANDING_CONTACT_DISPLAY_EMAIL = 'salse@daftrk.com';
const LANDING_CONTACT_TARGET_EMAIL = 'mahmoud.sobhy36@gmail.com';
const LANDING_CONTACT_MAILTO = `mailto:${LANDING_CONTACT_TARGET_EMAIL}`;
const WHATSAPP_NUMBER = '01111209131';
const WHATSAPP_INTL = '201111209131';
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_INTL}`;

function WhatsAppIcon({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
    </svg>
  );
}

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
  onTerms?: () => void;
}

export function LandingPage({ onGetStarted, onSignIn, onTerms }: LandingPageProps) {
  const { t, lang, setLang } = useLanguage();
  const { theme, toggle } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { href: '#features', label: t('landing.nav.features') },
    { href: '#how', label: t('landing.nav.howItWorks') },
    { href: '#why', label: t('landing.nav.why') },
    { href: '#pricing', label: t('landing.nav.pricing') },
    { href: '#faq', label: t('landing.nav.faq') },
  ];

  const scrollTo = (href: string) => {
    setMobileMenuOpen(false);
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-secondary-950 overflow-x-hidden">
      {/* ─── Navbar ─────────────────────────────────────────── */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? 'glass-strong shadow-sm' : 'bg-transparent'}`}>
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-primary">
              <BookOpen size={20} />
            </div>
            <span className="text-lg font-bold text-secondary-800 dark:text-white tracking-tight">{t('app.name')}</span>
          </div>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="px-4 py-2 text-sm font-medium text-secondary-600 hover:text-secondary-900 dark:text-secondary-400 dark:hover:text-white transition-colors rounded-lg hover:bg-secondary-100 dark:hover:bg-secondary-800"
              >
                {link.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={lang === 'ar' ? 'تواصل معانا عبر واتساب' : 'Contact Us on WhatsApp'}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              <WhatsAppIcon size={15} />
              <span>{lang === 'ar' ? 'تواصل معانا' : 'Contact Us'}</span>
            </a>
            <a
              href="https://www.facebook.com/Daftrk.ERP"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="btn-ghost p-2 rounded-lg text-secondary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <Facebook size={18} />
            </a>
            <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="btn-ghost p-2 rounded-lg">
              <Languages size={18} />
            </button>
            <button onClick={toggle} className="btn-ghost p-2 rounded-lg">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <Button variant="ghost" size="sm" className="hidden sm:flex" onClick={onSignIn}>{t('landing.nav.signin')}</Button>
            <Button size="sm" className="hidden sm:flex" onClick={onGetStarted}>
              {t('landing.nav.startTrial')}
              <ArrowRight size={14} className="rtl:rotate-180" />
            </Button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden btn-ghost p-2 rounded-lg">
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden glass-strong border-t border-secondary-200 dark:border-secondary-800 animate-fade-in-fast">
            <div className="px-4 py-4 space-y-1">
              {navLinks.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="block w-full text-start px-4 py-2.5 text-sm font-medium text-secondary-600 hover:text-secondary-900 dark:text-secondary-400 dark:hover:text-white hover:bg-secondary-100 dark:hover:bg-secondary-800 rounded-lg transition-colors"
                >
                  {link.label}
                </button>
              ))}
              <div className="pt-3 mt-3 border-t border-secondary-200 dark:border-secondary-800 space-y-2">
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-sm shadow-sm transition-colors"
                >
                  <WhatsAppIcon size={18} />
                  <span>{lang === 'ar' ? 'تواصل معانا' : 'Contact Us'}</span>
                </a>
                <Button variant="secondary" className="w-full" onClick={onSignIn}>{t('landing.nav.signin')}</Button>
                <Button className="w-full" onClick={onGetStarted}>{t('landing.nav.startTrial')}</Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ─── Hero ───────────────────────────────────────────── */}
      <HeroSection onTrial={onGetStarted} onDemo={onGetStarted} />

      {/* ─── Features ───────────────────────────────────────── */}
      <FeaturesSection />

      {/* ─── How It Works ───────────────────────────────────── */}
      <HowItWorksSection />

      {/* ─── Why Choose ─────────────────────────────────────── */}
      <WhySection />

      {/* ─── Pricing ─────────────────────────────────────────── */}
      <PricingSection onChoose={onGetStarted} />

      {/* ─── Testimonials ───────────────────────────────────── */}
      <TestimonialsSection />

      {/* ─── FAQ ────────────────────────────────────────────── */}
      <FAQSection />

      {/* ─── CTA ────────────────────────────────────────────── */}
      <CTASection onTrial={onGetStarted} onDemo={onGetStarted} />

      {/* ─── Footer ──────────────────────────────────────────── */}
      <FooterSection onTerms={onTerms} />

      {/* ─── Floating WhatsApp Button ───────────────────────── */}
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={lang === 'ar' ? 'تواصل معانا عبر واتساب' : 'Contact Us on WhatsApp'}
        className="fixed bottom-6 end-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-full shadow-2xl shadow-emerald-600/40 hover:scale-105 active:scale-95 transition-all duration-300 group"
      >
        <WhatsAppIcon size={24} />
        <span className="text-sm font-bold">
          {lang === 'ar' ? 'تواصل معانا' : 'Contact Us'}
        </span>
      </a>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Reveal wrapper component
════════════════════════════════════════════════════════════ */
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out-expo ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Hero Section
════════════════════════════════════════════════════════════ */
function HeroSection({ onTrial, onDemo }: { onTrial: () => void; onDemo: () => void }) {
  const { t, lang } = useLanguage();

  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 start-1/4 h-96 w-96 rounded-full bg-primary-200/40 dark:bg-primary-900/20 blur-3xl" />
        <div className="absolute top-20 end-1/4 h-96 w-96 rounded-full bg-accent-200/40 dark:bg-accent-900/20 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]" style={{
          backgroundImage: 'linear-gradient(#2563eb 1px, transparent 1px), linear-gradient(90deg, #2563eb 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 px-4 py-1.5 text-sm font-semibold text-primary-700 dark:text-primary-300 mb-6">
              <Sparkles size={14} />
              {t('landing.hero.badge')}
            </div>
          </Reveal>

          <Reveal delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-secondary-800 dark:text-white tracking-tight leading-tight">
              {lang === 'ar' ? (
                <>أدر أعمالك بالكامل من <span className="text-primary-600 dark:text-primary-400">منصة واحدة أنيقة</span></>
              ) : (
                <>Run your entire business with <span className="text-primary-600 dark:text-primary-400">one elegant platform</span></>
              )}
            </h1>
          </Reveal>

          <Reveal delay={200}>
            <p className="mt-6 text-lg text-secondary-500 dark:text-secondary-400 leading-relaxed max-w-2xl mx-auto">
              {t('landing.hero.subtitle')}
            </p>
          </Reveal>

          <Reveal delay={300}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" onClick={onTrial} className="w-full sm:w-auto">
                {t('landing.hero.ctaTrial')}
                <ArrowRight size={16} className="rtl:rotate-180" />
              </Button>
              <Button variant="secondary" size="lg" onClick={onDemo} className="w-full sm:w-auto">
                {t('landing.hero.ctaDemo')}
              </Button>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] px-6 py-3 text-base font-bold text-white shadow-md hover:scale-105 active:scale-95 transition-all w-full sm:w-auto"
              >
                <WhatsAppIcon size={18} />
                <span>{lang === 'ar' ? 'تواصل معانا' : 'Contact Us'}</span>
              </a>
            </div>
          </Reveal>

          <Reveal delay={400}>
            <p className="mt-4 text-sm text-secondary-400">{t('landing.hero.noCard')}</p>
          </Reveal>
        </div>

        {/* Hero illustration / dashboard mockup */}
        <Reveal delay={500} className="mt-16">
          <HeroMockup />
        </Reveal>

        {/* Stats */}
        <Reveal delay={600}>
          <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { value: '10K+', label: t('landing.hero.stat1') },
              { value: '500K+', label: t('landing.hero.stat2') },
              { value: '99.9%', label: t('landing.hero.stat3') },
              { value: '25+', label: t('landing.hero.stat4') },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl sm:text-4xl font-bold text-secondary-800 dark:text-white tracking-tight">{s.value}</p>
                <p className="mt-1 text-sm text-secondary-400 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function HeroMockup() {
  const { t } = useLanguage();
  return (
    <div className="relative max-w-5xl mx-auto">
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-primary-500/10 to-accent-500/10 blur-3xl rounded-3xl" />
      <div className="rounded-2xl border border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900 shadow-2xl overflow-hidden">
        {/* Browser bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-danger-400" />
            <div className="h-3 w-3 rounded-full bg-warning-400" />
            <div className="h-3 w-3 rounded-full bg-success-400" />
          </div>
          <div className="flex-1 flex justify-center">
            <div className="px-4 py-1 rounded-lg bg-white dark:bg-secondary-700 text-xs text-secondary-400 font-medium">app.daftrk.com/dashboard</div>
          </div>
        </div>
        {/* Dashboard content */}
        <div className="flex">
          {/* Sidebar */}
          <div className="hidden sm:flex flex-col w-48 border-e border-secondary-200 dark:border-secondary-800 p-3 gap-1">
            <div className="flex items-center gap-2 px-3 py-2 mb-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700" />
              <span className="text-sm font-bold text-secondary-700 dark:text-secondary-200">Daftrk</span>
            </div>
            {[
              { icon: BarChart3, label: t('nav.dashboard'), active: true },
              { icon: Users, label: t('nav.customers') },
              { icon: Package, label: t('nav.products') },
              { icon: FileText, label: t('nav.invoices') },
              { icon: Building2, label: t('nav.settings') },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium ${item.active ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'text-secondary-400'}`}>
                  <Icon size={14} />
                  {item.label}
                </div>
              );
            })}
          </div>
          {/* Main content */}
          <div className="flex-1 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-5 w-32 bg-secondary-200 dark:bg-secondary-700 rounded animate-pulse-soft" />
                <div className="h-3 w-24 bg-secondary-100 dark:bg-secondary-800 rounded mt-2" />
              </div>
              <div className="h-8 w-24 bg-primary-600 rounded-lg" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: CreditCard, color: 'bg-success-50 text-success-600 dark:bg-success-900/20' },
                { icon: FileText, color: 'bg-primary-50 text-primary-600 dark:bg-primary-900/20' },
                { icon: Send, color: 'bg-warning-50 text-warning-600 dark:bg-warning-900/20' },
                { icon: Users, color: 'bg-accent-50 text-accent-600 dark:bg-accent-900/20' },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} className="rounded-xl border border-secondary-200 dark:border-secondary-800 p-3">
                    <div className={`h-8 w-8 rounded-lg ${s.color} flex items-center justify-center mb-2`}>
                      <Icon size={14} />
                    </div>
                    <div className="h-4 w-16 bg-secondary-200 dark:bg-secondary-700 rounded" />
                    <div className="h-2 w-12 bg-secondary-100 dark:bg-secondary-800 rounded mt-1.5" />
                  </div>
                );
              })}
            </div>
            <div className="rounded-xl border border-secondary-200 dark:border-secondary-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-secondary-200 dark:border-secondary-800 bg-secondary-50 dark:bg-secondary-800/50">
                <div className="h-4 w-28 bg-secondary-200 dark:bg-secondary-700 rounded" />
              </div>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-secondary-100 dark:border-secondary-800 last:border-0">
                  <div className="h-8 w-8 rounded-lg bg-secondary-100 dark:bg-secondary-800" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 bg-secondary-200 dark:bg-secondary-700 rounded" />
                    <div className="h-2 w-20 bg-secondary-100 dark:bg-secondary-800 rounded" />
                  </div>
                  <div className="h-5 w-16 bg-success-50 dark:bg-success-900/20 rounded-full" />
                  <div className="h-3 w-16 bg-secondary-200 dark:bg-secondary-700 rounded hidden sm:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Features Section
════════════════════════════════════════════════════════════ */
function FeaturesSection() {
  const { t } = useLanguage();
  const features = [
    { icon: Users, title: t('landing.features.f1Title'), desc: t('landing.features.f1Desc'), color: 'from-primary-500 to-primary-700', bg: 'bg-primary-50 dark:bg-primary-900/20', text: 'text-primary-600 dark:text-primary-400' },
    { icon: Package, title: t('landing.features.f2Title'), desc: t('landing.features.f2Desc'), color: 'from-accent-400 to-accent-600', bg: 'bg-accent-50 dark:bg-accent-900/20', text: 'text-accent-600 dark:text-accent-400' },
    { icon: FileText, title: t('landing.features.f3Title'), desc: t('landing.features.f3Desc'), color: 'from-success-500 to-success-700', bg: 'bg-success-50 dark:bg-success-900/20', text: 'text-success-600 dark:text-success-400' },
    { icon: Globe, title: t('landing.features.f4Title'), desc: t('landing.features.f4Desc'), color: 'from-warning-400 to-warning-600', bg: 'bg-warning-50 dark:bg-warning-900/20', text: 'text-warning-600 dark:text-warning-400' },
    { icon: ShieldCheck, title: t('landing.features.f5Title'), desc: t('landing.features.f5Desc'), color: 'from-danger-400 to-danger-600', bg: 'bg-danger-50 dark:bg-danger-900/20', text: 'text-danger-600 dark:text-danger-400' },
    { icon: MoonIcon, title: t('landing.features.f6Title'), desc: t('landing.features.f6Desc'), color: 'from-secondary-500 to-secondary-700', bg: 'bg-secondary-100 dark:bg-secondary-800', text: 'text-secondary-600 dark:text-secondary-400' },
  ];

  return (
    <section id="features" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-bold px-4 py-1.5 mb-4">
              {t('landing.features.badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary-800 dark:text-white tracking-tight">{t('landing.features.title')}</h2>
            <p className="mt-4 text-lg text-secondary-500 dark:text-secondary-400">{t('landing.features.subtitle')}</p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.title} delay={i * 100}>
                <div className="group h-full rounded-2xl border border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900 p-6 transition-all duration-300 ease-out-expo hover:shadow-card-hover hover:border-secondary-300 dark:hover:border-secondary-700 hover:-translate-y-1">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${f.bg} ${f.text} mb-4 transition-transform duration-300 group-hover:scale-110`}>
                    <Icon size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-secondary-800 dark:text-secondary-100 mb-2">{f.title}</h3>
                  <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   How It Works Section
════════════════════════════════════════════════════════════ */
function HowItWorksSection() {
  const { t } = useLanguage();
  const steps = [
    { icon: Building2, title: t('landing.how.step1Title'), desc: t('landing.how.step1Desc'), color: 'from-primary-500 to-primary-700' },
    { icon: Users, title: t('landing.how.step2Title'), desc: t('landing.how.step2Desc'), color: 'from-accent-400 to-accent-600' },
    { icon: FileText, title: t('landing.how.step3Title'), desc: t('landing.how.step3Desc'), color: 'from-success-500 to-success-700' },
  ];

  return (
    <section id="how" className="py-20 lg:py-28 bg-secondary-50 dark:bg-secondary-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block rounded-full bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 text-sm font-bold px-4 py-1.5 mb-4">
              {t('landing.how.badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary-800 dark:text-white tracking-tight">{t('landing.how.title')}</h2>
            <p className="mt-4 text-lg text-secondary-500 dark:text-secondary-400">{t('landing.how.subtitle')}</p>
          </div>
        </Reveal>

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-12 start-1/6 end-1/6 h-0.5 bg-gradient-to-r from-primary-300 via-accent-300 to-success-300 dark:from-primary-800 dark:via-accent-800 dark:to-success-800" />

          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.title} delay={i * 150}>
                <div className="relative text-center">
                  <div className="relative inline-flex">
                    <div className={`flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} text-white shadow-lg mx-auto`}>
                      <Icon size={32} />
                    </div>
                    <div className="absolute -top-2 -end-2 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-secondary-900 border-2 border-secondary-200 dark:border-secondary-700 text-sm font-bold text-secondary-700 dark:text-secondary-200">
                      {i + 1}
                    </div>
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-secondary-800 dark:text-secondary-100">{step.title}</h3>
                  <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   Why Choose Section
════════════════════════════════════════════════════════════ */
function WhySection() {
  const { t } = useLanguage();
  const reasons = [
    { icon: Sparkles, title: t('landing.why.r1Title'), desc: t('landing.why.r1Desc') },
    { icon: ShieldCheck, title: t('landing.why.r2Title'), desc: t('landing.why.r2Desc') },
    { icon: Globe, title: t('landing.why.r3Title'), desc: t('landing.why.r3Desc') },
    { icon: Zap, title: t('landing.why.r4Title'), desc: t('landing.why.r4Desc') },
  ];

  return (
    <section id="why" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — illustration */}
          <Reveal>
            <div className="relative">
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/20 dark:to-accent-900/20 rounded-3xl blur-2xl" />
              <div className="rounded-3xl border border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900 p-8 shadow-xl">
                {/* Mini dashboard preview */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white">
                        <BookOpen size={16} />
                      </div>
                      <span className="font-bold text-secondary-800 dark:text-white">Daftrk</span>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-success-400" />
                      <div className="h-2 w-2 rounded-full bg-warning-400" />
                      <div className="h-2 w-2 rounded-full bg-danger-400" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Revenue', value: '$12,450', color: 'text-success-600' },
                      { label: 'Invoices', value: '48', color: 'text-primary-600' },
                      { label: 'Customers', value: '127', color: 'text-accent-600' },
                      { label: 'Products', value: '34', color: 'text-warning-600' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-secondary-200 dark:border-secondary-800 p-3">
                        <p className="text-xs text-secondary-400 font-medium">{s.label}</p>
                        <p className={`text-xl font-bold ${s.color} mt-1`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-secondary-200 dark:border-secondary-800 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-semibold text-secondary-700 dark:text-secondary-300">Recent Invoices</p>
                      <span className="badge bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300">
                        <span className="badge-dot bg-success-500" /> Paid
                      </span>
                    </div>
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded bg-secondary-100 dark:bg-secondary-800" />
                          <div className="flex-1 h-2 bg-secondary-100 dark:bg-secondary-800 rounded" />
                          <div className="h-3 w-12 bg-secondary-200 dark:bg-secondary-700 rounded" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Right — content */}
          <div>
            <Reveal>
              <span className="inline-block rounded-full bg-success-50 dark:bg-success-900/30 text-success-600 dark:text-success-400 text-sm font-bold px-4 py-1.5 mb-4">
                {t('landing.why.badge')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-secondary-800 dark:text-white tracking-tight">{t('landing.why.title')}</h2>
              <p className="mt-4 text-lg text-secondary-500 dark:text-secondary-400">{t('landing.why.subtitle')}</p>
            </Reveal>

            <div className="mt-8 space-y-5">
              {reasons.map((r, i) => {
                const Icon = r.icon;
                return (
                  <Reveal key={r.title} delay={i * 100}>
                    <div className="flex gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 shrink-0">
                        <Icon size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-secondary-800 dark:text-secondary-100">{r.title}</h3>
                        <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">{r.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   Pricing Section
════════════════════════════════════════════════════════════ */
function PricingSection({ onChoose }: { onChoose: () => void }) {
  const [yearly, setYearly] = useState(false);
  const { t } = useLanguage();

  const plan = {
    name: t('landing.pricing.pro'),
    desc: t('landing.pricing.proDesc'),
    originalPrice: !yearly ? t('landing.pricing.originalMonthly') : null,
    price: yearly ? t('landing.pricing.proPriceYearly') : t('landing.pricing.proPriceMonthly'),
    period: yearly ? t('landing.pricing.proPeriodYearly') : t('landing.pricing.proPeriodMonthly'),
    features: [
      t('landing.pricing.proF1'),
      t('landing.pricing.proF2'),
      t('landing.pricing.proF3'),
      t('landing.pricing.proF4'),
      t('landing.pricing.proF5'),
      t('landing.pricing.proF6'),
    ],
    cta: t('landing.pricing.choose'),
  };

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-secondary-50 dark:bg-secondary-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="inline-block rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-bold px-4 py-1.5 mb-4">
              {t('landing.pricing.badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary-800 dark:text-white tracking-tight">{t('landing.pricing.title')}</h2>
            <p className="mt-4 text-lg text-secondary-500 dark:text-secondary-400">{t('landing.pricing.subtitle')}</p>
          </div>
        </Reveal>

        {/* Billing toggle */}
        <Reveal delay={100}>
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className={`text-sm font-semibold ${!yearly ? 'text-secondary-800 dark:text-white' : 'text-secondary-400'}`}>{t('landing.pricing.monthly')}</span>
            <button
              onClick={() => setYearly(!yearly)}
              className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${yearly ? 'bg-primary-600' : 'bg-secondary-300 dark:bg-secondary-700'}`}
              aria-label="Toggle billing"
            >
              <span
                className="absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ease-out-expo"
                style={{ transform: yearly ? 'translateX(20px)' : 'translateX(4px)' }}
              />
            </button>
            <span className={`text-sm font-semibold ${yearly ? 'text-secondary-800 dark:text-white' : 'text-secondary-400'}`}>{t('landing.pricing.yearly')}</span>
            <span className="badge bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300 font-bold">{t('landing.pricing.save')}</span>
          </div>
        </Reveal>

        <div className="max-w-xl mx-auto">
          <Reveal delay={150}>
            <div className="relative rounded-3xl border-2 border-primary-500 bg-white dark:bg-secondary-900 p-6 sm:p-8 shadow-2xl ring-4 ring-primary-500/10 transition-all duration-300">
              <div className="absolute -top-4 start-1/2 -translate-x-1/2 rtl:translate-x-1/2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 text-white text-xs font-bold px-4 py-1.5 shadow-primary">
                  <Sparkles size={13} />
                  {t('landing.pricing.popular')}
                </span>
              </div>

              <div className="text-center sm:text-start">
                <h3 className="text-2xl font-black text-secondary-800 dark:text-white">{plan.name}</h3>
                <p className="mt-2 text-sm text-secondary-500 dark:text-secondary-400">{plan.desc}</p>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-secondary-50 dark:bg-secondary-800/60 border border-secondary-200/70 dark:border-secondary-700/50">
                <div className="flex flex-wrap items-baseline gap-2">
                  {plan.originalPrice && (
                    <span className="text-base text-secondary-400 line-through font-medium">
                      {plan.originalPrice}
                    </span>
                  )}
                  <span className="text-4xl sm:text-5xl font-black text-secondary-900 dark:text-white tracking-tight">
                    {plan.price}
                  </span>
                  <span className="text-sm font-semibold text-secondary-500 dark:text-secondary-400">
                    {plan.period}
                  </span>
                </div>
                {yearly ? (
                  <p className="mt-2 text-xs font-bold text-success-600 dark:text-success-400 flex items-center gap-1">
                    <Check size={14} />
                    {t('landing.pricing.save')}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">
                    <span className="line-through">{t('landing.pricing.originalMonthly')}</span> ➔ <span className="font-bold text-primary-600 dark:text-primary-400">{plan.price}</span> {t('landing.pricing.proPeriodMonthly')}
                  </p>
                )}
              </div>

              <Button
                variant="primary"
                size="lg"
                className="w-full mt-6 py-3.5 text-base shadow-primary hover:shadow-primary-hover font-bold"
                onClick={onChoose}
              >
                {plan.cta}
              </Button>

              <div className="mt-8 pt-6 border-t border-secondary-100 dark:border-secondary-800">
                <div className="grid grid-cols-1 gap-3.5">
                  {plan.features.map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success-50 dark:bg-success-900/30 text-success-600 dark:text-success-400 shrink-0 mt-0.5">
                        <Check size={13} strokeWidth={2.5} />
                      </div>
                      <span className="text-sm font-medium text-secondary-700 dark:text-secondary-200">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   Testimonials Section
════════════════════════════════════════════════════════════ */
function TestimonialsSection() {
  const { t } = useLanguage();
  const testimonials = [
    { text: t('landing.testimonials.t1'), name: t('landing.testimonials.t1Name'), role: t('landing.testimonials.t1Role'), initials: 'AH', gradient: 'from-primary-500 to-primary-700' },
    { text: t('landing.testimonials.t2'), name: t('landing.testimonials.t2Name'), role: t('landing.testimonials.t2Role'), initials: 'SM', gradient: 'from-accent-400 to-accent-600' },
    { text: t('landing.testimonials.t3'), name: t('landing.testimonials.t3Name'), role: t('landing.testimonials.t3Role'), initials: 'KR', gradient: 'from-success-500 to-success-700' },
  ];

  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block rounded-full bg-warning-50 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400 text-sm font-bold px-4 py-1.5 mb-4">
              {t('landing.testimonials.badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary-800 dark:text-white tracking-tight">{t('landing.testimonials.title')}</h2>
            <p className="mt-4 text-lg text-secondary-500 dark:text-secondary-400">{t('landing.testimonials.subtitle')}</p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((tm, i) => (
            <Reveal key={tm.name} delay={i * 100}>
              <div className="h-full rounded-2xl border border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900 p-6 transition-all duration-300 hover:shadow-card-hover hover:border-secondary-300 dark:hover:border-secondary-700">
                <Quote size={28} className="text-primary-200 dark:text-primary-800 mb-4" />
                <p className="text-sm text-secondary-600 dark:text-secondary-300 leading-relaxed">{tm.text}</p>
                <div className="mt-6 flex items-center gap-3 pt-5 border-t border-secondary-100 dark:border-secondary-800">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${tm.gradient} text-white font-bold text-sm shrink-0`}>
                    {tm.initials}
                  </div>
                  <div>
                    <p className="font-bold text-secondary-800 dark:text-white text-sm">{tm.name}</p>
                    <p className="text-xs text-secondary-400">{tm.role}</p>
                  </div>
                  <div className="ms-auto flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={13} className="text-warning-400 fill-warning-400" />
                    ))}
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   FAQ Section
════════════════════════════════════════════════════════════ */
function FAQSection() {
  const { t } = useLanguage();
  const faqs = [
    { q: t('landing.faq.q1'), a: t('landing.faq.a1') },
    { q: t('landing.faq.q2'), a: t('landing.faq.a2') },
    { q: t('landing.faq.q3'), a: t('landing.faq.a3') },
    { q: t('landing.faq.q4'), a: t('landing.faq.a4') },
    { q: t('landing.faq.q5'), a: t('landing.faq.a5') },
    { q: t('landing.faq.q6'), a: t('landing.faq.a6') },
  ];
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 lg:py-28 bg-secondary-50 dark:bg-secondary-900/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-14">
            <span className="inline-block rounded-full bg-accent-50 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 text-sm font-bold px-4 py-1.5 mb-4">
              {t('landing.faq.badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-secondary-800 dark:text-white tracking-tight">{t('landing.faq.title')}</h2>
            <p className="mt-4 text-lg text-secondary-500 dark:text-secondary-400">{t('landing.faq.subtitle')}</p>
          </div>
        </Reveal>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <Reveal key={i} delay={i * 50}>
              <div className="rounded-xl border border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-900 overflow-hidden transition-all duration-300">
                <button
                  onClick={() => setOpenIndex(openIndex === i ? null : i)}
                  className="flex items-center justify-between w-full px-5 py-4 text-start"
                >
                  <span className="font-semibold text-secondary-800 dark:text-secondary-100 text-sm">{faq.q}</span>
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-all duration-300 ${openIndex === i ? 'bg-primary-600 text-white rotate-180' : 'bg-secondary-100 dark:bg-secondary-800 text-secondary-500'}`}>
                    {openIndex === i ? <Minus size={14} /> : <Plus size={14} />}
                  </div>
                </button>
                <div className={`grid transition-all duration-300 ease-out-expo ${openIndex === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-4 text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed">{faq.a}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   CTA Section
════════════════════════════════════════════════════════════ */
function CTASection({ onTrial, onDemo }: { onTrial: () => void; onDemo: () => void }) {
  const { t, lang } = useLanguage();
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-secondary-900 px-6 py-16 sm:px-12 sm:py-20 text-center">
            {/* Decorations */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }} />
            <div className="absolute -top-24 -end-24 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />
            <div className="absolute -bottom-24 -start-24 h-72 w-72 rounded-full bg-primary-400/20 blur-3xl" />

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{t('landing.cta.title')}</h2>
              <p className="mt-4 text-lg text-primary-200 max-w-xl mx-auto leading-relaxed">{t('landing.cta.subtitle')}</p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={onTrial}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-bold text-primary-700 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  {t('landing.cta.trial')}
                  <ArrowRight size={16} className="rtl:rotate-180" />
                </button>
                <button
                  onClick={onDemo}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 backdrop-blur border border-white/20 px-6 py-3 text-base font-bold text-white hover:bg-white/20 transition-all duration-200"
                >
                  {t('landing.cta.demo')}
                </button>
                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 py-3 text-base font-bold text-white shadow-lg hover:bg-[#20ba59] hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  <WhatsAppIcon size={20} />
                  <span>{lang === 'ar' ? 'تواصل معانا' : 'Contact Us'}</span>
                </a>
                <a
                  href="https://www.facebook.com/Daftrk.ERP"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-6 py-3 text-base font-bold text-white shadow-lg hover:bg-[#0d65d9] hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  <Facebook size={18} />
                  {lang === 'ar' ? 'تابعنا على فيسبوك' : 'Follow us on Facebook'}
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   Footer Section
════════════════════════════════════════════════════════════ */
function FooterSection({ onTerms }: { onTerms?: () => void }) {
  const { t, lang } = useLanguage();

  const productLinks = [
    { label: t('landing.nav.features'), href: '#features' },
    { label: t('landing.nav.pricing'), href: '#pricing' },
    { label: t('landing.nav.howItWorks'), href: '#how' },
    { label: t('landing.nav.faq'), href: '#faq' },
  ];
  const companyLinks = [
    { label: t('landing.footer.about'), href: '#' },
    { label: t('landing.footer.blog'), href: '#' },
    { label: t('landing.footer.careers'), href: '#' },
    { label: lang === 'ar' ? 'تواصل معانا' : 'Contact Us', href: WHATSAPP_URL, external: true },
  ];
  const legalLinks = [
    { label: t('landing.footer.privacy'), href: '#' },
    {
      label: t('landing.footer.terms'),
      href: '/terms',
      onClick: onTerms ? (e: React.MouseEvent) => { e.preventDefault(); onTerms(); } : undefined,
    },
  ];

  const socials = [
    { icon: WhatsAppIcon, href: WHATSAPP_URL, label: 'WhatsApp', external: true, className: 'text-[#25D366] hover:border-[#25D366]' },
    { icon: Facebook, href: 'https://www.facebook.com/Daftrk.ERP', label: 'Facebook', external: true, className: '' },
    { icon: Twitter, href: '#', label: 'Twitter', external: false, className: '' },
    { icon: Linkedin, href: '#', label: 'LinkedIn', external: false, className: '' },
    { icon: Mail, href: LANDING_CONTACT_MAILTO, label: LANDING_CONTACT_DISPLAY_EMAIL, external: false, className: '' },
  ];

  return (
    <footer className="border-t border-secondary-200 dark:border-secondary-800 bg-white dark:bg-secondary-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-primary">
                <BookOpen size={20} />
              </div>
              <span className="text-lg font-bold text-secondary-800 dark:text-white tracking-tight">{t('app.name')}</span>
            </div>
            <p className="text-sm text-secondary-500 dark:text-secondary-400 leading-relaxed max-w-xs">{t('landing.footer.tagline')}</p>
            <div className="mt-3 flex flex-col gap-2">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <WhatsAppIcon size={16} />
                <span>{lang === 'ar' ? 'تواصل معانا' : 'Contact Us'}</span>
              </a>
              <a
                href={LANDING_CONTACT_MAILTO}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline break-all"
              >
                <Mail size={14} />
                {LANDING_CONTACT_DISPLAY_EMAIL}
              </a>
            </div>
            <div className="mt-5 flex gap-2">
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    {...(s.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border border-secondary-200 dark:border-secondary-800 text-secondary-500 hover:text-primary-600 hover:border-primary-300 dark:hover:text-primary-400 dark:hover:border-primary-700 transition-all duration-200 hover:scale-110 ${s.className || ''}`}
                  >
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-bold text-secondary-800 dark:text-white mb-4">{t('landing.footer.product')}</h4>
            <ul className="space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-secondary-500 dark:text-secondary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-bold text-secondary-800 dark:text-white mb-4">{t('landing.footer.company')}</h4>
            <ul className="space-y-2.5">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="text-sm text-secondary-500 dark:text-secondary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">{link.label}</a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-bold text-secondary-800 dark:text-white mb-4">{t('landing.footer.legal')}</h4>
            <ul className="space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    onClick={link.onClick}
                    className="text-sm text-secondary-500 dark:text-secondary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-2 text-sm text-secondary-400">
              <MapPin size={14} />
              <span>{lang === 'ar' ? 'القاهرة، مصر' : 'Cairo, Egypt'}</span>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-secondary-200 dark:border-secondary-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-secondary-400">{t('landing.footer.copyright')}</p>
          <p className="text-sm text-secondary-400 flex items-center gap-1.5">
            {t('landing.footer.madeWith')}
            <span className="text-danger-500">●</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
