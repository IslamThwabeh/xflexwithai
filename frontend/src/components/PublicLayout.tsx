import { useState, useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Globe, LogIn, Phone, Send, ArrowUp, X, Menu,
  Instagram, Facebook,
} from 'lucide-react';
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
      <header className="glass sticky top-0 z-[1000]" style={{ height: '72px' }} dir="ltr">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          <Link href="/">
            <span className="flex items-center gap-3 cursor-pointer">
              <span className="text-xl font-extrabold tracking-tight text-xf-dark">XFlex</span>
              <span className="text-sm text-gray-500 hidden sm:inline font-medium">Trading Academy</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <span className={`nav-link-xf cursor-pointer ${isActive(item.href) ? 'text-xf-dark font-semibold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
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

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100/50 px-4 py-3 flex flex-col gap-1 text-sm font-medium"
            style={{ height: 'calc(100dvh - 72px)', overflowY: 'auto' }}>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <span className={`block py-3.5 px-4 rounded-xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all cursor-pointer text-[1.05rem] ${isActive(item.href) ? 'text-xf-dark bg-xf-cream font-semibold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            ))}
            <Link href="/activate-key">
              <span className="block py-3.5 px-4 rounded-xl text-gray-600 hover:text-xf-dark hover:bg-xf-cream transition-all cursor-pointer text-[1.05rem]">
                {language === 'ar' ? 'تفعيل مفتاح' : 'Activate Key'}
              </span>
            </Link>
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

      {/* ======== CONTENT ======== */}
      <main>{children}</main>

      {/* ======== FOOTER ======== */}
      <footer className="bg-xf-dark text-gray-400 py-14">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl font-extrabold text-white tracking-tight">XFlex</span>
                <span className="text-sm text-gray-500 font-medium">Trading Academy</span>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">
                {t('home.footer.tagline')}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4">{t('home.footer.quickLinks')}</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{t('home.footer.home')}</span></Link></li>
                <li><Link href="/#packages"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{t('home.footer.packages')}</span></Link></li>
                <li><Link href="/events"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'الفعاليات' : 'Events'}</span></Link></li>
                <li><Link href="/articles"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'المقالات' : 'Articles'}</span></Link></li>
                <li><Link href="/free-content"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{t('home.footer.freeContent')}</span></Link></li>
                <li><Link href="/faq"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</span></Link></li>
                <li><Link href="/careers"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'وظائف' : 'Careers'}</span></Link></li>
                <li><Link href="/activate-key"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'تفعيل مفتاح' : 'Activate Key'}</span></Link></li>
                <li><Link href="/terms"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}</span></Link></li>
                <li><Link href="/refund-policy"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'سياسة الاسترجاع' : 'Refund Policy'}</span></Link></li>
                <li><Link href="/privacy"><span className="hover:text-white transition-colors duration-150 cursor-pointer">{language === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}</span></Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-4">{t('home.footer.socialFollow')}</h4>
              <div className="flex gap-3">
                <a href="https://www.instagram.com/xflex.academy?igsh=NG9jZng1emlxM3I3" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-[10px] bg-white/8 hover:bg-pink-600 flex items-center justify-center transition-all duration-150">
                  <Instagram className="w-4 h-4 text-gray-400" />
                </a>
                <a href="https://www.facebook.com/share/1Aj9HNNwsv/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-[10px] bg-white/8 hover:bg-emerald-600 flex items-center justify-center transition-all duration-150">
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
