import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import {
  BookOpen, Bot, Signal, Globe, LogIn, Send, CheckCircle, Loader2,
  ChevronRight, Star, GraduationCap, BarChart3, Brain, Lightbulb,
  TrendingUp, Shield, FileText, Play, Calendar, Newspaper,
  Instagram, Facebook, Phone, ArrowUp, X, MessageCircle, Quote,
  HelpCircle, Menu, KeyRound
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

// Stage data with icons and individual prices (display only — to show package value)
const stageData = [
  { num: 1, icon: BookOpen, color: 'from-blue-500 to-blue-600', price: 150 },
  { num: 2, icon: BarChart3, color: 'from-indigo-500 to-indigo-600', price: 300 },
  { num: 3, icon: TrendingUp, color: 'from-violet-500 to-violet-600', price: 200 },
  { num: 4, icon: Lightbulb, color: 'from-amber-500 to-amber-600', price: 100 },
  { num: 5, icon: Shield, color: 'from-emerald-500 to-emerald-600', price: 50 },
  { num: 6, icon: Signal, color: 'from-cyan-500 to-cyan-600', price: 50 },
  { num: 7, icon: Brain, color: 'from-rose-500 to-rose-600', price: 50 },
  { num: 8, icon: FileText, color: 'from-teal-500 to-teal-600', price: 30 },
];

export default function Home() {
  const { t, language, setLanguage, isRTL } = useLanguage();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const { data: testimonials } = trpc.testimonials.list.useQuery();

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

  // Scroll to top handler
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 600);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll-triggered fade-up animation
  useEffect(() => {
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
    const elements = document.querySelectorAll('.fade-up');
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [events, articles, testimonials]);

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
      webinar: 'bg-blue-100 text-blue-700',
    };
    return map[type] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="min-h-screen bg-[var(--color-xf-cream)]" dir="ltr">
      {/* ======== NAVIGATION ======== */}
      <header className="glass sticky top-0 z-[1000]" style={{ height: '72px' }} dir="ltr">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-extrabold tracking-tight text-xf-dark">
              XFlex
            </span>
            <span className="text-sm text-gray-500 hidden sm:inline font-medium">Trading Academy</span>
          </div>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            <button onClick={() => scrollToSection('packages')} className="nav-link-xf">{t('home.footer.packages')}</button>
            <button onClick={() => scrollToSection('stages')} className="nav-link-xf">{t('home.stages.title')}</button>
            <Link href="/events"><span className="nav-link-xf cursor-pointer">{t('home.events.title')}</span></Link>
            <Link href="/articles"><span className="nav-link-xf cursor-pointer">{t('home.articles.title')}</span></Link>
            <Link href="/free-content"><span className="nav-link-xf cursor-pointer">{t('home.footer.freeContent')}</span></Link>
            <Link href="/faq"><span className="nav-link-xf cursor-pointer">{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link>
            <Link href="/careers"><span className="nav-link-xf cursor-pointer">{language === 'ar' ? 'وظائف' : 'Careers'}</span></Link>
            <button onClick={() => scrollToSection('contact')} className="nav-link-xf">{t('home.footer.contact')}</button>
          </nav>

          <div className="flex items-center gap-2">
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
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-gray-500 hover:text-xf-dark hover:bg-gray-100/80 transition-all duration-150"
            >
              <Globe className="w-4 h-4" />
              {language === 'ar' ? 'EN' : 'عربي'}
            </button>
            <Link href="/auth">
              <button className="btn-primary-xf text-sm px-5 py-2 inline-flex items-center justify-center gap-1.5 min-w-[100px]">
                <LogIn className="w-3.5 h-3.5" />
                {t('home.heroCtaLogin')}
              </button>
            </Link>
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-gray-500 hover:text-xf-dark hover:bg-gray-100/80 transition-all duration-150"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100/50 px-4 py-3 flex flex-col gap-1 text-sm font-medium"
            style={{ height: 'calc(100dvh - 60px)', overflowY: 'auto' }}>
            {[
              { action: () => { scrollToSection('packages'); setMobileMenuOpen(false); }, label: t('home.footer.packages') },
              { action: () => { scrollToSection('stages'); setMobileMenuOpen(false); }, label: t('home.stages.title') },
            ].map((item, i) => (
              <button key={i} onClick={item.action} className="text-start py-3.5 px-4 rounded-xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all text-[1.05rem]">
                {item.label}
              </button>
            ))}
            <Link href="/events" onClick={() => setMobileMenuOpen(false)}><span className="block py-3.5 px-4 rounded-xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all cursor-pointer text-[1.05rem]">{t('home.events.title')}</span></Link>
            <Link href="/articles" onClick={() => setMobileMenuOpen(false)}><span className="block py-3.5 px-4 rounded-xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all cursor-pointer text-[1.05rem]">{t('home.articles.title')}</span></Link>
            <Link href="/free-content" onClick={() => setMobileMenuOpen(false)}><span className="block py-3.5 px-4 rounded-xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all cursor-pointer text-[1.05rem]">{t('home.footer.freeContent')}</span></Link>
            <Link href="/faq" onClick={() => setMobileMenuOpen(false)}><span className="block py-3.5 px-4 rounded-xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all cursor-pointer text-[1.05rem]">{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link>
            <Link href="/careers" onClick={() => setMobileMenuOpen(false)}><span className="block py-3.5 px-4 rounded-xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all cursor-pointer text-[1.05rem]">{language === 'ar' ? 'وظائف' : 'Careers'}</span></Link>
            <button onClick={() => { scrollToSection('contact'); setMobileMenuOpen(false); }} className="text-start py-3.5 px-4 rounded-xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all text-[1.05rem]">{t('home.footer.contact')}</button>
            <Link href="/activate-key" onClick={() => setMobileMenuOpen(false)}><span className="block py-3.5 px-4 rounded-xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all cursor-pointer text-[1.05rem]">{language === 'ar' ? 'تفعيل مفتاح' : 'Activate Key'}</span></Link>
            {/* Bottom actions */}
            <div className="mt-auto pt-4 pb-2 border-t border-gray-100 flex flex-col gap-2">
              <a
                href="https://wa.me/972597596030"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 text-center text-[1.05rem] inline-flex items-center justify-center gap-2 rounded-full bg-green-500 text-white font-semibold hover:bg-green-600 transition-all"
              >
                <Phone className="w-4 h-4" />
                WhatsApp
              </a>
              <Link href="/auth">
                <button className="btn-primary-xf w-full py-3 text-center text-[1.05rem] inline-flex items-center justify-center gap-2">
                  <LogIn className="w-4 h-4" />
                  {t('home.heroCtaLogin')}
                </button>
              </Link>
            </div>
          </nav>
        )}
      </header>

      {/* ======== HERO SECTION ======== */}
      <section className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1a2744 50%, #064e3b 100%)' }}>
        {/* Decorative radial gradients */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 80%, rgba(16,185,129,0.15), transparent), radial-gradient(ellipse 60% 50% at 80% 20%, rgba(245,158,11,0.1), transparent)' }} />
        <div className="absolute top-20 left-10 w-80 h-80 bg-emerald-500/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/8 rounded-full blur-[100px]" />

        <div className="relative container mx-auto px-4 py-24 md:py-36 text-center">
          <div className="max-w-4xl mx-auto">
            <Badge className="mb-6 bg-white/10 text-white border-white/20 px-4 py-1.5 text-sm font-medium rounded-full backdrop-blur-sm">
              <Star className="w-3.5 h-3.5 mr-1.5 fill-yellow-400 text-yellow-400" />
              XFlex Trading Academy
            </Badge>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-2 leading-tight tracking-[-0.5px]">
              <span className="bg-gradient-to-r from-white via-emerald-100 to-white bg-clip-text text-transparent">
                {t('home.heroTagline')}
              </span>
            </h1>
            {/* Accent bar under heading */}
            <div className="flex justify-center mb-8">
              <div className="w-[60px] h-1 rounded-full" style={{ background: 'linear-gradient(to right, #f59e0b, #10b981)' }} />
            </div>

            <p className="text-lg md:text-xl text-emerald-100/70 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              {t('home.heroSubtext')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                className="btn-pill-xf text-base px-10 py-3.5 inline-flex items-center justify-center gap-2 shadow-lg"
                style={{ boxShadow: '0 10px 40px rgba(16,185,129,0.25)' }}
                onClick={() => scrollToSection('packages')}
              >
                {t('home.heroCta')}
                <ChevronRight className="w-4 h-4" />
              </button>
              <Link href="/free-content">
                <button className="w-full sm:w-auto px-10 py-3.5 rounded-full border border-white/20 text-white hover:bg-white/10 transition-all duration-300 text-base font-medium inline-flex items-center justify-center gap-2">
                  {t('home.heroCtaFree')}
                </button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-20 grid grid-cols-3 gap-8 max-w-md mx-auto">
              {[
                { value: '8', label: language === 'ar' ? 'مراحل تعليمية' : 'Learning Stages' },
                { value: '40+', label: language === 'ar' ? 'فيديو تعليمي' : 'Video Lessons' },
                { value: 'PDF', label: language === 'ar' ? 'لكل مرحلة' : 'Per Stage' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{stat.value}</div>
                  <div className="text-xs md:text-sm text-emerald-200/50 mt-1 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ======== PACKAGES SECTION ======== */}
      <section id="packages" className="py-24 bg-[var(--color-xf-cream)]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16 fade-up">
            <h2 className="text-3xl md:text-4xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent">
              {t('home.packages.title')}
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto mt-6">
              {t('home.packages.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Basic Package */}
            <div className="fade-up glass-card p-8 flex flex-col">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-extrabold text-xf-dark mb-1 tracking-[-0.5px]">{t('home.packages.basic')}</h3>
                <div className="flex items-baseline justify-center gap-1 mt-3">
                  <span className="text-5xl font-extrabold text-xf-dark">$200</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{t('home.packages.price')} • {t('home.packages.lifetime')}</p>
                <p className="text-xs text-xf-primary mt-1 font-medium">
                  {t('home.packages.renewal')}: $50{t('home.packages.perMonth')}
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
            <div className="fade-up relative rounded-[16px] pt-12 pb-8 px-8 flex flex-col text-white" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' ,boxShadow: '0 20px 60px rgba(16,185,129,0.2)' }}>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
                <Badge className="bg-yellow-400 text-yellow-900 font-bold px-4 py-1 rounded-full shadow-lg text-xs">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  {t('home.packages.mostPopular')}
                </Badge>
              </div>

              <div className="text-center mb-6 mt-2">
                <h3 className="text-2xl font-extrabold mb-1 tracking-[-0.5px]">{t('home.packages.comprehensive')}</h3>
                <div className="flex items-baseline justify-center gap-1 mt-3">
                  <span className="text-5xl font-extrabold">$500</span>
                </div>
                <p className="text-sm text-emerald-100 mt-1">{t('home.packages.price')} • {t('home.packages.lifetime')}</p>
                <p className="text-xs text-emerald-200 mt-1">
                  {t('home.packages.renewal')}: $100{t('home.packages.perMonth')}
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
                  className={`fade-up group relative glass-card ${stage.comingSoon ? 'border-violet-200 bg-violet-50/30' : ''} p-5`}
                >
                  {stage.comingSoon && (
                    <span className="absolute -top-2.5 ltr:right-3 rtl:left-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
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
                      ${stage.price}
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
              <span className="line-through text-gray-400">{language === 'ar' ? 'القيمة الفردية: $730' : 'Individual value: $730'}</span>
              {' '}
              <span className="font-bold text-xf-primary">{language === 'ar' ? 'سعر الباقة الشاملة: $500 فقط!' : 'Comprehensive Package: Only $500!'}</span>
            </p>
          </div>
        </div>
      </section>

      {/* ======== WHY XFLEX ======== */}
      <section className="py-24" style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.04), rgba(16,185,129,0.04))' }}>
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
                icon: <Bot className="w-7 h-7 text-purple-600" />,
                title: t('home.why.aiPowered'),
                desc: t('home.why.aiDesc'),
                bg: 'bg-purple-50',
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
      {articles && articles.length > 0 && (
        <section id="articles" className="py-24 bg-[var(--color-xf-cream)]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 fade-up">
              <Link href="/articles">
                <h2 className="text-3xl md:text-4xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent cursor-pointer hover:text-xf-primary transition-colors inline-block">
                  {t('home.articles.title')}
                </h2>
              </Link>
              <p className="text-gray-500 text-lg mt-6">{t('home.articles.subtitle')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {articles.slice(0, 3).map((article) => (
                <div key={article.id} className="fade-up glass-card overflow-hidden">
                  {article.thumbnailUrl && (
                    <img src={article.thumbnailUrl} alt={isRTL ? article.titleAr : article.titleEn} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Newspaper className="w-3.5 h-3.5 text-gray-400" />
                      {article.publishedAt && (
                        <span className="text-xs text-gray-400">
                          {new Date(article.publishedAt).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-xf-dark mb-2 tracking-[-0.3px]">
                      {isRTL ? article.titleAr : article.titleEn}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {isRTL ? (article.excerptAr || '') : (article.excerptEn || '')}
                    </p>
                    <Link href={`/articles/${article.slug}`}>
                      <span className="inline-flex items-center gap-1 text-sm text-xf-primary hover:text-xf-primary-hover mt-3 font-semibold cursor-pointer transition-colors">
                        {t('home.articles.readMore')}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {articles.length > 0 && (
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

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
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

      {/* ======== TESTIMONIALS SECTION ======== */}
      {testimonials && testimonials.length > 0 && (
        <section className="py-24 bg-[var(--color-xf-cream)]">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16 fade-up">
              <h2 className="text-3xl md:text-4xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent">
                {language === 'ar' ? 'ماذا يقول طلابنا' : 'What Our Students Say'}
              </h2>
              <p className="text-gray-500 text-lg mt-6">
                {language === 'ar' ? 'آراء حقيقية من متداولين استفادوا من الأكاديمية' : 'Real feedback from traders who benefited from the academy'}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {testimonials.slice(0, 6).map((t) => (
                <div key={t.id} className="fade-up glass-card p-6 relative">
                  <Quote className="w-8 h-8 text-xf-primary/10 absolute top-4 end-4" />
                  <div className="flex gap-0.5 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-4 h-4 ${n <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    "{isRTL ? t.textAr : t.textEn}"
                  </p>
                  <div className="flex items-center gap-3 border-t border-gray-100 pt-3">
                    {t.avatarUrl ? (
                      <img src={t.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-xf-primary font-bold text-xs">
                        {(isRTL ? t.nameAr : t.nameEn).charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-xf-dark">{isRTL ? t.nameAr : t.nameEn}</p>
                      {(t.titleAr || t.titleEn) && (
                        <p className="text-xs text-gray-500">{isRTL ? t.titleAr : t.titleEn}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

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
      <section id="contact" className="py-24 bg-white">
        <div className="container mx-auto px-4 max-w-lg">
          <div className="text-center mb-10 fade-up">
            <h2 className="text-3xl font-extrabold text-xf-dark tracking-[-0.5px] heading-accent">
              {t('home.contact.title')}
            </h2>
            <p className="text-gray-500 mt-4">{t('home.contact.subtitle')}</p>
          </div>

          {contactSent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-xf-primary fade-up">
              <CheckCircle className="w-10 h-10" />
              <p className="font-semibold">{t('home.contact.sent')}</p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4 text-start fade-up">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {t('home.contact.email')}
                </label>
                <Input
                  type="email"
                  dir="ltr"
                  placeholder={t('home.contact.emailPlaceholder')}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                  className="rounded-[10px] border-gray-200 focus:border-xf-primary focus:ring-xf-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  {t('home.contact.message')}
                </label>
                <textarea
                  className="flex w-full rounded-[10px] border border-gray-200 bg-background px-3 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xf-primary focus-visible:ring-offset-2 min-h-[120px] resize-y transition-all"
                  placeholder={t('home.contact.messagePlaceholder')}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  required
                />
              </div>
              {contactError && (
                <p className="text-sm text-red-600">{contactError}</p>
              )}
              <button type="submit" className="btn-primary-xf w-full py-3.5 text-sm inline-flex items-center justify-center gap-2" disabled={contactSending}>
                {contactSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{t('home.contact.sending')}</>
                ) : (
                  <><Send className="w-4 h-4" />{t('home.contact.send')}</>
                )}
              </button>
            </form>
          )}

          {/* WhatsApp CTA */}
          <div className="mt-8 text-center fade-up">
            <a
              href="https://wa.me/972597596030"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-green-500 text-white hover:bg-green-600 transition-all duration-150 font-medium text-sm"
              style={{ boxShadow: '0 4px 20px rgba(34,197,94,0.25)' }}
            >
              <Phone className="w-4 h-4" />
              {t('home.whatsapp')}
            </a>
          </div>
        </div>
      </section>

      {/* ======== FOOTER ======== */}
      <footer className="bg-xf-dark text-gray-400 py-14">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl font-extrabold text-white tracking-tight">XFlex</span>
                <span className="text-sm text-gray-500 font-medium">Trading Academy</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                {t('home.footer.tagline')}
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4">{t('home.footer.quickLinks')}</h4>
              <ul className="space-y-2.5 text-sm">
                <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-white transition-colors duration-150">{t('home.footer.home')}</button></li>
                <li><button onClick={() => scrollToSection('packages')} className="hover:text-white transition-colors duration-150">{t('home.footer.packages')}</button></li>
                <li><Link href="/contact"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'تواصل معنا' : 'Contact Us'}</span></Link></li>
                <li><Link href="/faq"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link></li>
                <li><Link href="/free-content"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{t('home.footer.freeContent')}</span></Link></li>
                <li><Link href="/activate-key"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'تفعيل مفتاح' : 'Activate Key'}</span></Link></li>
                <li><Link href="/careers"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'وظائف' : 'Careers'}</span></Link></li>
                <li><Link href="/terms"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}</span></Link></li>
                <li><Link href="/refund-policy"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'سياسة الاسترجاع' : 'Refund Policy'}</span></Link></li>
                <li><Link href="/privacy"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}</span></Link></li>
                <li><Link href="/auth"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{t('home.heroCtaLogin')}</span></Link></li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4">{t('home.footer.socialFollow')}</h4>
              <div className="flex gap-3">
                <a href="https://www.instagram.com/xflex.academy?igsh=NG9jZng1emlxM3I3" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-[10px] bg-white/8 hover:bg-pink-600 flex items-center justify-center transition-all duration-150">
                  <Instagram className="w-4 h-4 text-gray-400" />
                </a>
                <a href="https://www.facebook.com/share/1Aj9HNNwsv/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-[10px] bg-white/8 hover:bg-blue-600 flex items-center justify-center transition-all duration-150">
                  <Facebook className="w-4 h-4 text-gray-400" />
                </a>
                <a href="https://t.me/+cXq1JGThuZkxNGI0" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-[10px] bg-white/8 hover:bg-sky-500 flex items-center justify-center transition-all duration-150">
                  <Send className="w-4 h-4 text-gray-400" />
                </a>
                <a href="https://wa.me/972597596030" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-[10px] bg-white/8 hover:bg-green-600 flex items-center justify-center transition-all duration-150">
                  <Phone className="w-4 h-4 text-gray-400" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t pt-6 text-center text-xs text-gray-600" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
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
