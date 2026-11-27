import { useEffect, useMemo, useState } from "react";
import { Download, Landmark, Printer, RefreshCw } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import FinancePeriodChecklist from "@/components/admin/FinancePeriodChecklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAdminCurrencyFromIls } from "@/lib/adminCurrency";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  useFinanceReportAccess,
  financeReportStaleTime,
} from "@/lib/useFinanceReport";
import { printReport } from "@/lib/printReport";
import { toast } from "sonner";
import {
  currentFinancialMonth,
  FINANCIAL_REPORT_VERSION,
  scopedReceiptTotals,
  type ReceiptScope,
} from "@shared/financialReport";
import { buildFinancialManagementCsv } from "@shared/financialReportCsv";
import { formatAcademyDateTime } from "@shared/academyLocale";
import {
  financialReportPath,
  isFinancialDate,
  readFinancialReportLocation,
  type FinancialFilters,
} from "@shared/financialReportLocation";

const categoryLabels: Record<string, { ar: string; en: string }> = {
  payroll: { en: "Payroll", ar: "الرواتب" },
  advertising: { en: "Advertising", ar: "الإعلانات" },
  software_and_subscriptions: {
    en: "Software & subscriptions",
    ar: "البرامج والاشتراكات",
  },
  professional_services: { en: "Professional services", ar: "الخدمات المهنية" },
  payment_and_bank_fees: {
    en: "Payment & bank fees",
    ar: "رسوم الدفع والبنوك",
  },
  rent_and_office: { en: "Rent & office", ar: "الإيجار والمكتب" },
  taxes_and_government_fees: {
    en: "Taxes & government fees",
    ar: "الضرائب والرسوم الحكومية",
  },
  training_and_content: { en: "Training & content", ar: "التدريب والمحتوى" },
  other: { en: "Other", ar: "أخرى" },
  uncategorized: { en: "Uncategorized — review", ar: "غير مصنفة — للمراجعة" },
};
const purposeLabels: Record<string, { ar: string; en: string }> = {
  new_sale: { en: "New sale", ar: "شراء جديد" },
  renewal: { en: "Paid renewal", ar: "تجديد مدفوع" },
  upgrade: { en: "Paid upgrade", ar: "ترقية مدفوعة" },
  copier_subscription: { en: "Copier subscription", ar: "اشتراك الناسخ" },
};
const entryLabels: Record<string, { ar: string; en: string }> = {
  payment: { en: "Payment", ar: "دفعة" },
  refund: { en: "Refund", ar: "استرداد" },
  expense: { en: "Expense", ar: "مصروف" },
  adjustment: { en: "Adjustment", ar: "تسوية" },
  reversal: { en: "Reversal", ar: "قيد عكسي" },
  opening_balance: { en: "Opening balance", ar: "رصيد افتتاحي" },
};

export default function AdminFinancialDashboard() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const {
    viewerId,
    access,
    checking,
    error: accessError,
  } = useFinanceReportAccess();
  const routeSearch = useSearch();
  const [, setLocation] = useLocation();
  const [defaults] = useState(() => currentFinancialMonth());
  const applied = useMemo(
    () => readFinancialReportLocation(routeSearch, defaults),
    [routeSearch, defaults]
  );
  const filters = useMemo<FinancialFilters>(
    () => ({ from: applied.from, to: applied.to, grouping: applied.grouping }),
    [applied.from, applied.to, applied.grouping]
  );
  const [draftFilters, setDraftFilters] = useState<FinancialFilters>(filters);
  useEffect(() => setDraftFilters(filters), [filters]);
  const scope = applied.scope;
  const setScope = (next: ReceiptScope) =>
    setLocation(financialReportPath({ ...filters, scope: next }));
  const query = trpc.financialReports.dashboard.useQuery(
    { ...filters, viewerId, access: access ?? "viewer" },
    {
      enabled: !!access,
      staleTime: financeReportStaleTime,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: true,
      retry: false,
    }
  );
  const data =
    access &&
    !checking &&
    query.error?.data?.code !== "FORBIDDEN" &&
    query.data?.reportVersion === FINANCIAL_REPORT_VERSION
      ? query.data
      : undefined;
  const fmt = (minor: number) =>
    formatAdminCurrencyFromIls(minor / 100, language);
  const scopeLabel =
    scope === "all"
      ? ar
        ? "كل الخدمات"
        : "All services"
      : scope === "academy"
        ? ar
          ? "الأكاديمية دون الناسخ"
          : "Academy excluding Copier"
        : ar
          ? "الناسخ فقط"
          : "Copier only";
  const selected = data ? scopedReceiptTotals(data.totals, scope) : null;
  const apply = () => {
    if (
      !isFinancialDate(draftFilters.from) ||
      !isFinancialDate(draftFilters.to) ||
      draftFilters.from > draftFilters.to
    ) {
      toast.error(ar ? "تحقق من نطاق التاريخ" : "Check the date range");
      return;
    }
    if (JSON.stringify(filters) === JSON.stringify(draftFilters))
      void query.refetch();
    else setLocation(financialReportPath({ ...draftFilters, scope }));
  };
  const preset = (kind: "month" | "previous" | "year") => {
    const now = new Date();
    const current = currentFinancialMonth(now);
    let range = current;
    if (kind === "year")
      range = { ...current, from: `${current.to.slice(0, 4)}-01-01` };
    if (kind === "previous") {
      const first = new Date(`${current.from}T00:00:00Z`);
      first.setUTCDate(0);
      range = {
        from: `${first.toISOString().slice(0, 7)}-01`,
        to: first.toISOString().slice(0, 10),
        grouping: "month",
      };
    }
    setDraftFilters(range);
    setLocation(financialReportPath({ ...range, scope }));
  };
  const exportCsv = () => {
    if (!data) return;
    const csv = buildFinancialManagementCsv({ ...data, scope });
    const url = URL.createObjectURL(
      new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `xflex-cash-report-${data.from}-${data.to}-${scope}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const metrics = (items: Array<[string, number]>) => (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border bg-white p-4">
          <p className="text-sm leading-6 text-slate-600">{label}</p>
          <p
            className={`mt-2 text-xl font-bold ${value < 0 ? "text-red-700" : "text-slate-950"}`}
          >
            <bdi>{fmt(value)}</bdi>
          </p>
        </div>
      ))}
    </div>
  );
  return (
    <DashboardLayout>
      <main className="print-title min-w-0 space-y-4" dir={ar ? "rtl" : "ltr"}>
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Landmark className="h-6 w-6 text-emerald-700" />
              {ar ? "لوحة الإدارة المالية" : "Financial Management Dashboard"}
            </h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {ar
                ? "مقبوضات مسجلة ومعتمدة بالشيكل، حسب تاريخ الدفع والتصحيح. طلبات الشراء وتفعيل المفاتيح لا تنشئ دخلاً."
                : "Approved recorded cash in ILS, by payment and correction date. Order requests and key activations do not create income."}
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!data}
              onClick={() =>
                printReport(
                  ar
                    ? "تقرير المقبوضات والنتيجة التشغيلية"
                    : "Receipts and Operating Cash Report"
                )
              }
            >
              <Printer className="h-4 w-4" />
              {ar ? "طباعة / PDF" : "Print / PDF"}
            </Button>
            <Button variant="outline" disabled={!data} onClick={exportCsv}>
              <Download className="h-4 w-4" />
              {ar ? "تصدير CSV" : "Export CSV"}
            </Button>
          </div>
        </header>
        <section className="no-print space-y-3 rounded-2xl border bg-white p-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => preset("month")}>
              {ar ? "هذا الشهر" : "This month"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => preset("previous")}
            >
              {ar ? "الشهر الماضي" : "Last month"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => preset("year")}>
              {ar ? "من بداية السنة" : "Year to date"}
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_150px_auto_auto]">
            <div>
              <Label>{ar ? "من" : "From"}</Label>
              <Input
                type="date"
                value={draftFilters.from}
                onChange={event =>
                  setDraftFilters({ ...draftFilters, from: event.target.value })
                }
              />
            </div>
            <div>
              <Label>{ar ? "إلى" : "To"}</Label>
              <Input
                type="date"
                value={draftFilters.to}
                onChange={event =>
                  setDraftFilters({ ...draftFilters, to: event.target.value })
                }
              />
            </div>
            <label className="text-sm">
              {ar ? "التجميع" : "Grouping"}
              <select
                className="mt-2 h-10 w-full rounded-md border px-3"
                value={draftFilters.grouping}
                onChange={event =>
                  setDraftFilters({
                    ...draftFilters,
                    grouping: event.target.value as "month" | "year",
                  })
                }
              >
                <option value="month">{ar ? "شهري" : "Monthly"}</option>
                <option value="year">{ar ? "سنوي" : "Annual"}</option>
              </select>
            </label>
            <Button
              className="self-end"
              disabled={query.isFetching || !access}
              onClick={apply}
            >
              {ar ? "تطبيق النطاق" : "Apply range"}
            </Button>
            <Button
              className="self-end"
              variant="outline"
              disabled={query.isFetching || !access}
              onClick={() => void query.refetch()}
            >
              <RefreshCw className="h-4 w-4" />
              {ar ? "تحديث" : "Refresh"}
            </Button>
          </div>
          <p className="text-xs text-slate-600">
            {ar
              ? "الفترات بتوقيت UTC. استخدم تحديث للاطلاع على آخر دفعة أو تصحيح معتمد."
              : "Periods use UTC. Refresh to include the latest approved payment or correction."}
          </p>
          {(draftFilters.from !== filters.from ||
            draftFilters.to !== filters.to ||
            draftFilters.grouping !== filters.grouping) && (
            <p role="status" className="text-sm font-semibold text-amber-900">
              {ar
                ? "تغييرات النطاق لم تُطبق بعد. اضغط تطبيق النطاق لتحديث التقرير."
                : "Date/grouping changes are not applied yet. Choose Apply range to update the report."}
            </p>
          )}
        </section>
        {checking && (
          <p role="status">
            {ar ? "جارٍ التحقق من الصلاحية…" : "Checking report access…"}
          </p>
        )}
        {!checking && !access && !accessError && (
          <p role="alert">
            {ar
              ? "صلاحية الاطلاع على التقارير المالية مطلوبة."
              : "Financial report access is required."}
          </p>
        )}
        {(accessError || query.error) && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900"
          >
            {query.error?.message ??
              (ar
                ? "تعذّر التحقق من صلاحية التقرير."
                : "Could not verify report access.")}
            {data && (
              <p className="mt-2">
                {ar
                  ? "المعروض نسخة محفوظة سابقة؛ لم يتم تحديثها."
                  : "The displayed data is a previously saved snapshot; it was not refreshed."}
              </p>
            )}
          </div>
        )}
        {access && query.isPending && (
          <p role="status">{ar ? "جارٍ تحميل التقرير…" : "Loading report…"}</p>
        )}
        {access && !checking && !query.error && query.data && !data && (
          <p role="alert">
            {ar
              ? "نسخة الخادم لا تدعم التقرير المالي الحالي. حدّث الصفحة أو تواصل مع المسؤول."
              : "The server does not support this report version. Reload or contact the administrator."}
          </p>
        )}
        {data && selected && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-6">
              <strong>
                {ar ? "النطاق المعروض" : "Applied range"}: {data.from} —{" "}
                {data.to} · UTC
              </strong>
              <p>
                {ar ? "وقت التقرير" : "Snapshot"}:{" "}
                {formatAcademyDateTime(data.generatedAt, language)} ·{" "}
                {ar ? "بتوقيت فلسطين" : "Palestine time"}.{" "}
                {ar ? "دفعات مسجلة" : "Recorded receipts"}: {data.receiptCount}{" "}
                · {ar ? "قيود تصحيح" : "Correction entries"}:{" "}
                {data.correctionCount}.
              </p>
            </div>
            <section className="space-y-4 rounded-2xl border p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold">
                    {ar ? "المقبوضات والاستردادات" : "Receipts and refunds"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {ar
                      ? "اختر خدمات الأكاديمية أو الناسخ دون تغيير نطاق تقرير التشغيل العام أدناه."
                      : "Choose Academy or Copier receipts. The business-wide operating report below always includes all services."}
                  </p>
                </div>
                <label className="text-sm">
                  {ar ? "نطاق المقبوضات" : "Receipt scope"}
                  <select
                    className="ms-2 h-10 max-w-full rounded-md border bg-white px-3"
                    value={scope}
                    onChange={event =>
                      setScope(event.target.value as ReceiptScope)
                    }
                  >
                    <option value="all">
                      {ar ? "كل الخدمات" : "All services"}
                    </option>
                    <option value="academy">
                      {ar
                        ? "الأكاديمية دون الناسخ"
                        : "Academy excluding Copier"}
                    </option>
                    <option value="copier">
                      {ar ? "الناسخ فقط" : "Copier only"}
                    </option>
                  </select>
                </label>
              </div>
              <p className="font-semibold">{scopeLabel}</p>
              {metrics([
                [
                  ar ? "صافي المقبوضات المؤكدة" : "Net confirmed receipts",
                  selected.received,
                ],
                [ar ? "صافي الاستردادات" : "Net refunds", selected.refunds],
                [
                  ar ? "المقبوضات بعد الاستردادات" : "Receipts after refunds",
                  selected.net,
                ],
              ])}
              <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                <span>
                  {ar
                    ? "مقبوضات الأكاديمية بعد التصحيحات"
                    : "Academy receipts after corrections"}
                  :{" "}
                  <bdi className="font-bold">
                    {fmt(data.totals.academyReceiptsMinor)}
                  </bdi>
                </span>
                <span>
                  {ar
                    ? "مقبوضات الناسخ بعد التصحيحات"
                    : "Copier receipts after corrections"}
                  :{" "}
                  <bdi className="font-bold">
                    {fmt(data.totals.copierMinor)}
                  </bdi>
                </span>
                {data.totals.unclassifiedIncomeMinor !== 0 && (
                  <span>
                    {ar ? "مقبوضات غير مصنفة" : "Unclassified receipts"}:{" "}
                    <bdi className="font-bold">
                      {fmt(data.totals.unclassifiedIncomeMinor)}
                    </bdi>
                  </span>
                )}
              </div>
              <details className="rounded-xl border bg-slate-50 p-4">
                <summary className="cursor-pointer font-semibold">
                  {ar
                    ? "تصنيف مقبوضات كل الخدمات"
                    : "All-service receipt classification"}
                </summary>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    [
                      ar ? "مبيعات جديدة" : "New sales",
                      data.totals.newSalesMinor,
                    ],
                    [
                      ar ? "تجديدات مدفوعة" : "Paid renewals",
                      data.totals.renewalsMinor,
                    ],
                    [
                      ar ? "ترقيات مدفوعة" : "Paid upgrades",
                      data.totals.upgradesMinor,
                    ],
                    [
                      ar ? "اشتراكات الناسخ" : "Copier subscriptions",
                      data.totals.copierMinor,
                    ],
                    [
                      ar ? "مقبوضات غير مصنفة" : "Unclassified receipts",
                      data.totals.unclassifiedIncomeMinor,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="flex flex-wrap justify-between gap-2 border-b pb-2"
                    >
                      <dt>{label}</dt>
                      <dd className="font-bold">
                        <bdi>{fmt(Number(value))}</bdi>
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
              <div className="space-y-2">
                {data.periods.map(period => {
                  const values = scopedReceiptTotals(period, scope);
                  return (
                    <div
                      key={period.period}
                      className="grid gap-2 rounded-xl border p-3 sm:grid-cols-4"
                    >
                      <strong>{period.period}</strong>
                      <span>
                        {ar ? "مقبوضات" : "Receipts"}:{" "}
                        <bdi>{fmt(values.received)}</bdi>
                      </span>
                      <span>
                        {ar ? "استردادات" : "Refunds"}:{" "}
                        <bdi>{fmt(values.refunds)}</bdi>
                      </span>
                      <strong>
                        {ar ? "الصافي" : "Net"}: <bdi>{fmt(values.net)}</bdi>
                      </strong>
                    </div>
                  );
                })}
              </div>
              {data.periods.length === 0 && (
                <p>
                  {ar
                    ? "لا توجد حركات معتمدة في النطاق المحدد."
                    : "No approved activity in the selected range."}
                </p>
              )}
            </section>
            {Object.values(data.quality).some(value => value > 0) && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7">
                <h2 className="font-bold">
                  {ar ? "ملاحظات تحتاج مراجعة" : "Items needing review"}
                </h2>
                {data.quality.sharedPaymentReferenceGroups > 0 && (
                  <p>
                    {ar
                      ? "مجموعات مراجع دفع مشتركة ضمن النطاق"
                      : "Shared payment reference groups within this range"}
                    : {data.quality.sharedPaymentReferenceGroups}.{" "}
                    {ar
                      ? "تُعرض للمراجعة ولا تُحذف تلقائياً."
                      : "Flagged for review; never automatically deducted."}
                  </p>
                )}
                {data.quality.unclassifiedReceiptEntries +
                  data.quality.unclassifiedRefundEntries >
                  0 && (
                  <p>
                    {ar
                      ? "مقبوضات أو استردادات غير مصنفة تبقى ضمن كل الخدمات ولا تُنسب للأكاديمية أو الناسخ تلقائياً."
                      : "Unclassified receipts/refunds remain in All services and are not assigned to Academy or Copier automatically."}
                  </p>
                )}
                {data.quality.unallocatedAdjustmentEntries > 0 && (
                  <p>
                    {ar
                      ? "تسويات غير موزعة، معروضة بشكل منفصل ولا تُحتسب كربح تشغيلي."
                      : "Unallocated adjustments are shown separately and do not count as operating profit."}
                  </p>
                )}
                {data.quality.duplicateHistoricalEntries > 0 && (
                  <p>
                    {ar
                      ? "توجد مصادر تاريخية يغطيها دفع مؤكد لنفس الطلب؛ لم تُحتسب مرتين. راجع المطابقة المالية."
                      : "Some historical sources are already covered by a confirmed payment for the same order; they were not counted twice. Review financial reconciliation."}
                  </p>
                )}
              </section>
            )}
            <section className="space-y-4 rounded-2xl border p-4 sm:p-5">
              <h2 className="text-xl font-bold">
                {ar
                  ? "نتيجة التشغيل — كل الخدمات"
                  : "Operating cash result — all services"}
              </h2>
              <p className="text-sm leading-7 text-slate-600">
                {ar
                  ? "صافي المقبوضات بعد الاستردادات ناقص المصروفات المعتمدة بعد تصحيحاتها. لا يتم توزيع المصروفات المشتركة على الأكاديمية أو الناسخ افتراضياً."
                  : "Net receipts after refunds less approved expenses after corrections. Shared expenses are not assumed to belong to Academy or Copier."}
              </p>
              <FinancePeriodChecklist netExpensesMinor={data.totals.expensesMinor} />
              {metrics([
                [
                  ar ? "صافي إيراد كل الخدمات" : "All-service net cash revenue",
                  data.totals.netRevenueMinor,
                ],
                [
                  ar ? "صافي المصروفات المعتمدة" : "Net approved expenses",
                  data.totals.expensesMinor,
                ],
                [
                  ar ? "النتيجة التشغيلية النقدية" : "Operating cash result",
                  data.totals.operatingProfitLossMinor,
                ],
              ])}
              <div className="space-y-2">
                {data.periods.map(period => (
                  <div
                    key={period.period}
                    className="flex flex-wrap justify-between gap-2 rounded-xl border p-3"
                  >
                    <strong>{period.period}</strong>
                    <span>
                      {ar ? "صافي الإيراد" : "Net cash revenue"}:{" "}
                      {fmt(period.netRevenueMinor)}
                    </span>
                    <span>
                      {ar ? "المصروفات" : "Expenses"}:{" "}
                      {fmt(period.expensesMinor)}
                    </span>
                    <strong>
                      {ar ? "النتيجة" : "Result"}:{" "}
                      {fmt(period.operatingProfitLossMinor)}
                    </strong>
                  </div>
                ))}
              </div>
              {data.categories.length > 0 && (
                <details className="rounded-xl border p-4">
                  <summary className="cursor-pointer font-semibold">
                    {ar ? "تصنيف صافي المصروفات" : "Net expenses by category"}
                  </summary>
                  <dl className="mt-4 space-y-3">
                    {data.categories.map(category => (
                      <div
                        key={category.category}
                        className="flex flex-wrap justify-between gap-2"
                      >
                        <dt>
                          {categoryLabels[category.category]?.[language] ??
                            category.category}
                        </dt>
                        <dd>{fmt(category.amountMinor)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
            </section>
            <details className="rounded-2xl border p-4 sm:p-5">
              <summary className="cursor-pointer text-lg font-bold">
                {ar
                  ? "كيف تتطابق الأرقام مع دفتر المالية؟"
                  : "How do these figures reconcile to the ledger?"}
              </summary>
              <dl className="mt-4 space-y-3">
                {[
                  [
                    ar
                      ? "المقبوضات المسجلة قبل التصحيحات"
                      : "Recorded receipts before corrections",
                    data.totals.recordedReceiptsMinor,
                  ],
                  [
                    ar ? "أثر تصحيحات المقبوضات" : "Receipt correction impact",
                    data.totals.receiptCorrectionsMinor,
                  ],
                  [
                    ar ? "صافي المقبوضات المؤكدة" : "Net confirmed receipts",
                    data.totals.confirmedIncomeMinor,
                  ],
                  [
                    ar ? "صافي الاستردادات" : "Net refunds",
                    data.totals.refundsMinor,
                  ],
                  [
                    ar ? "صافي المصروفات" : "Net expenses",
                    data.totals.expensesMinor,
                  ],
                  [
                    ar ? "النتيجة التشغيلية النقدية" : "Operating cash result",
                    data.totals.operatingProfitLossMinor,
                  ],
                  [
                    ar
                      ? "الأرصدة الافتتاحية — خارج الربح"
                      : "Opening balances — outside profit",
                    data.totals.openingBalancesMinor,
                  ],
                  [
                    ar
                      ? "التسويات غير الموزعة — خارج الربح"
                      : "Unallocated adjustments — outside profit",
                    data.totals.netAdjustmentsMinor,
                  ],
                  [
                    ar
                      ? "صافي حركة الدفتر، وليس رصيد البنك"
                      : "Net ledger movement, not a bank balance",
                    data.totals.ledgerMovementMinor,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="flex flex-wrap justify-between gap-2 border-b pb-2"
                  >
                    <dt>{label}</dt>
                    <dd className="font-bold">
                      <bdi>{fmt(Number(value))}</bdi>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-sm leading-7">
                {ar
                  ? "صافي حركة الدفتر = النتيجة التشغيلية + الأرصدة الافتتاحية + التسويات غير الموزعة. قد تكون الاستردادات أو المصروفات سالبة عند إلغاء حركة سابقة."
                  : "Net ledger movement = operating result + opening balances + unallocated adjustments. Net refunds or expenses can be negative when an earlier entry is reversed."}
              </p>
            </details>
            {data.canViewLedger &&
              (access === "owner" || access === "manager") && (
                <section className="min-w-0 rounded-2xl border p-4 sm:p-5">
                  <h2 className="text-xl font-bold">
                    {ar ? "دفتر الحركات المعتمدة" : "Approved ledger"}
                  </h2>
                  <p className="my-3 text-sm">
                    {ar
                      ? "آخر 100 قيد في النطاق. الإجماليات تشمل كل القيود ضمن حد التقرير المعلن."
                      : "Latest 100 entries in the range. Totals include every entry within the stated report source limit."}
                    {data.ledgerTruncated &&
                      (ar
                        ? " العرض محدود إلى 100."
                        : " Display limited to 100.")}
                  </p>
                  <div className="max-w-full overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {[
                            ar ? "التاريخ — فلسطين" : "Date — Palestine",
                            ar ? "النوع" : "Type",
                            ar ? "الغرض" : "Purpose",
                            ar ? "الوصف / المرجع" : "Description / source",
                            ar ? "الطلب" : "Order",
                            ar ? "المبلغ" : "Amount",
                          ].map(label => (
                            <th key={label} className="p-3 text-start">
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.ledger.map(entry => (
                          <tr key={entry.id} className="border-t">
                            <td className="p-3">
                              {formatAcademyDateTime(
                                entry.effectiveAt,
                                language
                              )}
                            </td>
                            <td className="p-3">
                              {entryLabels[entry.entryType]?.[language] ??
                                entry.entryType}
                            </td>
                            <td className="p-3">
                              {entry.transactionPurpose
                                ? (purposeLabels[entry.transactionPurpose]?.[
                                    language
                                  ] ?? entry.transactionPurpose)
                                : "—"}
                            </td>
                            <td className="max-w-xs break-words p-3" dir="auto">
                              {entry.description ?? "—"}
                              <span className="mt-1 block break-all text-xs text-slate-500">
                                {entry.sourceReference}
                              </span>
                            </td>
                            <td className="p-3">
                              {entry.orderId ? (
                                <Link
                                  className="underline"
                                  href={`/admin/orders?orderId=${entry.orderId}`}
                                >
                                  #{entry.orderId}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="whitespace-nowrap p-3 font-bold">
                              <bdi>{fmt(entry.baseAmountIlsMinor)}</bdi>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            <footer className="text-sm leading-7 text-slate-600">
              {ar
                ? "التقرير يستند إلى القيود المعتمدة، ولا يجري مطابقة تلقائية مع كشف البنك."
                : "This report uses approved ledger records; it does not automatically reconcile external bank statements."}
            </footer>
          </>
        )}
      </main>
    </DashboardLayout>
  );
}
