import {
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  Database,
  Server,
  ShieldCheck,
  TriangleAlert,
  Wallet,
  Workflow,
} from "lucide-react";
import {
  PlanHero,
  PlanSectionTitle,
  PlanTopBar,
  usePlanDocumentLanguage,
  type PlanNavLink,
} from "@/components/public/VipBotPlanShared";

const navLinks: PlanNavLink[] = [
  { href: "/business-owner/vip-trading-bot-plan", label: "Overview" },
  { href: "/en/project/vip-bot-plan", label: "Technical EN", active: true },
  { href: "/ar/project/vip-bot-plan", label: "العربية" },
];

const heroStats = [
  {
    title: "Operating cost",
    value: "USD 30-80 / month",
    note: "Lean MVP operating cost before exchange fees and slippage.",
    icon: Wallet,
  },
  {
    title: "Build effort",
    value: "92-165h",
    note: "Expected engineering effort for the build owner.",
    icon: Workflow,
  },
  {
    title: "Validated target",
    value: "1-2% / month",
    note: "Conservative post-validation objective, not a promise and not a launch assumption.",
    icon: Clock3,
  },
  {
    title: "Hard stop rules",
    value: "1% / 6% / 25%",
    note: "Daily loss halt, drawdown halt, and max deployed capital cap.",
    icon: ShieldCheck,
  },
] as const;

const moduleCards = [
  {
    title: "1. Market data collector",
    body: "Primary path: MetaTrader5 Python package for MT5 data or direct exchange WebSocket / REST for spot data. Poll only on candle close for 15m and 4h in V1.",
    icon: Database,
  },
  {
    title: "2. Feature engine",
    body: "Build structured features instead of screenshots: OHLCV windows, EMA20/50/200 alignment, ATR14, swing highs/lows, spread, volatility bucket, and liquidity guardrails.",
    icon: Workflow,
  },
  {
    title: "3. XFLEX adapter",
    body: "Refactor XFLEX to consume JSON, not images. The model output should be strict JSON with regime, action, confidence, invalidation, and take-profit levels.",
    icon: ArrowRightLeft,
  },
  {
    title: "4. Signal normalizer",
    body: "4h signal grants permission to trade. 15m signal provides timing. If either side is uncertain, the output is NO_TRADE.",
    icon: ShieldCheck,
  },
  {
    title: "5. Risk and compliance layer",
    body: "Every order request must clear both engines: hard caps, asset whitelist, leverage = 1, no margin, no lending, no forbidden symbols, and no CFD / synthetic instruments.",
    icon: TriangleAlert,
  },
  {
    title: "6. Execution and reconciliation",
    body: "Use a venue adapter for one exchange only in V1. Reconcile balances, positions, fills, and order state every 30 to 60 seconds. Any unresolved mismatch triggers safe mode.",
    icon: Server,
  },
] as const;

const regimeRows = [
  {
    regime: "UPTREND",
    fourHour: "4h XFLEX bullish, confidence >= 0.70, structure intact, volatility not extreme",
    fifteenMinute: "15m pullback complete, local structure restored, spread acceptable",
    action: "Allow small long entries with hard invalidation and staged exits",
  },
  {
    regime: "RANGE / NEUTRAL",
    fourHour: "4h neutral or mixed, no decisive directional edge",
    fifteenMinute: "Noisy mean-reversion behavior only",
    action: "For V1, prefer WAIT. Do not introduce grid logic until after paper-trading evidence says it is safe.",
  },
  {
    regime: "RISK_OFF",
    fourHour: "Bearish breakdown, macro stress, volatility expansion, or confidence collapse",
    fifteenMinute: "Ignore long triggers even if locally attractive",
    action: "No new exposure. Cancel resting orders. Hold reserve capital.",
  },
] as const;

const recoveryRows = [
  {
    risk: "Exchange or broker API outage",
    control: "Heartbeat checks, stale-data timeout, exchange-specific circuit breaker, and immediate safe mode if the venue cannot confirm order state.",
  },
  {
    risk: "VPS or machine failure",
    control: "Manual kill switch independent of the model, documented API-key revocation steps, and a secondary standby host or same-day restore plan.",
  },
  {
    risk: "Key staff dependency",
    control: "Write an operator runbook, store secrets in a managed vault, and document restart / disable procedures so one person is not the only recovery path.",
  },
  {
    risk: "Position mismatch between bot and venue",
    control: "Reconciliation loop every 30 to 60 seconds; unresolved mismatch blocks fresh orders and raises an alert until manually reviewed.",
  },
  {
    risk: "Venue product is not genuine spot",
    control: "Treat this as a no-go condition. Do not rely on labeling alone. Verify legal docs, product specs, leverage settings, and financing behavior in writing.",
  },
] as const;

const implementationSteps = [
  "Data extraction automation: 12 to 20 hours for MT5, 20 to 35 hours if MT4 / MetaApi is required.",
  "XFLEX refactor and structured OpenAI integration: 20 to 35 hours.",
  "Risk engine, compliance engine, and kill-switch logic: 15 to 25 hours.",
  "Execution adapter and reconciliation loop: 15 to 30 hours.",
  "Monitoring, alerts, daily reports, and runbook: 10 to 20 hours.",
  "Backtest harness, paper-trading simulator, and acceptance dashboard: 20 to 35 hours.",
] as const;

export default function VipTradingBotPlanEnglish() {
  usePlanDocumentLanguage("en", "ltr");

  return (
    <div className="min-h-screen bg-[var(--color-xf-cream)] text-slate-900" translate="no">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <PlanTopBar navLinks={navLinks} homeLabel="Back To Home" />

        <PlanHero
          eyebrow="Technical lead version"
          title="Problem statement and strategic goal"
          subtitle="The current XFLEX workflow depends on a human to create screenshots from MetaTrader and manually execute ideas. That flow is not scalable, not fully auditable, and not acceptable for a VIP product. The goal is to replace it with a structured-data, spot-only execution stack that prioritizes capital survival, compliance, and operational control over trade frequency."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {heroStats.map((item) => {
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
            eyebrow="Summary verdict"
            title="Conditional go, with explicit no-go triggers"
            subtitle="Proceed only if you can run a genuine spot-only venue, enforce leverage = 1 in code and at the account level, and prove the risk engine can shut the system down before losses compound."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <h3 className="text-lg font-black text-slate-900">What makes this a technical go</h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>Single strategy family in V1: long-only, low-frequency spot trading.</li>
                <li>Structured JSON interface between XFLEX and execution logic.</li>
                <li>Risk-first control plane stronger than the model itself.</li>
                <li>Paper trading gates the live decision, not the other way around.</li>
              </ul>
            </article>

            <article className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
              <h3 className="text-lg font-black text-slate-900">No-go triggers</h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>CFD, futures, leverage, margin, overnight financing, or unclear settlement mechanics.</li>
                <li>Any unresolved order-state mismatch during paper trading.</li>
                <li>Negative expectancy after fees and slippage over the evaluation window.</li>
                <li>Any compliance violation that proves the guardrails can be bypassed.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-200 bg-emerald-50/80 p-5 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-6">
          <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-700">Implementation note</div>
          <p className="mt-3 text-sm leading-7 text-slate-700 md:text-base">
            <span className="font-black text-slate-900">Note:</span> This architecture uses API-based JSON data extraction from MetaTrader. No manual screenshots or image recognition are used in production. The XFLEX bot is refactored to consume structured data.
          </p>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="Technical architecture"
            title="Module-by-module implementation surface"
            subtitle="Treat the model as one module inside a deterministic trading system, not as the system itself. Execution authority belongs to the risk and compliance layers."
          />

          <div className="grid gap-4 lg:grid-cols-3">
            {moduleCards.map((card) => {
              const Icon = card.icon;

              return (
                <article key={card.title} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-700 w-fit">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-black text-slate-900">{card.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{card.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="MVP definition"
            title="Exact rule set for the first safe version"
            subtitle="The MVP is a long-only, low-frequency, regime-filtered spot system. It should sit in cash when conditions are unclear rather than forcing activity."
          />

          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-black text-slate-900">Regime</th>
                  <th className="px-4 py-3 font-black text-slate-900">4h gate</th>
                  <th className="px-4 py-3 font-black text-slate-900">15m trigger</th>
                  <th className="px-4 py-3 font-black text-slate-900">Allowed action</th>
                </tr>
              </thead>
              <tbody>
                {regimeRows.map((row) => (
                  <tr key={row.regime} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-4 font-bold text-slate-900">{row.regime}</td>
                    <td className="px-4 py-4 leading-7 text-slate-600">{row.fourHour}</td>
                    <td className="px-4 py-4 leading-7 text-slate-600">{row.fifteenMinute}</td>
                    <td className="px-4 py-4 leading-7 text-slate-600">{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-3xl border border-teal-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5">
            <pre className="whitespace-pre-wrap font-mono text-sm leading-7 text-slate-700">{`if venue_is_not_spot: block_all_orders
if leverage != 1 or margin_enabled: block_all_orders
if daily_realized_loss_pct <= -1.0: halt_trading
if drawdown_pct >= 6.0: halt_trading
if deployed_capital_pct >= 25.0: reject_new_entries

regime = derive_regime_from_4h_xflex()
if regime == "RISK_OFF": return WAIT
if regime == "UPTREND" and trigger_15m_pullback_long(): return BUY_SMALL
return WAIT`}</pre>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="Venue, VPS, and API choices"
            title="Recommended infrastructure and endpoints"
            subtitle="Because the strategy is 15m and 4h driven, operational stability matters more than ultra-low latency. Choose the venue first, then keep the stack narrow."
          />

          <div className="grid gap-4 lg:grid-cols-3">
            <article className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <h3 className="text-lg font-black text-slate-900">MT5 data path</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Use a Windows VPS with 4 vCPU and 8 GB RAM if MT5 is part of the stack. Use the MetaTrader5 Python package with functions such as <code>copy_rates_from_pos</code>, <code>symbol_info_tick</code>, <code>positions_get</code>, and <code>order_send</code> only when the instrument is confirmed as genuine spot.
              </p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <h3 className="text-lg font-black text-slate-900">Preferred live execution</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                For crypto, direct spot exchange APIs are cleaner. Start with one venue only. Candidate APIs: Binance Spot <code>/api/v3/order</code>, Kraken AddOrder / WebSocket v2, or Coinbase Advanced Trade <code>/api/v3/brokerage/orders</code>.
              </p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
              <h3 className="text-lg font-black text-slate-900">Fallback path</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Use MetaApi only if you are forced into MT4 or need a cloud bridge. Treat it as an integration convenience, not as proof that the product is safe or Halal.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="Risk analysis"
            title="Technical, operational, and disaster-recovery controls"
            subtitle="The strategy does not protect the business by itself. The protection comes from operational design, fast shutdown paths, and explicit ownership of failure modes."
          />

          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 font-black text-slate-900">Business / technical risk</th>
                  <th className="px-4 py-3 font-black text-slate-900">Mitigation control</th>
                </tr>
              </thead>
              <tbody>
                {recoveryRows.map((row) => (
                  <tr key={row.risk} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-4 font-semibold text-slate-900">{row.risk}</td>
                    <td className="px-4 py-4 leading-7 text-slate-600">{row.control}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="Paper-trading gate"
            title="Acceptance criteria before any live pilot"
            subtitle="Paper trading is not a marketing step. It is the decision gate. The build is not approved for VIP capital until these criteria are met together."
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <article className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                Required pass conditions
              </h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>8 to 12 stable weeks of paper trading or shadow-live operation.</li>
                <li>Positive net expectancy after fees and slippage.</li>
                <li>Max drawdown at or below 6%.</li>
                <li>Zero compliance violations and zero forbidden-product trades.</li>
                <li>Zero unresolved reconciliation mismatches beyond 60 seconds.</li>
                <li>Safe-mode triggers tested for stale data, venue outage, and manual kill-switch use.</li>
              </ul>
            </article>

            <article className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-900">
                <TriangleAlert className="h-5 w-5 text-amber-700" />
                What invalidates the pilot
              </h3>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
                <li>Model output that cannot be parsed into the strict JSON contract.</li>
                <li>Any hidden assumption that requires a human to interpret screenshots or override orders.</li>
                <li>Daily loss stop not firing exactly as designed during test scenarios.</li>
                <li>Evidence that profitability disappears once fees and slippage are included.</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="mt-6 rounded-[28px] border border-emerald-100/70 bg-white p-6 shadow-[0_18px_42px_rgba(15,118,110,0.06)] md:p-8">
          <PlanSectionTitle
            eyebrow="Implementation plan"
            title="What you build, in what order, and how long it should take"
            subtitle="At 10 to 15 hours per week, this is a roughly 7 to 12 week coding effort followed by a gated paper-trading phase."
          />

          <ol className="space-y-3 text-sm leading-7 text-slate-700 md:text-base">
            {implementationSteps.map((step, index) => (
              <li key={step} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                <span className="mr-2 font-black text-emerald-700">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <footer className="print-hide pb-4 pt-6 text-center text-sm text-slate-500">
          Technical recommendation: approve the MVP build and the paper-trading phase now, but do not approve live VIP capital until the pass criteria above are satisfied.
        </footer>
      </div>
    </div>
  );
}