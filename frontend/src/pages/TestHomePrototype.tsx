/**
 * /test — Cinematic landing page (standalone, does NOT touch Home).
 * All images live in frontend/public/images/landing/
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowUpRight, Award, Bot, CheckCircle, ChevronDown, Clock3,
  Facebook, Instagram, Phone, Menu, Quote, ShieldCheck,
  Sparkles, Star, Target, TrendingUp, Users, X, Zap,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLanguageSwitchLabel } from '@/lib/languageToggle';
import { formatIlsAmount, getPackageDisplayPricing } from '@/lib/packagePricing';
import { trpc } from '@/lib/trpc';
import { APP_LOGO, APP_TITLE } from '@/const';

// ─── Image map ────────────────────────────────────────────────────────────────
const IMG = {
  hero:      '/images/landing/HERO SECTION IMAGE.png',
  learn:     '/images/landing/STICKY SCROLL SECTION \u2014 LEARNING EXPERIENCE.png',
  dashboard: '/images/landing/Sleek neon trading dashboard mockup.png',
  mentor:    '/images/landing/Mentor - Professional trader in a high-tech office.png',
  mobile:    '/images/landing/MOBILE TRADING LIFESTYLE IMAGE.png',
  community: '/images/landing/ELITE COMMUNITY SECTION.png',
  success:   '/images/landing/Nighttime trading success celebration.png',
  workspace: '/images/landing/Modern trading desk with green accents.png',
  tech:      '/images/landing/XFLEX Trading Academy interface.png',
  academy:   '/images/landing/XFLEX Trading Academy in action.png',
  cta:       '/images/landing/Master the markets, create your future.png',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type PackageKey = 'basic' | 'comprehensive';

type RenewalOffer = {
  id: string;
  packageId: PackageKey;
  months: 3 | 6;
  discountedIls: number;
  originalIls: number;
};

const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

const renewalOffers: RenewalOffer[] = [
  { id: 'comp-3m',  packageId: 'comprehensive', months: 3, discountedIls: 875,  originalIls: 1050 },
  { id: 'basic-3m', packageId: 'basic',         months: 3, discountedIls: 437,  originalIls: 525  },
  { id: 'comp-6m',  packageId: 'comprehensive', months: 6, discountedIls: 1750, originalIls: 2100 },
  { id: 'basic-6m', packageId: 'basic',         months: 6, discountedIls: 875,  originalIls: 1050 },
];

// ─── Hooks ────────────────────────────────────────────────────────────────────
function usePrefersReducedMotion() {
  const [pref, setPref] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPref(mq.matches);
    const handler = () => setPref(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return pref;
}

function useScrollReveal(ref: { readonly current: HTMLElement | null }) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-reveal]'));
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('cin-revealed');
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -48px 0px' },
    );
    nodes.forEach((n) => obs.observe(n));
    return () => obs.disconnect();
  });
}

// ─── Global cinematic styles ──────────────────────────────────────────────────
function CinematicStyles() {
  return (
    <style>{`
      :root { --cin-ease: ${EASE}; }

      /* Scroll reveal */
      [data-reveal] {
        opacity: 0;
        transform: translate3d(0, 28px, 0);
        filter: blur(6px);
        transition:
          opacity 640ms var(--cin-ease),
          transform 640ms var(--cin-ease),
          filter 640ms var(--cin-ease);
        will-change: opacity, transform, filter;
      }
      [data-reveal].cin-revealed {
        opacity: 1;
        transform: none;
        filter: none;
      }
      @media (prefers-reduced-motion: reduce) {
        [data-reveal] {
          opacity: 1 !important;
          transform: none !important;
          filter: none !important;
          transition: none !important;
        }
      }

      /* Hero */
      @keyframes cin-hero-in {
        from { opacity: 0; transform: translate3d(0, 36px, 0); filter: blur(10px); }
        to   { opacity: 1; transform: none; filter: none; }
      }
      @keyframes cin-bg-zoom {
        from { transform: scale(1.06); }
        to   { transform: scale(1); }
      }
      .cin-hero-1 { animation: cin-hero-in 900ms var(--cin-ease) 80ms  both; }
      .cin-hero-2 { animation: cin-hero-in 900ms var(--cin-ease) 220ms both; }
      .cin-hero-3 { animation: cin-hero-in 900ms var(--cin-ease) 380ms both; }
      .cin-hero-4 { animation: cin-hero-in 900ms var(--cin-ease) 530ms both; }
      .cin-bg-zoom { animation: cin-bg-zoom 6s var(--cin-ease) both; }

      /* Float cards */
      @keyframes cin-float { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-10px,0); } }
      .cin-float-1 { animation: cin-float 4.8s ease-in-out infinite; }
      .cin-float-2 { animation: cin-float 5.6s ease-in-out 1.2s infinite; }
      .cin-float-3 { animation: cin-float 6.2s ease-in-out 0.6s infinite; }

      /* Marquee */
      @keyframes cin-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .cin-marquee { animation: cin-marquee 28s linear infinite; }

      /* Sticky image crossfade */
      .cin-sticky-img {
        position: absolute; inset: 0;
        opacity: 0;
        transition: opacity 700ms var(--cin-ease);
      }
      .cin-sticky-img.cin-active { opacity: 1; }

      /* Buttons */
      .cin-btn-green {
        background: linear-gradient(135deg, #00C176 0%, #009E63 100%);
        box-shadow: 0 16px 40px rgba(0,193,118,0.28);
        transition: transform 300ms var(--cin-ease), box-shadow 300ms var(--cin-ease);
      }
      .cin-btn-green:hover { transform: translate3d(0,-3px,0); box-shadow: 0 22px 52px rgba(0,193,118,0.36); }
      .cin-btn-green:active { transform: none; }

      .cin-btn-ghost {
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        backdrop-filter: blur(12px);
        transition: background 280ms var(--cin-ease), border-color 280ms var(--cin-ease);
      }
      .cin-btn-ghost:hover { background: rgba(255,255,255,0.11); border-color: rgba(255,255,255,0.22); }

      .cin-btn-white {
        background: rgba(255,255,255,0.94);
        color: #050505;
        box-shadow: 0 12px 32px rgba(255,255,255,0.08);
        transition: transform 300ms var(--cin-ease), background 280ms var(--cin-ease);
      }
      .cin-btn-white:hover { transform: translate3d(0,-3px,0); background: #ffffff; }

      /* Package cards */
      .cin-pkg-card {
        transition: transform 320ms var(--cin-ease), box-shadow 320ms var(--cin-ease);
      }
      .cin-pkg-card:hover { transform: translate3d(0,-8px,0); }

      /* Nav */
      .cin-nav { transition: background 400ms var(--cin-ease), border-color 400ms; }
      .cin-nav.cin-nav-scrolled {
        background: rgba(5,5,5,0.95);
        border-bottom: 1px solid rgba(255,255,255,0.07);
        backdrop-filter: blur(24px);
      }

      /* Story card active */
      .cin-story-card {
        transition: border-color 400ms var(--cin-ease), background 400ms var(--cin-ease);
      }
      .cin-story-card.cin-story-active {
        border-color: rgba(0,193,118,0.30) !important;
        background: rgba(0,193,118,0.05) !important;
      }

      /* Glow top line on featured card */
      .cin-featured-line {
        position: relative;
      }
      .cin-featured-line::before {
        content: '';
        position: absolute;
        top: -1px; left: 0; right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(0,193,118,0.55), transparent);
        pointer-events: none;
      }
    `}</style>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedCounter({
  value,
  prefix = '',
  suffix = '',
  start,
  reduced,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  start: boolean;
  reduced: boolean;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!start) { setDisplay(0); return undefined; }
    if (reduced) { setDisplay(value); return undefined; }
    const began = performance.now();
    let frameId = 0;
    const tick = (now: number) => {
      const p = Math.min((now - began) / 920, 1);
      setDisplay(value * (1 - Math.pow(1 - p, 4)));
      if (p < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [start, value, reduced]);

  return (
    <span>
      {prefix}
      {Math.round(display).toLocaleString()}
      {suffix}
    </span>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────
function CinematicNav({ onScrollTo }: { onScrollTo: (id: string) => void }) {
  const { language, setLanguage, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = isArabic
    ? [['الباقات', 'packages'], ['المسار', 'story'], ['المدرب', 'mentor'], ['المجتمع', 'community']]
    : [['Packages', 'packages'], ['Curriculum', 'story'], ['Mentor', 'mentor'], ['Community', 'community']];

  return (
    <header
      className={`cin-nav fixed inset-x-0 top-0 z-50 ${scrolled ? 'cin-nav-scrolled' : ''}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
        {/* Logo */}
        <Link href="/">
          <a className="flex shrink-0 items-center gap-2">
            <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-auto" />
          </a>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 text-sm font-medium text-white/60 md:flex">
          {navLinks.map(([label, id]) => (
            <button
              key={id}
              type="button"
              onClick={() => onScrollTo(id)}
              className="transition-colors duration-200 hover:text-white"
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Desktop right actions */}
        <div className="hidden items-center gap-4 md:flex">
          <button
            type="button"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            className="text-xs font-semibold text-white/50 transition-colors hover:text-white"
          >
            {getLanguageSwitchLabel(language)}
          </button>
          <button
            type="button"
            onClick={() => onScrollTo('packages')}
            className="cin-btn-green inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white"
          >
            {isArabic ? 'ابدأ الآن' : 'Get Started'}
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="text-white/70 hover:text-white md:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-white/08 bg-[#0A0A0A]/96 px-4 pb-6 pt-4 backdrop-blur-2xl md:hidden">
          <div className="flex flex-col gap-5">
            {navLinks.map(([label, id]) => (
              <button
                key={id}
                type="button"
                onClick={() => { onScrollTo(id); setMenuOpen(false); }}
                className="text-left text-base font-medium text-white/70 hover:text-white"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { onScrollTo('packages'); setMenuOpen(false); }}
              className="cin-btn-green mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white"
            >
              {isArabic ? 'ابدأ الآن' : 'Get Started'}
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── 1. Hero ──────────────────────────────────────────────────────────────────
function HeroSection({ onScrollTo }: { onScrollTo: (id: string) => void }) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';

  return (
    <section
      className="relative flex min-h-screen flex-col items-start justify-center overflow-hidden"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background */}
      <div className="cin-bg-zoom absolute inset-0">
        <img
          src={IMG.hero}
          alt=""
          className="h-full w-full object-cover object-center"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/90 via-[#050505]/65 to-[#050505]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/75 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pb-20 pt-24 md:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left text block */}
          <div className="max-w-2xl">
            <div className="cin-hero-1 inline-flex items-center gap-2 rounded-full border border-[#00C176]/30 bg-[#00C176]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C176]" />
              {isArabic ? 'أكاديمية التداول الأولى في فلسطين' : 'Elite Trading Academy — Palestine'}
            </div>

            <h1 className="cin-hero-2 mt-6 text-5xl font-extrabold leading-[1.08] tracking-[-0.03em] text-white md:text-6xl lg:text-[4.25rem]">
              {isArabic ? (
                <>تداول بثقة.<br /><span className="text-[#00C176]">ابنِ مستقبلك.</span></>
              ) : (
                <>Trade with<br /><span className="text-[#00C176]">Confidence.</span></>
              )}
            </h1>

            <p className="cin-hero-3 mt-6 max-w-xl text-base leading-8 text-white/65 md:text-lg">
              {isArabic
                ? 'مسار تعليمي متكامل من الصفر حتى الاحتراف، توصيات مباشرة، وتحليل ذكي من LexAI — كل شيء في مكان واحد.'
                : 'A complete structured curriculum, live trade recommendations, and LexAI intelligence — everything you need to trade at a professional level.'}
            </p>

            <div className="cin-hero-4 mt-9 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => onScrollTo('packages')}
                className="cin-btn-green inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white"
              >
                {isArabic ? 'ابدأ رحلتك' : 'Start your journey'}
                <ArrowUpRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onScrollTo('story')}
                className="cin-btn-ghost inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white"
              >
                {isArabic ? 'اكتشف المسار' : 'Explore the path'}
              </button>
            </div>
          </div>

          {/* Right: floating stat cards (desktop) */}
          <div className="hidden flex-col items-end gap-4 lg:flex">
            <div className="cin-float-1 flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.06] px-5 py-4 backdrop-blur-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00C176]/20">
                <TrendingUp className="h-5 w-5 text-[#00C176]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/55">{isArabic ? 'الطلاب النشطون' : 'Active students'}</p>
                <p className="text-2xl font-extrabold text-white">+5,000</p>
              </div>
            </div>

            <div className="cin-float-2 flex items-center gap-3 rounded-2xl border border-[#00C176]/20 bg-[#00C176]/[0.08] px-5 py-4 backdrop-blur-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8A96B]/20">
                <Award className="h-5 w-5 text-[#C8A96B]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/55">{isArabic ? 'المراحل التعليمية' : 'Learning stages'}</p>
                <p className="text-2xl font-extrabold text-white">8 {isArabic ? 'مراحل' : 'stages'}</p>
              </div>
            </div>

            <div className="cin-float-3 flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.06] px-5 py-4 backdrop-blur-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20">
                <Zap className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/55">{isArabic ? 'تحليل ذكي' : 'AI-powered'}</p>
                <p className="text-xl font-extrabold text-white">LexAI</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/35">
        <p className="text-[10px] uppercase tracking-widest">{isArabic ? 'اكتشف' : 'Scroll'}</p>
        <ChevronDown className="h-5 w-5 animate-bounce" />
      </div>
    </section>
  );
}

// ─── 2. Trust bar ─────────────────────────────────────────────────────────────
function TrustBar() {
  const { language } = useLanguage();
  const isArabic = language === 'ar';

  const items = isArabic
    ? ['+5,000 طالب', '8 مراحل تعليمية', 'توصيات يومية', 'LexAI للتحليل الذكي', 'دعم فوري', 'محتوى مدى الحياة', 'تداول موثوق']
    : ['+5,000 students', '8 learning stages', 'Daily signals', 'LexAI intelligent analysis', 'Instant support', 'Lifetime access', 'Trusted trading'];

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-y border-white/06 bg-[#0A0A0A] py-4">
      <div className="cin-marquee flex whitespace-nowrap">
        {doubled.map((item, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-3 px-8 text-sm font-semibold text-white/45"
          >
            <span className="h-1 w-1 rounded-full bg-[#00C176]" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── 3. Sticky storytelling ───────────────────────────────────────────────────
function StickyStorySection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const [activeIdx, setActiveIdx] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef);

  const storyImages = [IMG.academy, IMG.dashboard, IMG.workspace, IMG.learn, IMG.success];

  const cards = isArabic
    ? [
        { icon: Target,     title: 'علم نفس السوق',            body: 'افهم كيف تتحرك الأسواق وكيف تؤثر العواطف على قراراتك — الأساس الذي يفتقده أغلب المتداولين.' },
        { icon: TrendingUp, title: 'التحليل الفني الاحترافي',  body: 'إتقان القراءة الحقيقية للشارت من الأنماط إلى المستويات الحاسمة بأسلوب عملي ومباشر.' },
        { icon: Zap,        title: 'التنفيذ الحقيقي في السوق', body: 'توصيات حية مع تحليل مفصّل لكل صفقة — ليس تعليماً نظرياً بل تنفيذ فعلي في السوق.' },
        { icon: Award,      title: 'إدارة المخاطر',            body: 'أهم مهارة يتجاهلها المبتدئون. تعلّم كيف تحمي رأسمالك وتبقى في السوق على المدى البعيد.' },
        { icon: Users,      title: 'جلسات تداول مباشرة',       body: 'تعلّم جنباً إلى جنب مع محترفين في جلسات مباشرة تغطي أحدث حركات السوق.' },
      ]
    : [
        { icon: Target,     title: 'Market Psychology',      body: 'Understand how markets move and how emotions shape decisions — the foundation most traders skip.' },
        { icon: TrendingUp, title: 'Technical Mastery',      body: 'Real chart reading from patterns to key levels — practical, direct, and immediately applicable.' },
        { icon: Zap,        title: 'Live Market Execution',  body: 'Live trade recommendations with detailed analysis for each position. Not theory — real execution.' },
        { icon: Award,      title: 'Risk Management',        body: 'The most critical skill beginners ignore. Learn to protect your capital and stay in the game long-term.' },
        { icon: Users,      title: 'Live Trading Sessions',  body: 'Learn side-by-side with professionals in live sessions covering the latest market moves.' },
      ];

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const idx = Number(e.target.getAttribute('data-story-idx'));
            if (!Number.isNaN(idx)) setActiveIdx(idx);
          }
        });
      },
      { threshold: 0.55 },
    );
    cardRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <section
      id="story"
      ref={sectionRef}
      className="bg-[#050505] py-20 md:py-28"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="container mx-auto px-4 md:px-8">
        <div data-reveal className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">
            {isArabic ? 'المسار التعليمي' : 'The curriculum'}
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">
            {isArabic ? 'من الصفر إلى الاحتراف' : 'From zero to professional'}
          </h2>
        </div>

        <div className="relative flex gap-0 lg:gap-14">
          {/* Sticky left image — desktop */}
          <div className="hidden w-1/2 shrink-0 lg:block">
            <div className="sticky top-20 h-[78vh] overflow-hidden rounded-3xl">
              {storyImages.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt=""
                  className={`cin-sticky-img h-full w-full object-cover object-center ${activeIdx === i ? 'cin-active' : ''}`}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/60 to-transparent" />
              <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
                {storyImages.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-500 ${activeIdx === i ? 'w-7 bg-[#00C176]' : 'w-1.5 bg-white/30'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right scrolling cards */}
          <div className="flex flex-1 flex-col gap-6 py-4 lg:gap-8">
            {cards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  ref={(el) => { cardRefs.current[i] = el; }}
                  data-story-idx={i}
                  className={`cin-story-card rounded-3xl border border-white/08 bg-white/[0.025] p-6 md:p-8 ${activeIdx === i ? 'cin-story-active' : ''}`}
                >
                  {/* Mobile image */}
                  <div className="mb-5 overflow-hidden rounded-2xl lg:hidden">
                    <img src={storyImages[i]} alt="" className="h-48 w-full object-cover" />
                  </div>

                  <div className="flex items-start gap-4">
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors duration-300 ${activeIdx === i ? 'bg-[#00C176]/18' : 'bg-white/05'}`}>
                      <Icon className={`h-6 w-6 transition-colors duration-300 ${activeIdx === i ? 'text-[#00C176]' : 'text-white/45'}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
                        {isArabic ? `المرحلة ${i + 1}` : `Stage ${i + 1}`}
                      </p>
                      <h3 className="mt-1 text-xl font-bold text-white md:text-2xl">{card.title}</h3>
                      <p className="mt-3 text-base leading-7 text-white/58">{card.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 4. Dashboard ─────────────────────────────────────────────────────────────
function DashboardSection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  const pillLabels = isArabic
    ? ['تحليل فني متقدم', 'توصيات مباشرة', 'إدارة المخاطر']
    : ['Advanced analysis', 'Live signals', 'Risk management'];

  return (
    <section ref={ref} className="bg-[#0A0A0A] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4 md:px-8">
        <div data-reveal className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C8A96B]">
            {isArabic ? 'منصة التداول' : 'Trading platform'}
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">
            {isArabic ? 'التحليل على أعلى مستوى' : 'Analysis at the highest level'}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/50">
            {isArabic
              ? 'لوحة تحكم تجمع التحليل الفني وتوصيات الخبراء وقوة LexAI الذكية في مكان واحد.'
              : 'A dashboard combining technical analysis, expert signals, and LexAI intelligence in one place.'}
          </p>
        </div>

        <div data-reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
          <img
            src={IMG.dashboard}
            alt={isArabic ? 'لوحة تداول XFlex' : 'XFlex trading dashboard'}
            className="h-auto w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/70 via-transparent to-transparent" />
          <div className="absolute inset-x-6 bottom-6 flex justify-between gap-3">
            {pillLabels.map((label) => (
              <div
                key={label}
                className="flex-1 rounded-xl border border-white/12 bg-black/60 px-4 py-3 text-center backdrop-blur-sm"
              >
                <span className="mb-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C176]" />
                <p className="text-xs font-semibold text-white/78">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 5. Mentor ────────────────────────────────────────────────────────────────
function MentorSection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  const statItems = isArabic
    ? [
        { value: '+5,000', label: 'طالب تخرج'      },
        { value: '8',      label: 'مراحل متكاملة'  },
        { value: '100%',   label: 'شفافية كاملة'   },
        { value: 'LexAI',  label: 'تحليل ذكي'      },
      ]
    : [
        { value: '+5,000', label: 'students trained'  },
        { value: '8',      label: 'integrated stages' },
        { value: '100%',   label: 'full transparency' },
        { value: 'LexAI',  label: 'AI analysis'       },
      ];

  return (
    <section
      id="mentor"
      ref={ref}
      className="bg-[#050505] py-20 md:py-28"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Portrait */}
          <div data-reveal className="relative overflow-hidden rounded-3xl">
            <img
              src={IMG.mentor}
              alt={isArabic ? 'مدرب XFlex' : 'XFlex mentor'}
              className="h-[500px] w-full object-cover object-top md:h-[620px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/75 via-transparent to-transparent" />
            <div className="absolute inset-x-8 bottom-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00C176]/30 bg-[#00C176]/10 px-4 py-2 text-sm font-semibold text-[#00C176]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C176]" />
                {isArabic ? 'متداول محترف' : 'Professional Trader'}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-8">
            <div data-reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">
                {isArabic ? 'عن المدرب' : 'About the mentor'}
              </p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">
                {isArabic ? 'خبرة حقيقية.\nنتائج قابلة للقياس.' : 'Real expertise.\nMeasurable results.'}
              </h2>
              <p className="mt-6 text-base leading-8 text-white/58">
                {isArabic
                  ? 'ليس مجرد معلم — بل متداول فعلي يشارك طلابه في غرفة التداول الحية، ويقدم توصيات حقيقية مبنية على تحليل دقيق ومسار واضح.'
                  : 'Not just a teacher — an active trader who shares the live trading room with students, delivering real signals built on precise analysis and a clear methodology.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {statItems.map((item, i) => (
                <div
                  key={i}
                  data-reveal
                  className="rounded-2xl border border-white/08 bg-white/[0.04] p-5"
                  style={{ transitionDelay: `${i * 70}ms` }}
                >
                  <p className="text-2xl font-extrabold text-[#00C176]">{item.value}</p>
                  <p className="mt-1 text-sm text-white/48">{item.label}</p>
                </div>
              ))}
            </div>

            <div data-reveal>
              <Link href="/contact">
                <a className="cin-btn-green inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white">
                  {isArabic ? 'تواصل مع الفريق' : 'Talk to the team'}
                  <ArrowUpRight className="h-5 w-5" />
                </a>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 6. Mobile ────────────────────────────────────────────────────────────────
function MobileSection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  const featureItems = isArabic
    ? [
        { icon: Zap,        text: 'إشعارات فورية للتوصيات'  },
        { icon: TrendingUp, text: 'تحليل الشارت المباشر'    },
        { icon: Award,      text: 'متابعة تقدمك في المراحل' },
      ]
    : [
        { icon: Zap,        text: 'Instant signal notifications' },
        { icon: TrendingUp, text: 'Live chart analysis'         },
        { icon: Award,      text: 'Track your stage progress'   },
      ];

  return (
    <section ref={ref} className="bg-[#0A0A0A] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <div data-reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C8A96B]">
                {isArabic ? 'تداول في أي مكان' : 'Trade anywhere'}
              </p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">
                {isArabic ? 'السوق في يدك' : 'The market\nin your hand'}
              </h2>
              <p className="mt-6 text-base leading-8 text-white/58">
                {isArabic
                  ? 'استقبل التوصيات، راجع تحليلات LexAI، وتابع مسارك التعليمي من هاتفك في أي وقت وأي مكان.'
                  : 'Receive signals, review LexAI analysis, and track your learning journey from your phone — anytime, anywhere.'}
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {featureItems.map(({ icon: Icon, text }, i) => (
                <div
                  key={i}
                  data-reveal
                  className="flex items-center gap-4 rounded-2xl border border-white/08 bg-white/[0.03] px-5 py-4"
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00C176]/15">
                    <Icon className="h-5 w-5 text-[#00C176]" />
                  </div>
                  <p className="text-sm font-semibold text-white/78">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal className="relative overflow-hidden rounded-3xl">
            <img
              src={IMG.mobile}
              alt={isArabic ? 'تداول على الجوال' : 'Mobile trading'}
              className="h-[520px] w-full object-cover object-center md:h-[620px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/50 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 7. Community ─────────────────────────────────────────────────────────────
function CommunitySection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  return (
    <section
      id="community"
      ref={ref}
      className="relative overflow-hidden py-28 md:py-40"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="absolute inset-0">
        <img src={IMG.community} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/55 to-[#050505]/90" />
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center md:px-8">
        <div data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C8A96B]">
            {isArabic ? 'المجتمع الحصري' : 'Exclusive community'}
          </p>
          <h2 className="mt-4 text-5xl font-extrabold tracking-[-0.03em] text-white md:text-6xl">
            {isArabic ? 'ليس فقط تعليماً —\nبل انتماء.' : 'Not just education —\na community.'}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/55 md:text-lg">
            {isArabic
              ? 'انضم إلى مجتمع من المتداولين الجادين، شارك الأفكار، وتعلّم من تجارب زملائك في السوق.'
              : 'Join a community of serious traders, share insights, and learn from real market experiences alongside your peers.'}
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm">
            <Users className="h-4 w-4 text-[#00C176]" />
            {isArabic ? '+5,000 متداول نشط' : '+5,000 active traders'}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 8. Results ───────────────────────────────────────────────────────────────
function ResultsSection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  const [countersOn, setCountersOn] = useState(false);
  const reduced = usePrefersReducedMotion();
  useScrollReveal(ref);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setCountersOn(true); },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const stats = isArabic
    ? [
        { value: 5000, suffix: '+', label: 'طالب متخرج'              },
        { value: 8,                  label: 'مراحل تعليمية متكاملة'  },
        { value: 175,  prefix: '₪',  label: 'بداية التجديد الشهري'  },
        { value: 2,                  label: 'خياران واضحان للاشتراك' },
      ]
    : [
        { value: 5000, suffix: '+', label: 'students trained'          },
        { value: 8,                  label: 'integrated learning stages' },
        { value: 175,  prefix: '₪',  label: 'starting monthly renewal'  },
        { value: 2,                  label: 'clear package options'      },
      ];

  return (
    <section ref={ref} className="relative overflow-hidden py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0">
        <img src={IMG.success} alt="" className="h-full w-full object-cover object-center" style={{ opacity: 0.18 }} />
        <div className="absolute inset-0 bg-[#050505]/82" />
      </div>

      <div className="relative z-10 container mx-auto px-4 md:px-8">
        <div data-reveal className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">
            {isArabic ? 'بالأرقام الحقيقية' : 'By the numbers'}
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">
            {isArabic ? 'نتائج تتحدث عن نفسها' : 'Results speak for themselves'}
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={i}
              data-reveal
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-sm md:p-8"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <p className="text-4xl font-extrabold text-[#00C176] md:text-5xl">
                <AnimatedCounter
                  value={s.value}
                  prefix={s.prefix}
                  suffix={s.suffix}
                  start={countersOn}
                  reduced={reduced}
                />
              </p>
              <p className="mt-3 text-sm text-white/48">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 9. Packages (full pricing hub) ──────────────────────────────────────────
function PackagesSection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const basicPricing         = getPackageDisplayPricing('basic',         20000, 5000);
  const comprehensivePricing = getPackageDisplayPricing('comprehensive', 50000, 10000);
  const { data: testimonials } = trpc.testimonials.list.useQuery();
  const ref = useRef<HTMLElement | null>(null);
  const [countersOn, setCountersOn] = useState(false);
  const reduced = usePrefersReducedMotion();
  useScrollReveal(ref);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setCountersOn(true); },
      { threshold: 0.15 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const sanitize = (v: string) =>
    v.replace(/[$₪]\s?\d[\d,.]*/g, '').replace(/\s{2,}/g, ' ').trim();

  const proofItems = useMemo(() => {
    const fallback = isArabic
      ? [
          { id: 'a', name: 'وضوح الشرح',      quote: 'الأسلوب واضح بشكل استثنائي — تعرف ماذا تفعل ومتى تتحرك من اليوم الأول.' },
          { id: 'b', name: 'الدعم والمتابعة', quote: 'المتابعة حقيقية وليست إضافة — تحس أنك مرفوق في كل خطوة.' },
          { id: 'c', name: 'الثقة بالنفس',   quote: 'الهدف بناء ثقة حقيقية في قراراتك، ليس مجرد معرفة نظرية.' },
        ]
      : [
          { id: 'a', name: 'Clarity',    quote: 'The teaching style is exceptionally clear — you know what to do and when to move from day one.' },
          { id: 'b', name: 'Support',    quote: 'The support is real and ongoing — you feel accompanied at every step.' },
          { id: 'c', name: 'Confidence', quote: 'The goal is building real confidence in your decisions, not just theoretical knowledge.' },
        ];

    if (!testimonials?.length) return fallback;

    return testimonials.slice(0, 3).map((item) => {
      const raw   = isArabic ? item.textAr : item.textEn;
      const quote = sanitize(raw);
      return {
        id:    String(item.id),
        name:  (isArabic ? item.nameAr : item.nameEn) || (isArabic ? 'طالب' : 'Student'),
        quote: quote.length > 120 ? `${quote.slice(0, 120).trim()}…` : quote,
      };
    });
  }, [isArabic, testimonials]);

  const packages = [
    {
      id:       'basic' as const,
      icon:     ShieldCheck,
      name:     isArabic ? 'الباقة الأساسية' : 'Basic',
      eyebrow:  isArabic ? 'البداية الواضحة' : 'The clear start',
      pricing:  basicPricing,
      featured: false,
      href:     '/packages/basic',
      cta:      isArabic ? 'ابدأ بالأساسية' : 'Start with Basic',
      tagline:  isArabic
        ? 'مسار كامل من الصفر مع توصيات ودعم — دون LexAI.'
        : 'Full structured path with signals and support — without LexAI.',
      features: isArabic
        ? ['8 مراحل تعليمية عملية', 'فيديوهات + PDF لكل مرحلة', 'التوصيات والدعم الفني', 'وصول دائم للمادة']
        : ['8 practical learning stages', 'Videos + PDF per stage', 'Signals and technical support', 'Permanent content access'],
    },
    {
      id:       'comprehensive' as const,
      icon:     Bot,
      name:     isArabic ? 'الباقة الشاملة' : 'Comprehensive',
      eyebrow:  isArabic ? 'الأكثر طلباً' : 'Most requested',
      pricing:  comprehensivePricing,
      featured: true,
      href:     '/packages/comprehensive',
      cta:      isArabic ? 'ابدأ بالشاملة' : 'Start with Comprehensive',
      tagline:  isArabic
        ? 'التجربة الكاملة: التعليم، التوصيات، الدعم، وLexAI كطبقة تحليل ذكية.'
        : 'The full experience: education, signals, support, and LexAI as your intelligent analysis layer.',
      features: isArabic
        ? ['كل ما في الأساسية', 'LexAI للتحليل الذكي', 'التوصيات والدعم', 'المسار الأمثل للمتداول الجاد']
        : ['Everything in Basic', 'LexAI intelligent analysis', 'Signals and support', 'Best fit for serious traders'],
    },
  ];

  return (
    <section id="packages" ref={ref} className="bg-[#0A0A0A] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4 md:px-8">

        {/* Heading */}
        <div data-reveal className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">
            {isArabic ? 'اختر مسارك' : 'Choose your path'}
          </p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">
            {isArabic ? 'باقتان واضحتان. قرار واحد.' : 'Two clear packages. One decision.'}
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/48">
            {isArabic
              ? 'جميع الأسعار بالشيكل وتشمل ضريبة 16٪. المادة التعليمية تبقى مدى الحياة.'
              : 'All prices in ILS including 16% VAT. Learning content stays with you for life.'}
          </p>
        </div>

        {/* Stats row */}
        <div data-reveal className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {(isArabic
            ? [
                { value: 5000, suffix: '+', label: 'طالب'           },
                { value: 8,                  label: 'مراحل'          },
                { value: 175,  prefix: '₪',  label: 'بداية التجديد' },
                { value: 2,                  label: 'خياران'         },
              ]
            : [
                { value: 5000, suffix: '+', label: 'students'       },
                { value: 8,                  label: 'stages'         },
                { value: 175,  prefix: '₪',  label: 'renewal from'  },
                { value: 2,                  label: 'packages'       },
              ]
          ).map((s, i) => (
            <div key={i} className="rounded-2xl border border-white/08 bg-white/[0.03] p-5 text-center">
              <p className="text-3xl font-extrabold text-[#00C176]">
                <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} start={countersOn} reduced={reduced} />
              </p>
              <p className="mt-2 text-xs text-white/40">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Proof quotes */}
        <div className="mb-12 grid gap-4 md:grid-cols-3">
          {proofItems.map((item, i) => (
            <div
              key={item.id}
              data-reveal
              className="rounded-2xl border border-white/08 bg-white/[0.025] p-5"
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#C8A96B]/80">
                <Quote className="h-3.5 w-3.5" />
                {item.name}
              </div>
              <p className="mt-3 text-sm leading-6 text-white/60">{item.quote}</p>
            </div>
          ))}
        </div>

        {/* Package cards */}
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {packages.map((pkg, i) => {
            const Icon    = pkg.icon;
            const offers  = renewalOffers.filter((o) => o.packageId === pkg.id);
            const renewalPrice = formatIlsAmount(pkg.pricing.ilsRenewal ?? 0);

            return (
              <article
                key={pkg.id}
                data-reveal
                className={`cin-pkg-card relative overflow-hidden rounded-3xl border p-7 md:p-9 ${
                  pkg.featured
                    ? 'cin-featured-line border-[#00C176]/25 bg-gradient-to-b from-[#00C176]/[0.07] to-[#050505]'
                    : 'border-white/08 bg-white/[0.035]'
                }`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    pkg.featured
                      ? 'border border-white/14 bg-white/[0.08] text-white/78'
                      : 'border border-white/08 bg-white/[0.04] text-white/48'
                  }`}>
                    <Icon className={`h-3.5 w-3.5 ${pkg.featured ? 'text-[#00C176]' : 'text-white/38'}`} />
                    {pkg.eyebrow}
                  </div>
                  {pkg.featured && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#C8A96B] to-amber-500 px-3 py-1 text-xs font-bold text-white">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {isArabic ? 'LexAI مُضمّن' : 'LexAI included'}
                    </div>
                  )}
                </div>

                <h3 className="mt-5 text-2xl font-extrabold text-white md:text-3xl">{pkg.name}</h3>
                <p className="mt-2 text-sm leading-7 text-white/52">{pkg.tagline}</p>

                <div className="mt-6 flex flex-wrap items-end gap-3">
                  <span className="text-5xl font-extrabold tracking-[-0.04em] text-[#00C176]">
                    {formatIlsAmount(pkg.pricing.ilsPrice)}
                  </span>
                  <span className="pb-1 text-sm font-semibold text-white/42">
                    {isArabic ? 'دفعة واحدة شاملة ضريبة القيمة المضافة' : 'One payment incl. VAT'}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-white/46">
                  {isArabic
                    ? `التعليم مدى الحياة · تجديد شهري ${renewalPrice}`
                    : `Lifetime learning · monthly renewal ${renewalPrice}`}
                </p>

                <ul className="mt-6 space-y-3">
                  {pkg.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-white/70">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#00C176]" />
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* Renewal options */}
                <div className="mt-7 rounded-2xl border border-white/08 bg-black/25 p-4">
                  <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                    <Clock3 className="h-3.5 w-3.5 text-[#C8A96B]" />
                    {isArabic ? 'خيارات التجديد' : 'Renewal options'}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {offers.map((offer) => {
                      const saving = offer.originalIls - offer.discountedIls;
                      return (
                        <div key={offer.id} className="rounded-xl border border-white/06 bg-white/[0.03] p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-white/78">
                              {isArabic ? `${offer.months} شهور` : `${offer.months} months`}
                            </p>
                            <span className="rounded-full bg-amber-500/[0.14] px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                              {isArabic ? `وفر ${formatIlsAmount(saving)}` : `Save ${formatIlsAmount(saving)}`}
                            </span>
                          </div>
                          <div className="mt-2 flex items-end gap-1.5">
                            <span className="text-lg font-extrabold text-[#00C176]">
                              {formatIlsAmount(offer.discountedIls)}
                            </span>
                            <span className="mb-0.5 text-xs text-white/28 line-through">
                              {formatIlsAmount(offer.originalIls)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CTAs */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link href={pkg.href}>
                    <a className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold ${
                      pkg.featured ? 'cin-btn-green text-white' : 'cin-btn-white'
                    }`}>
                      {pkg.cta}
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </Link>
                  <Link href="/contact">
                    <a className="cin-btn-ghost flex-1 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white">
                      {isArabic ? 'اسأل عن الأنسب' : 'Ask us first'}
                    </a>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* Post-purchase clarity */}
        <div data-reveal className="mx-auto mt-10 max-w-5xl rounded-3xl border border-white/07 bg-white/[0.02] p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-3">
            {(isArabic
              ? [
                  { step: '01', title: 'تفعيل فوري',        body: 'تدخل مسارك التعليمي من أول دقيقة وتحتفظ بالمحتوى مدى الحياة.' },
                  { step: '02', title: 'الخدمات حسب باقتك', body: 'التوصيات والدعم وLexAI تعمل حسب الباقة التي اخترتها.' },
                  { step: '03', title: 'تجديد عند الحاجة',   body: 'التجديد للخدمات الزمنية فقط — المحتوى التعليمي لا يتجدد.' },
                ]
              : [
                  { step: '01', title: 'Instant activation',       body: 'You enter the learning path immediately and keep the content for life.' },
                  { step: '02', title: 'Services match your plan',  body: 'Signals, support, and LexAI work according to your chosen package.' },
                  { step: '03', title: 'Renew only when needed',    body: 'Renewal applies only to timed services — learning content is permanent.' },
                ]
            ).map((item) => (
              <div key={item.step}>
                <p className="text-xs font-bold tracking-[0.24em] text-[#00C176]">{item.step}</p>
                <h3 className="mt-2 text-sm font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/42">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 10. Final CTA ────────────────────────────────────────────────────────────
function CTASection({ onScrollTo }: { onScrollTo: (id: string) => void }) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  return (
    <section ref={ref} className="relative overflow-hidden py-28 md:py-44" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0">
        <img src={IMG.cta} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/82 via-[#050505]/65 to-[#050505]/92" />
      </div>

      <div className="relative z-10 container mx-auto px-4 text-center md:px-8">
        <div data-reveal>
          <h2 className="text-5xl font-extrabold tracking-[-0.03em] text-white md:text-6xl lg:text-7xl">
            {isArabic ? 'تداول بثقة.' : 'Trade with Confidence.'}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/52">
            {isArabic
              ? 'الفرصة أمامك. المنهج جاهز. الفريق موجود. القرار في يدك.'
              : 'The opportunity is here. The curriculum is ready. The team is present. The decision is yours.'}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => onScrollTo('packages')}
              className="cin-btn-green inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white"
            >
              {isArabic ? 'ابدأ الآن' : 'Start now'}
              <ArrowUpRight className="h-5 w-5" />
            </button>
            <Link href="/contact">
              <a className="cin-btn-ghost inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white">
                {isArabic ? 'تواصل معنا' : 'Contact us'}
              </a>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function CinematicFooter() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';

  return (
    <footer className="border-t border-white/06 bg-[#050505] py-14" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div>
            <img src={APP_LOGO} alt={APP_TITLE} className="h-8 w-auto" />
            <p className="mt-3 max-w-xs text-sm text-white/38">
              {isArabic ? 'أكاديمية التداول الأولى في فلسطين.' : 'Elite trading academy — Palestine.'}
            </p>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-2 gap-8 text-sm text-white/40 sm:grid-cols-3">
            {[
              {
                heading: isArabic ? 'الأكاديمية' : 'Academy',
                links: [
                  { label: isArabic ? 'الرئيسية'       : 'Home',          href: '/'                       },
                  { label: isArabic ? 'الباقة الأساسية': 'Basic',         href: '/packages/basic'         },
                  { label: isArabic ? 'الباقة الشاملة' : 'Comprehensive', href: '/packages/comprehensive' },
                ],
              },
              {
                heading: isArabic ? 'المحتوى' : 'Content',
                links: [
                  { label: isArabic ? 'محتوى مجاني' : 'Free content', href: '/free-content' },
                  { label: isArabic ? 'المقالات'    : 'Articles',      href: '/articles'     },
                  { label: isArabic ? 'الأحداث'     : 'Events',        href: '/events'       },
                ],
              },
              {
                heading: isArabic ? 'الدعم' : 'Support',
                links: [
                  { label: isArabic ? 'تواصل معنا'      : 'Contact', href: '/contact' },
                  { label: isArabic ? 'الأسئلة الشائعة' : 'FAQ',     href: '/faq'     },
                  { label: isArabic ? 'تسجيل الدخول'    : 'Login',   href: '/login'   },
                ],
              },
            ].map((col) => (
              <div key={col.heading} className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/20">{col.heading}</p>
                {col.links.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <a className="transition-colors hover:text-white">{link.label}</a>
                  </Link>
                ))}
              </div>
            ))}
          </div>

          {/* Social */}
          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/20">
              {isArabic ? 'تابعنا' : 'Follow us'}
            </p>
            <div className="flex gap-3">
              {[
                { icon: Instagram, href: 'https://www.instagram.com/xflex.academy?igsh=NG9jZng1emlxM3I3', label: 'Instagram' },
                { icon: Facebook,  href: 'https://www.facebook.com/share/1Aj9HNNwsv/?mibextid=wwXIfr',    label: 'Facebook'  },
                { icon: Phone,     href: 'https://wa.me/972597596030',                                      label: 'WhatsApp'  },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/40 transition-colors hover:border-white/22 hover:text-white"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/05 pt-6 text-xs text-white/24 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {APP_TITLE}. {isArabic ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}</p>
          <p>{isArabic ? 'جميع الأسعار بالشيكل وتشمل ضريبة القيمة المضافة 16٪.' : 'All prices in ILS and include 16% VAT.'}</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────
export default function TestHomePrototype() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <CinematicStyles />
      <CinematicNav onScrollTo={scrollTo} />
      <main>
        <HeroSection    onScrollTo={scrollTo} />
        <TrustBar />
        <StickyStorySection />
        <DashboardSection />
        <MentorSection />
        <MobileSection />
        <CommunitySection />
        <ResultsSection />
        <PackagesSection />
        <CTASection     onScrollTo={scrollTo} />
      </main>
      <CinematicFooter />
    </div>
  );
}
