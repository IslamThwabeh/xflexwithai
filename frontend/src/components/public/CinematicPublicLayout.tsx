import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  ArrowUpRight,
  ArrowUp,
  Facebook,
  Instagram,
  Menu,
  Phone,
  X,
} from 'lucide-react';

import { APP_TITLE } from '@/const';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLanguageSwitchLabel } from '@/lib/languageToggle';
import {
  CINEMATIC_PRIMARY_NAV_ITEMS,
  DEFAULT_CINEMATIC_PRIMARY_ACTION,
} from '@/components/public/cinematicPublicNav';

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const BRAND_LOGO_SRC = '/xflex-logo-2026-transparent.png';

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
        transition: background 400ms var(--cin-public-ease), border-color 400ms var(--cin-public-ease), box-shadow 400ms var(--cin-public-ease);
      }
      .cin-public-nav.cin-public-nav-scrolled {
        background: rgba(5, 5, 5, 0.92);
        border-bottom: 1px solid rgba(255,255,255,0.07);
        backdrop-filter: blur(28px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      }

      .cin-public-logo {
        display: block;
        height: auto;
        object-fit: contain;
        filter:
          drop-shadow(0 0 12px rgba(0,193,118,0.18))
          drop-shadow(0 0 28px rgba(0,193,118,0.12));
      }
      .cin-public-logo-header {
        width: clamp(150px, 16vw, 236px);
      }
      .cin-public-logo-footer {
        width: clamp(168px, 15vw, 220px);
      }
      @media (max-width: 767px) {
        .cin-public-logo {
          filter:
            drop-shadow(0 0 14px rgba(0,193,118,0.26))
            drop-shadow(0 0 30px rgba(0,193,118,0.18));
        }
        .cin-public-logo-header {
          width: 156px;
        }
        .cin-public-logo-footer {
          width: 172px;
        }
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
          0 16px 40px rgba(0,193,118,0.32),
          0 0 0 1px rgba(0,193,118,0.35) inset,
          0 0 24px rgba(0,193,118,0.18);
        transition: transform 320ms var(--cin-public-ease), box-shadow 320ms var(--cin-public-ease);
      }
      .cin-btn-green::after {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: inherit;
        background: radial-gradient(circle at 50% 100%, rgba(0,193,118,0.55), transparent 70%);
        opacity: 0;
        transition: opacity 320ms var(--cin-public-ease);
        z-index: -1;
        filter: blur(14px);
      }
      .cin-btn-green:hover {
        transform: translate3d(0,-4px,0) scale(1.015);
        box-shadow:
          0 28px 60px rgba(0,193,118,0.50),
          0 0 0 1px rgba(0,193,118,0.55) inset,
          0 0 50px rgba(0,193,118,0.40);
      }
      .cin-btn-green:hover::after { opacity: 1; }
      .cin-btn-green:active { transform: none; }

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
  primaryAction = DEFAULT_CINEMATIC_PRIMARY_ACTION,
  mainClassName = '',
}: CinematicPublicLayoutProps) {
  const { language, setLanguage, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const localePrefix = `/${language}`;
  const localizePublicHref = (href: string) => {
    if (href === '/') return localePrefix;
    if (href.startsWith('/#')) return `${localePrefix}${href.slice(1)}`;
    if (href.startsWith('/auth') || href.startsWith('/register')) return href;
    if (href.startsWith('/ar/') || href.startsWith('/en/')) return href;
    return `${localePrefix}${href}`;
  };
  const switchLanguage = () => {
    const nextLanguage = language === 'ar' ? 'en' : 'ar';
    const nextPath = window.location.pathname.match(/^\/(ar|en)(?=\/|$)/)
      ? window.location.pathname.replace(/^\/(ar|en)(?=\/|$)/, `/${nextLanguage}`)
      : `/${nextLanguage}${window.location.pathname === '/' ? '' : window.location.pathname}`;
    setLanguage(nextLanguage);
    window.location.assign(`${nextPath}${window.location.search}${window.location.hash}`);
  };

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

  const navItems = CINEMATIC_PRIMARY_NAV_ITEMS.map((item) => ({
    ...item,
    label: isArabic ? item.labelAr : item.labelEn,
  }));

  const footerLinks = [
    { href: localePrefix, label: isArabic ? 'الرئيسية' : 'Home' },
    { href: '/gifts', label: isArabic ? 'الهدايا' : 'Gifts' },
    { href: '/articles', label: isArabic ? 'المقالات' : 'Articles' },
    { href: '/free-content', label: isArabic ? 'المحتوى المجاني' : 'Free Content' },
    { href: '/faq', label: isArabic ? 'الأسئلة الشائعة' : 'FAQ' },
    { href: '/contact', label: isArabic ? 'تواصل معنا' : 'Contact' },
    { href: '/terms', label: isArabic ? 'الشروط والأحكام' : 'Terms & Conditions' },
    { href: '/refund-policy', label: isArabic ? 'سياسة الاسترداد' : 'Refund Policy' },
    { href: '/editorial-policy', label: isArabic ? 'السياسة التحريرية' : 'Editorial Policy' },
    { href: '/risk-disclosure', label: isArabic ? 'إفصاح المخاطر' : 'Risk Disclosure' },
    { href: '/auth', label: isArabic ? 'تسجيل الدخول' : 'Login' },
    { href: '/register', label: isArabic ? 'إنشاء حساب' : 'Create account' },
  ];

  const scrollToHomeSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (!element) return false;

    const headerOffset = window.innerWidth >= 768 ? 88 : 72;
    const top = element.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top, behavior: 'smooth' });
    return true;
  };

  const handlePrimaryNavigation = (sectionId: string, href: string) => {
    if (location === localePrefix && scrollToHomeSection(sectionId)) {
      setMenuOpen(false);
      return;
    }

    window.location.assign(localizePublicHref(href));
  };

  const handlePrimaryAction = (href: string) => {
    if (href.startsWith('/#')) {
      const sectionId = href.slice(2);
      handlePrimaryNavigation(sectionId, href);
      return;
    }

    window.location.assign(localizePublicHref(href));
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white" dir={isRTL ? 'rtl' : 'ltr'}>
      <CinematicPublicStyles />

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="cin-public-orb cin-public-orb-green" style={{ width: 420, height: 420, top: '-8%', right: '-8%' }} />
        <div className="cin-public-orb cin-public-orb-gold" style={{ width: 320, height: 320, bottom: '-10%', left: '-6%', animationDelay: '2.4s' }} />
      </div>

      <header className={`cin-public-nav fixed inset-x-0 top-0 z-50 ${scrolled ? 'cin-public-nav-scrolled' : ''}`}>
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:h-20 md:px-8" dir={isRTL ? 'rtl' : 'ltr'}>
          <Link href={localePrefix}>
            <a className="flex shrink-0 items-center gap-2">
              <img src={BRAND_LOGO_SRC} alt={APP_TITLE} className="cin-public-logo cin-public-logo-header" />
            </a>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium text-white/65 md:flex">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => handlePrimaryNavigation(item.sectionId, item.href)}
                className="cin-public-link transition-colors duration-200 hover:text-white"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <button
              type="button"
              onClick={switchLanguage}
              className="text-xs font-semibold text-white/55 transition-colors hover:text-white"
            >
              {getLanguageSwitchLabel(language)}
            </button>
            {primaryAction ? (
              <button
                type="button"
                onClick={() => handlePrimaryAction(primaryAction.href)}
                className="cin-btn-green inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
              >
                  {isArabic ? primaryAction.labelAr : primaryAction.labelEn}
                  <ArrowUpRight className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="text-white/70 transition hover:text-white md:hidden"
            aria-label={menuOpen ? (isArabic ? 'إغلاق القائمة' : 'Close menu') : (isArabic ? 'فتح القائمة' : 'Open menu')}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {menuOpen ? (
          <div className="border-t border-white/10 bg-[#0A0A0A]/96 px-4 pb-6 pt-4 backdrop-blur-2xl md:hidden" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="flex flex-col gap-5">
              <button
                type="button"
                onClick={switchLanguage}
                className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/80"
              >
                <span>{isArabic ? 'اللغة' : 'Language'}</span>
                <span className="text-[#00C176]">{getLanguageSwitchLabel(language)}</span>
              </button>

              {navItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handlePrimaryNavigation(item.sectionId, item.href)}
                  className="text-start text-base font-medium text-white/70 hover:text-white"
                >
                  {item.label}
                </button>
              ))}

              {primaryAction ? (
                <button
                  type="button"
                  onClick={() => handlePrimaryAction(primaryAction.href)}
                  className="cin-btn-green mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"
                >
                    {isArabic ? primaryAction.labelAr : primaryAction.labelEn}
                    <ArrowUpRight className="h-4 w-4" />
                </button>
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
              <img src={BRAND_LOGO_SRC} alt={APP_TITLE} className="cin-public-logo cin-public-logo-footer max-w-full" />
              <p className="mt-3 max-w-sm text-sm leading-7 text-white/42">
                {isArabic
                  ? 'أكاديمية تداول عربية تجمع بين التعليم العملي، التحليل الواضح، والدعم المستمر للمتداول الجاد.'
                  : 'An Arabic-first trading academy built around practical education, clear analysis, and ongoing support for serious traders.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 text-sm text-white/46 sm:grid-cols-3">
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/22">{isArabic ? 'التصفح' : 'Browse'}</p>
                {footerLinks.slice(0, 3).map((link) => (
                  <Link key={link.href} href={localizePublicHref(link.href)}>
                    <a className="cin-public-footer-link">{link.label}</a>
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/22">{isArabic ? 'المحتوى' : 'Content'}</p>
                {footerLinks.slice(3, 6).map((link) => (
                  <Link key={link.href} href={localizePublicHref(link.href)}>
                    <a className="cin-public-footer-link">{link.label}</a>
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/22">{isArabic ? 'الحساب' : 'Account'}</p>
                {footerLinks.slice(6).map((link) => (
                  <Link key={link.href} href={localizePublicHref(link.href)}>
                    <a className="cin-public-footer-link">{link.label}</a>
                  </Link>
                ))}
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
            <p>{isArabic ? 'تعليم واضح. تحليل منضبط. دعم مستمر.' : 'Clear education. Disciplined analysis. Ongoing support.'}</p>
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
