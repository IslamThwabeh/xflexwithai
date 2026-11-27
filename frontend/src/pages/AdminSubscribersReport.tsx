import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import DashboardLayout from "@/components/DashboardLayout";
import ClientPaymentSummary from "@/components/admin/ClientPaymentSummary";
import CustomerReportExport from "@/components/admin/CustomerReportExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CUSTOMER_REPORT_COLUMNS,
  customerReportDate,
  customerServiceStatusLabel,
  type CustomerReportColumn,
  type CustomerReportFilter,
  type CustomerReportPage,
} from "@shared/customerReport";
import { customerCountryDisplay } from "@shared/customerLocation";
import { formatAcademyDateTime } from "@shared/academyLocale";
import { RefreshCw, Users } from "lucide-react";

const defaults: CustomerReportFilter = {
  search: "",
  country: "",
  sort: "registered",
  direction: "desc",
  page: 1,
  pageSize: 20,
};
export default function AdminSubscribersReport() {
  const { user } = useAuth();
  return <CustomerWorkspace key={user?.id ?? 0} viewerId={user?.id ?? 0} />;
}
function CustomerWorkspace({ viewerId }: { viewerId: number }) {
  const { language } = useLanguage(),
    ar = language === "ar",
    lang = ar ? "ar" : "en";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const client = useQueryClient();
  const [draft, setDraft] = useState(defaults),
    [filters, setFilters] = useState(defaults);
  const [columns, setColumns] = useState<CustomerReportColumn[]>(() => {
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("adminCustomers_visibleCols_v1") ?? "null"
      );
      if (Array.isArray(saved)) {
        const valid = CUSTOMER_REPORT_COLUMNS.map(column => column.key).filter(
          key => saved.includes(key)
        );
        if (valid.length) return valid;
      }
    } catch {}
    return ["name", "email", "country", "services"];
  });
  const accessQuery = trpc.reports.customerAccess.useQuery(
    { viewerId },
    {
      enabled: !!viewerId,
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: true,
    }
  );
  const access =
    !accessQuery.error && accessQuery.data?.viewerId === viewerId
      ? accessQuery.data
      : undefined;
  const verified = !!access && !accessQuery.isFetching;
  const scope = {
    viewerId,
    accessVersion:
      access?.accessVersion === "payments"
        ? ("payments" as const)
        : ("operations" as const),
  };
  const includePayments =
    !!access?.canViewClientPayments && columns.includes("paid");
  const input = { ...filters, ...scope, includePayments };
  const query = trpc.reports.customers.useQuery(input, {
    enabled: verified,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const data =
    verified &&
    !query.error &&
    query.data?.viewerId === viewerId &&
    query.data.accessVersion === scope.accessVersion
      ? query.data
      : undefined;
  const mismatchedResult =
    verified && !query.isFetching && !!query.data && !data;
  const activeScope = useRef("");
  activeScope.current = verified ? `${viewerId}:${scope.accessVersion}` : "";
  useEffect(
    () => () => {
      activeScope.current = "";
    },
    []
  );
  useEffect(() => {
    client.removeQueries({
      predicate(query) {
        const [path, options] = query.queryKey as [
          string[]?,
          { input?: { viewerId?: number; accessVersion?: string } }?,
        ];
        return (
          path?.join(".") === "reports.customers" &&
          (options?.input?.viewerId !== viewerId ||
            (!!access &&
              options?.input?.accessVersion !== access.accessVersion))
        );
      },
    });
  }, [client, viewerId, access?.accessVersion]);
  useEffect(() => {
    if (
      query.error?.data?.code === "FORBIDDEN" ||
      query.error?.data?.code === "UNAUTHORIZED"
    )
      void accessQuery.refetch();
  }, [query.error]);
  const availableColumns = CUSTOMER_REPORT_COLUMNS.filter(
    column => column.key !== "paid" || access?.canViewClientPayments
  );
  const selectedColumns = availableColumns.filter(column =>
    columns.includes(column.key)
  );
  const visible = selectedColumns.length
    ? selectedColumns
    : availableColumns.filter(column => column.key === "name");
  useEffect(() => {
    if (verified && !access?.canViewClientPayments) {
      setFilters(previous =>
        previous.sort === "paid"
          ? { ...previous, sort: "registered", direction: "desc", page: 1 }
          : previous
      );
      setDraft(previous =>
        previous.sort === "paid"
          ? { ...previous, sort: "registered", direction: "desc", page: 1 }
          : previous
      );
    }
  }, [verified, access?.canViewClientPayments]);
  const toggleColumn = (column: CustomerReportColumn) => {
    const next = columns.includes(column)
      ? columns.filter(key => key !== column)
      : [...columns, column];
    if (!next.some(key => availableColumns.some(column => column.key === key)))
      return;
    setColumns(next);
    try {
      localStorage.setItem(
        "adminCustomers_visibleCols_v1",
        JSON.stringify(next)
      );
    } catch {}
    if (column === "paid" && columns.includes(column)) {
      setFilters(previous =>
        previous.sort === "paid"
          ? { ...previous, sort: "registered", direction: "desc", page: 1 }
          : previous
      );
      setDraft(previous =>
        previous.sort === "paid"
          ? { ...previous, sort: "registered", direction: "desc", page: 1 }
          : previous
      );
    }
  };
  const displayCell = (
    row: CustomerReportPage["items"][number],
    column: CustomerReportColumn
  ) => {
    if (column === "paid")
      return (
        <ClientPaymentSummary summary={row.paymentSummary} language={lang} />
      );
    if (column === "services")
      return (
        <>
          {row.loginRestricted && (
            <p className="mb-1 text-sm font-medium text-amber-800">
              {t(
                "Login restricted; recorded service states below",
                "تسجيل الدخول مقيّد؛ حالات الخدمات المسجّلة أدناه"
              )}
            </p>
          )}
          {row.services.length ? (
            <details>
              <summary className="min-h-10 cursor-pointer py-1 text-sm">
                {t(
                  `${row.services.filter(service => ["active", "expiring"].includes(service.status)).length} recorded active · details`,
                  `${row.services.filter(service => ["active", "expiring"].includes(service.status)).length} نشطة موثّقة · التفاصيل`
                )}
                {row.services.some(service => service.status === "unknown") && (
                  <span className="block text-xs text-amber-800">
                    {t(
                      "Some service records need review",
                      "بعض سجلات الخدمات تحتاج مراجعة"
                    )}
                  </span>
                )}
              </summary>
              <ul className="space-y-1 pt-2">
                {row.services.map((service, index) => (
                  <li
                    key={index}
                    className={
                      ["active", "expiring"].includes(service.status)
                        ? "text-emerald-800"
                        : "text-muted-foreground"
                    }
                  >
                    {ar ? service.nameAr : service.nameEn} ·{" "}
                    {customerServiceStatusLabel(service.status, lang)}
                    {service.endDate && customerReportDate(service.endDate) && (
                      <span className="block text-xs">
                        {formatAcademyDateTime(
                          customerReportDate(service.endDate)!,
                          lang
                        )}
                      </span>
                    )}
                    {service.endDate &&
                      !customerReportDate(service.endDate) && (
                        <span className="block text-xs text-amber-800">
                          {t("Invalid historical date", "تاريخ سابق غير صالح")}
                        </span>
                      )}
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <span className="text-muted-foreground">
              {t("No service history recorded", "لا يوجد سجل خدمة موثّق")}
            </span>
          )}
        </>
      );
    if (column === "country") {
      const country = customerCountryDisplay(row.country, lang);
      return (
        <>
          {country.label}
          {country.needsReview && (
            <span className="block text-xs text-amber-800">
              {t("Historical value to review", "قيمة سابقة تحتاج مراجعة")}
            </span>
          )}
        </>
      );
    }
    if (column === "registered") {
      const date = customerReportDate(row.createdAt);
      return date ? formatAcademyDateTime(date, lang) : "—";
    }
    if (column === "keys") return row.totalKeys;
    if (column === "renewals") return row.renewalCount;
    return row[column] || "—";
  };
  return (
    <DashboardLayout>
      <div className="space-y-5 p-4 md:p-6" dir={ar ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Users className="h-6 w-6 shrink-0" />
              {t("Customer accounts", "حسابات العملاء")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                "All customer accounts, including those without purchases; staff excluded.",
                "جميع حسابات العملاء، بما فيها الحسابات دون مشتريات؛ باستثناء الموظفين."
              )}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={!verified || query.isFetching}
            onClick={() => void query.refetch()}
          >
            <RefreshCw className="me-2 h-4 w-4" />
            {t("Refresh", "تحديث")}
          </Button>
        </div>
        <p className="rounded-md border bg-muted/30 p-3 text-sm">
          {t(
            "Recorded payments are lifetime evidence, separate from active access. Historical keys and renewals are activity counts, not new sales. Display times: Palestine.",
            "المدفوعات الموثقة هي أدلة طوال الحساب، ومنفصلة عن الوصول النشط. المفاتيح والتجديدات السابقة أعداد نشاط وليست مبيعات جديدة. توقيت العرض: فلسطين."
          )}
        </p>
        {!verified ? (
          <div role="status" className="rounded border p-4">
            {accessQuery.error ? (
              <>
                <p>
                  {t(
                    "Access could not be verified. Customer data is hidden.",
                    "تعذّر التحقق من الصلاحيات. بيانات العملاء مخفية."
                  )}
                </p>
                <Button onClick={() => void accessQuery.refetch()}>
                  {t("Try again", "إعادة المحاولة")}
                </Button>
              </>
            ) : (
              t("Checking access…", "جارٍ التحقق من الصلاحيات…")
            )}
          </div>
        ) : (
          <>
            <form
              className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4"
              onSubmit={event => {
                event.preventDefault();
                setFilters({ ...draft, page: 1 });
              }}
            >
              <label className="text-sm">
                {t(
                  "Name, email, phone or city",
                  "الاسم، البريد، الهاتف أو المدينة"
                )}
                <Input
                  maxLength={200}
                  value={draft.search}
                  onChange={event =>
                    setDraft({ ...draft, search: event.target.value })
                  }
                />
              </label>
              <label className="text-sm">
                {t("Country", "البلد")}
                <select
                  className="mt-1 w-full rounded border bg-background p-2"
                  value={draft.country}
                  onChange={event =>
                    setDraft({ ...draft, country: event.target.value })
                  }
                >
                  <option value="">{t("All countries", "جميع البلدان")}</option>
                  {data?.countries.map(country => (
                    <option key={country.value} value={country.value}>
                      {ar ? country.labelAr : country.labelEn}
                      {country.needsReview ? t(" (review)", " (للمراجعة)") : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                {t("Order by", "الترتيب حسب")}
                <select
                  className="mt-1 w-full rounded border bg-background p-2"
                  value={draft.sort}
                  onChange={event =>
                    setDraft({
                      ...draft,
                      sort: event.target.value as CustomerReportFilter["sort"],
                    })
                  }
                >
                  {availableColumns
                    .filter(
                      column =>
                        !["phone", "services"].includes(column.key) &&
                        (column.key !== "paid" || includePayments)
                    )
                    .map(column => (
                      <option key={column.key} value={column.key}>
                        {column.key === "country"
                          ? t(
                              "Country (English name)",
                              "البلد (الاسم الإنجليزي)"
                            )
                          : ar
                            ? column.ar
                            : column.en}
                      </option>
                    ))}
                </select>
              </label>
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  {t("Direction", "الاتجاه")}
                  <select
                    className="block rounded border bg-background p-2"
                    value={draft.direction}
                    onChange={event =>
                      setDraft({
                        ...draft,
                        direction: event.target.value as "asc" | "desc",
                      })
                    }
                  >
                    <option value="desc">{t("Descending", "تنازلي")}</option>
                    <option value="asc">{t("Ascending", "تصاعدي")}</option>
                  </select>
                </label>
                <Button type="submit" disabled={query.isFetching}>
                  {t("Apply", "تطبيق")}
                </Button>
              </div>
            </form>
            <details className="rounded border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                {t("Visible columns", "الأعمدة الظاهرة")}
              </summary>
              <div className="mt-3 flex flex-wrap gap-4">
                {availableColumns.map(column => (
                  <label
                    key={column.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={columns.includes(column.key)}
                      onChange={() => toggleColumn(column.key)}
                    />
                    {ar ? column.ar : column.en}
                  </label>
                ))}
              </div>
            </details>
            {query.error || mismatchedResult ? (
              <div role="alert" className="rounded border p-4">
                <p>
                  {t(
                    "The report could not be loaded; previous customer rows are hidden.",
                    "تعذّر تحميل التقرير؛ الصفوف السابقة مخفية."
                  )}
                </p>
                <p className="text-sm">
                  {query.error?.message ??
                    t(
                      "The report response did not match this account. Refresh to verify it.",
                      "استجابة التقرير لا تطابق هذا الحساب. حدّث للتحقق منها."
                    )}
                </p>
                <Button onClick={() => void query.refetch()}>
                  {t("Try again", "إعادة المحاولة")}
                </Button>
              </div>
            ) : !data ? (
              <p role="status">
                {t("Loading customer accounts…", "جارٍ تحميل حسابات العملاء…")}
              </p>
            ) : (
              <>
                <div className="space-y-1 text-sm">
                  <p>
                    {t(
                      `${data.total} matching customer accounts / ${data.accountCount} total`,
                      `${data.total} حساب عميل مطابق / ${data.accountCount} إجمالي الحسابات`
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {t("Read started", "بدأت القراءة")}:{" "}
                    {formatAcademyDateTime(data.generatedAt, lang)} ·{" "}
                    {t("Applied filters", "الفلاتر المطبّقة")}:{" "}
                    {filters.search || t("No search", "دون بحث")} /{" "}
                    {filters.country
                      ? (data.countries.find(
                          country => country.value === filters.country
                        )?.[ar ? "labelAr" : "labelEn"] ?? filters.country)
                      : t("All countries", "جميع البلدان")}
                  </p>
                  {includePayments && (
                    <p className="text-muted-foreground">
                      {t(
                        "Complete recorded evidence or unavailable; no page payment totals.",
                        "الأدلة الموثقة الكاملة أو تعذّر القراءة؛ دون إجماليات دفع للصفحة."
                      )}
                    </p>
                  )}
                </div>
                <div className="overflow-x-auto rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {visible.map(column => (
                          <th
                            key={column.key}
                            className="min-w-36 p-3 text-start"
                          >
                            {ar ? column.ar : column.en}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map(row => (
                        <tr key={row.id} className="border-t">
                          {visible.map(column => (
                            <td
                              key={column.key}
                              className="max-w-xs break-words p-3 align-top"
                              dir={
                                ["email", "phone"].includes(column.key)
                                  ? "ltr"
                                  : undefined
                              }
                            >
                              {displayCell(row, column.key)}
                            </td>
                          ))}
                        </tr>
                      ))}
                      {!data.items.length && (
                        <tr>
                          <td
                            colSpan={visible.length || 1}
                            className="p-6 text-center"
                          >
                            {t(
                              "No matching customer accounts.",
                              "لا توجد حسابات عملاء مطابقة."
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={data.page <= 1 || query.isFetching}
                      onClick={() =>
                        setFilters({ ...filters, page: data.page - 1 })
                      }
                    >
                      {t("Previous", "السابق")}
                    </Button>
                    <span>
                      {data.page} /{" "}
                      {Math.max(1, Math.ceil(data.total / filters.pageSize))}
                    </span>
                    <Button
                      variant="outline"
                      disabled={
                        data.page * filters.pageSize >= data.total ||
                        query.isFetching
                      }
                      onClick={() =>
                        setFilters({ ...filters, page: data.page + 1 })
                      }
                    >
                      {t("Next", "التالي")}
                    </Button>
                  </div>
                  <label className="text-sm">
                    {t("Rows per page", "صفوف الصفحة")}{" "}
                    <select
                      className="rounded border bg-background p-2"
                      value={filters.pageSize}
                      onChange={event => {
                        const pageSize = Number(
                          event.target.value
                        ) as CustomerReportFilter["pageSize"];
                        setFilters({ ...filters, pageSize, page: 1 });
                        setDraft({ ...draft, pageSize });
                      }}
                    >
                      {[10, 20, 50].map(size => (
                        <option key={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <CustomerReportExport
                  data={data}
                  input={input}
                  visible={visible.map(column => column.key)}
                  allColumns={availableColumns.map(column => column.key)}
                  language={lang}
                  activeScope={activeScope}
                  fetching={query.isFetching}
                />
              </>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
