/**
 * /test2 — Cinematic landing page with enhanced glow + premium fintech polish.
 * Layered on top of /test: ambient glow orbs, mouse spotlight, animated chart line,
 * particle field, scroll progress, trust badges, testimonial carousel, FAQ accordion.
 * Standalone — does NOT touch Home or /test.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowUpRight, Award, Bot, CheckCircle, ChevronDown, Clock3,
  Facebook, Instagram, Phone, Lock, Menu, MessageCircle, Quote, ShieldCheck,
  Sparkles, Star, Target, TrendingUp, Users, X, Zap,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLanguageSwitchLabel } from '@/lib/languageToggle';
import { formatIlsAmount, getPackageDisplayPricing } from '@/lib/packagePricing';
import { trpc } from '@/lib/trpc';
import { APP_TITLE } from '@/const';

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
const ACCENT = '#00C176';
const TEST2_LOGO = '/xflex-logo-2026-transparent.png';

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

// ─── Global cinematic + glow styles ───────────────────────────────────────────
function CinematicStyles() {
  return (
    <style>{`
      :root { --cin-ease: ${EASE}; --cin-accent: ${ACCENT}; }

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
        opacity: 1; transform: none; filter: none;
      }
      @media (prefers-reduced-motion: reduce) {
        [data-reveal] { opacity: 1 !important; transform: none !important; filter: none !important; transition: none !important; }
      }

      /* Hero entry */
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
      .cin-hero-5 { animation: cin-hero-in 900ms var(--cin-ease) 680ms both; }
      .cin-bg-zoom { animation: cin-bg-zoom 6s var(--cin-ease) both; }

      /* Brand mark */
      .cin-logo-img {
        display: block;
        height: auto;
        object-fit: contain;
        filter:
          drop-shadow(0 0 12px rgba(0,193,118,0.18))
          drop-shadow(0 0 28px rgba(0,193,118,0.12));
      }
      .cin-logo-header {
        width: clamp(150px, 16vw, 236px);
      }
      .cin-logo-footer {
        width: clamp(168px, 15vw, 220px);
      }
      @media (max-width: 767px) {
        .cin-logo-img {
          filter:
            drop-shadow(0 0 14px rgba(0,193,118,0.26))
            drop-shadow(0 0 30px rgba(0,193,118,0.18));
        }
        .cin-logo-header {
          width: 156px;
        }
        .cin-logo-footer {
          width: 172px;
        }
      }

      /* Float */
      @keyframes cin-float { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-10px,0); } }
      .cin-float-1 { animation: cin-float 4.8s ease-in-out infinite; }
      .cin-float-2 { animation: cin-float 5.6s ease-in-out 1.2s infinite; }
      .cin-float-3 { animation: cin-float 6.2s ease-in-out 0.6s infinite; }
      .cin-float-4 { animation: cin-float 5.2s ease-in-out 1.8s infinite; }

      /* Marquee */
      @keyframes cin-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      .cin-marquee { animation: cin-marquee 28s linear infinite; }

      /* Sticky crossfade */
      .cin-sticky-img {
        position: absolute; inset: 0;
        opacity: 0;
        transform: scale(1.08);
        filter: blur(6px);
        transition: opacity 900ms var(--cin-ease), transform 1600ms var(--cin-ease), filter 900ms var(--cin-ease);
        will-change: opacity, transform, filter;
      }
      .cin-sticky-img.cin-active {
        opacity: 1;
        transform: scale(1);
        filter: blur(0);
      }

      /* ─── GLOW SYSTEM ─────────────────────────────────────────────────── */

      /* Ambient pulsing orbs in section backgrounds */
      @keyframes cin-glow-pulse {
        0%, 100% { opacity: 0.45; transform: scale(1); }
        50%      { opacity: 0.75; transform: scale(1.08); }
      }
      .cin-orb {
        position: absolute;
        border-radius: 9999px;
        filter: blur(80px);
        pointer-events: none;
        will-change: transform, opacity;
        animation: cin-glow-pulse 8s ease-in-out infinite;
      }
      .cin-orb-green  { background: radial-gradient(circle, rgba(0,193,118,0.55) 0%, rgba(0,193,118,0) 70%); }
      .cin-orb-gold   { background: radial-gradient(circle, rgba(200,169,107,0.40) 0%, rgba(200,169,107,0) 70%); }
      .cin-orb-purple { background: radial-gradient(circle, rgba(168,85,247,0.35)  0%, rgba(168,85,247,0)  70%); }

      /* Mouse spotlight */
      .cin-spotlight {
        position: absolute; inset: 0; pointer-events: none;
        background: radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), rgba(0,193,118,0.18), transparent 60%);
        transition: background 200ms ease-out;
      }

      /* Particle field */
      @keyframes cin-particle-rise {
        from { transform: translate3d(0, 100vh, 0); opacity: 0; }
        10%  { opacity: 0.6; }
        90%  { opacity: 0.4; }
        to   { transform: translate3d(0, -10vh, 0); opacity: 0; }
      }
      .cin-particle {
        position: absolute; bottom: 0;
        width: 3px; height: 3px; border-radius: 9999px;
        background: rgba(0,193,118,0.55);
        box-shadow: 0 0 8px rgba(0,193,118,0.6);
        will-change: transform, opacity;
      }

      /* Scroll progress */
      .cin-scroll-bar {
        position: fixed; top: 0; left: 0; height: 2px;
        background: linear-gradient(90deg, transparent, ${ACCENT}, rgba(200,169,107,0.9), transparent);
        box-shadow: 0 0 12px rgba(0,193,118,0.7);
        z-index: 100;
        transition: width 80ms linear;
      }

      /* Animated chart line in hero */
      @keyframes cin-chart-draw {
        from { stroke-dashoffset: 1200; }
        to   { stroke-dashoffset: 0; }
      }
      @keyframes cin-chart-pulse {
        0%, 100% { opacity: 0.18; }
        50%      { opacity: 0.35; }
      }
      .cin-chart-path {
        stroke: ${ACCENT};
        stroke-width: 1.5;
        fill: none;
        stroke-dasharray: 1200;
        animation:
          cin-chart-draw 4.5s var(--cin-ease) both,
          cin-chart-pulse 5s ease-in-out 4.5s infinite;
        filter: drop-shadow(0 0 8px rgba(0,193,118,0.6));
      }
      .cin-chart-area {
        fill: url(#cin-chart-grad);
        opacity: 0;
        animation: cin-chart-pulse 5s ease-in-out 4.5s infinite;
      }

      /* Buttons — premium with strong glow */
      .cin-btn-green {
        position: relative;
        background: linear-gradient(135deg, #00D17F 0%, #009E63 100%);
        box-shadow:
          0 16px 40px rgba(0,193,118,0.32),
          0 0 0 1px rgba(0,193,118,0.35) inset,
          0 0 24px rgba(0,193,118,0.18);
        transition: transform 320ms var(--cin-ease), box-shadow 320ms var(--cin-ease);
      }
      .cin-btn-green::after {
        content: ''; position: absolute; inset: -2px; border-radius: inherit;
        background: radial-gradient(circle at 50% 100%, rgba(0,193,118,0.55), transparent 70%);
        opacity: 0; transition: opacity 320ms var(--cin-ease);
        z-index: -1; filter: blur(14px);
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
        position: relative; overflow: hidden;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(255,255,255,0.05);
        backdrop-filter: blur(14px);
        transition: background 280ms var(--cin-ease), border-color 280ms var(--cin-ease), transform 280ms var(--cin-ease);
      }
      .cin-btn-ghost::before {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(120deg, transparent 30%, rgba(0,193,118,0.18) 50%, transparent 70%);
        transform: translateX(-100%);
        transition: transform 700ms var(--cin-ease);
      }
      .cin-btn-ghost:hover {
        background: rgba(255,255,255,0.10);
        border-color: rgba(0,193,118,0.4);
        transform: translate3d(0,-2px,0);
      }
      .cin-btn-ghost:hover::before { transform: translateX(100%); }

      .cin-btn-white {
        background: rgba(255,255,255,0.96);
        color: #050505;
        box-shadow: 0 16px 40px rgba(255,255,255,0.10);
        transition: transform 320ms var(--cin-ease), background 280ms var(--cin-ease), box-shadow 320ms var(--cin-ease);
      }
      .cin-btn-white:hover {
        transform: translate3d(0,-4px,0) scale(1.015);
        background: #ffffff;
        box-shadow: 0 24px 56px rgba(255,255,255,0.20);
      }

      /* Package cards */
      .cin-pkg-card { transition: transform 320ms var(--cin-ease), box-shadow 320ms var(--cin-ease), border-color 320ms var(--cin-ease); }
      .cin-pkg-card:hover { transform: translate3d(0,-10px,0); }
      .cin-pkg-featured {
        box-shadow:
          0 30px 70px rgba(0,193,118,0.18),
          0 0 0 1px rgba(0,193,118,0.30) inset,
          0 0 60px rgba(0,193,118,0.12);
      }
      .cin-pkg-featured:hover {
        box-shadow:
          0 40px 90px rgba(0,193,118,0.30),
          0 0 0 1px rgba(0,193,118,0.50) inset,
          0 0 90px rgba(0,193,118,0.22);
      }

      /* Glow ring on portrait/cards */
      .cin-glow-ring {
        position: relative;
      }
      .cin-glow-ring::before {
        content: ''; position: absolute; inset: -2px; border-radius: inherit;
        background: linear-gradient(135deg, rgba(0,193,118,0.55), rgba(200,169,107,0.30), rgba(0,193,118,0.55));
        z-index: -1; filter: blur(18px); opacity: 0.55;
        animation: cin-glow-pulse 6s ease-in-out infinite;
      }

      /* Nav */
      .cin-nav { transition: background 400ms var(--cin-ease), border-color 400ms; }
      .cin-nav.cin-nav-scrolled {
        background: rgba(5,5,5,0.92);
        border-bottom: 1px solid rgba(255,255,255,0.07);
        backdrop-filter: blur(28px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      }

      /* Story card active */
      .cin-story-card { transition: border-color 400ms var(--cin-ease), background 400ms var(--cin-ease), box-shadow 400ms var(--cin-ease); }
      .cin-story-card.cin-story-active {
        border-color: rgba(0,193,118,0.35) !important;
        background: rgba(0,193,118,0.06) !important;
        box-shadow: 0 16px 48px rgba(0,193,118,0.18), 0 0 60px rgba(0,193,118,0.06);
      }

      /* Featured top glow line */
      .cin-featured-line { position: relative; }
      .cin-featured-line::before {
        content: ''; position: absolute; top: -1px; left: 0; right: 0; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(0,193,118,0.7), transparent);
        pointer-events: none;
      }

      /* Trust badge */
      .cin-trust-badge {
        transition: transform 280ms var(--cin-ease), box-shadow 280ms var(--cin-ease), border-color 280ms;
      }
      .cin-trust-badge:hover {
        transform: translate3d(0,-3px,0);
        border-color: rgba(0,193,118,0.40);
        box-shadow: 0 12px 32px rgba(0,193,118,0.18);
      }

      /* FAQ */
      .cin-faq-item summary { list-style: none; cursor: pointer; }
      .cin-faq-item summary::-webkit-details-marker { display: none; }
      .cin-faq-chev { transition: transform 280ms var(--cin-ease); }
      .cin-faq-item[open] .cin-faq-chev { transform: rotate(180deg); }
      .cin-faq-item { transition: border-color 320ms var(--cin-ease), background 320ms var(--cin-ease); }
      .cin-faq-item[open] {
        border-color: rgba(0,193,118,0.30) !important;
        background: rgba(0,193,118,0.04) !important;
      }
      .cin-faq-body {
        max-height: 0; opacity: 0; overflow: hidden;
        transition: max-height 320ms var(--cin-ease), opacity 320ms var(--cin-ease);
      }
      .cin-faq-item[open] .cin-faq-body { max-height: 320px; opacity: 1; }

      /* Counter glow */
      .cin-stat-num {
        text-shadow: 0 0 24px rgba(0,193,118,0.35);
      }

      /* Gradient section divider */
      .cin-section-div {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(0,193,118,0.25), rgba(200,169,107,0.20), rgba(0,193,118,0.25), transparent);
      }
    `}</style>
  );
}

// ─── Scroll progress bar ──────────────────────────────────────────────────────
function ScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const total = h.scrollHeight - h.clientHeight;
      setPct(total > 0 ? (h.scrollTop / total) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return <div className="cin-scroll-bar" style={{ width: `${pct}%` }} />;
}

// ─── Particle field (subtle) ──────────────────────────────────────────────────
function ParticleField({ count = 14 }: { count?: number }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const left = Math.random() * 100;
        const dur = 14 + Math.random() * 18;
        const delay = -Math.random() * dur;
        const size = 1.5 + Math.random() * 2.5;
        return (
          <span
            key={i}
            className="cin-particle"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              animation: `cin-particle-rise ${dur}s linear ${delay}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Animated SVG chart line for hero background ──────────────────────────────
function AnimatedChartBg() {
  return (
    <svg
      className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 w-full opacity-50"
      viewBox="0 0 1200 400"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cin-chart-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={ACCENT} stopOpacity="0.35" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="cin-chart-area"
        d="M0,320 L80,290 L160,310 L240,250 L320,270 L400,210 L480,230 L560,170 L640,200 L720,140 L800,160 L880,110 L960,130 L1040,80 L1120,100 L1200,60 L1200,400 L0,400 Z"
      />
      <path
        className="cin-chart-path"
        d="M0,320 L80,290 L160,310 L240,250 L320,270 L400,210 L480,230 L560,170 L640,200 L720,140 L800,160 L880,110 L960,130 L1040,80 L1120,100 L1200,60"
      />
    </svg>
  );
}

// ─── Animated counter ─────────────────────────────────────────────────────────
function AnimatedCounter({
  value, prefix = '', suffix = '', start, reduced,
}: {
  value: number; prefix?: string; suffix?: string; start: boolean; reduced: boolean;
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
  return <span className="cin-stat-num">{prefix}{Math.round(display).toLocaleString()}{suffix}</span>;
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
    ? [['الباقات', 'packages'], ['المسار', 'story'], ['المدرب', 'mentor'], ['الأسئلة', 'faq']]
    : [['Packages', 'packages'], ['Curriculum', 'story'], ['Mentor', 'mentor'], ['FAQ', 'faq']];

  return (
    <header className={`cin-nav fixed inset-x-0 top-0 z-50 ${scrolled ? 'cin-nav-scrolled' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:h-20 md:px-8">
        <Link href="/"><a className="flex shrink-0 items-center gap-2"><img src={TEST2_LOGO} alt={APP_TITLE} className="cin-logo-img cin-logo-header" /></a></Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-white/65 md:flex">
          {navLinks.map(([label, id]) => (
            <button key={id} type="button" onClick={() => onScrollTo(id)} className="transition-colors duration-200 hover:text-white">{label}</button>
          ))}
        </nav>
        <div className="hidden items-center gap-4 md:flex">
          <button type="button" onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')} className="text-xs font-semibold text-white/55 transition-colors hover:text-white">
            {getLanguageSwitchLabel(language)}
          </button>
          <button type="button" onClick={() => onScrollTo('packages')} className="cin-btn-green inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white">
            {isArabic ? 'ابدأ الآن' : 'Get Started'}<ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
        <button type="button" className="text-white/70 hover:text-white md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {menuOpen && (
        <div className="border-t border-white/10 bg-[#0A0A0A]/96 px-4 pb-6 pt-4 backdrop-blur-2xl md:hidden">
          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="inline-flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/80"
            >
              <span>{isArabic ? 'اللغة' : 'Language'}</span>
              <span className="text-[#00C176]">{getLanguageSwitchLabel(language)}</span>
            </button>
            {navLinks.map(([label, id]) => (
              <button key={id} type="button" onClick={() => { onScrollTo(id); setMenuOpen(false); }} className="text-start text-base font-medium text-white/70 hover:text-white">{label}</button>
            ))}
            <button type="button" onClick={() => { onScrollTo('packages'); setMenuOpen(false); }} className="cin-btn-green mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white">
              {isArabic ? 'ابدأ الآن' : 'Get Started'}<ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── 1. Hero (with mouse spotlight + chart bg + particles + glow orbs) ───────
function HeroSection({ onScrollTo }: { onScrollTo: (id: string) => void }) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const heroRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;
      el.style.setProperty('--mx', `${x}%`);
      el.style.setProperty('--my', `${y}%`);
    };
    el.addEventListener('mousemove', onMove);
    return () => el.removeEventListener('mousemove', onMove);
  }, []);

  const heroHighlights = isArabic
    ? [
        {
          id: 'students',
          icon: TrendingUp,
          label: 'الطلاب النشطون',
          value: '+5,000',
          detail: null,
          valueClass: 'text-2xl',
          cardClass: 'border-white/15 bg-white/[0.07]',
          iconWrapClass: 'bg-[#00C176]/22',
          iconClass: 'text-[#00C176]',
          shadow: '0 24px 60px rgba(0,193,118,0.18)',
          floatClass: 'cin-float-1',
        },
        {
          id: 'stages',
          icon: Award,
          label: 'المراحل التعليمية',
          value: '8 مراحل',
          detail: null,
          valueClass: 'text-2xl',
          cardClass: 'border-[#00C176]/25 bg-[#00C176]/[0.10]',
          iconWrapClass: 'bg-[#C8A96B]/22',
          iconClass: 'text-[#C8A96B]',
          shadow: '0 24px 60px rgba(0,193,118,0.22)',
          floatClass: 'cin-float-2',
        },
        {
          id: 'lexai',
          icon: Sparkles,
          label: 'تحليل ذكي',
          value: 'LexAI',
          detail: null,
          valueClass: 'text-xl',
          cardClass: 'border-white/15 bg-white/[0.07]',
          iconWrapClass: 'bg-[#00C176]/22',
          iconClass: 'text-[#00C176]',
          shadow: '0 24px 60px rgba(0,193,118,0.18)',
          floatClass: 'cin-float-3',
        },
        {
          id: 'live-trading',
          icon: Users,
          label: 'جلسات مباشرة',
          value: 'تداول لايف',
          detail: null,
          valueClass: 'text-xl',
          cardClass: 'border-white/15 bg-white/[0.07]',
          iconWrapClass: 'bg-[#C8A96B]/20',
          iconClass: 'text-[#C8A96B]',
          shadow: '0 24px 60px rgba(200,169,107,0.18)',
          floatClass: 'cin-float-4',
        },
      ]
    : [
        {
          id: 'students',
          icon: TrendingUp,
          label: 'Active students',
          value: '+5,000',
          detail: null,
          valueClass: 'text-2xl',
          cardClass: 'border-white/15 bg-white/[0.07]',
          iconWrapClass: 'bg-[#00C176]/22',
          iconClass: 'text-[#00C176]',
          shadow: '0 24px 60px rgba(0,193,118,0.18)',
          floatClass: 'cin-float-1',
        },
        {
          id: 'stages',
          icon: Award,
          label: 'Learning stages',
          value: '8 stages',
          detail: null,
          valueClass: 'text-2xl',
          cardClass: 'border-[#00C176]/25 bg-[#00C176]/[0.10]',
          iconWrapClass: 'bg-[#C8A96B]/22',
          iconClass: 'text-[#C8A96B]',
          shadow: '0 24px 60px rgba(0,193,118,0.22)',
          floatClass: 'cin-float-2',
        },
        {
          id: 'lexai',
          icon: Sparkles,
          label: 'AI-powered',
          value: 'LexAI',
          detail: null,
          valueClass: 'text-xl',
          cardClass: 'border-white/15 bg-white/[0.07]',
          iconWrapClass: 'bg-[#00C176]/22',
          iconClass: 'text-[#00C176]',
          shadow: '0 24px 60px rgba(0,193,118,0.18)',
          floatClass: 'cin-float-3',
        },
        {
          id: 'live-trading',
          icon: Users,
          label: 'Live sessions',
          value: 'Live trading',
          detail: null,
          valueClass: 'text-xl',
          cardClass: 'border-white/15 bg-white/[0.07]',
          iconWrapClass: 'bg-[#C8A96B]/20',
          iconClass: 'text-[#C8A96B]',
          shadow: '0 24px 60px rgba(200,169,107,0.18)',
          floatClass: 'cin-float-4',
        },
      ];

  return (
    <section ref={heroRef} className="relative flex min-h-screen flex-col items-start justify-center overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Background image */}
      <div className="cin-bg-zoom absolute inset-0">
        <img src={IMG.hero} alt="" className="h-full w-full object-cover object-center" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/92 via-[#050505]/70 to-[#050505]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/85 via-transparent to-transparent" />
      </div>

      {/* Animated SVG chart line */}
      <AnimatedChartBg />

      {/* Mouse spotlight */}
      <div className="cin-spotlight" />

      {/* Glow orbs */}
      <div className="cin-orb cin-orb-green"  style={{ width: 520, height: 520, top: '-10%', right: '-8%' }} />
      <div className="cin-orb cin-orb-purple" style={{ width: 360, height: 360, bottom: '-12%', left: '-6%', animationDelay: '2s' }} />
      <div className="cin-orb cin-orb-gold"   style={{ width: 280, height: 280, top: '40%', left: '30%', animationDelay: '4s' }} />

      {/* Particles */}
      <ParticleField count={18} />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 pb-20 pt-24 md:px-8">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div className="max-w-2xl">
            <div className="cin-hero-1 inline-flex items-center gap-2 rounded-full border border-[#00C176]/35 bg-[#00C176]/12 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]" style={{ boxShadow: '0 0 24px rgba(0,193,118,0.25)' }}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
              {isArabic ? 'أكاديمية التداول الأولى في فلسطين' : 'Elite Trading Academy — Palestine'}
            </div>

            <h1 className="cin-hero-2 mt-6 text-5xl font-extrabold leading-[1.08] tracking-[-0.03em] text-white md:text-6xl lg:text-[4.25rem]">
              {isArabic ? (<>تداول بثقة.<br /><span className="text-[#00C176]" style={{ textShadow: '0 0 40px rgba(0,193,118,0.45)' }}>ابنِ مستقبلك.</span></>) : (<>Trade with<br /><span className="text-[#00C176]" style={{ textShadow: '0 0 40px rgba(0,193,118,0.45)' }}>Confidence.</span></>)}
            </h1>

            <p className="cin-hero-3 mt-6 max-w-xl text-base leading-8 text-white/70 md:text-lg">
              {isArabic ? 'مسار تعليمي متكامل من الصفر حتى الاحتراف، توصيات مباشرة، وتحليل ذكي من LexAI — كل شيء في مكان واحد.' : 'A complete structured curriculum, live trade recommendations, and LexAI intelligence — everything you need to trade at a professional level.'}
            </p>

            <div className="cin-hero-4 mt-9 flex flex-wrap gap-4">
              <button type="button" onClick={() => onScrollTo('packages')} className="cin-btn-green inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white">
                {isArabic ? 'ابدأ رحلتك' : 'Start your journey'}<ArrowUpRight className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => onScrollTo('story')} className="cin-btn-ghost inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white">
                {isArabic ? 'اكتشف المسار' : 'Explore the path'}
              </button>
            </div>

            {/* Inline trust mini-row */}
            <div className="cin-hero-5 mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-white/55">
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#00C176]" />{isArabic ? 'دفع آمن' : 'Secure payments'}</div>
              <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-[#00C176]" />{isArabic ? 'بيانات محمية' : 'Encrypted data'}</div>
              <div className="flex items-center gap-2"><Star className="h-4 w-4 text-[#C8A96B]" />{isArabic ? '+5,000 طالب' : '+5,000 students'}</div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:hidden">
              {heroHighlights.map(({ id, icon: Icon, label, value, detail, valueClass, cardClass, iconWrapClass, iconClass, shadow }) => (
                <div key={id} className={`flex items-center gap-3 rounded-2xl px-4 py-4 backdrop-blur-xl ${cardClass}`} style={{ boxShadow: shadow }}>
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconWrapClass}`}><Icon className={`h-5 w-5 ${iconClass}`} /></div>
                  <div>
                    <p className="text-xs font-semibold text-white/60">{label}</p>
                    <p className={`${valueClass} font-extrabold text-white`}>{value}</p>
                    {detail ? <p className="mt-0.5 text-xs font-semibold text-[#00C176]">{detail}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Floating cards (desktop) */}
          <div className="hidden flex-col items-end gap-4 lg:flex">
            {heroHighlights.map(({ id, icon: Icon, label, value, detail, valueClass, cardClass, iconWrapClass, iconClass, shadow, floatClass }) => (
              <div key={id} className={`${floatClass} flex items-center gap-3 rounded-2xl px-5 py-4 backdrop-blur-xl ${cardClass}`} style={{ boxShadow: shadow }}>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconWrapClass}`}><Icon className={`h-5 w-5 ${iconClass}`} /></div>
                <div>
                  <p className="text-xs font-semibold text-white/60">{label}</p>
                  <p className={`${valueClass} font-extrabold text-white`}>{value}</p>
                  {detail ? <p className="mt-0.5 text-xs font-semibold text-[#00C176]">{detail}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/40">
        <p className="text-[10px] uppercase tracking-widest">{isArabic ? 'اكتشف' : 'Scroll'}</p>
        <ChevronDown className="h-5 w-5 animate-bounce" />
      </div>
    </section>
  );
}

// ─── 2. Trust badges row (NEW) ────────────────────────────────────────────────
function TrustBadgesRow() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const badges = isArabic
    ? [
        { icon: ShieldCheck, title: 'دفع آمن',        sub: 'حوالة بنكية موثوقة' },
        { icon: Lock,        title: 'بيانات محمية',   sub: 'تشفير من طرف لطرف' },
        { icon: Award,       title: 'محتوى أصلي',     sub: 'منهج مبني على خبرة سنوات' },
        { icon: MessageCircle, title: 'دعم بشري',     sub: 'فريق فعلي متاح يومياً' },
      ]
    : [
        { icon: ShieldCheck, title: 'Secure payments',  sub: 'Trusted bank transfer' },
        { icon: Lock,        title: 'Encrypted data',   sub: 'End-to-end protection' },
        { icon: Award,       title: 'Original content', sub: 'Built on years of expertise' },
        { icon: MessageCircle, title: 'Human support',  sub: 'Real team, daily availability' },
      ];
  return (
    <section className="relative bg-[#070707] py-10 md:py-12" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="cin-orb cin-orb-green" style={{ width: 500, height: 500, top: '-50%', left: '-10%', opacity: 0.18 }} />
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {badges.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="cin-trust-badge flex items-center gap-3 rounded-2xl border border-white/08 bg-white/[0.03] px-4 py-4 md:px-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00C176]/15">
                <Icon className="h-5 w-5 text-[#00C176]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="mt-0.5 text-xs text-white/45">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 3. Trust marquee ─────────────────────────────────────────────────────────
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
          <span key={i} className="inline-flex items-center gap-3 px-8 text-sm font-semibold text-white/45">
            <span className="h-1 w-1 rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 6px #00C176' }} />{item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── 4. Sticky storytelling ───────────────────────────────────────────────────
function StickyStorySection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const sectionRef = useRef<HTMLElement | null>(null);
  useScrollReveal(sectionRef);

  const desktopStoryImagePosition = '12% center';

  const allCards = isArabic
    ? [
        { icon: Target,     title: 'علم نفس السوق',            body: 'افهم كيف تتحرك الأسواق وكيف تؤثر العواطف على قراراتك — الأساس الذي يفتقده أغلب المتداولين.' },
        { icon: TrendingUp, title: 'التحليل الفني و الاساسي الاحترافي', body: 'ادمج قراءة الشارت مع فهم الأخبار والبيانات الاقتصادية لتبني رؤية أوضح وأكثر توازناً قبل أي قرار.' },
        { icon: Zap,        title: 'التنفيذ الحقيقي في السوق', body: 'توصيات حية مع تحليل مفصّل لكل صفقة — ليس تعليماً نظرياً بل تنفيذ فعلي في السوق.' },
        { icon: Award,      title: 'إدارة المخاطر',            body: 'أهم مهارة يتجاهلها المبتدئون. تعلّم كيف تحمي رأسمالك وتبقى في السوق على المدى البعيد.' },
        { icon: Users,      title: 'جلسات تداول مباشرة',       body: 'تعلّم جنباً إلى جنب مع محترفين في جلسات مباشرة تغطي أحدث حركات السوق.' },
        { icon: CheckCircle, title: 'بناء الخطة التداولية',    body: 'حوّل المعرفة إلى قواعد واضحة للدخول والخروج وإدارة الصفقة، حتى لا يصبح قرارك رهين المزاج اللحظي.' },
        { icon: ShieldCheck, title: 'مراجعة الأداء والانضباط', body: 'راجع صفقاتك بوعي، اكتشف الأخطاء المتكررة، وطوّر انضباطاً يحافظ على ثباتك مع الوقت.' },
        { icon: Star,       title: 'الانتقال إلى الاحتراف',     body: 'منهج يربط التعليم بالتطبيق والمتابعة حتى تبني روتين متداول منظم وواثق على المدى الطويل.' },
      ]
    : [
        { icon: Target,     title: 'Market Psychology',      body: 'Understand how markets move and how emotions shape decisions — the foundation most traders skip.' },
        { icon: TrendingUp, title: 'Technical and Fundamental Analysis', body: 'Blend chart reading with news and macro context so every decision is built on a clearer market view.' },
        { icon: Zap,        title: 'Live Market Execution',  body: 'Live trade recommendations with detailed analysis for each position. Not theory — real execution.' },
        { icon: Award,      title: 'Risk Management',        body: 'The most critical skill beginners ignore. Learn to protect your capital and stay in the game long-term.' },
        { icon: Users,      title: 'Live Trading Sessions',  body: 'Learn side-by-side with professionals in live sessions covering the latest market moves.' },
        { icon: CheckCircle, title: 'Trading Plan Design',    body: 'Turn knowledge into clear entry, exit, and risk rules so your execution is driven by process, not mood.' },
        { icon: ShieldCheck, title: 'Performance Review and Discipline', body: 'Review your trades, spot repeated mistakes, and build the discipline that keeps performance stable over time.' },
        { icon: Star,       title: 'Professional Progression', body: 'A structured path that connects learning, execution, and follow-up so you grow into a confident, organized trader.' },
      ];

  const allImages = [IMG.academy, IMG.dashboard, IMG.tech, IMG.workspace, IMG.learn, IMG.mentor, IMG.community, IMG.success];

  // Split into two sticky chapters so each chapter's cards column ≈ the sticky panel height,
  // keeping the sticky image visible beside the cards for the whole scroll.
  const chapterOne = { cards: allCards.slice(0, 4), images: allImages.slice(0, 4), startIndex: 0 };
  const chapterTwo = { cards: allCards.slice(4, 8), images: allImages.slice(4, 8), startIndex: 4 };

  return (
    <section id="story" ref={sectionRef} className="relative bg-[#050505] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="cin-orb cin-orb-green" style={{ width: 500, height: 500, top: '10%', right: '-15%' }} />
      </div>
      <div className="container mx-auto px-4 md:px-8">
        <div data-reveal className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">{isArabic ? 'المسار التعليمي' : 'The curriculum'}</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">{isArabic ? 'من الصفر إلى الاحتراف' : 'From zero to professional'}</h2>
        </div>

        <StickyStoryChapter
          cards={chapterOne.cards}
          images={chapterOne.images}
          startIndex={chapterOne.startIndex}
          isArabic={isArabic}
          desktopStoryImagePosition={desktopStoryImagePosition}
        />
        <div className="mt-12 lg:mt-16" />
        <StickyStoryChapter
          cards={chapterTwo.cards}
          images={chapterTwo.images}
          startIndex={chapterTwo.startIndex}
          isArabic={isArabic}
          desktopStoryImagePosition={desktopStoryImagePosition}
        />
      </div>
    </section>
  );
}

type StickyStoryCard = { icon: typeof Target; title: string; body: string };

function StickyStoryChapter({
  cards,
  images,
  startIndex,
  isArabic,
  desktopStoryImagePosition,
}: {
  cards: StickyStoryCard[];
  images: string[];
  startIndex: number;
  isArabic: boolean;
  desktopStoryImagePosition: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

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
    <div className="relative flex gap-0 lg:gap-14">
      <div className="hidden w-1/2 shrink-0 lg:block">
        <div className="cin-glow-ring sticky top-20 h-[78vh] overflow-hidden rounded-3xl">
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt=""
              className={`cin-sticky-img h-full w-full object-cover ${activeIdx === i ? 'cin-active' : ''}`}
              style={{ objectPosition: desktopStoryImagePosition }}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/65 to-transparent" />
          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
            {images.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${activeIdx === i ? 'w-7 bg-[#00C176]' : 'w-1.5 bg-white/30'}`}
                style={activeIdx === i ? { boxShadow: '0 0 10px #00C176' } : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 py-4 lg:gap-8">
        {cards.map((card, i) => {
          const Icon = card.icon;
          const stageNumber = startIndex + i + 1;
          return (
            <div
              key={i}
              ref={(el) => { cardRefs.current[i] = el; }}
              data-story-idx={i}
              className={`cin-story-card rounded-3xl border border-white/08 bg-white/[0.025] p-6 md:p-8 ${activeIdx === i ? 'cin-story-active' : ''}`}
            >
              <div className="mb-5 overflow-hidden rounded-2xl lg:hidden">
                <img src={images[i]} alt="" className="h-48 w-full object-cover" />
              </div>
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors duration-300 ${activeIdx === i ? 'bg-[#00C176]/22' : 'bg-white/05'}`}
                  style={activeIdx === i ? { boxShadow: '0 0 24px rgba(0,193,118,0.35)' } : undefined}
                >
                  <Icon className={`h-6 w-6 transition-colors duration-300 ${activeIdx === i ? 'text-[#00C176]' : 'text-white/45'}`} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">{isArabic ? `المرحلة ${stageNumber}` : `Stage ${stageNumber}`}</p>
                  <h3 className="mt-1 text-xl font-bold text-white md:text-2xl">{card.title}</h3>
                  <p className="mt-3 text-base leading-7 text-white/60">{card.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 5. Dashboard ─────────────────────────────────────────────────────────────
function DashboardSection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  const pillLabels = isArabic
    ? ['تحليل فني متقدم', 'توصيات مباشرة', 'إدارة المخاطر']
    : ['Advanced analysis', 'Live signals', 'Risk management'];

  return (
    <section ref={ref} className="relative overflow-hidden bg-[#0A0A0A] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="cin-orb cin-orb-green" style={{ width: 600, height: 600, top: '20%', left: '-15%' }} />
      <div className="cin-orb cin-orb-gold"  style={{ width: 400, height: 400, bottom: '-10%', right: '-10%', animationDelay: '3s' }} />
      <div className="container mx-auto px-4 md:px-8">
        <div data-reveal className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C8A96B]">{isArabic ? 'منصة التداول' : 'Trading platform'}</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">{isArabic ? 'التحليل على أعلى مستوى' : 'Analysis at the highest level'}</h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/55">{isArabic ? 'لوحة تحكم تجمع التحليل الفني وتوصيات الخبراء وقوة LexAI الذكية في مكان واحد.' : 'A dashboard combining technical analysis, expert signals, and LexAI intelligence in one place.'}</p>
        </div>

        <div data-reveal className="cin-glow-ring relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/12">
          <img src={IMG.dashboard} alt={isArabic ? 'لوحة تداول XFlex' : 'XFlex trading dashboard'} className="h-auto w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/70 via-transparent to-transparent" />
          <div className="absolute inset-x-6 bottom-6 flex justify-between gap-3">
            {pillLabels.map((label) => (
              <div key={label} className="flex-1 rounded-xl border border-white/14 bg-black/65 px-4 py-3 text-center backdrop-blur-md" style={{ boxShadow: '0 0 24px rgba(0,193,118,0.18)' }}>
                <span className="mb-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
                <p className="text-xs font-semibold text-white/80">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 6. LexAI conversation explainer ─────────────────────────────────────────
function LexAISection({ onScrollTo }: { onScrollTo: (id: string) => void }) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  const featureItems = isArabic
    ? [
        { icon: TrendingUp, title: 'تحليل متعدد الأطر', body: 'يقرأ الحركة من أكثر من إطار زمني حتى لا تعتمد على لقطة واحدة قد تكون مضللة.' },
        { icon: Target, title: 'مناطق الدعم والمقاومة', body: 'يحدد لك مناطق القرار المهمة ويشرح لماذا تعتبر حساسة للسوق.' },
        { icon: CheckCircle, title: 'نقاط الدخول والخروج', body: 'يعطيك سيناريوهات واضحة للدخول أو الانتظار أو إلغاء الفكرة عند تغير المعطيات.' },
        { icon: ShieldCheck, title: 'تنبيه بالمخاطرة', body: 'يربط التحليل دائماً بحدود الخطر، حتى لا تتحول الفكرة الجيدة إلى صفقة سيئة.' },
      ]
    : [
        { icon: TrendingUp, title: 'Multi-timeframe analysis', body: 'Reads the market across more than one timeframe so you are not acting on a single misleading snapshot.' },
        { icon: Target, title: 'Support and resistance zones', body: 'Highlights the key decision areas and explains why they matter to the current market structure.' },
        { icon: CheckCircle, title: 'Entry and exit scenarios', body: 'Gives you clear scenarios for entering, waiting, or invalidating the idea when conditions change.' },
        { icon: ShieldCheck, title: 'Risk-aware guidance', body: 'Keeps the analysis tied to risk boundaries so a good idea does not become a careless trade.' },
      ];

  const badges = isArabic
    ? ['تحليل متعدد الأطر', 'مستويات واضحة', 'خطة مخاطرة']
    : ['Multi-timeframe view', 'Clear zones', 'Risk plan'];

  const conversation = isArabic
    ? {
        eyebrow: 'LexAI',
        title: 'ليس مجرد اسم داخل الباقة. بل مساعد تحليلي يشرح لك القرار.',
        body: 'بدلاً من وصف عام للسوق، يشرح LexAI الفكرة، يحدد المناطق المهمة، ويربطها بسيناريو دخول وخروج وإدارة مخاطرة بلغة واضحة بالعربية أو الإنجليزية.',
        questionOne: 'الذهب قريب من مقاومة قوية. هل هذا وقت دخول أم انتظار؟',
        answerOneTitle: 'قراءة LexAI الحالية',
        answerOneBody: 'على الأربع ساعات الاتجاه ما زال صاعداً، لكن السعر الآن يختبر منطقة عرض يومية. الأفضل انتظار إغلاق واضح فوق المقاومة أو إعادة اختبار ناجحة قبل الدخول. الدخول المبكر هنا يرفع نسبة الفخ الكاذب.',
        questionTwo: 'وإذا لم يحصل الاختراق؟',
        answerTwoBody: 'إذا عاد السعر وأغلق تحت منطقة الإبطال، فالفكرة تفقد قوتها. في هذه الحالة الأفضل البقاء خارج الصفقة أو تقليل المخاطرة إلى الحد الأدنى.',
        ctaPrimary: 'شاهد الباقة الشاملة',
        ctaSecondary: 'اسأل الفريق عن LexAI',
        status: 'متصل الآن',
        subtitle: 'عربي / English',
        liveBadge: 'تحليل تفاعلي',
      }
    : {
        eyebrow: 'LexAI',
        title: 'Not just a name inside the package. A real analytical assistant.',
        body: 'Instead of giving a vague market opinion, LexAI explains the setup, marks the important zones, and connects them to entry, exit, and risk scenarios in clear Arabic or English.',
        questionOne: 'Gold is approaching a major resistance. Is this a valid entry or should I wait?',
        answerOneTitle: 'LexAI current read',
        answerOneBody: 'On the 4H chart the trend is still bullish, but price is testing a daily supply area. The stronger plan is to wait for a clean close above resistance or a successful retest before entering. Entering now increases the chance of a false breakout.',
        questionTwo: 'What if the breakout fails?',
        answerTwoBody: 'If price closes back below the invalidation area, the idea loses strength. In that case, staying out or reducing risk is the smarter response.',
        ctaPrimary: 'See the Comprehensive package',
        ctaSecondary: 'Ask the team about LexAI',
        status: 'Online now',
        subtitle: 'Arabic / English',
        liveBadge: 'Interactive analysis',
      };

  return (
    <section ref={ref} className="relative overflow-hidden bg-[#050505] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="cin-orb cin-orb-green" style={{ width: 520, height: 520, top: '0%', right: '-12%' }} />
      <div className="cin-orb cin-orb-gold" style={{ width: 360, height: 360, bottom: '-8%', left: '-10%', animationDelay: '2.5s' }} />
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid items-start gap-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div className="space-y-8">
            <div data-reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">{conversation.eyebrow}</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">{conversation.title}</h2>
              <p className="mt-6 max-w-2xl text-base leading-8 text-white/60">{conversation.body}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {featureItems.map(({ icon: Icon, title, body }, index) => (
                <div
                  key={title}
                  data-reveal
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 hover:border-[#00C176]/28 hover:bg-[#00C176]/[0.04]"
                  style={{ transitionDelay: `${index * 80}ms` }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#00C176]/14">
                    <Icon className="h-5 w-5 text-[#00C176]" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-7 text-white/58">{body}</p>
                </div>
              ))}
            </div>

            <div data-reveal className="flex flex-wrap gap-4">
              <button type="button" onClick={() => onScrollTo('packages')} className="cin-btn-green inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white">
                {conversation.ctaPrimary}<ArrowUpRight className="h-5 w-5" />
              </button>
              <Link href="/contact">
                <a className="cin-btn-ghost inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white">
                  {conversation.ctaSecondary}
                </a>
              </Link>
            </div>
          </div>

          <div data-reveal className="cin-glow-ring relative overflow-hidden rounded-3xl border border-white/12 bg-[linear-gradient(180deg,rgba(8,20,18,0.92),rgba(5,5,5,0.98))] p-6 md:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,193,118,0.12),transparent_45%),radial-gradient(circle_at_bottom,rgba(200,169,107,0.10),transparent_35%)]" />
            <div className="relative">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00C176]/18" style={{ boxShadow: '0 0 22px rgba(0,193,118,0.28)' }}>
                    <Bot className="h-6 w-6 text-[#00C176]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">LexAI</p>
                    <p className="text-xs text-white/45">{conversation.status} · {conversation.subtitle}</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#00C176]/25 bg-[#00C176]/10 px-3 py-1 text-xs font-semibold text-[#00C176]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
                  {conversation.liveBadge}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="self-end max-w-[88%] rounded-[1.35rem] rounded-br-md border border-white/10 bg-white/[0.05] px-4 py-3 text-sm leading-7 text-white/78">
                  {conversation.questionOne}
                </div>

                <div className="max-w-[92%] rounded-[1.5rem] rounded-bl-md border border-[#00C176]/24 bg-[#00C176]/[0.08] px-4 py-4 text-sm text-white/80">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#00C176]/18">
                      <Sparkles className="h-4 w-4 text-[#00C176]" />
                    </div>
                    <div>
                      <p className="font-semibold text-white">{conversation.answerOneTitle}</p>
                      <p className="mt-2 leading-7 text-white/72">{conversation.answerOneBody}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {badges.map((badge) => (
                      <span key={badge} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[11px] font-semibold text-white/64">
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="self-end max-w-[72%] rounded-[1.35rem] rounded-br-md border border-white/10 bg-white/[0.05] px-4 py-3 text-sm leading-7 text-white/78">
                  {conversation.questionTwo}
                </div>

                <div className="max-w-[84%] rounded-[1.35rem] rounded-bl-md border border-white/10 bg-black/28 px-4 py-3 text-sm leading-7 text-white/66">
                  {conversation.answerTwoBody}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 7. Mentor ────────────────────────────────────────────────────────────────
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
    <section id="mentor" ref={ref} className="relative overflow-hidden bg-[#050505] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="cin-orb cin-orb-green" style={{ width: 480, height: 480, top: '15%', right: '-10%' }} />
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div data-reveal className="cin-glow-ring relative overflow-hidden rounded-3xl">
            <img src={IMG.mentor} alt={isArabic ? 'مدرب XFlex' : 'XFlex mentor'} className="h-[500px] w-full object-cover object-top md:h-[620px] md:object-left-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505]/80 via-transparent to-transparent" />
            <div className="absolute inset-x-8 bottom-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00C176]/35 bg-[#00C176]/12 px-4 py-2 text-sm font-semibold text-[#00C176]" style={{ boxShadow: '0 0 24px rgba(0,193,118,0.30)' }}>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
                {isArabic ? 'متداول محترف' : 'Professional Trader'}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div data-reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">{isArabic ? 'عن المدرب' : 'About the mentor'}</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">{isArabic ? 'خبرة حقيقية.\nنتائج قابلة للقياس.' : 'Real expertise.\nMeasurable results.'}</h2>
              <p className="mt-6 text-base leading-8 text-white/60">{isArabic ? 'ليس مجرد معلم — بل متداول فعلي يشارك طلابه في غرفة التداول الحية، ويقدم توصيات حقيقية مبنية على تحليل دقيق ومسار واضح.' : 'Not just a teacher — an active trader who shares the live trading room with students, delivering real signals built on precise analysis and a clear methodology.'}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {statItems.map((item, i) => (
                <div key={i} data-reveal className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-all duration-300 hover:border-[#00C176]/35 hover:bg-[#00C176]/[0.04]" style={{ transitionDelay: `${i * 70}ms` }}>
                  <p className="cin-stat-num text-2xl font-extrabold text-[#00C176]">{item.value}</p>
                  <p className="mt-1 text-sm text-white/50">{item.label}</p>
                </div>
              ))}
            </div>

            <div data-reveal>
              <Link href="/contact"><a className="cin-btn-green inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold text-white">{isArabic ? 'تواصل مع الفريق' : 'Talk to the team'}<ArrowUpRight className="h-5 w-5" /></a></Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 8. Mobile lifestyle ──────────────────────────────────────────────────────
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
    <section ref={ref} className="relative overflow-hidden bg-[#0A0A0A] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="cin-orb cin-orb-purple" style={{ width: 420, height: 420, bottom: '5%', left: '-10%', animationDelay: '2s' }} />
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="space-y-8">
            <div data-reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C8A96B]">{isArabic ? 'تداول في أي مكان' : 'Trade anywhere'}</p>
              <h2 className="mt-4 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">{isArabic ? 'السوق في يدك' : 'The market\nin your hand'}</h2>
              <p className="mt-6 text-base leading-8 text-white/60">{isArabic ? 'استقبل التوصيات، راجع تحليلات LexAI، وتابع مسارك التعليمي من هاتفك في أي وقت وأي مكان.' : 'Receive signals, review LexAI analysis, and track your learning journey from your phone — anytime, anywhere.'}</p>
            </div>

            <div className="flex flex-col gap-4">
              {featureItems.map(({ icon: Icon, text }, i) => (
                <div key={i} data-reveal className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 transition-all duration-300 hover:border-[#00C176]/35 hover:bg-[#00C176]/[0.04]" style={{ transitionDelay: `${i * 80}ms` }}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#00C176]/18" style={{ boxShadow: '0 0 16px rgba(0,193,118,0.20)' }}>
                    <Icon className="h-5 w-5 text-[#00C176]" />
                  </div>
                  <p className="text-sm font-semibold text-white/80">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal className="cin-glow-ring relative overflow-hidden rounded-3xl">
            <img src={IMG.mobile} alt={isArabic ? 'تداول على الجوال' : 'Mobile trading'} className="h-[520px] w-full object-cover object-center md:h-[620px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/55 to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 8. Community ─────────────────────────────────────────────────────────────
function CommunitySection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  return (
    <section id="community" ref={ref} className="relative overflow-hidden py-28 md:py-40" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0">
        <img src={IMG.community} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/85 via-[#050505]/60 to-[#050505]/92" />
      </div>
      <div className="cin-orb cin-orb-green" style={{ width: 500, height: 500, top: '20%', left: '50%', transform: 'translateX(-50%)', opacity: 0.35 }} />

      <div className="relative z-10 container mx-auto px-4 text-center md:px-8">
        <div data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#C8A96B]">{isArabic ? 'المجتمع الحصري' : 'Exclusive community'}</p>
          <h2 className="mt-4 text-5xl font-extrabold tracking-[-0.03em] text-white md:text-6xl">{isArabic ? 'ليس فقط تعليماً —\nبل انتماء.' : 'Not just education —\na community.'}</h2>
          <p className="mx-auto mt-6 max-w-xl text-base leading-8 text-white/60 md:text-lg">{isArabic ? 'انضم إلى مجتمع من المتداولين الجادين، شارك الأفكار، وتعلّم من تجارب زملائك في السوق.' : 'Join a community of serious traders, share insights, and learn from real market experiences alongside your peers.'}</p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/[0.10] px-6 py-3 text-sm font-semibold text-white backdrop-blur-md" style={{ boxShadow: '0 0 32px rgba(0,193,118,0.25)' }}>
            <Users className="h-4 w-4 text-[#00C176]" />
            {isArabic ? '+5,000 متداول نشط' : '+5,000 active traders'}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 9. Results ───────────────────────────────────────────────────────────────
function ResultsSection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  const [countersOn, setCountersOn] = useState(false);
  const reduced = usePrefersReducedMotion();
  useScrollReveal(ref);

  type ResultStat = {
    label: string;
    value?: number;
    prefix?: string;
    suffix?: string;
    display?: string;
  };

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

  const stats: ResultStat[] = isArabic
    ? [
        { value: 5000, suffix: '+', label: 'طالب متخرج'              },
        { value: 8,                  label: 'مراحل تعليمية متكاملة'  },
        { display: '∞',              label: 'تحليلات يومية غير محدودة' },
        { value: 2,                  label: 'خياران واضحان للاشتراك' },
      ]
    : [
        { value: 5000, suffix: '+', label: 'students trained'          },
        { value: 8,                  label: 'integrated learning stages' },
        { display: '∞',              label: 'unlimited daily analysis'   },
        { value: 2,                  label: 'clear package options'      },
      ];

  return (
    <section ref={ref} className="relative overflow-hidden py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0">
        <img src={IMG.success} alt="" className="h-full w-full object-cover object-center" style={{ opacity: 0.20 }} />
        <div className="absolute inset-0 bg-[#050505]/85" />
      </div>
      <div className="cin-orb cin-orb-green" style={{ width: 600, height: 600, top: '20%', right: '-15%', opacity: 0.45 }} />

      <div className="relative z-10 container mx-auto px-4 md:px-8">
        <div data-reveal className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">{isArabic ? 'بالأرقام الحقيقية' : 'By the numbers'}</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">{isArabic ? 'نتائج تتحدث عن نفسها' : 'Results speak for themselves'}</h2>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={i} data-reveal className="rounded-3xl border border-white/12 bg-white/[0.05] p-6 text-center backdrop-blur-sm transition-all duration-300 hover:border-[#00C176]/40 hover:bg-[#00C176]/[0.05] md:p-8" style={{ transitionDelay: `${i * 80}ms`, boxShadow: '0 16px 48px rgba(0,193,118,0.10)' }}>
              <p className="text-4xl font-extrabold text-[#00C176] md:text-5xl">
                {typeof s.value === 'number'
                  ? <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} start={countersOn} reduced={reduced} />
                  : <span className="cin-stat-num">{s.display}</span>}
              </p>
              <p className="mt-3 text-sm text-white/55">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 10. Testimonial carousel (NEW) ───────────────────────────────────────────
function TestimonialCarousel() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const { data: testimonials } = trpc.testimonials.list.useQuery();
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  const sanitize = (v: string) => v.replace(/[$₪]\s?\d[\d,.]*/g, '').replace(/\s{2,}/g, ' ').trim();

  const items = useMemo(() => {
    const fallback = isArabic
      ? [
          { id: 'a', name: 'محمد', role: 'متداول', quote: 'الشرح واضح والمتابعة حقيقية. حسيت إني مرفوق في كل خطوة.' },
          { id: 'b', name: 'سارة', role: 'مبتدئة', quote: 'الباقة الشاملة غيرت طريقة تفكيري بالسوق — التحليل من LexAI ممتاز.' },
          { id: 'c', name: 'أحمد', role: 'متداول جاد', quote: 'أحسن استثمار للتعلم. الفريق محترف والتوصيات دقيقة.' },
          { id: 'd', name: 'لينا', role: 'طالبة', quote: 'بعد 8 مراحل أصبحت أتداول بثقة وبدون توتر. شكراً للأكاديمية.' },
        ]
      : [
          { id: 'a', name: 'Mohammed', role: 'Trader',         quote: 'The teaching is clear and the support is real. I felt accompanied every step of the way.' },
          { id: 'b', name: 'Sara',     role: 'Beginner',       quote: 'The Comprehensive package changed how I see the market — LexAI analysis is exceptional.' },
          { id: 'c', name: 'Ahmad',    role: 'Serious trader', quote: 'Best learning investment I made. The team is professional and signals are precise.' },
          { id: 'd', name: 'Lina',     role: 'Student',        quote: 'After 8 stages I trade with confidence and no anxiety. Thank you to the academy.' },
        ];
    if (!testimonials?.length) return fallback;
    return testimonials.slice(0, 6).map((t) => ({
      id: String(t.id),
      name: (isArabic ? t.nameAr : t.nameEn) || (isArabic ? 'طالب' : 'Student'),
      role: isArabic ? 'طالب في XFlex' : 'XFlex student',
      quote: (() => { const q = sanitize(isArabic ? t.textAr : t.textEn); return q.length > 180 ? `${q.slice(0, 180).trim()}…` : q; })(),
    }));
  }, [isArabic, testimonials]);

  const [idx, setIdx] = useState(0);
  const reduced = usePrefersReducedMotion();
  useEffect(() => {
    if (reduced || items.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length, reduced]);

  if (!items.length) return null;
  const current = items[idx];

  return (
    <section ref={ref} className="relative overflow-hidden bg-[#0A0A0A] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="cin-orb cin-orb-green" style={{ width: 500, height: 500, top: '10%', left: '-10%' }} />
      <div className="cin-orb cin-orb-gold"  style={{ width: 380, height: 380, bottom: '-10%', right: '-5%', animationDelay: '3s' }} />
      <div className="container mx-auto px-4 md:px-8">
        <div data-reveal className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">{isArabic ? 'ماذا يقول طلابنا' : 'What our students say'}</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">{isArabic ? 'تجارب حقيقية' : 'Real experiences'}</h2>
        </div>

        <div data-reveal className="mx-auto max-w-3xl">
          <div className="cin-glow-ring relative rounded-3xl border border-white/12 bg-white/[0.04] p-8 backdrop-blur-sm md:p-12" style={{ boxShadow: '0 24px 80px rgba(0,193,118,0.18)' }}>
            <Quote className="mb-6 h-10 w-10 text-[#00C176]/70" style={{ filter: 'drop-shadow(0 0 12px rgba(0,193,118,0.5))' }} />
            <p key={current.id} className="text-xl font-medium leading-9 text-white md:text-2xl" style={{ animation: 'cin-hero-in 600ms var(--cin-ease) both' }}>
              {current.quote}
            </p>
            <div className="mt-8 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">{current.name}</p>
                <p className="mt-0.5 text-xs text-white/45">{current.role}</p>
              </div>
              <div className="flex gap-2">
                {items.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Testimonial ${i + 1}`}
                    onClick={() => setIdx(i)}
                    className={`h-1.5 rounded-full transition-all duration-400 ${i === idx ? 'w-8 bg-[#00C176]' : 'w-1.5 bg-white/25 hover:bg-white/40'}`}
                    style={i === idx ? { boxShadow: '0 0 10px #00C176' } : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 11. Packages ─────────────────────────────────────────────────────────────
function PackagesSection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const basicPricing         = getPackageDisplayPricing('basic',         20000, 5000);
  const comprehensivePricing = getPackageDisplayPricing('comprehensive', 50000, 10000);
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
    <section id="packages" ref={ref} className="relative overflow-hidden bg-[#0A0A0A] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="cin-orb cin-orb-green" style={{ width: 600, height: 600, top: '10%', right: '-15%', opacity: 0.55 }} />
      <div className="cin-orb cin-orb-gold"  style={{ width: 420, height: 420, bottom: '5%', left: '-10%', animationDelay: '3s' }} />
      <div className="container mx-auto px-4 md:px-8">
        <div data-reveal className="mb-14 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">{isArabic ? 'اختر مسارك' : 'Choose your path'}</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">{isArabic ? 'باقتان واضحتان. قرار واحد.' : 'Two clear packages. One decision.'}</h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/52">{isArabic ? 'جميع الأسعار بالشيكل وتشمل ضريبة 16٪. المادة التعليمية تبقى مدى الحياة.' : 'All prices in ILS including 16% VAT. Learning content stays with you for life.'}</p>
        </div>

        <div data-reveal className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {(isArabic
            ? [{ value: 5000, suffix: '+', label: 'طالب' }, { value: 8, label: 'مراحل' }, { display: 'مباشر', label: 'دعم فني' }, { value: 2, label: 'خياران' }]
            : [{ value: 5000, suffix: '+', label: 'students' }, { value: 8, label: 'stages' }, { display: 'Live', label: 'support' }, { value: 2, label: 'packages' }]
          ).map((s, i) => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center transition-all duration-300 hover:border-[#00C176]/30">
              <p className="text-3xl font-extrabold text-[#00C176]">
                {'display' in s ? s.display : <AnimatedCounter value={s.value} prefix={s.prefix} suffix={s.suffix} start={countersOn} reduced={reduced} />}
              </p>
              <p className="mt-2 text-xs text-white/45">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          {packages.map((pkg, i) => {
            const Icon = pkg.icon;
            const offers = renewalOffers.filter((o) => o.packageId === pkg.id);
            const renewalPrice = formatIlsAmount(pkg.pricing.ilsRenewal ?? 0);
            return (
              <article
                key={pkg.id}
                data-reveal
                className={`cin-pkg-card relative overflow-hidden rounded-3xl border p-7 md:p-9 ${
                  pkg.featured
                    ? 'cin-featured-line cin-pkg-featured border-[#00C176]/30 bg-gradient-to-b from-[#00C176]/[0.09] to-[#050505]'
                    : 'border-white/10 bg-white/[0.04] hover:border-white/22'
                }`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                    pkg.featured ? 'border border-white/16 bg-white/[0.10] text-white/82' : 'border border-white/10 bg-white/[0.05] text-white/52'
                  }`}>
                    <Icon className={`h-3.5 w-3.5 ${pkg.featured ? 'text-[#00C176]' : 'text-white/40'}`} />
                    {pkg.eyebrow}
                  </div>
                  {pkg.featured && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#C8A96B] to-amber-500 px-3 py-1 text-xs font-bold text-white" style={{ boxShadow: '0 0 24px rgba(200,169,107,0.35)' }}>
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {isArabic ? 'LexAI مُضمّن' : 'LexAI included'}
                    </div>
                  )}
                </div>

                <h3 className="mt-5 text-2xl font-extrabold text-white md:text-3xl">{pkg.name}</h3>
                <p className="mt-2 text-sm leading-7 text-white/55">{pkg.tagline}</p>

                <div className="mt-6 flex flex-wrap items-end gap-3">
                  <span className="text-5xl font-extrabold tracking-[-0.04em] text-[#00C176] cin-stat-num">
                    {formatIlsAmount(pkg.pricing.ilsPrice)}
                  </span>
                  <span className="pb-1 text-sm font-semibold text-white/45">
                    {isArabic ? 'دفعة واحدة شاملة ضريبة القيمة المضافة' : 'One payment incl. VAT'}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-white/48">
                  {isArabic ? `التعليم مدى الحياة · تجديد شهري ${renewalPrice}` : `Lifetime learning · monthly renewal ${renewalPrice}`}
                </p>

                <ul className="mt-6 space-y-3">
                  {pkg.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-white/72">
                      <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#00C176]" style={{ filter: 'drop-shadow(0 0 6px rgba(0,193,118,0.5))' }} />
                      {feat}
                    </li>
                  ))}
                </ul>

                <div className="mt-7 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/48">
                    <Clock3 className="h-3.5 w-3.5 text-[#C8A96B]" />
                    {isArabic ? 'خيارات التجديد' : 'Renewal options'}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {offers.map((offer) => {
                      const saving = offer.originalIls - offer.discountedIls;
                      return (
                        <div key={offer.id} className="rounded-xl border border-white/08 bg-white/[0.04] p-3 transition-colors hover:border-[#00C176]/30">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-white/80">
                              {isArabic ? `${offer.months} شهور` : `${offer.months} months`}
                            </p>
                            <span className="rounded-full bg-amber-500/[0.16] px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                              {isArabic ? `وفر ${formatIlsAmount(saving)}` : `Save ${formatIlsAmount(saving)}`}
                            </span>
                          </div>
                          <div className="mt-2 flex items-end gap-1.5">
                            <span className="text-lg font-extrabold text-[#00C176]">{formatIlsAmount(offer.discountedIls)}</span>
                            <span className="mb-0.5 text-xs text-white/30 line-through">{formatIlsAmount(offer.originalIls)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

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

        <div data-reveal className="mx-auto mt-10 max-w-5xl rounded-3xl border border-white/08 bg-white/[0.025] p-6 md:p-8">
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
                <p className="mt-2 text-sm leading-6 text-white/45">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── 12. FAQ accordion (NEW) ──────────────────────────────────────────────────
function FAQSection() {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  const faqs = isArabic
    ? [
        { q: 'هل أحتاج خبرة سابقة في التداول؟', a: 'لا. الباقات مصممة من الصفر — نبدأ معك من الأساسيات وننتقل تدريجياً إلى التحليل المتقدم والتنفيذ الحقيقي.' },
        { q: 'ما الفرق بين الأساسية والشاملة؟',  a: 'الأساسية تعطيك المنهج الكامل والتوصيات والدعم. الشاملة تضيف LexAI — طبقة التحليل الذكية التي تساعدك على فهم السوق بشكل أعمق.' },
        { q: 'هل المحتوى التعليمي ينتهي؟',        a: 'لا. المحتوى التعليمي يبقى معك مدى الحياة. التجديد يطبق فقط على الخدمات الزمنية كالتوصيات وLexAI.' },
        { q: 'ما طرق الدفع المتاحة؟',             a: 'حالياً ندعم الحوالة البنكية الموثوقة. كل المعاملات شاملة ضريبة القيمة المضافة 16٪.' },
        { q: 'كم مدة الوصول للتوصيات؟',          a: 'الوصول الأولي شهر، ويمكنك التجديد لأشهر إضافية بأسعار مخفضة (3 أو 6 شهور).' },
        { q: 'هل يوجد دعم مباشر؟',                 a: 'نعم. فريقنا متاح يومياً عبر الدردشة المباشرة والواتساب للرد على أسئلتك.' },
      ]
    : [
        { q: 'Do I need prior trading experience?', a: 'No. Packages are designed from scratch — we start with fundamentals and move gradually into advanced analysis and real execution.' },
        { q: 'What is the difference between Basic and Comprehensive?', a: 'Basic gives you the full curriculum, signals, and support. Comprehensive adds LexAI — the intelligent analysis layer that helps you understand the market more deeply.' },
        { q: 'Does the learning content expire?', a: 'No. Learning content stays with you for life. Renewal applies only to timed services like signals and LexAI.' },
        { q: 'What payment methods are available?', a: 'We currently support trusted bank transfer. All transactions include 16% VAT.' },
        { q: 'How long is signal access?', a: 'Initial access is one month, with discounted renewal options for 3 or 6 months.' },
        { q: 'Is there live support?', a: 'Yes. Our team is available daily via live chat and WhatsApp to answer your questions.' },
      ];

  return (
    <section id="faq" ref={ref} className="relative overflow-hidden bg-[#050505] py-20 md:py-28" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="cin-orb cin-orb-green" style={{ width: 480, height: 480, top: '10%', right: '-12%' }} />
      <div className="container mx-auto px-4 md:px-8">
        <div data-reveal className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#00C176]">{isArabic ? 'الأسئلة الشائعة' : 'Frequently asked'}</p>
          <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] text-white md:text-5xl">{isArabic ? 'كل ما تحتاج معرفته' : 'Everything you need to know'}</h2>
        </div>

        <div className="mx-auto max-w-3xl space-y-3">
          {faqs.map((faq, i) => (
            <details
              key={i}
              data-reveal
              className="cin-faq-item group rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-4 md:px-6 md:py-5"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <summary className="flex items-center justify-between gap-4">
                <span className="text-base font-semibold text-white md:text-lg">{faq.q}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/70 transition-colors group-open:border-[#00C176]/40 group-open:bg-[#00C176]/10 group-open:text-[#00C176]">
                  <ChevronDown className="cin-faq-chev h-4 w-4" />
                </span>
              </summary>
              <div className="cin-faq-body">
                <p className="mt-4 text-sm leading-7 text-white/60 md:text-base">{faq.a}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── 13. Final CTA ────────────────────────────────────────────────────────────
function CTASection({ onScrollTo }: { onScrollTo: (id: string) => void }) {
  const { language, isRTL } = useLanguage();
  const isArabic = language === 'ar';
  const ref = useRef<HTMLElement | null>(null);
  useScrollReveal(ref);

  return (
    <section ref={ref} className="relative overflow-hidden py-28 md:py-44" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0">
        <img src={IMG.cta} alt="" className="h-full w-full object-cover object-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/85 via-[#050505]/68 to-[#050505]/95" />
      </div>
      <div className="cin-orb cin-orb-green" style={{ width: 700, height: 700, top: '20%', left: '50%', transform: 'translateX(-50%)', opacity: 0.45 }} />
      <ParticleField count={20} />

      <div className="relative z-10 container mx-auto px-4 text-center md:px-8">
        <div data-reveal>
          <h2 className="text-5xl font-extrabold tracking-[-0.03em] text-white md:text-6xl lg:text-7xl" style={{ textShadow: '0 0 60px rgba(0,193,118,0.30)' }}>
            {isArabic ? 'تداول بثقة.' : 'Trade with Confidence.'}
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-white/58">
            {isArabic ? 'الفرصة أمامك. المنهج جاهز. الفريق موجود. القرار في يدك.' : 'The opportunity is here. The curriculum is ready. The team is present. The decision is yours.'}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button type="button" onClick={() => onScrollTo('packages')} className="cin-btn-green inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white">
              {isArabic ? 'ابدأ الآن' : 'Start now'}<ArrowUpRight className="h-5 w-5" />
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
          <div>
            <img src={TEST2_LOGO} alt={APP_TITLE} className="cin-logo-img cin-logo-footer" />
            <p className="mt-3 max-w-xs text-sm text-white/40">
              {isArabic ? 'أكاديمية التداول الأولى في فلسطين.' : 'Elite trading academy — Palestine.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm text-white/45 sm:grid-cols-3">
            {[
              { heading: isArabic ? 'الأكاديمية' : 'Academy', links: [
                { label: isArabic ? 'الرئيسية'        : 'Home',          href: '/'                       },
                { label: isArabic ? 'الباقة الأساسية' : 'Basic',         href: '/packages/basic'         },
                { label: isArabic ? 'الباقة الشاملة'  : 'Comprehensive', href: '/packages/comprehensive' },
              ] },
              { heading: isArabic ? 'المحتوى' : 'Content', links: [
                { label: isArabic ? 'محتوى مجاني' : 'Free content', href: '/free-content' },
                { label: isArabic ? 'المقالات'    : 'Articles',      href: '/articles'     },
                { label: isArabic ? 'الأحداث'     : 'Events',        href: '/events'       },
              ] },
              { heading: isArabic ? 'الدعم' : 'Support', links: [
                { label: isArabic ? 'تواصل معنا'      : 'Contact', href: '/contact' },
                { label: isArabic ? 'الأسئلة الشائعة' : 'FAQ',     href: '/faq'     },
                { label: isArabic ? 'تسجيل الدخول'    : 'Login',   href: '/login'   },
              ] },
            ].map((col) => (
              <div key={col.heading} className="flex flex-col gap-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/22">{col.heading}</p>
                {col.links.map((link) => (
                  <Link key={link.href} href={link.href}><a className="transition-colors hover:text-white">{link.label}</a></Link>
                ))}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/22">{isArabic ? 'تابعنا' : 'Follow us'}</p>
            <div className="flex gap-3">
              {[
                { icon: Instagram, href: 'https://www.instagram.com/xflex.academy?igsh=NG9jZng1emlxM3I3', label: 'Instagram' },
                { icon: Facebook,  href: 'https://www.facebook.com/share/1Aj9HNNwsv/?mibextid=wwXIfr',    label: 'Facebook'  },
                { icon: Phone,     href: 'https://wa.me/972597596030',                                      label: 'WhatsApp'  },
              ].map(({ icon: Icon, href, label }) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 text-white/45 transition-all hover:border-[#00C176]/40 hover:text-[#00C176]"
                  style={{ transition: 'all 240ms var(--cin-ease)' }}>
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-white/05 pt-6 text-xs text-white/26 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {APP_TITLE}. {isArabic ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}</p>
          <p>{isArabic ? 'جميع الأسعار بالشيكل وتشمل ضريبة القيمة المضافة 16٪.' : 'All prices in ILS and include 16% VAT.'}</p>
        </div>
      </div>
    </footer>
  );
}

// ─── Page root ────────────────────────────────────────────────────────────────
export default function TestHomePrototype2() {
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const headerOffset = window.innerWidth >= 768 ? 88 : 72;
    const top = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#050505] text-white">
      <CinematicStyles />
      <ScrollProgress />
      <CinematicNav onScrollTo={scrollTo} />
      <main className="overflow-x-clip">
        <HeroSection onScrollTo={scrollTo} />
        <TrustBadgesRow />
        <TrustBar />
        <StickyStorySection />
        <DashboardSection />
        <LexAISection onScrollTo={scrollTo} />
        <MentorSection />
        <MobileSection />
        <CommunitySection />
        <ResultsSection />
        <TestimonialCarousel />
        <PackagesSection />
        <FAQSection />
        <CTASection onScrollTo={scrollTo} />
      </main>
      <CinematicFooter />
    </div>
  );
}
