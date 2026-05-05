import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Globe, LogIn, Phone, Send, ArrowUp, X, Menu,
  Instagram, Facebook,
} from 'lucide-react';
import { APP_LOGO, APP_TITLE } from '@/const';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PublicLayout({ children }: { children: ReactNode }) {
  const { language, setLanguage, t } = useLanguage();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  const navItems = [
    { href: '/#packages', label: t('home.footer.packages') },
    { href: '/events', label: language === 'ar' ? 'الفعاليات' : 'Events' },
    { href: '/articles', label: language === 'ar' ? 'المقالات' : 'Articles' },
    { href: '/free-content', label: t('home.footer.freeContent') },
    { href: '/faq', label: language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ' },
    { href: '/careers', label: language === 'ar' ? 'وظائف' : 'Careers' },
    { href: '/#contact', label: language === 'ar' ? 'تواصل معنا' : 'Contact' },
  ];

  const isActive = (href: string) => {
    if (href.startsWith('/#')) return false;
    return location === href || location.startsWith(href + '/');
  };

  return (
    <div className="min-h-screen bg-[var(--color-xf-cream)]" dir="ltr">
      {/* ======== HEADER ======== */}
      <header
        className="sticky top-0 z-[1000] border-b border-white/65 bg-white/70 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
        style={{ height: '72px' }}
        dir="ltr"
      >
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-3 cursor-pointer rounded-2xl border border-slate-200/70 bg-white/90 px-3 py-2 shadow-sm">
              <img
                src={APP_LOGO}
                alt={APP_TITLE}
                className="h-8 w-auto md:h-9"
              />
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 rounded-full border border-slate-200/80 bg-white/80 px-5 py-2 text-sm font-medium shadow-sm">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <span className={`nav-link-xf cursor-pointer ${isActive(item.href) ? 'text-xf-dark font-semibold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 p-1 shadow-sm">
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
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-gray-500 hover:text-xf-dark hover:bg-gray-100/80 transition-all duration-150"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Side Menu */}
        {mobileMenuOpen && (
          <>
            <button
              type="button"
              aria-label={language === 'ar' ? 'إغلاق القائمة' : 'Close menu'}
              className="fixed inset-0 z-[1090] bg-slate-950/30 backdrop-blur-sm md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <nav
              className="fixed inset-y-0 right-0 z-[1100] flex w-[min(88vw,22rem)] flex-col border-l border-white/60 bg-white/96 px-4 pb-4 pt-5 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-2xl md:hidden"
              style={{ overflowY: 'auto' }}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                  <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-auto" />
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-5 text-sm leading-6 text-slate-500">
                {language === 'ar'
                  ? 'قائمة أنظف وأوضح للوصول السريع إلى الصفحات الأساسية.'
                  : 'A cleaner navigation drawer for quick access to the essential pages.'}
              </p>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <span className={`block py-3.5 px-4 rounded-2xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all cursor-pointer text-[1.05rem] ${isActive(item.href) ? 'text-xf-dark bg-xf-cream font-semibold' : ''}`}>
                    {item.label}
                  </span>
                </Link>
              ))}
              <Link href="/activate-key">
                <span className="block py-3.5 px-4 rounded-2xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all cursor-pointer text-[1.05rem]">
                  {language === 'ar' ? 'تفعيل مفتاح' : 'Activate Key'}
                </span>
              </Link>
              <div className="mt-auto pt-5 border-t border-slate-200 flex flex-col gap-2">
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
          </>
        )}
      </header>

      {/* ======== CONTENT ======== */}
      <main>{children}</main>

      {/* ======== FOOTER ======== */}
      <footer className="relative overflow-hidden bg-[#07111f] py-16 text-slate-300">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_25%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.1),transparent_30%)]" />
        <div className="relative container mx-auto px-4">
          <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-[1.2fr_0.85fr_0.95fr]">
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
                  ? 'تعليم مرتب، محتوى عملي، وقنوات واضحة للوصول إلى ما تحتاجه بسرعة.'
                  : 'Structured education, practical content, and clearer paths to the pages students need most.'}
              </p>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">{t('home.footer.quickLinks')}</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{t('home.footer.home')}</span></Link></li>
                <li><Link href="/#packages"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{t('home.footer.packages')}</span></Link></li>
                <li><Link href="/events"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{language === 'ar' ? 'الفعاليات' : 'Events'}</span></Link></li>
                <li><Link href="/articles"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{language === 'ar' ? 'المقالات' : 'Articles'}</span></Link></li>
                <li><Link href="/free-content"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{t('home.footer.freeContent')}</span></Link></li>
                <li><Link href="/faq"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link></li>
                <li><Link href="/careers"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{language === 'ar' ? 'وظائف' : 'Careers'}</span></Link></li>
                <li><Link href="/activate-key"><span className="cursor-pointer transition-colors duration-150 hover:text-white">{language === 'ar' ? 'تفعيل مفتاح' : 'Activate Key'}</span></Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-semibold text-white">{language === 'ar' ? 'تواصل واكتشف المزيد' : 'Connect and explore more'}</h4>
              <div className="flex flex-col gap-3">
                <Link href="/contact">
                  <span className="inline-flex cursor-pointer items-center justify-center rounded-full border border-white/12 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10">
                    {language === 'ar' ? 'أرسل لنا استفسارك' : 'Send us your question'}
                  </span>
                </Link>
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

      {/* Scroll to top */}
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
