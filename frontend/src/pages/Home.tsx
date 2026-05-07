import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import {
  BookOpen, Bot, Signal, Globe, LogIn, Send, CheckCircle, Loader2,
  ChevronRight, Star, GraduationCap, BarChart3, Brain, Lightbulb,
  TrendingUp, Shield, FileText, Play, Calendar, Newspaper,
  Instagram, Facebook, Phone, ArrowUp, X, MessageCircle, Quote,
  HelpCircle, Menu, KeyRound, type LucideIcon
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import TestimonialProofCard from '@/components/TestimonialProofCard';
import FreeLibrarySection from '@/components/FreeLibrarySection';
import ArticlePreviewCard from '@/components/ArticlePreviewCard';
import PublicMobileNavSheet, { publicMobileNavItemClassName } from '@/components/PublicMobileNavSheet';
import { APP_LOGO, APP_TITLE } from '@/const';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLanguageSwitchLabel } from '@/lib/languageToggle';
import { formatIlsAmount, getPackageDisplayPricing } from '@/lib/packagePricing';
import { trpc } from '@/lib/trpc';
import { DEFAULT_TESTIMONIAL_PROOFS } from '@/lib/defaultTestimonialProofs';

// Stage data with icons and individual prices (display only — to show package value)
const stageData: Array<{ num: number; icon: LucideIcon; color: string; price: number; comingSoon?: boolean }> = [
  { num: 1, icon: BookOpen, color: 'from-emerald-500 to-emerald-600', price: 525 },
  { num: 2, icon: BarChart3, color: 'from-emerald-500 to-emerald-600', price: 1050 },
  { num: 3, icon: TrendingUp, color: 'from-teal-500 to-teal-600', price: 700 },
  { num: 4, icon: Lightbulb, color: 'from-amber-500 to-amber-600', price: 350 },
  { num: 5, icon: Shield, color: 'from-emerald-500 to-emerald-600', price: 175 },
  { num: 6, icon: Signal, color: 'from-cyan-500 to-cyan-600', price: 175 },
  { num: 7, icon: Brain, color: 'from-rose-500 to-rose-600', price: 175 },
  { num: 8, icon: FileText, color: 'from-teal-500 to-teal-600', price: 105 },
];

export default function Home() {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [headerScrolled, setHeaderScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const basicPricing = getPackageDisplayPricing('basic', 20000, 5000);
  const comprehensivePricing = getPackageDisplayPricing('comprehensive', 50000, 10000);

  // Contact support form
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState('');

  const contactMutation = trpc.contactSupport.useMutation();

  // Fetch published events and articles
  const { data: events } = trpc.events.list.useQuery();
  const { data: articles } = trpc.articles.list.useQuery();
  const { data: freeLibrary } = trpc.freeLibrary.list.useQuery();
  const { data: testimonials } = trpc.testimonials.list.useQuery();
  const { data: testimonialProofs } = trpc.testimonials.listProofs.useQuery({ surface: 'home', limit: 4 });
  const featuredArticles = articles?.slice(0, 3) ?? [];

  const homeProofItems = testimonialProofs && testimonialProofs.length > 0
    ? testimonialProofs
    : DEFAULT_TESTIMONIAL_PROOFS.filter((item) => item.showProofOnHome).slice(0, 4);

  const heroStats = [
    {
      value: '5000+',
      label: language === 'ar' ? 'طالب استفادوا من الأكاديمية' : 'students supported across the region',
    },
    {
      value: language === 'ar' ? '+8 سنوات' : '8+ years',
      label: language === 'ar' ? 'خبرة عملية في المجال' : 'of field experience',
    },
    {
      value: '$69,300',
      label: language === 'ar' ? 'صافي أرباح طلابنا من التوصيات' : 'net student profits from signals',
    },
  ];

  const heroTitleClassName = isArabic
    ? 'mx-auto max-w-[17rem] text-[2.65rem] font-extrabold leading-[1.16] md:max-w-[26rem] md:text-[3.25rem] lg:mx-0 lg:max-w-[31rem] lg:text-[3.05rem] xl:text-[3.35rem]'
    : 'mx-auto max-w-[17.5rem] text-[2.65rem] font-extrabold leading-[1.04] tracking-[-0.04em] md:max-w-[28rem] md:text-[3.7rem] lg:mx-0 lg:max-w-[32rem] lg:text-[3.35rem] xl:text-[3.75rem]';

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail.trim() || !contactMessage.trim()) return;
    setContactSending(true);
    setContactError('');
    try {
      await contactMutation.mutateAsync({
        email: contactEmail.trim(),
        message: contactMessage.trim(),
      });
      setContactSent(true);
      setContactEmail('');
      setContactMessage('');
      setTimeout(() => setContactSent(false), 5000);
    } catch (err: any) {
      setContactError(err.message || 'Failed to send');
    } finally {
      setContactSending(false);
    }
  };

  // Scroll to top handler + sticky-blur header state
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setShowScrollTop(y > 600);
      setHeaderScrolled(y > 16);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll-triggered fade-up animation
  useEffect(() => {
    const elements = document.querySelectorAll('.fade-up');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((el) => el.classList.add('visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [events, articles, freeLibrary, testimonials, testimonialProofs]);

  useEffect(() => {
    const scrollToHashSection = () => {
      const sectionId = window.location.hash.replace('#', '');
      if (!sectionId) return;
      window.requestAnimationFrame(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    };

    scrollToHashSection();
    window.addEventListener('hashchange', scrollToHashSection);
    return () => window.removeEventListener('hashchange', scrollToHashSection);
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const eventTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      live: t('home.events.live'),
      competition: t('home.events.competition'),
      discount: t('home.events.discount'),
      webinar: t('home.events.webinar'),
    };
    return map[type] || type;
  };

  const eventTypeColor = (type: string) => {
    const map: Record<string, string> = {
      live: 'bg-red-100 text-red-700',
      competition: 'bg-amber-100 text-amber-700',
      discount: 'bg-green-100 text-green-700',
      webinar: 'bg-emerald-100 text-emerald-700',
    };
    return map[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-[var(--color-xf-cream)]" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ======== NAVIGATION ======== */}
      <header
        className={`sticky top-0 z-[1000] transition-all duration-300 ${headerScrolled ? 'border-b border-slate-200/80 bg-white/95 shadow-[0_8px_30px_rgba(13,23,42,0.08)] backdrop-blur-xl' : 'border-b border-white/65 bg-white/70 shadow-[0_18px_60px_rgba(15,23,42,0.04)] backdrop-blur-2xl'}`}
        style={{ height: '72px' }}
        dir="ltr"
      >
        <div className="container mx-auto flex h-full items-center justify-between gap-3 px-4">
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/90 px-3 py-2 shadow-sm">
            <img
              src={APP_LOGO}
              alt={APP_TITLE}
              className="h-8 w-auto md:h-9"
            />
          </div>

          <nav className="hidden md:flex items-center gap-6 rounded-full border border-slate-200/80 bg-white/80 px-5 py-2 text-sm font-medium shadow-sm">
            <button onClick={() => scrollToSection('packages')} className="nav-link-xf">{t('home.footer.packages')}</button>
            <button onClick={() => scrollToSection('stages')} className="nav-link-xf">{t('home.stages.title')}</button>
            <Link href="/events"><span className="nav-link-xf cursor-pointer">{t('home.events.title')}</span></Link>
            <Link href="/articles"><span className="nav-link-xf cursor-pointer">{t('home.articles.title')}</span></Link>
            <Link href="/free-content"><span className="nav-link-xf cursor-pointer">{t('home.footer.freeContent')}</span></Link>
            <Link href="/faq"><span className="nav-link-xf cursor-pointer">{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link>
            <Link href="/careers"><span className="nav-link-xf cursor-pointer">{language === 'ar' ? 'وظائف' : 'Careers'}</span></Link>
            <button onClick={() => scrollToSection('contact')} className="nav-link-xf">{t('home.footer.contact')}</button>
          </nav>

          <div className="flex min-w-0 items-center gap-1 sm:gap-2 rounded-full border border-slate-200/80 bg-white/80 p-0.5 sm:p-1 shadow-sm">
            {/* WhatsApp in header */}
            <a
              href="https://wa.me/972597596030"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm text-green-600 hover:bg-green-50 transition-all duration-150 font-medium"
            >
              <Phone className="w-4 h-4" />
              <span className="hidden lg:inline">WhatsApp</span>
            </a>
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1.5 text-xs text-gray-500 transition-all duration-150 hover:bg-gray-100/80 hover:text-xf-dark sm:px-3 sm:text-sm"
              aria-label={getLanguageSwitchLabel(language)}
            >
              <Globe className="w-4 h-4" />
              {getLanguageSwitchLabel(language)}
            </button>
            <Link href="/auth">
              <button className="btn-primary-xf inline-flex min-w-[86px] items-center justify-center gap-1.5 px-4 py-2 text-sm sm:min-w-[100px] sm:px-5">
                <LogIn className="w-3.5 h-3.5" />
                {t('home.heroCtaLogin')}
              </button>
            </Link>
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              aria-label={mobileMenuOpen ? (language === 'ar' ? 'إغلاق القائمة' : 'Close menu') : (language === 'ar' ? 'فتح القائمة' : 'Open menu')}
              aria-expanded={mobileMenuOpen}
              className="shrink-0 rounded-xl p-2 text-gray-500 transition-all duration-150 hover:bg-gray-100/80 hover:text-xf-dark md:hidden"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <PublicMobileNavSheet
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          language={language}
          loginLabel={t('home.heroCtaLogin')}
          intro={language === 'ar'
            ? 'تنقل سريع بين الأقسام المهمة مع وصول مباشر للتواصل وتسجيل الدخول.'
            : 'Quick access to the key sections, contact touchpoints, and login.'}
        >
          {[
            { action: () => { scrollToSection('packages'); setMobileMenuOpen(false); }, label: t('home.footer.packages') },
            { action: () => { scrollToSection('stages'); setMobileMenuOpen(false); }, label: t('home.stages.title') },
          ].map((item, i) => (
            <button key={i} type="button" onClick={item.action} className={`${publicMobileNavItemClassName} w-full text-start`}>
              {item.label}
            </button>
          ))}
          <Link href="/events" onClick={() => setMobileMenuOpen(false)}><span className={`${publicMobileNavItemClassName} cursor-pointer`}>{t('home.events.title')}</span></Link>
          <Link href="/articles" onClick={() => setMobileMenuOpen(false)}><span className={`${publicMobileNavItemClassName} cursor-pointer`}>{t('home.articles.title')}</span></Link>
          <Link href="/free-content" onClick={() => setMobileMenuOpen(false)}><span className={`${publicMobileNavItemClassName} cursor-pointer`}>{t('home.footer.freeContent')}</span></Link>
          <Link href="/faq" onClick={() => setMobileMenuOpen(false)}><span className={`${publicMobileNavItemClassName} cursor-pointer`}>{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link>
          <Link href="/careers" onClick={() => setMobileMenuOpen(false)}><span className={`${publicMobileNavItemClassName} cursor-pointer`}>{language === 'ar' ? 'وظائف' : 'Careers'}</span></Link>
          <button type="button" onClick={() => { scrollToSection('contact'); setMobileMenuOpen(false); }} className={`${publicMobileNavItemClassName} w-full text-start`}>{t('home.footer.contact')}</button>
          <Link href="/activate-key" onClick={() => setMobileMenuOpen(false)}><span className={`${publicMobileNavItemClassName} cursor-pointer`}>{language === 'ar' ? 'تفعيل مفتاح' : 'Activate Key'}</span></Link>
        </PublicMobileNavSheet>
      </header>

      {/* ======== HERO SECTION ======== */}
      <section className="relative overflow-hidden border-b border-slate-900/10 text-white" style={{ background: 'linear-gradient(135deg, #07111f 0%, #10203a 44%, #0a5c45 100%)' }}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.08),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_34%)]" />
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '56px 56px' }} />
        <div className="absolute left-[-8rem] top-16 h-72 w-72 rounded-full bg-emerald-400/12 blur-[90px]" />
        <div className="absolute bottom-[-6rem] right-[-4rem] h-80 w-80 rounded-full bg-amber-400/10 blur-[110px]" />

        <div className="relative container mx-auto px-4 py-16 md:py-20 lg:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,0.96fr)_minmax(340px,1.04fr)] lg:gap-12">
            <div className="text-center lg:text-start">
              <Badge className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-center text-sm font-medium leading-6 text-white/95 backdrop-blur-sm">
                <Star className="mr-1.5 h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                {t('home.heroTagline')}
              </Badge>

              <h1 className={heroTitleClassName}>
                <span className="bg-gradient-to-r from-white via-emerald-50 to-white bg-clip-text text-transparent">
                  {t('home.heroTitle')}
                </span>
              </h1>

              <div className="mx-auto mt-5 h-1 w-16 rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 lg:mx-0" />

              <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-emerald-50/78 md:text-lg md:leading-8 lg:mx-0 lg:max-w-[35rem]">
                {t('home.heroSubtext')}
              </p>

              <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center lg:justify-start">
                <button
                  className="btn-pill-xf inline-flex items-center justify-center gap-2 px-10 py-3.5 text-base shadow-lg"
                  style={{ boxShadow: '0 12px 44px rgba(16,185,129,0.24)' }}
                  onClick={() => scrollToSection('services')}
                >
                  {t('home.heroCta')}
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-10 py-3.5 text-base font-medium text-white transition-all duration-300 hover:bg-white/10 sm:w-auto"
                  onClick={() => scrollToSection('student-results')}
                >
                  {t('home.heroCtaFree')}
                </button>
              </div>
            </div>

            <div className="fade-up">
              <div className="relative mx-auto max-w-xl">
                <div className="relative overflow-hidden rounded-[30px] border border-white/15 bg-gradient-to-br from-white/10 to-white/5 p-2 shadow-[0_24px_80px_rgba(7,17,31,0.36)] backdrop-blur-xl">
                  <img
                    src="/hero-trader.png"
                    alt={language === 'ar' ? 'متداول عربي أمام شاشات التداول' : 'Arab trader at workstation with live charts'}
                    className="w-full h-auto rounded-[24px] object-cover"
                    style={isRTL ? { transform: 'scaleX(-1)' } : undefined}
                    loading="eager"
                    decoding="async"
                  />
                  {/* Subtle navy-to-transparent gradient for legibility of overlay badge */}
                  <div className="hero-media-overlay pointer-events-none absolute inset-0 rounded-[24px]" />
                </div>

                <div className="absolute -bottom-5 left-4 hidden rounded-[20px] border border-white/15 bg-white/95 px-4 py-3 shadow-xl md:block">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700/70">
                    {language === 'ar' ? 'دليل ثقة' : 'Trust signal'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {language === 'ar' ? 'نتائج الطلاب قبل الضجيج التسويقي' : 'Student proof before marketing noise'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-3 border-t border-white/10 pt-6 sm:grid-cols-3 lg:mt-12 lg:pt-7">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-[20px] border border-white/10 bg-white/[0.06] px-4 py-4 text-center backdrop-blur-sm lg:text-start">
                <div className="text-xl font-extrabold tracking-tight text-white md:text-2xl">{stat.value}</div>
                <div className="mt-1.5 text-xs font-medium leading-5 text-emerald-50/72 md:text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======== 8 STAGES SECTION ======== */}
      <section id="stages" className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 fade-up">
            <h2 className="text-3xl md:text-4xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent">
              {t('home.stages.title')}
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto mt-6">
              {t('home.stages.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {stageData.map((stage) => {
              const Icon = stage.icon;
              return (
                <div
                  key={stage.num}
                  className={`fade-up group relative glass-card ${stage.comingSoon ? 'border-teal-200 bg-teal-50/30' : ''} p-5`}
                >
                  {stage.comingSoon && (
                    <span className="absolute -top-2.5 ltr:right-3 rtl:left-3 bg-gradient-to-r from-teal-500 to-amber-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                      {language === 'ar' ? 'قريباً' : 'Coming Soon'}
                    </span>
                  )}
                  <div className={`w-12 h-12 rounded-[12px] bg-gradient-to-br ${stage.color} flex items-center justify-center mb-4 ${stage.comingSoon ? 'opacity-60' : ''}`} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                      {language === 'ar' ? `المرحلة ${stage.num}` : `Stage ${stage.num}`}
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-xf-dark mb-1 tracking-[-0.3px]">
                    {t(`home.stage${stage.num}`)}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {t(`home.stage${stage.num}.desc`)}
                  </p>
                  {stage.price > 0 && (
                    <p className="text-sm font-bold text-gray-400 line-through mt-2">
                      ₪{stage.price}
                    </p>
                  )}
                  {!stage.comingSoon && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                      <Play className="w-3 h-3" />
                      <span>
                        {language === 'ar' ? 'فيديو + PDF' : 'Video + PDF'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Individual value vs package deal */}
          <div className="text-center mt-10 space-y-2 fade-up">
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
              <FileText className="w-4 h-4 text-xf-primary" />
              {t('home.stages.everyStage')}
            </p>
            <p className="text-sm text-gray-500">
              <span className="line-through text-gray-400">{language === 'ar' ? 'القيمة الفردية: ₪2550' : 'Individual value: ₪2550'}</span>
              {' '}
              <span className="font-bold text-xf-primary">{language === 'ar' ? 'سعر الباقة الشاملة: ₪1700 فقط!' : 'Comprehensive Package: Only ₪1700!'}</span>
            </p>
          </div>
        </div>
      </section>

      {/* ======== WHY XFLEX ======== */}
      <section id="services" className="py-24" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(16,185,129,0.04))' }}>
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 fade-up">
            <h2 className="text-3xl md:text-4xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent">
              {t('home.why.title')}
            </h2>
            <p className="text-gray-500 text-lg mt-6">{t('home.why.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                icon: <GraduationCap className="w-7 h-7 text-xf-primary" />,
                title: t('home.why.expertCourses'),
                desc: t('home.why.expertDesc'),
                bg: 'bg-emerald-50',
              },
              {
                icon: <Bot className="w-7 h-7 text-amber-600" />,
                title: t('home.why.aiPowered'),
                desc: t('home.why.aiDesc'),
                bg: 'bg-amber-50',
              },
              {
                icon: <Signal className="w-7 h-7 text-xf-accent-dark" />,
                title: t('home.why.liveSignals'),
                desc: t('home.why.liveDesc'),
                bg: 'bg-amber-50',
              },
              {
                icon: <Shield className="w-7 h-7 text-xf-dark" />,
                title: t('home.why.lifetimeAccess'),
                desc: t('home.why.lifetimeDesc'),
                bg: 'bg-slate-50',
              },
              {
                icon: <TrendingUp className="w-7 h-7 text-rose-600" />,
                title: t('home.why.practicalStrategies'),
                desc: t('home.why.practicalDesc'),
                bg: 'bg-rose-50',
              },
              {
                icon: <MessageCircle className="w-7 h-7 text-cyan-600" />,
                title: t('home.why.community'),
                desc: t('home.why.communityDesc'),
                bg: 'bg-cyan-50',
              },
            ].map((item, i) => (
              <div key={i} className="fade-up text-center p-6 rounded-[16px] hover:bg-white/60 transition-all duration-300">
                <div className={`w-14 h-14 ${item.bg} rounded-[12px] flex items-center justify-center mx-auto mb-4`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-extrabold text-xf-dark mb-2 tracking-[-0.3px]">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======== EVENTS SECTION ======== */}
      {events && events.length > 0 && (
        <section id="events" className="py-24 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 fade-up">
              <Link href="/events">
                <h2 className="text-3xl md:text-4xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent cursor-pointer hover:text-xf-primary transition-colors inline-block">
                  {t('home.events.title')}
                </h2>
              </Link>
              <p className="text-gray-500 text-lg mt-6">{t('home.events.subtitle')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {events.slice(0, 3).map((event) => (
                <div key={event.id} className="fade-up glass-card overflow-hidden">
                  {event.imageUrl && (
                    <img src={event.imageUrl} alt={isRTL ? event.titleAr : event.titleEn} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${eventTypeColor(event.eventType)}`}>
                        {eventTypeLabel(event.eventType)}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(event.eventDate).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-xf-dark mb-1 tracking-[-0.3px]">
                      {isRTL ? event.titleAr : event.titleEn}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {isRTL ? event.descriptionAr : event.descriptionEn}
                    </p>
                    {event.linkUrl && (
                      <a href={event.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-xf-primary hover:text-xf-primary-hover mt-3 font-semibold transition-colors">
                        {language === 'ar' ? 'المزيد' : 'Learn More'}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {events.length > 0 && (
              <div className="text-center mt-10 fade-up">
                <Link href="/events">
                  <button className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:text-xf-dark hover:border-xf-dark/20 transition-all duration-150 text-sm font-medium">
                    {language === 'ar' ? 'عرض جميع الفعاليات' : 'View All Events'}
                  </button>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======== ARTICLES SECTION ======== */}
      {featuredArticles.length > 0 && (
        <section id="articles" className="py-24 bg-[var(--color-xf-cream)]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 fade-up">
              <Link href="/articles">
                <h2 className="text-3xl md:text-4xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent cursor-pointer hover:text-xf-primary transition-colors inline-block">
                  {t('home.articles.title')}
                </h2>
              </Link>
              <p className="mx-auto mt-6 max-w-3xl text-gray-500 text-lg">
                {isRTL
                  ? 'ثلاث قراءات افتتاحية مرتبة بوضوح: الموضوع أولاً، ثم الفكرة، ثم زر مباشر لفتح المقال بالكامل من دون دفن المحتوى داخل ملف واحد.'
                  : 'Three editorial reads with a cleaner structure: subject first, point of view second, and a direct path into the full article instead of hiding everything inside one file.'}
              </p>
            </div>

            <div className="mx-auto max-w-6xl">
              {featuredArticles.length === 1 ? (
                <div className="fade-up max-w-3xl mx-auto">
                  <ArticlePreviewCard article={featuredArticles[0]} isRtl={isRTL} variant="feature" />
                </div>
              ) : (
                <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="fade-up">
                    <ArticlePreviewCard article={featuredArticles[0]} isRtl={isRTL} variant="feature" />
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
                    {featuredArticles.slice(1).map((article) => (
                      <div key={article.id} className="fade-up">
                        <ArticlePreviewCard article={article} isRtl={isRTL} variant="compact" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {featuredArticles.length > 0 && (
              <div className="text-center mt-10 fade-up">
                <Link href="/articles">
                  <button className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:text-xf-dark hover:border-xf-dark/20 transition-all duration-150 text-sm font-medium">
                    {language === 'ar' ? 'عرض جميع المقالات' : 'View All Articles'}
                  </button>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======== FREE CONTENT SECTION ======== */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12 fade-up">
            <h2 className="text-3xl md:text-4xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent">
              {t('home.free.title')}
            </h2>
            <p className="text-gray-500 text-lg mt-6">
              {t('home.free.subtitle')}
            </p>
          </div>

          {freeLibrary ? (
            <div className="fade-up max-w-6xl mx-auto">
              <div className="mb-8 rounded-[20px] border border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/70 p-5 md:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
                      {language === 'ar' ? 'جديد في المحتوى المفتوح' : 'New In Open Content'}
                    </p>
                    <h3 className="mt-2 text-2xl font-extrabold tracking-[-0.4px] text-xf-dark">
                      {language === 'ar' ? 'مكتبة مجانية مرتبة: فيديوهات مركزة + مقالات كاملة' : 'A structured free library: focused videos + full articles'}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-gray-600 md:text-base">
                      {language === 'ar'
                        ? 'أضفنا المواد المجانية الجديدة داخل تجربة أوضح: شاهد الفيديو مباشرة، ثم انتقل إلى المقالات المنفصلة لقراءة الفكرة كاملة موضوعاً بموضوع.'
                        : 'The new free material now lives in a cleaner experience: watch the video directly, then move into standalone articles so each idea has its own full read.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/free-content">
                      <button className="btn-primary-xf px-6 py-3 text-sm font-semibold">
                        {language === 'ar' ? 'افتح المكتبة المجانية' : 'Open Free Library'}
                      </button>
                    </Link>
                    <Link href="/articles">
                      <button className="rounded-full border border-amber-200 px-6 py-3 text-sm font-semibold text-amber-700 transition-all duration-150 hover:bg-amber-50">
                        {language === 'ar' ? 'اذهب إلى المقالات' : 'Browse Articles'}
                      </button>
                    </Link>
                  </div>
                </div>
              </div>

              <FreeLibrarySection data={freeLibrary} isRtl={isRTL} mode="home" />
            </div>
          ) : null}

          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto mt-10">
            <div className="fade-up rounded-[16px] p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))' }}>
              <BookOpen className="w-10 h-10 text-xf-primary mx-auto mb-4" />
              <h3 className="text-lg font-extrabold text-xf-dark mb-2 tracking-[-0.3px]">{t('home.free.courses')}</h3>
              <p className="text-sm text-gray-600 mb-5">{t('home.free.coursesDesc')}</p>
              <Link href="/free-content">
                <button className="px-6 py-2.5 rounded-full border border-xf-primary/30 text-xf-primary hover:bg-xf-primary hover:text-white transition-all duration-200 text-sm font-semibold">
                  {t('home.free.browseCourses')}
                </button>
              </Link>
            </div>
            <div className="fade-up rounded-[16px] p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))' }}>
              <Newspaper className="w-10 h-10 text-xf-accent-dark mx-auto mb-4" />
              <h3 className="text-lg font-extrabold text-xf-dark mb-2 tracking-[-0.3px]">{t('home.free.articles')}</h3>
              <p className="text-sm text-gray-600 mb-5">{t('home.free.articlesDesc')}</p>
              <Link href="/articles">
                <button className="px-6 py-2.5 rounded-full border border-xf-accent/30 text-xf-accent-dark hover:bg-xf-accent hover:text-white transition-all duration-200 text-sm font-semibold">
                  {t('home.free.browseArticles')}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {homeProofItems.length > 0 && (
        <section
          id="student-results"
          className="py-24"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,1), rgba(250,247,242,0.78))' }}
        >
          <div className="container mx-auto px-4">
            <div className="text-center mb-14 fade-up">
              <div className="mb-4 flex justify-center">
                <Badge variant="outline" className="border-emerald-200 bg-white/90 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  {language === 'ar' ? 'أدلة حقيقية' : 'Real Proof'}
                </Badge>
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent">
                {language === 'ar' ? 'لقطات حقيقية من الطلاب' : 'Real Student Screenshots'}
              </h2>
              <p className="text-gray-500 text-lg mt-6 max-w-3xl mx-auto">
                {language === 'ar'
                  ? 'أربع لقطات مختارة بعناية من محادثات حقيقية توضح أسلوب الشرح والمتابعة والدعم الذي يصفه طلابنا داخل الأكاديمية.'
                  : 'Four carefully selected snapshots from real student conversations that show the teaching style, follow-up, and support students keep describing.'}
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4 max-w-7xl mx-auto">
              {homeProofItems.map((item) => (
                <div key={item.id} className="fade-up">
                  <TestimonialProofCard item={item} isRTL={isRTL} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ======== TESTIMONIALS SECTION ======== */}
      {testimonials && testimonials.length > 0 && (
        <section className="relative overflow-hidden py-24 bg-[linear-gradient(180deg,rgba(250,247,242,0.84),rgba(255,255,255,1))]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.08),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.08),transparent_28%)]" />
          <div className="relative container mx-auto px-4" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
              <div className="fade-up lg:sticky lg:top-28">
                <Badge variant="outline" className="border-emerald-200 bg-white/90 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                  {language === 'ar' ? 'أصوات من الداخل' : 'Inside Voices'}
                </Badge>
                <h2 className="mt-5 text-3xl font-extrabold tracking-[-0.5px] text-xf-dark md:text-4xl">
                  {language === 'ar' ? 'ماذا يقول طلابنا بعد التجربة الفعلية' : 'What Students Say After the Real Experience'}
                </h2>
                <p className="mt-6 text-lg leading-8 text-gray-600">
                  {language === 'ar'
                    ? 'هنا لا نعتمد على وعود عامة. هذه رسائل وانطباعات من طلاب يصفون أسلوب الشرح، المتابعة، والدعم كما عاشوه فعلاً.'
                    : 'This is not generic marketing language. These are student reactions describing the teaching style, follow-up, and support as they actually experienced it.'}
                </p>
                <div className="mt-8 space-y-3">
                  {[
                    language === 'ar' ? 'التركيز على وضوح الشرح لا على الإبهار الزائد.' : 'Clarity of explanation over visual hype.',
                    language === 'ar' ? 'المتابعة تظهر كجزء أساسي من التجربة لا كإضافة جانبية.' : 'Follow-up shows up as a core part of the experience, not an afterthought.',
                    language === 'ar' ? 'التقييم هنا مبني على تجربة طلاب دخلوا المسار فعلاً.' : 'The feedback comes from students who actually went through the path.',
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-[20px] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.05)] backdrop-blur-sm">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-xf-primary" />
                      <p className="text-sm leading-6 text-gray-600">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {testimonials.slice(0, 6).map((t) => (
                  <div key={t.id} className="fade-up flex h-full flex-col rounded-[26px] border border-white/80 bg-white/95 p-6 shadow-[0_18px_40px_rgba(15,23,42,0.07)] backdrop-blur-sm">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-4 w-4 ${n <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                        ))}
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        {language === 'ar' ? 'تجربة طالب' : 'Student Voice'}
                      </span>
                    </div>
                    <Quote className="mb-4 h-8 w-8 text-xf-primary/12" />
                    <p className="flex-1 text-sm leading-7 text-gray-700">
                      "{isRTL ? t.textAr : t.textEn}"
                    </p>
                    <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                      {t.avatarUrl ? (
                        <img src={t.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-xf-primary">
                          {(isRTL ? t.nameAr : t.nameEn).charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-xf-dark">{isRTL ? t.nameAr : t.nameEn}</p>
                        <p className="text-xs text-gray-500">
                          {(isRTL ? t.titleAr : t.titleEn) || (language === 'ar' ? 'طالب في الأكاديمية' : 'Academy student')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ======== PACKAGES SECTION ======== */}
      <section id="packages" className="relative overflow-hidden py-24 bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.07),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.09),transparent_24%)]" />
        <div className="relative container mx-auto px-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="mx-auto mb-10 max-w-5xl fade-up">
            <div className="rounded-[30px] border border-slate-200 bg-[var(--color-xf-cream)] p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-8">
              <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="text-center lg:text-start">
                  <h2 className="text-3xl font-extrabold tracking-[-0.5px] text-xf-dark md:text-4xl">
                    {t('home.packages.title')}
                  </h2>
                  <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600 lg:mx-0">
                    {t('home.packages.subtitle')}
                  </p>
                </div>
                <div className="rounded-[24px] border border-emerald-200 bg-white px-5 py-4 text-center shadow-sm lg:max-w-xs lg:text-start">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    {language === 'ar' ? 'معلومة سريعة' : 'Quick Note'}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {language === 'ar'
                      ? 'كل الأسعار هنا بالشيكل، والمسار التعليمي دائم، بينما التجديد الشهري يخص الخدمات الزمنية حسب الباقة.'
                      : 'All prices here are in ILS. The course path is permanent, while monthly renewal applies to the timed services in each package.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
            {/* Basic Package */}
            <div className="fade-up flex flex-col rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_18px_44px_rgba(15,23,42,0.06)]">
              <div className="text-center mb-6">
                <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">
                  {language === 'ar' ? 'للانطلاقة الواضحة' : 'For a clear start'}
                </span>
                <h3 className="text-2xl font-extrabold text-xf-dark mb-1 tracking-[-0.5px]">{t('home.packages.basic')}</h3>
                <div className="flex items-end justify-center gap-2 mt-3">
                  <span className="text-5xl font-extrabold text-xf-dark">{formatIlsAmount(basicPricing.ilsPrice)}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{t('home.packages.price')} • {t('home.packages.lifetime')}</p>
                <p className="text-xs text-xf-primary mt-1 font-medium">
                  {t('home.packages.renewal')}: {formatIlsAmount(basicPricing.ilsRenewal ?? 0)}{t('home.packages.perMonth')}
                </p>
              </div>

              <div className="mb-6 rounded-[22px] bg-emerald-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  {language === 'ar' ? 'مناسب إذا كنت تريد' : 'Best if you want'}
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {language === 'ar'
                    ? 'مساراً تعليمياً مرتباً مع التوصيات والدعم، من دون إضافة LexAI في البداية.'
                    : 'A structured learning path with recommendations and support, without adding LexAI at the start.'}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-6 flex-1">
                <p className="text-sm font-bold text-gray-700 mb-4">{t('home.packages.includes')}:</p>
                <ul className="space-y-3">
                  {[
                    t('home.packages.courses'),
                    t('home.packages.pdf'),
                    t('home.packages.introVideos'),
                    t('home.packages.support'),
                    t('home.packages.recommendations'),
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-xf-primary mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                  <li className="flex items-start gap-2.5 text-sm text-gray-400">
                    <X className="w-4 h-4 text-gray-300 mt-0.5 flex-shrink-0" />
                    {t('home.packages.lexai')}
                  </li>
                </ul>
              </div>

              <Link href="/packages/basic">
                <button className="w-full mt-6 py-3.5 rounded-full bg-xf-dark text-white font-semibold hover:bg-xf-dark-lighter transition-all duration-150 text-sm">
                  {t('home.packages.choosePlan')}
                </button>
              </Link>
            </div>

            {/* Comprehensive Package */}
            <div className="fade-up relative flex flex-col rounded-[30px] border border-emerald-400/40 px-8 pb-8 pt-12 text-white" style={{ background: 'linear-gradient(135deg, var(--color-xf-primary), #0f766e)' , boxShadow: '0 20px 60px rgba(var(--color-xf-primary-rgb), 0.2)' }}>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                <Badge className="bg-yellow-400 text-yellow-900 font-bold px-4 py-1 rounded-full shadow-lg text-xs">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  {t('home.packages.mostPopular')}
                </Badge>
              </div>

              <div className="text-center mb-6 mt-2">
                <h3 className="text-2xl font-extrabold mb-1 tracking-[-0.5px]">{t('home.packages.comprehensive')}</h3>
                <div className="flex items-end justify-center gap-2 mt-3">
                  <span className="text-5xl font-extrabold">{formatIlsAmount(comprehensivePricing.ilsPrice)}</span>
                </div>
                <p className="text-sm text-emerald-100 mt-1">{t('home.packages.price')} • {t('home.packages.lifetime')}</p>
                <p className="text-xs text-emerald-200 mt-1">
                  {t('home.packages.renewal')}: {formatIlsAmount(comprehensivePricing.ilsRenewal ?? 0)}{t('home.packages.perMonth')}
                </p>
              </div>

              <div className="mb-6 rounded-[22px] border border-white/14 bg-white/10 px-4 py-4 backdrop-blur-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/80">
                  {language === 'ar' ? 'مناسب إذا كنت تريد' : 'Best if you want'}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/88">
                  {language === 'ar'
                    ? 'كل ما في الباقة الأساسية مع LexAI للقراءة والتحليل كجزء من التجربة الكاملة.'
                    : 'Everything in Basic plus LexAI for reading and analysis as part of the full package experience.'}
                </p>
              </div>

              <div className="border-t border-white/20 pt-6 flex-1">
                <p className="text-sm font-bold text-emerald-100 mb-4">{t('home.packages.includes')}:</p>
                <ul className="space-y-3">
                  {[
                    t('home.packages.courses'),
                    t('home.packages.pdf'),
                    t('home.packages.introVideos'),
                    t('home.packages.support'),
                    t('home.packages.recommendations'),
                    t('home.packages.lexai'),
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-200 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Link href="/packages/comprehensive">
                <button className="w-full mt-6 py-3.5 rounded-full bg-white text-xf-primary-hover font-bold hover:bg-emerald-50 transition-all duration-150 text-sm">
                  {t('home.packages.choosePlan')}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======== ABOUT SECTION ======== */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-3xl text-center fade-up">
          <h2 className="text-3xl md:text-4xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent">
            {t('home.about.title')}
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-6 mt-6">
            {t('home.about.text')}
          </p>
          <Link href="/about">
            <button className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:text-xf-dark hover:border-xf-dark/20 transition-all duration-150 text-sm font-medium inline-flex items-center gap-1">
              {t('home.about.learnMore')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </section>

      {/* ======== CAREERS CTA SECTION ======== */}
      <section id="careers" className="py-20" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(245,158,11,0.06))' }}>
        <div className="container mx-auto px-4 text-center fade-up">
          <h2 className="text-3xl font-extrabold text-xf-dark tracking-[-0.5px] mb-3">
            {language === 'ar' ? 'انضم لفريق الأكاديمية' : 'Join XFlex Academy Team'}
          </h2>
          <p className="text-gray-600 mb-8 max-w-lg mx-auto">
            {language === 'ar' ? 'نبحث عن أشخاص موهوبين وشغوفين للانضمام لفريقنا المتنامي. اطلع على الوظائف المتاحة وقدم طلبك الآن!' : 'We are looking for talented people to join our growing team. View open positions and apply now!'}
          </p>
          <Link href="/careers">
            <button className="btn-pill-xf px-10 py-3.5 text-base inline-flex items-center gap-2 shadow-lg">
              {language === 'ar' ? 'الوظائف المتاحة' : 'View Open Positions'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </section>

      {/* ======== CONTACT SECTION ======== */}
      <section id="contact" className="py-24 bg-[var(--color-xf-cream)]">
        <div className="container mx-auto px-4 max-w-6xl" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="fade-up relative overflow-hidden rounded-[30px] bg-[#07111f] p-8 text-white shadow-[0_24px_70px_rgba(7,17,31,0.22)] md:p-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.16),transparent_30%)]" />
              <div className="relative">
                <Badge className="border border-white/15 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                  {language === 'ar' ? 'تواصل واضح ومباشر' : 'Clear, direct contact'}
                </Badge>
                <h2 className="mt-5 text-3xl font-extrabold tracking-[-0.5px] md:text-4xl">
                  {t('home.contact.title')}
                </h2>
                <p className="mt-5 text-base leading-8 text-white/78 md:text-lg">
                  {t('home.contact.subtitle')}
                </p>

                <div className="mt-8 space-y-3">
                  {[
                    {
                      icon: HelpCircle,
                      title: language === 'ar' ? 'استفسارات قبل الاشتراك' : 'Pre-enrollment questions',
                      description: language === 'ar' ? 'إذا كنت متردداً بين الباقات أو تريد فهم المسار الأنسب لك.' : 'If you are deciding between packages or want the right learning path for your case.',
                    },
                    {
                      icon: KeyRound,
                      title: language === 'ar' ? 'مساعدة في التفعيل' : 'Activation help',
                      description: language === 'ar' ? 'نوجّهك إذا كان لديك سؤال عن المفاتيح أو الوصول إلى الباقة.' : 'We can guide you if you have a question about keys or package access.',
                    },
                    {
                      icon: Phone,
                      title: language === 'ar' ? 'تواصل أسرع عند الحاجة' : 'A faster path when needed',
                      description: language === 'ar' ? 'يمكنك التحول مباشرة إلى واتساب إذا كان سؤالك يحتاج رداً أسرع.' : 'You can switch to WhatsApp directly if the question needs a quicker back-and-forth.',
                    },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.title} className="rounded-[22px] border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-200">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white md:text-base">{item.title}</h3>
                            <p className="mt-1 text-sm leading-6 text-white/72">{item.description}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <a
                    href="https://wa.me/972597596030"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-green-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-600"
                  >
                    <Phone className="h-4 w-4" />
                    {t('home.whatsapp')}
                  </a>
                  <Link href="/faq">
                    <button className="rounded-full border border-white/18 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                      {language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}
                    </button>
                  </Link>
                </div>
              </div>
            </div>

            <div className="fade-up rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_20px_52px_rgba(15,23,42,0.08)] md:p-8">
              <div className="mb-8 text-center lg:text-start">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                  {language === 'ar' ? 'راسلنا عبر البريد' : 'Message us by email'}
                </p>
                <p className="mt-3 text-sm leading-6 text-gray-500 md:text-base">
                  {language === 'ar'
                    ? 'اكتب سؤالك بوضوح وسنعود إليك عبر البريد الإلكتروني الذي تدخله هنا.'
                    : 'Write your question clearly and we will reply to the email address you enter here.'}
                </p>
              </div>

              {contactSent ? (
                <div className="flex flex-col items-center gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50/70 py-10 text-xf-primary">
                  <CheckCircle className="h-10 w-10" />
                  <p className="font-semibold">{t('home.contact.sent')}</p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-5 text-start">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      {t('home.contact.email')}
                    </label>
                    <Input
                      type="email"
                      dir="ltr"
                      placeholder={t('home.contact.emailPlaceholder')}
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                      className="h-12 rounded-[14px] border-slate-200 focus:border-xf-primary focus:ring-xf-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                      {t('home.contact.message')}
                    </label>
                    <textarea
                      className="min-h-[160px] w-full resize-y rounded-[14px] border border-slate-200 bg-background px-3 py-3 text-sm ring-offset-background transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xf-primary focus-visible:ring-offset-2"
                      placeholder={t('home.contact.messagePlaceholder')}
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      required
                    />
                  </div>
                  {contactError && (
                    <p className="text-sm text-red-600">{contactError}</p>
                  )}
                  <button type="submit" className="btn-primary-xf inline-flex w-full items-center justify-center gap-2 py-3.5 text-sm" disabled={contactSending}>
                    {contactSending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />{t('home.contact.sending')}</>
                    ) : (
                      <><Send className="h-4 w-4" />{t('home.contact.send')}</>
                    )}
                  </button>
                </form>
              )}

              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm leading-6 text-gray-500">
                    {language === 'ar'
                      ? 'إذا كنت تفضّل رسالة مباشرة وسريعة، استخدم واتساب بدلاً من النموذج.'
                      : 'If you prefer a faster direct message, use WhatsApp instead of the form.'}
                  </p>
                  <a
                    href="https://wa.me/972597596030"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-green-200 px-5 py-2.5 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                  >
                    <Phone className="h-4 w-4" />
                    {t('home.whatsapp')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======== FOOTER ======== */}
      <footer className="relative overflow-hidden bg-[#07111f] py-16 text-slate-300">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_25%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.1),transparent_30%)]" />
        <div className="relative container mx-auto px-4">
          <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-[1.2fr_0.85fr_0.95fr]">
            {/* Brand */}
            <div>
              <div className="mb-4 inline-flex rounded-[24px] bg-white px-4 py-3 shadow-[0_12px_32px_rgba(7,17,31,0.18)]">
                <img
                  src={APP_LOGO}
                  alt={APP_TITLE}
                  className="h-11 w-auto"
                />
              </div>
              <p className="max-w-md text-sm leading-7 text-slate-300/75">
                {t('home.footer.tagline')}
              </p>
              <p className="mt-4 max-w-md text-sm leading-7 text-emerald-100/65">
                {language === 'ar'
                  ? 'منصة تعليمية تركز على الوضوح، التدرج، والدعم الحقيقي حتى يشعر الطالب أن هناك من يسير معه فعلاً.'
                  : 'A learning platform built around clarity, progression, and support that feels genuinely present.'}
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">{t('home.footer.quickLinks')}</h4>
              <ul className="space-y-2.5 text-sm">
                <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="transition-colors duration-150 hover:text-white">{t('home.footer.home')}</button></li>
                <li><button onClick={() => scrollToSection('services')} className="transition-colors duration-150 hover:text-white">{language === 'ar' ? 'خدماتنا' : 'Our Services'}</button></li>
                <li><button onClick={() => scrollToSection('packages')} className="transition-colors duration-150 hover:text-white">{t('home.footer.packages')}</button></li>
                <li><button onClick={() => scrollToSection('student-results')} className="transition-colors duration-150 hover:text-white">{language === 'ar' ? 'نتائج الطلاب' : 'Student Results'}</button></li>
                <li><Link href="/faq"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link></li>
                <li><Link href="/careers"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{language === 'ar' ? 'وظائف' : 'Careers'}</span></Link></li>
                <li><Link href="/auth"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{t('home.heroCtaLogin')}</span></Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">{language === 'ar' ? 'تواصل واكتشف المزيد' : 'Connect and explore more'}</h4>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => scrollToSection('contact')}
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  {language === 'ar' ? 'أرسل لنا استفسارك' : 'Send us your question'}
                </button>
                <a
                  href="https://wa.me/972597596030"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-green-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-600"
                >
                  <Phone className="h-4 w-4" />
                  WhatsApp
                </a>
              </div>
              <div className="mt-5 flex gap-3">
                <a href="https://www.instagram.com/xflex.academy?igsh=NG9jZng1emlxM3I3" target="_blank" rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/8 transition-all duration-150 hover:bg-pink-600">
                  <Instagram className="h-4 w-4 text-slate-300" />
                </a>
                <a href="https://www.facebook.com/share/1Aj9HNNwsv/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/8 transition-all duration-150 hover:bg-emerald-600">
                  <Facebook className="h-4 w-4 text-slate-300" />
                </a>
                <a href="https://t.me/+cXq1JGThuZkxNGI0" target="_blank" rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/8 transition-all duration-150 hover:bg-sky-500">
                  <Send className="h-4 w-4 text-slate-300" />
                </a>
                <a href="https://wa.me/972597596030" target="_blank" rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/8 transition-all duration-150 hover:bg-green-600">
                  <Phone className="h-4 w-4 text-slate-300" />
                </a>
              </div>
              <div className="mt-5 space-y-2 text-sm text-slate-300/68">
                <Link href="/terms"><span className="block cursor-pointer transition-colors duration-150 hover:text-white">{language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}</span></Link>
                <Link href="/refund-policy"><span className="block cursor-pointer transition-colors duration-150 hover:text-white">{language === 'ar' ? 'سياسة الاسترجاع' : 'Refund Policy'}</span></Link>
                <Link href="/privacy"><span className="block cursor-pointer transition-colors duration-150 hover:text-white">{language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}</span></Link>
              </div>
            </div>
          </div>

          <div className="pt-6 text-center text-xs text-slate-400/60">
            &copy; {new Date().getFullYear()} XFlex Trading Academy. {t('home.footer.rights')}
          </div>
        </div>
      </footer>

      {/* ======== SCROLL TO TOP BUTTON ======== */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 end-6 w-10 h-10 rounded-full bg-xf-primary text-white hover:bg-xf-primary-hover transition-all duration-150 flex items-center justify-center z-50"
          style={{ boxShadow: '0 4px 20px rgba(16,185,129,0.3)' }}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
