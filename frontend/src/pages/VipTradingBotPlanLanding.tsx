import {
  ArrowRight,
  Clock3,
  ShieldCheck,
  Wallet,
  Workflow,
} from "lucide-react";
import { Link } from "wouter";
import {
  PlanHero,
  PlanSectionTitle,
  PlanTopBar,
  usePlanDocumentLanguage,
  type PlanNavLink,
} from "@/components/public/VipBotPlanShared";

const navLinks: PlanNavLink[] = [
  { href: "/business-owner/vip-trading-bot-plan", label: "Overview", active: true },
  { href: "/en/project/vip-bot-plan", label: "Technical EN" },
  { href: "/ar/project/vip-bot-plan", label: "العربية" },
];

const stats = [
  {
    title: "Monthly operating cost",
    value: "USD 30-80",
    note: "Lean MVP operating range before trading fees and slippage.",
    icon: Wallet,
  },
  {
    title: "Build effort",
    value: "92-165h",
    note: "Expected engineering effort for the first usable MVP.",
    icon: Workflow,
  },
  {
    title: "Calendar time",
    value: "4-7 months",
    note: "Build, paper trading, and controlled rollout together.",
    icon: Clock3,
  },
  {
    title: "Go / no-go stance",
    value: "Conditional go",
    note: "Only on genuine spot execution with hard compliance locks.",
    icon: ShieldCheck,
  },
] as const;

const audienceCards = [
  {
    title: "English Technical Lead Version",
    subtitle: "For architecture, module design, execution venues, risk engine behavior, and paper-trading acceptance criteria.",
    bullets: [
      "Technical system architecture and module ownership",
      "Exact MVP rule set and 4h / 15m signal logic",
      "VPS, API, exchange, and disaster-recovery details",
      "Acceptance thresholds for build, testnet, and go-live",
    ],
    href: "/en/project/vip-bot-plan",
    cta: "Open technical plan",
  },
  {
    title: "النسخة العربية لمالك العمل",
    subtitle: "للتركيز على القيمة التجارية، حماية السمعة، التكلفة، الجدول الزمني، وشروط الموافقة قبل استخدام أي أموال VIP.",
    bullets: [
      "ملخص تنفيذي وقرار موافقة مشروطة",
      "قيمة المشروع للأكاديمية وتقليل المخاطر التشغيلية",
      "تقدير العائد المحافظ والجدوى المالية بشكل مبسط",
      "قائمة اعتماد واضحة قبل الانتقال من الورقي إلى الحي",
    ],
    href: "/ar/project/vip-bot-plan",
    cta: "فتح النسخة العربية",
  },
] as const;

export default function VipTradingBotPlanLanding() {
  usePlanDocumentLanguage("en", "ltr");

  return (
    <div className="min-h-screen bg-[var(--color-xf-cream)] text-slate-900" translate="no">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PlanTopBar navLinks={navLinks} homeLabel="Back To Home" />

        <PlanHero
          eyebrow="Audience-specific proposal hub"
          title="VIP trading bot proposal, split for the right decision-maker"
          afterTitle={
            <div className="rounded-3xl border border-emerald-200 bg-white/90 p-4 text-sm leading-7 text-slate-700 shadow-sm md:text-base">
              <span className="font-black text-slate-900">Recommendation:</span> Begin with the Arabic business version for approval and commercial governance. Once approved, the technical lead proceeds with the English technical version for implementation.
            </div>
          }
          subtitle="This proposal now has two dedicated versions: one technical English route for the build owner and one Arabic business route for the final decision-maker. The goal is to keep the technical reasoning intact while giving the business owner a cleaner approval path."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((item) => {
              const Icon = item.icon;

              return (
                <article key={item.title} className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-500">{item.title}</div>
                    <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-700">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-4 text-2xl font-black text-slate-900">{item.value}</div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.note}</p>
                </article>
              );
            })}
          </div>
        </PlanHero>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="Choose the right version"
            title="Two distinct documents for two distinct decisions"
            subtitle="The technical version is for implementation planning. The Arabic version is for business approval, risk appetite, and rollout governance."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            {audienceCards.map((card) => (
              <article key={card.title} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-6">
                <h3 className="text-xl font-black text-slate-900">{card.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-700 md:text-base">{card.subtitle}</p>

                <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700 md:text-base">
                  {card.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <span className="mt-2 h-2.5 w-2.5 flex-none rounded-full bg-emerald-500" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <Link href={card.href}>
                  <span className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_22px_rgba(16,185,129,0.18)]">
                    {card.cta}
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="Shared non-negotiables"
            title="Rules that do not change between versions"
            subtitle="The audience changes, but the hard business rules do not. These conditions remain binding whether the proposal is read in Arabic or English."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-lg font-black text-slate-900">Absolute deal-breakers</h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>CFD, futures, margin, leverage, overnight financing, or synthetic exposure.</li>
                <li>Any live product that cannot prove genuine spot execution and ownership.</li>
                <li>Any workflow that still depends on manual screenshots in production.</li>
                <li>Any setup without a hard risk engine, a kill switch, and reconciliation checks.</li>
              </ul>
            </article>

            <article className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <h3 className="text-lg font-black text-slate-900">Common launch sequence</h3>
              <ol className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>1. Approve the MVP build and the risk model.</li>
                <li>2. Complete paper trading for 8 to 12 weeks with tracked acceptance criteria.</li>
                <li>3. Reassess go / no-go before any VIP capital is exposed.</li>
                <li>4. Launch only with a tightly capped pilot and a formal rollback plan.</li>
              </ol>
            </article>
          </div>
        </section>

        <footer className="print-hide pb-4 pt-6 text-center text-sm text-slate-500">
          Recommended review flow: Arabic business page first for approval logic, then English technical page for execution detail.
        </footer>
      </div>
    </div>
  );
}