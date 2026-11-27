import { useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  buildCustomerReportCsv,
  buildCustomerReportPrint,
  customerExportTable,
} from "@shared/customerReportExport";
import type {
  CustomerReportColumn,
  CustomerReportFilter,
  CustomerReportPage,
} from "@shared/customerReport";
import type { MutableRefObject } from "react";

export default function CustomerReportExport({
  data,
  input,
  visible,
  allColumns,
  language,
  activeScope,
  fetching,
}: {
  data: CustomerReportPage;
  input: CustomerReportFilter & {
    viewerId: number;
    accessVersion: "payments" | "operations";
    includePayments: boolean;
  };
  visible: CustomerReportColumn[];
  allColumns: CustomerReportColumn[];
  language: "ar" | "en";
  activeScope: MutableRefObject<string>;
  fetching: boolean;
}) {
  const ar = language === "ar",
    t = (en: string, arabic: string) => (ar ? arabic : en);
  const utils = trpc.useUtils();
  const [rows, setRows] = useState<"page" | "filtered">("page"),
    [columns, setColumns] = useState<"visible" | "all">("visible");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (format: "csv" | "pdf") => {
    if (busy || fetching || !activeScope.current) return;
    const expectedScope = activeScope.current;
    const target = format === "pdf" ? window.open("", "_blank") : null;
    if (format === "pdf" && !target) {
      setError(
        t(
          "Allow the print window and try again.",
          "اسمح بنافذة الطباعة ثم حاول مجدداً."
        )
      );
      return;
    }
    if (target) target.opener = null;
    setBusy(true);
    setError("");
    try {
      const selected = columns === "all" ? allColumns : visible;
      const result = await utils.reports.customers.fetch(
        {
          ...input,
          includePayments:
            selected.includes("paid") && data.canViewClientPayments,
          exportAll: rows === "filtered",
        },
        { staleTime: 0 }
      );
      if (
        activeScope.current !== expectedScope ||
        result.viewerId !== input.viewerId ||
        result.accessVersion !== input.accessVersion
      )
        throw new Error(
          t(
            "Access changed. Reopen the report.",
            "تغيّرت الصلاحيات. أعد فتح التقرير."
          )
        );
      const table = customerExportTable(
        result.items,
        selected,
        language,
        result.canViewClientPayments
      );
      const country = result.countries.find(
        country => country.value === input.country
      );
      const metadata: Array<[string, string | number]> = [
        [
          t("Report", "التقرير"),
          t(
            "Customer accounts, excluding staff",
            "حسابات العملاء باستثناء الموظفين"
          ),
        ],
        [
          t("Scope", "النطاق"),
          rows === "filtered"
            ? t("All filtered accounts", "جميع الحسابات المطابقة")
            : t(`Current page ${result.page}`, `الصفحة الحالية ${result.page}`),
        ],
        [
          t("Rows / matching accounts", "الصفوف / الحسابات المطابقة"),
          `${result.items.length} / ${result.total}`,
        ],
        [
          t("Columns", "الأعمدة"),
          columns === "all"
            ? t(
                "All authorized columns, including contacts",
                "جميع الأعمدة المسموحة، بما فيها بيانات التواصل"
              )
            : t("Visible columns", "الأعمدة الظاهرة"),
        ],
        [t("Applied search", "البحث المطبّق"), input.search || "—"],
        [
          t("Applied country", "البلد المطبّق"),
          country
            ? ar
              ? country.labelAr
              : country.labelEn
            : t("All countries", "جميع البلدان"),
        ],
        [
          t("Ordering", "الترتيب"),
          `${input.sort} ${input.direction}; ID tie-breaker`,
        ],
        [
          t("Basis", "الأساس"),
          t(
            "Lifetime recorded payment evidence, separate from current access. Not registration-date sales, complete historical payments or company cash totals.",
            "أدلة الدفع الموثقة طوال الحساب، منفصلة عن الوصول الحالي. ليست مبيعات بتاريخ التسجيل أو إثباتاً لاكتمال المدفوعات السابقة أو إجمالي مالية الشركة."
          ),
        ],
        [t("Read started (UTC)", "بدء القراءة (UTC)"), result.generatedAt],
        [
          t("Display timezone", "توقيت العرض"),
          t(
            "Palestine (Asia/Hebron); payment evidence read timestamps stay UTC",
            "فلسطين (Asia/Hebron)؛ أوقات قراءة أدلة الدفع تبقى بتوقيت UTC"
          ),
        ],
        [
          t("Read note", "ملاحظة القراءة"),
          t(
            "On-demand reads; payment rows carry their own evidence timestamps. No page cash totals.",
            "قراءات عند الطلب؛ لصفوف الدفع أوقات قراءة مستقلة للأدلة. لا توجد إجماليات مالية للصفحة."
          ),
        ],
      ];
      if (format === "pdf" && target) {
        target.document.write(
          buildCustomerReportPrint(table, metadata, language)
        );
        target.document.close();
      } else {
        const url = URL.createObjectURL(
          new Blob(["\ufeff" + buildCustomerReportCsv(table, metadata)], {
            type: "text/csv;charset=utf-8;",
          })
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `customer-accounts-${rows}-${result.generatedAt.slice(0, 10)}.csv`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      target?.close();
      setError(
        error instanceof Error
          ? error.message
          : t(
              "Export failed; no file produced.",
              "تعذّر التصدير؛ لم يُنتج ملف."
            )
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="space-y-3 rounded border p-3">
      <h2 className="font-semibold">
        {t("Export / print", "التصدير / الطباعة")}
      </h2>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 text-sm">
          {t("Rows", "الصفوف")}
          <select
            className="block max-w-full rounded border bg-background p-2"
            value={rows}
            onChange={event =>
              setRows(event.target.value as "page" | "filtered")
            }
          >
            <option value="page">{t("Current page", "الصفحة الحالية")}</option>
            <option value="filtered">
              {t(
                "All filtered accounts (up to 5,000)",
                "جميع الحسابات المطابقة (حتى ٥٠٠٠)"
              )}
            </option>
          </select>
        </label>
        <label className="min-w-0 text-sm">
          {t("Columns", "الأعمدة")}
          <select
            className="block max-w-full rounded border bg-background p-2"
            value={columns}
            onChange={event =>
              setColumns(event.target.value as "visible" | "all")
            }
          >
            <option value="visible">
              {t("Visible columns", "الأعمدة الظاهرة")}
            </option>
            <option value="all">
              {t(
                "All authorized columns (includes contacts)",
                "جميع الأعمدة المسموحة (تشمل التواصل)"
              )}
            </option>
          </select>
        </label>
        <Button
          variant="outline"
          disabled={!data.items.length || busy || fetching}
          onClick={() => void run("csv")}
        >
          CSV
        </Button>
        <Button
          variant="outline"
          disabled={!data.items.length || busy || fetching}
          onClick={() => void run("pdf")}
        >
          {t("Print / PDF", "طباعة / PDF")}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {t(
          "Uses applied filters and a fresh read. All columns includes phone and city. No partial export when a source limit is exceeded.",
          "يستخدم الفلاتر المطبّقة وقراءة جديدة. جميع الأعمدة تشمل الهاتف والمدينة. لا يُنتج تصدير جزئي عند تجاوز حد المصدر."
        )}
      </p>
      {busy && (
        <p role="status">{t("Preparing export…", "جارٍ تحضير التصدير…")}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
