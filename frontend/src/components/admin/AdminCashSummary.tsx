import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { formatAdminCurrencyFromIls } from "@/lib/adminCurrency";
import {
  useFinanceReportAccess,
  financeReportStaleTime,
} from "@/lib/useFinanceReport";
import {
  currentFinancialMonth,
  FINANCIAL_REPORT_VERSION,
  scopedReceiptTotals,
  type ReceiptScope,
} from "@shared/financialReport";
import { formatAcademyDateTime } from "@shared/academyLocale";

export default function AdminCashSummary() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { access, viewerId, checking, error } = useFinanceReportAccess();
  const range = currentFinancialMonth();
  const [scope, setScope] = useState<ReceiptScope>("all");
  const query = trpc.financialReports.summary.useQuery(
    { ...range, viewerId, access: access ?? "viewer" },
    {
      enabled: !!access,
      staleTime: financeReportStaleTime,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
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
  if (!checking && !access && !error) return null;
  const selected = data ? scopedReceiptTotals(data.totals, scope) : null;
  return (
    <section className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">
            {ar
              ? "المقبوضات المؤكدة هذا الشهر"
              : "Confirmed receipts this month"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {range.from} — {range.to} · UTC ·{" "}
            {ar
              ? "من دفتر المالية، وليس تفعيل المفاتيح"
              : "From the financial ledger, not key activations"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={query.isFetching || !access}
            onClick={() => void query.refetch()}
          >
            {ar ? "تحديث" : "Refresh"}
          </Button>
          <Button size="sm" asChild>
            <Link
              href={`/admin/finance?from=${range.from}&to=${range.to}&scope=${scope}`}
            >
              {ar ? "فتح التقرير المالي" : "Open financial report"}
            </Link>
          </Button>
        </div>
      </div>
      <label className="flex flex-wrap items-center gap-2 text-sm">
        {ar ? "نطاق المقبوضات" : "Receipt scope"}
        <select
          className="h-10 rounded-md border bg-white px-3"
          value={scope}
          onChange={event => setScope(event.target.value as ReceiptScope)}
        >
          <option value="all">{ar ? "كل الخدمات" : "All services"}</option>
          <option value="academy">
            {ar ? "الأكاديمية دون الناسخ" : "Academy excluding Copier"}
          </option>
          <option value="copier">{ar ? "الناسخ فقط" : "Copier only"}</option>
        </select>
      </label>
      {(checking || query.isPending) && access !== null ? (
        <p role="status">
          {ar ? "جارٍ تحميل المقبوضات…" : "Loading receipts…"}
        </p>
      ) : null}
      {(error || query.error) && (
        <p role="alert" className="text-sm text-red-800">
          {ar
            ? "تعذّر تحديث الأرقام المالية. استخدم تحديث للمحاولة مجدداً."
            : "Could not refresh financial totals. Use Refresh to try again."}
        </p>
      )}
      {access && !checking && !query.error && query.data && !data && (
        <p role="alert">
          {ar
            ? "نسخة الخادم لا تدعم التقرير المالي الحالي. حدّث الصفحة أو تواصل مع المسؤول."
            : "The server does not support this report version. Reload or contact the administrator."}
        </p>
      )}
      {selected && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              [
                ar ? "صافي المقبوضات المؤكدة" : "Net confirmed receipts",
                selected.received,
              ],
              [ar ? "صافي الاستردادات" : "Net refunds", selected.refunds],
              [
                ar ? "المقبوضات بعد الاستردادات" : "Receipts after refunds",
                selected.net,
              ],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border bg-white p-4"
              >
                <p className="text-sm text-slate-600">{label}</p>
                <p className="mt-2 text-xl font-bold">
                  <bdi>{fmt(Number(value))}</bdi>
                </p>
              </div>
            ))}
          </div>
          <p className="text-sm leading-7">
            {ar ? "الأكاديمية" : "Academy"}:{" "}
            <bdi>{fmt(data.totals.academyReceiptsMinor)}</bdi> ·{" "}
            {ar ? "الناسخ" : "Copier"}:{" "}
            <bdi>{fmt(data.totals.copierMinor)}</bdi> ·{" "}
            {ar ? "دفعات مسجلة" : "Recorded receipts"}: {data.receiptCount} ·{" "}
            {ar ? "قيود تصحيح" : "Correction entries"}: {data.correctionCount}
          </p>
          {data.totals.unclassifiedIncomeMinor !== 0 && (
            <p className="text-sm text-amber-900">
              {ar
                ? "مقبوضات غير مصنفة ضمن إجمالي كل الخدمات"
                : "Unclassified receipts included in All services"}
              : {fmt(data.totals.unclassifiedIncomeMinor)}
            </p>
          )}
          <p className="text-sm text-slate-600">
            {ar ? "وقت التقرير" : "Snapshot"}:{" "}
            {formatAcademyDateTime(data.generatedAt, language)} ·{" "}
            {ar
              ? "بتوقيت فلسطين. لا يوجد تحديث تلقائي؛ استخدم تحديث للاطلاع على آخر القيود المعتمدة."
              : "Palestine time. No automatic updates; refresh for the latest approved entries."}
          </p>
        </>
      )}
    </section>
  );
}
