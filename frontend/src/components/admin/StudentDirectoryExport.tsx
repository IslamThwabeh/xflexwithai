import {
  ACADEMY_COUNTRY_AR,
  ACADEMY_COUNTRY_EN,
  ACADEMY_TIME_ZONE,
} from "@shared/academyLocale";
import { useState, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../../backend/routers";
import {
  studentDirectoryExportTable,
  type StudentDirectoryColumn,
} from "@shared/studentDirectoryExport";
import {
  buildCustomerReportCsv,
  buildCustomerReportPrint,
} from "@shared/customerReportExport";
type Input = inferRouterInputs<AppRouter>["reports"]["studentsPage"];
export default function StudentDirectoryExport({
  input,
  visible,
  allColumns,
  language,
  activeScope,
  fetching,
}: {
  input: Input;
  visible: StudentDirectoryColumn[];
  allColumns: StudentDirectoryColumn[];
  language: "ar" | "en";
  activeScope: MutableRefObject<string>;
  fetching: boolean;
}) {
  const ar = language === "ar",
    t = (en: string, arabic: string) => (ar ? arabic : en),
    utils = trpc.useUtils();
  const [rows, setRows] = useState("page"),
    [columns, setColumns] = useState("visible"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (format: "csv" | "print") => {
    if (busy || fetching || !activeScope.current) return;
    const scope = activeScope.current,
      target = format === "print" ? window.open("", "_blank") : null;
    if (format === "print" && !target) {
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
      const selected = columns === "all" ? allColumns : visible,
        result = await utils.reports.studentsPage.fetch(
          {
            ...input,
            includePayments: selected.includes("spent"),
            exportAll: rows === "filtered",
          },
          { staleTime: 0 }
        );
      if (
        scope !== activeScope.current ||
        result.viewerId !== input.viewerId ||
        result.accessVersion !== input.accessVersion
      )
        throw Error(
          t(
            "Access changed. Reopen the directory.",
            "تغيّرت الصلاحيات. أعد فتح القائمة."
          )
        );
      const table = studentDirectoryExportTable(
          result.items,
          selected,
          language,
          result.canViewClientPayments
        ),
        country = result.countries.find(row => row.value === input.country);
      const metadata: Array<[string, string | number]> = [
        [
          t("Report", "التقرير"),
          t(
            "Student/customer accounts, excluding staff",
            "حسابات الطلاب والعملاء باستثناء الموظفين"
          ),
        ],
        [
          t("Rows", "الصفوف"),
          rows === "filtered"
            ? t("All filtered accounts", "جميع الحسابات المطابقة")
            : t("Current page", "الصفحة الحالية"),
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
                "جميع الأعمدة المسموحة بما فيها بيانات التواصل"
              )
            : t("Visible columns", "الأعمدة الظاهرة"),
        ],
        [t("Applied search", "البحث المطبق"), input.search || "—"],
        [
          t("Country", "البلد"),
          country
            ? ar
              ? country.labelAr
              : country.labelEn
            : t("All countries", "جميع البلدان"),
        ],
        [
          t("Package filter", "تصفية الباقة"),
          input.packageFilter === "active"
            ? t("Package marked active", "باقة مسجّلة كنشطة")
            : input.packageFilter === "none"
              ? t("No package marked active", "بدون باقة مسجّلة كنشطة")
              : t("All accounts", "جميع الحسابات"),
        ],
        [t("Ordering", "الترتيب"), `${input.sort} ${input.direction}`],
        [
          t("Basis", "الأساس"),
          t(
            "Lifetime recorded payment evidence; marked package status is separate from current service access. No page cash total or company financial total.",
            "أدلة دفع موثقة طوال الحساب؛ حالة الباقة المسجّلة منفصلة عن صلاحية الخدمات الحالية. ليست إجماليات مالية للصفحة أو للشركة."
          ),
        ],
        [t("Read started (UTC)", "بدء القراءة (UTC)"), result.generatedAt],
        [
          t("Display timezone", "توقيت العرض"),
          `${ar ? ACADEMY_COUNTRY_AR : ACADEMY_COUNTRY_EN} (${ACADEMY_TIME_ZONE})`,
        ],
      ];
      if (format === "csv") {
        const blob = new Blob(
            ["\ufeff" + buildCustomerReportCsv(table, metadata)],
            {
              type: "text/csv;charset=utf-8;",
            }
          ),
          url = URL.createObjectURL(blob),
          link = document.createElement("a");
        link.href = url;
        link.download = "student-accounts.csv";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else if (target) {
        target.document.write(
          buildCustomerReportPrint(table, metadata, language)
        );
        target.document.close();
      }
    } catch (error) {
      target?.close();
      setError(
        error instanceof Error
          ? error.message
          : t(
              "Export failed; no partial output.",
              "تعذر التصدير؛ لم يتم إخراج جزء من البيانات."
            )
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="space-y-2 rounded border p-3"
      aria-label={t("Directory export", "تصدير قائمة الطلاب")}
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          {t("Rows", "الصفوف")}
          <select
            aria-label={t("Rows", "الصفوف")}
            className="ms-2 rounded border p-2"
            value={rows}
            onChange={event => setRows(event.target.value)}
          >
            <option value="page">{t("Current page", "الصفحة الحالية")}</option>
            <option value="filtered">
              {t("All filtered accounts", "جميع الحسابات المطابقة")}
            </option>
          </select>
        </label>
        <label className="text-sm">
          {t("Columns", "الأعمدة")}
          <select
            aria-label={t("Columns", "الأعمدة")}
            className="ms-2 rounded border p-2"
            value={columns}
            onChange={event => setColumns(event.target.value)}
          >
            <option value="visible">
              {t("Visible columns", "الأعمدة الظاهرة")}
            </option>
            <option value="all">
              {t("All authorized columns", "جميع الأعمدة المسموحة")}
            </option>
          </select>
        </label>
        <Button
          variant="outline"
          disabled={busy || fetching}
          onClick={() => void run("csv")}
        >
          CSV
        </Button>
        <Button
          variant="outline"
          disabled={busy || fetching}
          onClick={() => void run("print")}
        >
          {t("Print / PDF", "طباعة / PDF")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
