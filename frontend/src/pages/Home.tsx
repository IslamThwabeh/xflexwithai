import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import {
  BookOpen, Bot, Signal, Globe, LogIn, Send, CheckCircle, Loader2,
  ChevronRight, Star, GraduationCap, BarChart3, Brain, Lightbulb,
  TrendingUp, Shield, FileText, Play, Calendar, Newspaper,
  Instagram, Facebook, Phone, ArrowUp, X, MessageCircle, Quote,
  HelpCircle, Menu, KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

// Stage data with icons and individual prices (display only — to show package value)
const stageData = [
  { num: 1, icon: BookOpen, color: 'from-blue-500 to-blue-600', price: 150 },
  { num: 2, icon: BarChart3, color: 'from-indigo-500 to-indigo-600', price: 300 },
  { num: 3, icon: TrendingUp, color: 'from-violet-500 to-violet-600', price: 0, comingSoon: true },
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
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ======== NAVIGATION ======== */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              XFlex
            </span>
            <span className="text-sm text-gray-500 hidden sm:inline">Trading Academy</span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
            <button onClick={() => scrollToSection('packages')} className="hover:text-blue-600 transition">{t('home.footer.packages')}</button>
            <button onClick={() => scrollToSection('stages')} className="hover:text-blue-600 transition">{t('home.stages.title')}</button>
            <button onClick={() => scrollToSection('events')} className="hover:text-blue-600 transition">{t('home.events.title')}</button>
            <button onClick={() => scrollToSection('articles')} className="hover:text-blue-600 transition">{t('home.articles.title')}</button>
            <Link href="/free-content"><span className="hover:text-blue-600 transition cursor-pointer">{t('home.footer.freeContent')}</span></Link>
            <Link href="/faq"><span className="hover:text-blue-600 transition cursor-pointer">{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link>
            <button onClick={() => scrollToSection('contact')} className="hover:text-blue-600 transition">{t('home.footer.contact')}</button>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
            >
              <Globe className="w-4 h-4" />
              {language === 'ar' ? 'EN' : 'عربي'}
            </button>
            <Link href="/auth">
              <Button size="sm" variant="outline" className="gap-1.5 text-sm">
                <LogIn className="w-3.5 h-3.5" />
                {t('home.heroCtaLogin')}
              </Button>
            </Link>
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-2 text-sm font-medium text-gray-600">
            <button onClick={() => { scrollToSection('packages'); setMobileMenuOpen(false); }} className="text-start hover:text-blue-600 transition py-1.5">{t('home.footer.packages')}</button>
            <button onClick={() => { scrollToSection('stages'); setMobileMenuOpen(false); }} className="text-start hover:text-blue-600 transition py-1.5">{t('home.stages.title')}</button>
            <button onClick={() => { scrollToSection('events'); setMobileMenuOpen(false); }} className="text-start hover:text-blue-600 transition py-1.5">{t('home.events.title')}</button>
            <button onClick={() => { scrollToSection('articles'); setMobileMenuOpen(false); }} className="text-start hover:text-blue-600 transition py-1.5">{t('home.articles.title')}</button>
            <Link href="/free-content" onClick={() => setMobileMenuOpen(false)}><span className="block hover:text-blue-600 transition py-1.5 cursor-pointer">{t('home.footer.freeContent')}</span></Link>
            <Link href="/faq" onClick={() => setMobileMenuOpen(false)}><span className="block hover:text-blue-600 transition py-1.5 cursor-pointer">{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link>
            <button onClick={() => { scrollToSection('contact'); setMobileMenuOpen(false); }} className="text-start hover:text-blue-600 transition py-1.5">{t('home.footer.contact')}</button>
            <Link href="/activate-key" onClick={() => setMobileMenuOpen(false)}><span className="block hover:text-blue-600 transition py-1.5 cursor-pointer">{language === 'ar' ? 'تفعيل مفتاح' : 'Activate Key'}</span></Link>
          </nav>
        )}
      </header>

      {/* ======== HERO SECTION ======== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzEuNjU3IDAgMy0xLjM0MyAzLTNzLTEuMzQzLTMtMy0zLTMgMS4zNDMtMyAzIDEuMzQzIDMgMyAzem0wIDBjMS42NTcgMCAzLTEuMzQzIDMtM3MtMS4zNDMtMy0zLTMtMyAxLjM0My0zIDMgMS4zNDMgMyAzIDN6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="relative container mx-auto px-4 py-20 md:py-32 text-center">
          <div className="max-w-4xl mx-auto">
            <Badge className="mb-6 bg-white/10 text-white border-white/20 px-4 py-1.5 text-sm font-medium">
              <Star className="w-3.5 h-3.5 mr-1.5 fill-yellow-400 text-yellow-400" />
              XFlex Trading Academy
            </Badge>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
                {t('home.heroTagline')}
              </span>
            </h1>

            <p className="text-lg md:text-xl text-blue-100/80 max-w-2xl mx-auto mb-8 leading-relaxed">
              {t('home.heroSubtext')}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/25 text-base px-8"
                onClick={() => scrollToSection('packages')}
              >
                {t('home.heroCta')}
                <ChevronRight className="w-4 h-4 ms-1" />
              </Button>
              <Link href="/free-content">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10 text-base px-8 w-full sm:w-auto"
                >
                  {t('home.heroCtaFree')}
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto">
              <div>
                <div className="text-2xl md:text-3xl font-bold text-white">8</div>
                <div className="text-xs md:text-sm text-blue-200/60">{language === 'ar' ? 'مراحل تعليمية' : 'Learning Stages'}</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-white">40+</div>
                <div className="text-xs md:text-sm text-blue-200/60">{language === 'ar' ? 'فيديو تعليمي' : 'Video Lessons'}</div>
              </div>
              <div>
                <div className="text-2xl md:text-3xl font-bold text-white">PDF</div>
                <div className="text-xs md:text-sm text-blue-200/60">{language === 'ar' ? 'لكل مرحلة' : 'Per Stage'}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======== PACKAGES SECTION ======== */}
      <section id="packages" className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {t('home.packages.title')}
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              {t('home.packages.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Basic Package */}
            <div className="relative bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-200 p-8 flex flex-col hover:shadow-xl transition-shadow">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-1">{t('home.packages.basic')}</h3>
                <div className="flex items-baseline justify-center gap-1 mt-3">
                  <span className="text-5xl font-extrabold text-gray-900">$200</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{t('home.packages.price')} • {t('home.packages.lifetime')}</p>
                <p className="text-xs text-blue-600 mt-1">
                  {t('home.packages.renewal')}: $50{t('home.packages.perMonth')}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-6 flex-1">
                <p className="text-sm font-semibold text-gray-700 mb-4">{t('home.packages.includes')}:</p>
                <ul className="space-y-3">
                  {[
                    t('home.packages.courses'),
                    t('home.packages.pdf'),
                    t('home.packages.introVideos'),
                    t('home.packages.support'),
                    t('home.packages.recommendations'),
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
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
                <Button
                  size="lg"
                  className="w-full mt-6 bg-gray-900 hover:bg-gray-800 text-white"
                >
                  {t('home.packages.choosePlan')}
                </Button>
              </Link>
            </div>

            {/* Comprehensive Package */}
            <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-xl shadow-blue-500/20 p-8 flex flex-col text-white">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-yellow-400 text-yellow-900 font-bold px-3 py-0.5">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  {t('home.packages.mostPopular')}
                </Badge>
              </div>

              <div className="text-center mb-6 mt-2">
                <h3 className="text-2xl font-bold mb-1">{t('home.packages.comprehensive')}</h3>
                <div className="flex items-baseline justify-center gap-1 mt-3">
                  <span className="text-5xl font-extrabold">$500</span>
                </div>
                <p className="text-sm text-blue-100 mt-1">{t('home.packages.price')} • {t('home.packages.lifetime')}</p>
                <p className="text-xs text-blue-200 mt-1">
                  {t('home.packages.renewal')}: $100{t('home.packages.perMonth')}
                </p>
              </div>

              <div className="border-t border-white/20 pt-6 flex-1">
                <p className="text-sm font-semibold text-blue-100 mb-4">{t('home.packages.includes')}:</p>
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
                      <CheckCircle className="w-4 h-4 text-green-300 mt-0.5 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Link href="/packages/comprehensive">
                <Button
                  size="lg"
                  className="w-full mt-6 bg-white text-blue-700 hover:bg-blue-50 font-bold"
                >
                  {t('home.packages.choosePlan')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======== 8 STAGES SECTION ======== */}
      <section id="stages" className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {t('home.stages.title')}
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              {t('home.stages.subtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {stageData.map((stage) => {
              const Icon = stage.icon;
              return (
                <div
                  key={stage.num}
                  className={`group relative bg-white rounded-xl border ${stage.comingSoon ? 'border-violet-200 bg-violet-50/30' : 'border-gray-200'} p-5 hover:shadow-lg hover:border-blue-200 transition-all`}
                >
                  {stage.comingSoon && (
                    <span className="absolute -top-2.5 ltr:right-3 rtl:left-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                      {language === 'ar' ? 'قريباً' : 'Coming Soon'}
                    </span>
                  )}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stage.color} flex items-center justify-center mb-4 shadow-sm ${stage.comingSoon ? 'opacity-60' : ''}`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400 uppercase">
                      {language === 'ar' ? `المرحلة ${stage.num}` : `Stage ${stage.num}`}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">
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
          <div className="text-center mt-8 space-y-2">
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              {t('home.stages.everyStage')}
            </p>
            <p className="text-sm text-gray-500">
              <span className="line-through text-gray-400">{language === 'ar' ? 'القيمة الفردية: $730' : 'Individual value: $730'}</span>
              {' '}
              <span className="font-bold text-green-600">{language === 'ar' ? 'سعر الباقة الشاملة: $500 فقط!' : 'Comprehensive Package: Only $500!'}</span>
            </p>
          </div>
        </div>
      </section>

      {/* ======== WHY XFLEX ======== */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {t('home.why.title')}
            </h2>
            <p className="text-gray-500 text-lg">{t('home.why.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                icon: <GraduationCap className="w-7 h-7 text-blue-600" />,
                title: t('home.why.expertCourses'),
                desc: t('home.why.expertDesc'),
                bg: 'bg-blue-50',
              },
              {
                icon: <Bot className="w-7 h-7 text-purple-600" />,
                title: t('home.why.aiPowered'),
                desc: t('home.why.aiDesc'),
                bg: 'bg-purple-50',
              },
              {
                icon: <Signal className="w-7 h-7 text-emerald-600" />,
                title: t('home.why.liveSignals'),
                desc: t('home.why.liveDesc'),
                bg: 'bg-emerald-50',
              },
              {
                icon: <Shield className="w-7 h-7 text-amber-600" />,
                title: t('home.why.lifetimeAccess'),
                desc: t('home.why.lifetimeDesc'),
                bg: 'bg-amber-50',
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
              <div key={i} className="text-center p-6">
                <div className={`w-14 h-14 ${item.bg} rounded-xl flex items-center justify-center mx-auto mb-4`}>
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======== EVENTS SECTION ======== */}
      {events && events.length > 0 && (
        <section id="events" className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                {t('home.events.title')}
              </h2>
              <p className="text-gray-500 text-lg">{t('home.events.subtitle')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {events.slice(0, 3).map((event) => (
                <div key={event.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                  {event.imageUrl && (
                    <img src={event.imageUrl} alt={isRTL ? event.titleAr : event.titleEn} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${eventTypeColor(event.eventType)}`}>
                        {eventTypeLabel(event.eventType)}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(event.eventDate).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <h3 className="font-bold text-gray-900 mb-1">
                      {isRTL ? event.titleAr : event.titleEn}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {isRTL ? event.descriptionAr : event.descriptionEn}
                    </p>
                    {event.linkUrl && (
                      <a href={event.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-3 font-medium">
                        {language === 'ar' ? 'المزيد' : 'Learn More'}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {events.length > 3 && (
              <div className="text-center mt-8">
                <Link href="/events">
                  <Button variant="outline">{language === 'ar' ? 'عرض جميع الفعاليات' : 'View All Events'}</Button>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======== ARTICLES SECTION ======== */}
      {articles && articles.length > 0 && (
        <section id="articles" className="py-20 bg-gray-50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                {t('home.articles.title')}
              </h2>
              <p className="text-gray-500 text-lg">{t('home.articles.subtitle')}</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {articles.slice(0, 3).map((article) => (
                <div key={article.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                  {article.thumbnailUrl && (
                    <img src={article.thumbnailUrl} alt={isRTL ? article.titleAr : article.titleEn} className="w-full h-40 object-cover" />
                  )}
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Newspaper className="w-3.5 h-3.5 text-gray-400" />
                      {article.publishedAt && (
                        <span className="text-xs text-gray-400">
                          {new Date(article.publishedAt).toLocaleDateString(language === 'ar' ? 'ar-SA' : 'en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-gray-900 mb-2">
                      {isRTL ? article.titleAr : article.titleEn}
                    </h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {isRTL ? (article.excerptAr || '') : (article.excerptEn || '')}
                    </p>
                    <Link href={`/articles/${article.slug}`}>
                      <span className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 mt-3 font-medium cursor-pointer">
                        {t('home.articles.readMore')}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {articles.length > 3 && (
              <div className="text-center mt-8">
                <Link href="/articles">
                  <Button variant="outline">{language === 'ar' ? 'عرض جميع المقالات' : 'View All Articles'}</Button>
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ======== FREE CONTENT SECTION ======== */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {t('home.free.title')}
            </h2>
            <p className="text-gray-500 text-lg">
              {t('home.free.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            <div className="bg-blue-50 rounded-2xl p-8 text-center">
              <BookOpen className="w-10 h-10 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('home.free.courses')}</h3>
              <p className="text-sm text-gray-600 mb-4">{t('home.free.coursesDesc')}</p>
              <Link href="/free-content">
                <Button variant="outline" size="sm" className="border-blue-200 text-blue-600 hover:bg-blue-100">
                  {t('home.free.browseCourses')}
                </Button>
              </Link>
            </div>
            <div className="bg-indigo-50 rounded-2xl p-8 text-center">
              <Newspaper className="w-10 h-10 text-indigo-600 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('home.free.articles')}</h3>
              <p className="text-sm text-gray-600 mb-4">{t('home.free.articlesDesc')}</p>
              <Link href="/articles">
                <Button variant="outline" size="sm" className="border-indigo-200 text-indigo-600 hover:bg-indigo-100">
                  {t('home.free.browseArticles')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ======== TESTIMONIALS SECTION ======== */}
      {testimonials && testimonials.length > 0 && (
        <section className="py-20 bg-white">
          <div className="container mx-auto px-4">
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                {language === 'ar' ? 'ماذا يقول طلابنا' : 'What Our Students Say'}
              </h2>
              <p className="text-gray-500 text-lg">
                {language === 'ar' ? 'آراء حقيقية من متداولين استفادوا من الأكاديمية' : 'Real feedback from traders who benefited from the academy'}
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {testimonials.slice(0, 6).map((t) => (
                <div key={t.id} className="bg-gray-50 rounded-2xl p-6 relative">
                  <Quote className="w-8 h-8 text-blue-100 absolute top-4 end-4" />
                  <div className="flex gap-0.5 mb-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-4 h-4 ${n <= t.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed mb-4">
                    "{isRTL ? t.textAr : t.textEn}"
                  </p>
                  <div className="flex items-center gap-3 border-t border-gray-200 pt-3">
                    {t.avatarUrl ? (
                      <img src={t.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                        {(isRTL ? t.nameAr : t.nameEn).charAt(0)}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{isRTL ? t.nameAr : t.nameEn}</p>
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
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {t('home.about.title')}
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed mb-6">
            {t('home.about.text')}
          </p>
          <Link href="/about">
            <Button variant="outline" size="sm">
              {t('home.about.learnMore')}
              <ChevronRight className="w-4 h-4 ms-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* ======== CONTACT SECTION ======== */}
      <section id="contact" className="py-20 bg-white border-t border-gray-100">
        <div className="container mx-auto px-4 max-w-lg">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {t('home.contact.title')}
            </h2>
            <p className="text-gray-500">{t('home.contact.subtitle')}</p>
          </div>

          {contactSent ? (
            <div className="flex flex-col items-center gap-3 py-6 text-green-600">
              <CheckCircle className="w-10 h-10" />
              <p className="font-medium">{t('home.contact.sent')}</p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4 text-start">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('home.contact.email')}
                </label>
                <Input
                  type="email"
                  dir="ltr"
                  placeholder={t('home.contact.emailPlaceholder')}
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('home.contact.message')}
                </label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[120px] resize-y"
                  placeholder={t('home.contact.messagePlaceholder')}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  required
                />
              </div>
              {contactError && (
                <p className="text-sm text-red-600">{contactError}</p>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={contactSending}>
                {contactSending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{t('home.contact.sending')}</>
                ) : (
                  <><Send className="w-4 h-4" />{t('home.contact.send')}</>
                )}
              </Button>
            </form>
          )}

          {/* WhatsApp CTA */}
          <div className="mt-8 text-center">
            <a
              href="https://wa.me/972597596030"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-green-500 text-white hover:bg-green-600 transition font-medium text-sm shadow-sm"
            >
              <Phone className="w-4 h-4" />
              {t('home.whatsapp')}
            </a>
          </div>
        </div>
      </section>

      {/* ======== FOOTER ======== */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl font-extrabold text-white">XFlex</span>
                <span className="text-sm text-gray-500">Trading Academy</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                {t('home.footer.tagline')}
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">{t('home.footer.quickLinks')}</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-white transition">{t('home.footer.home')}</button></li>
                <li><button onClick={() => scrollToSection('packages')} className="hover:text-white transition">{t('home.footer.packages')}</button></li>
                <li><Link href="/contact"><span className="hover:text-white transition cursor-pointer">{language === 'ar' ? 'تواصل معنا' : 'Contact Us'}</span></Link></li>
                <li><Link href="/faq"><span className="hover:text-white transition cursor-pointer">{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link></li>
                <li><Link href="/free-content"><span className="hover:text-white transition cursor-pointer">{t('home.footer.freeContent')}</span></Link></li>
                <li><Link href="/activate-key"><span className="hover:text-white transition cursor-pointer">{language === 'ar' ? 'تفعيل مفتاح' : 'Activate Key'}</span></Link></li>
                <li><Link href="/terms"><span className="hover:text-white transition cursor-pointer">{language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}</span></Link></li>
                <li><Link href="/refund-policy"><span className="hover:text-white transition cursor-pointer">{language === 'ar' ? 'سياسة الاسترجاع' : 'Refund Policy'}</span></Link></li>
                <li><Link href="/privacy"><span className="hover:text-white transition cursor-pointer">{language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}</span></Link></li>
                <li><Link href="/auth"><span className="hover:text-white transition cursor-pointer">{t('home.heroCtaLogin')}</span></Link></li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3">{t('home.footer.socialFollow')}</h4>
              <div className="flex gap-3">
                <a href="https://www.instagram.com/xflex.academy?igsh=NG9jZng1emlxM3I3" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-pink-600 flex items-center justify-center transition">
                  <Instagram className="w-4 h-4 text-gray-300" />
                </a>
                <a href="https://www.facebook.com/share/1Aj9HNNwsv/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-blue-600 flex items-center justify-center transition">
                  <Facebook className="w-4 h-4 text-gray-300" />
                </a>
                <a href="https://t.me/+cXq1JGThuZkxNGI0" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-sky-500 flex items-center justify-center transition">
                  <Send className="w-4 h-4 text-gray-300" />
                </a>
                <a href="https://wa.me/972597596030" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-green-600 flex items-center justify-center transition">
                  <Phone className="w-4 h-4 text-gray-300" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 text-center text-xs text-gray-600">
            &copy; {new Date().getFullYear()} XFlex Trading Academy. {t('home.footer.rights')}
          </div>
        </div>
      </footer>

      {/* ======== SCROLL TO TOP BUTTON ======== */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 end-6 w-10 h-10 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition flex items-center justify-center z-50"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
