import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowUpRight,
  ArrowUp,
  Facebook,
  Globe,
  Instagram,
  Menu,
  Phone,
  X,
} from 'lucide-react';

import { APP_TITLE } from '@/const';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLanguageSwitchLabel } from '@/lib/languageToggle';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const TEST2_LOGO = '/xflex-logo-2026-transparent.png';

type LayoutAction = {
  href: string;
  labelEn: string;
  labelAr: string;
};

type CinematicPublicLayoutProps = {
  children: ReactNode;
  primaryAction?: LayoutAction | null;
  mainClassName?: string;
};

function CinematicPublicStyles() {
  return (
    <style>{`
      :root { --cin-public-ease: ${EASE}; }

      .cin-public-nav {
        transition: background 320ms var(--cin-public-ease), border-color 320ms var(--cin-public-ease), box-shadow 320ms var(--cin-public-ease);
        background: rgba(5, 5, 5, 0.52);
        border-bottom: 1px solid rgba(255,255,255,0.05);
        backdrop-filter: blur(18px);
      }
      .cin-public-nav.cin-public-nav-scrolled {
        background: rgba(5, 5, 5, 0.92);
        border-bottom-color: rgba(255,255,255,0.09);
        box-shadow: 0 8px 32px rgba(0,0,0,0.38);
      }

      .cin-public-logo {
        display: block;
        width: clamp(150px, 14vw, 224px);
        height: auto;
        object-fit: contain;
        filter:
          drop-shadow(0 0 14px rgba(0,193,118,0.20))
          drop-shadow(0 0 28px rgba(0,193,118,0.16));
      }

      .cin-public-link {
        transition: color 220ms var(--cin-public-ease), opacity 220ms var(--cin-public-ease);
      }
      .cin-public-link:hover {
        color: white;
      }

      .cin-btn-green {
        position: relative;
        background: linear-gradient(135deg, #00D17F 0%, #009E63 100%);
        box-shadow:
          0 16px 40px rgba(0,193,118,0.28),
          0 0 0 1px rgba(0,193,118,0.32) inset,
          0 0 24px rgba(0,193,118,0.14);
        transition: transform 320ms var(--cin-public-ease), box-shadow 320ms var(--cin-public-ease);
      }
      .cin-btn-green:hover {
        transform: translate3d(0,-3px,0);
        box-shadow:
          0 24px 54px rgba(0,193,118,0.42),
          0 0 0 1px rgba(0,193,118,0.45) inset,
          0 0 40px rgba(0,193,118,0.24);
      }

      .cin-btn-ghost {
        position: relative;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.05);
        backdrop-filter: blur(14px);
        transition: background 280ms var(--cin-public-ease), border-color 280ms var(--cin-public-ease), transform 280ms var(--cin-public-ease);
      }
      .cin-btn-ghost:hover {
        background: rgba(255,255,255,0.10);
        border-color: rgba(0,193,118,0.32);
        transform: translate3d(0,-2px,0);
      }

      @keyframes cin-public-glow-pulse {
        0%, 100% { opacity: 0.42; transform: scale(1); }
        50% { opacity: 0.72; transform: scale(1.08); }
      }

      .cin-public-orb {
        position: absolute;
        border-radius: 9999px;
        filter: blur(80px);
        pointer-events: none;
        animation: cin-public-glow-pulse 8s ease-in-out infinite;
      }
      .cin-public-orb-green {
        background: radial-gradient(circle, rgba(0,193,118,0.44) 0%, rgba(0,193,118,0) 70%);
      }
      .cin-public-orb-gold {
        background: radial-gradient(circle, rgba(200,169,107,0.32) 0%, rgba(200,169,107,0) 70%);
      }

      .cin-public-footer-link {
        transition: color 220ms var(--cin-public-ease);
      }
      .cin-public-footer-link:hover {
        color: white;
      }
    `}</style>
  );
}

export default function CinematicPublicLayout({
  children,
  primaryAction = { href: '/auth', labelEn: 'Sign In', labelAr: 'سجل الدخول' },
  mainClassName = '',
}: CinematicPublicLayoutProps) {
  const { language, setLanguage, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 480);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location]);

  const navItems = [
    { href: '/#packages', label: isArabic ? 'الباقات' : 'Packages' },
    { href: '/gifts', label: isArabic ? 'الهدايا' : 'Gifts' },
    { href: '/articles', label: isArabic ? 'المقالات' : 'Articles' },
    { href: '/free-content', label: isArabic ? 'المكتبة المجانية' : 'Free Content' },
    { href: '/faq', label: isArabic ? 'الأسئلة' : 'FAQ' },
    { href: '/contact', label: isArabic ? 'تواصل معنا' : 'Contact' },
  ];

  const footerLinks = [
    { href: '/', label: isArabic ? 'الرئيسية' : 'Home' },
    { href: '/gifts', label: isArabic ? 'الهدايا' : 'Gifts' },
    { href: '/articles', label: isArabic ? 'المقالات' : 'Articles' },
    { href: '/free-content', label: isArabic ? 'المحتوى المجاني' : 'Free Content' },
    { href: '/faq', label: isArabic ? 'الأسئلة الشائعة' : 'FAQ' },
    { href: '/contact', label: isArabic ? 'تواصل معنا' : 'Contact' },
    { href: '/auth', label: isArabic ? 'تسجيل الدخول' : 'Login' },
  ];

  const isActive = (href: string) => {
    if (href.startsWith('/#')) return false;
    return location === href || location.startsWith(`${href}/`);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <CinematicPublicStyles />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="cin-public-orb cin-public-orb-green" style={{ width: 420, height: 420, top: '-8%', right: '-8%' }} />
        <div className="cin-public-orb cin-public-orb-gold" style={{ width: 320, height: 320, bottom: '-10%', left: '-6%', animationDelay: '2.4s' }} />
      </div>

      <header className={`cin-public-nav fixed inset-x-0 top-0 z-50 ${scrolled ? 'cin-public-nav-scrolled' : ''}`}>
        <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4 md:h-20 md:px-8" dir={isRTL ? 'rtl' : 'ltr'}>
          <Link href="/">
            <a className="flex shrink-0 items-center gap-2">
              <img src={TEST2_LOGO} alt={APP_TITLE} className="cin-public-logo" />
            </a>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-white/62 lg:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <a className={`cin-public-link ${isActive(item.href) ? 'text-white' : ''}`}>
                  {item.label}
                </a>
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <a
              href="https://wa.me/972597596030"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/78 transition hover:border-[#00C176]/28 hover:text-white"
            >
              <Phone className="h-4 w-4 text-[#00C176]" />
              WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/78 transition hover:border-white/18 hover:text-white"
            >
              <Globe className="h-4 w-4" />
              {getLanguageSwitchLabel(language)}
            </button>
            {primaryAction ? (
              <Link href={primaryAction.href}>
                <a className="cin-btn-green inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white">
                  {isArabic ? primaryAction.labelAr : primaryAction.labelEn}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </Link>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-2 text-white/80 transition hover:border-white/18 hover:text-white md:hidden"
            aria-label={menuOpen ? (isArabic ? 'إغلاق القائمة' : 'Close menu') : (isArabic ? 'فتح القائمة' : 'Open menu')}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-white/10 bg-[#0A0A0A]/96 px-4 pb-5 pt-4 backdrop-blur-2xl md:hidden" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/80"
              >
                <span>{isArabic ? 'اللغة' : 'Language'}</span>
                <span className="text-[#00C176]">{getLanguageSwitchLabel(language)}</span>
              </button>

              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <a className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${isActive(item.href) ? 'border-[#00C176]/25 bg-[#00C176]/10 text-white' : 'border-white/8 bg-white/[0.03] text-white/72 hover:border-white/14 hover:text-white'}`}>
                    {item.label}
                  </a>
                </Link>
              ))}

              <a
                href="https://wa.me/972597596030"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-green-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-600"
              >
                <Phone className="h-4 w-4" />
                WhatsApp
              </a>

              {primaryAction ? (
                <Link href={primaryAction.href}>
                  <a className="cin-btn-green inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white">
                    {isArabic ? primaryAction.labelAr : primaryAction.labelEn}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>

      <main className={`relative z-10 pt-16 md:pt-20 ${mainClassName}`}>{children}</main>

      <footer className="relative z-10 border-t border-white/06 bg-[#050505] py-14" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="container mx-auto px-4 md:px-8">
          <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
            <div>
              <img src={TEST2_LOGO} alt={APP_TITLE} className="cin-public-logo w-[168px] max-w-full" />
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/42">
                {isArabic
                  ? 'نفس اللغة البصرية الجديدة: تعليم واضح، محتوى عملي، ومسارات وصول أنظف للصفحات العامة.'
                  : 'The same new visual language: clear education, practical content, and cleaner paths through the public site.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm text-white/46 sm:grid-cols-3">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/22">{isArabic ? 'التصفح' : 'Browse'}</p>
                {footerLinks.slice(0, 3).map((link) => (
                  <Link key={link.href} href={link.href}>
                    <a className="cin-public-footer-link">{link.label}</a>
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/22">{isArabic ? 'المحتوى' : 'Content'}</p>
                {footerLinks.slice(3, 6).map((link) => (
                  <Link key={link.href} href={link.href}>
                    <a className="cin-public-footer-link">{link.label}</a>
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/22">{isArabic ? 'الحساب' : 'Account'}</p>
                <Link href="/auth">
                  <a className="cin-public-footer-link">{isArabic ? 'تسجيل الدخول' : 'Login'}</a>
                </Link>
                <Link href="/register">
                  <a className="cin-public-footer-link">{isArabic ? 'إنشاء حساب' : 'Create account'}</a>
                </Link>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/22">{isArabic ? 'تابعنا' : 'Follow us'}</p>
              <div className="flex gap-3">
                {[
                  { icon: Instagram, href: 'https://www.instagram.com/xflex.academy?igsh=NG9jZng1emlxM3I3', label: 'Instagram' },
                  { icon: Facebook, href: 'https://www.facebook.com/share/1Aj9HNNwsv/?mibextid=wwXIfr', label: 'Facebook' },
                  { icon: Phone, href: 'https://wa.me/972597596030', label: 'WhatsApp' },
                ].map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-white/45 transition-all hover:border-[#00C176]/40 hover:text-[#00C176]"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-2 border-t border-white/05 pt-6 text-xs text-white/26 sm:flex-row sm:items-center sm:justify-between">
            <p>© {new Date().getFullYear()} {APP_TITLE}. {isArabic ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}</p>
            <p>{isArabic ? 'الواجهة العامة تتبنى الآن لغة test2 البصرية بشكل تدريجي.' : 'The public experience is gradually adopting the test2 visual language.'}</p>
          </div>
        </div>
      </footer>

      {showScrollTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="cin-btn-green fixed bottom-6 right-6 z-50 inline-flex h-11 w-11 items-center justify-center rounded-full text-white"
          aria-label={isArabic ? 'العودة للأعلى' : 'Back to top'}
        >
          <ArrowUp className="h-4.5 w-4.5" />
        </button>
      ) : null}
    </div>
  );
}