import ClientPaymentSummary from "@/components/admin/ClientPaymentSummary";
import { useAuth } from "@/_core/hooks/useAuth";
import StudentDirectoryExport from "@/components/admin/StudentDirectoryExport";
import type { StudentDirectoryColumn } from "@shared/studentDirectoryExport";
import { customerCountryDisplay } from "@shared/customerLocation";
import { customerReportDate } from "@shared/customerReport";
import {
  formatAcademyDateTime,
  ACADEMY_TIME_LABEL_AR,
  ACADEMY_TIME_LABEL_EN,
} from "@shared/academyLocale";
import { useState, useEffect, useRef } from "react";
import AdminClientProfileSheet from "@/components/admin/AdminClientProfileSheet";
import StudentActivityBreakdown, {
  ActivityHelp,
} from "@/components/admin/StudentActivityBreakdown";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  DataTablePagination,
  SortableHeader,
  zebraRow,
} from "@/components/DataTable";
import {
  Users,
  Search,
  Download,
  FileText,
  Package,
  UserCheck,
  UserX,
  Copy,
  SlidersHorizontal,
  FastForward,
  Undo2,
  Building2,
  Info,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { formatAdminCurrencyFromIls } from "@/lib/adminCurrency";

export default function AdminStudents() {
  const { user } = useAuth();
  return <StudentWorkspace key={user?.id ?? 0} viewerId={user?.id ?? 0} />;
}
function StudentWorkspace({ viewerId }: { viewerId: number }) {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const adminQuery = trpc.auth.isAdmin.useQuery(undefined, { retry: false });
  const adminCheck = adminQuery.error ? undefined : adminQuery.data;
  const isAdmin = !!adminCheck?.isAdmin;
  const staffRoles = adminCheck?.staffRoles ?? [];
  const canManageCourseSkip = isAdmin || staffRoles.includes("key_manager");
  const canManageBrokerSkip = isAdmin;

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
  const verified =
    !!access &&
    !accessQuery.isFetching &&
    !!adminCheck &&
    !adminQuery.isFetching;
  const canViewFinancials = !!access?.canViewClientPayments;
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilterValue] = useState("all");
  const [packageFilter, setPackageFilterValue] = useState("all");
  const [appliedSearch, setAppliedSearch] = useState(""),
    [requestedPage, setPage] = useState(0),
    [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<string | null>(null),
    [sortDir, setSortDir] = useState<"asc" | "desc" | null>(null);
  const setCountryFilter = (value: string) => {
    setCountryFilterValue(value);
    setPage(0);
  };
  const setPackageFilter = (value: string) => {
    setPackageFilterValue(value);
    setPage(0);
  };
  const changePageSize = (value: number) => {
    setPageSize(value);
    setPage(0);
  };
  const handleSort = (key: string) => {
    if (key === sortKey && sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
    } else {
      setSortKey(key);
      setSortDir(key === sortKey && sortDir === "asc" ? "desc" : "asc");
    }
    setPage(0);
  };
  const [showActivityBreakdown, setShowActivityBreakdown] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [skipBrokerConfirm, setSkipBrokerConfirm] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [rollbackBrokerConfirm, setRollbackBrokerConfirm] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [confirmNameInput, setConfirmNameInput] = useState("");
  const [profileUserId, setProfileUserId] = useState<number | null>(null);

  const skipCourseMutation = trpc.enrollments.skipCourse.useMutation({
    onSuccess: () => {
      toast.success(
        isRtl ? "تم تخطي الدورة بنجاح" : "Course skipped successfully"
      );
      setSkipConfirm(null);
      setConfirmNameInput("");
      void Promise.all([
        utils.reports.subscribers.invalidate(),
        utils.reports.studentsPage.invalidate(),
        utils.reports.customers.invalidate(),
      ]);
    },
    onError: err => {
      toast.error(err.message);
    },
  });

  const rollbackSkipMutation = trpc.enrollments.rollbackSkip.useMutation({
    onSuccess: () => {
      toast.success(
        isRtl ? "تم التراجع عن التخطي بنجاح" : "Skip rolled back successfully"
      );
      setRollbackConfirm(null);
      setConfirmNameInput("");
      void Promise.all([
        utils.reports.subscribers.invalidate(),
        utils.reports.studentsPage.invalidate(),
        utils.reports.customers.invalidate(),
      ]);
    },
    onError: err => {
      toast.error(err.message);
    },
  });

  const skipBrokerMutation = trpc.enrollments.skipBrokerOnboarding.useMutation({
    onSuccess: () => {
      toast.success(
        isRtl
          ? "تم تخطي فتح الحساب بنجاح"
          : "Broker onboarding skipped successfully"
      );
      setSkipBrokerConfirm(null);
      setConfirmNameInput("");
      void Promise.all([
        utils.reports.subscribers.invalidate(),
        utils.reports.studentsPage.invalidate(),
        utils.reports.customers.invalidate(),
      ]);
    },
    onError: err => {
      toast.error(err.message);
    },
  });

  const rollbackBrokerSkipMutation =
    trpc.enrollments.rollbackBrokerSkip.useMutation({
      onSuccess: () => {
        toast.success(
          isRtl
            ? "تم التراجع عن تخطي الوسيط بنجاح"
            : "Broker skip rolled back successfully"
        );
        setRollbackBrokerConfirm(null);
        setConfirmNameInput("");
        void Promise.all([
          utils.reports.subscribers.invalidate(),
          utils.reports.studentsPage.invalidate(),
          utils.reports.customers.invalidate(),
        ]);
      },
      onError: err => {
        toast.error(err.message);
      },
    });

  // Column visibility
  const allColumns = [
    { key: "name", en: "Name", ar: "الاسم" },
    { key: "email", en: "Email", ar: "الإيميل" },
    { key: "phone", en: "Phone", ar: "الهاتف" },
    { key: "location", en: "Location", ar: "الموقع" },
    { key: "package", en: "Package", ar: "الباقة" },
    { key: "spent", en: "Net confirmed paid", ar: "صافي المدفوع الموثق" },
    { key: "renewals", en: "Renewals", ar: "التجديدات" },
    { key: "registered", en: "Registered", ar: "التسجيل" },
    { key: "lastSignIn", en: "Last Sign In", ar: "آخر دخول" },
  ] as const;
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("adminStudents_visibleCols");
      if (saved) {
        const values: unknown = JSON.parse(saved);
        if (Array.isArray(values)) {
          const valid = allColumns
            .filter(column => values.includes(column.key))
            .map(column => column.key);
          if (valid.length) return new Set(valid);
        }
      }
    } catch {}
    return new Set([
      "name",
      "email",
      "package",
      "spent",
      "registered",
      "lastSignIn",
    ]);
  });
  const toggleCol = (col: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      try {
        localStorage.setItem(
          "adminStudents_visibleCols",
          JSON.stringify(Array.from(next))
        );
      } catch {}
      return next.size ? next : prev;
    });
  };
  const visibleColCount = visibleCols.size;

  // Package badge colors
  const pkgBadgeClass = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes("comprehensive") || lower.includes("شامل"))
      return "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100";
    return "bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100";
  };

  const scope = {
    viewerId,
    accessVersion:
      access?.accessVersion === "payments"
        ? ("payments" as const)
        : ("operations" as const),
  };
  const includePayments = canViewFinancials && visibleCols.has("spent");
  const effectiveSort =
    sortKey === "spent" && !includePayments
      ? "registered"
      : (sortKey ?? "registered");
  const input = {
    ...scope,
    search: appliedSearch,
    country: countryFilter === "all" ? "" : countryFilter,
    packageFilter: packageFilter as "all" | "active" | "none",
    sort: effectiveSort as
      | "name"
      | "email"
      | "location"
      | "package"
      | "spent"
      | "renewals"
      | "registered"
      | "lastSignIn",
    direction: sortDir ?? ("desc" as "asc" | "desc"),
    page: requestedPage + 1,
    pageSize: pageSize as 10 | 25 | 50,
    includePayments,
  };
  const query = trpc.reports.studentsPage.useQuery(input, {
    enabled: verified,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 30_000,
  });
  const result =
    verified &&
    !query.error &&
    query.data?.viewerId === viewerId &&
    query.data.accessVersion === scope.accessVersion
      ? query.data
      : undefined;
  const isLoading = !verified || query.isLoading;
  const paged = result?.items ?? [],
    countries = result?.countries ?? [],
    totalItems = result?.total ?? 0,
    page = (result?.page ?? requestedPage + 1) - 1,
    totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const totalStudents = result?.accountCount ?? 0,
    activeStudents = result?.markedActiveAccounts ?? 0,
    inactiveStudents = totalStudents - activeStudents,
    totalConfirmedPaidMinor = result?.filteredPaymentTotalMinor ?? null;
  const activeScope = useRef("");
  activeScope.current = verified ? viewerId + ":" + scope.accessVersion : "";
  useEffect(
    () => () => {
      activeScope.current = "";
    },
    []
  );
  const authoritySignature =
    scope.accessVersion +
    ":" +
    isAdmin +
    ":" +
    [...staffRoles].sort().join(",");
  const priorScope = useRef(authoritySignature);
  useEffect(() => {
    if (!verified) return;
    if (priorScope.current !== authoritySignature) {
      setSkipConfirm(null);
      setRollbackConfirm(null);
      setSkipBrokerConfirm(null);
      setRollbackBrokerConfirm(null);
      setProfileUserId(null);
      setConfirmNameInput("");
    }
    priorScope.current = authoritySignature;
  }, [authoritySignature, verified]);
  useEffect(() => {
    if (!includePayments && sortKey === "spent") {
      setSortKey(null);
      setSortDir(null);
      setPage(0);
    }
  }, [includePayments, sortKey]);
  useEffect(() => {
    if (
      query.error?.data?.code === "FORBIDDEN" ||
      query.error?.data?.code === "UNAUTHORIZED"
    )
      void accessQuery.refetch();
  }, [query.error]);
  const location = (row: { city: string | null; country: string | null }) => {
    const country = customerCountryDisplay(row.country, language);
    return [
      row.city,
      country.label +
        (country.needsReview
          ? isRtl
            ? " (قيمة سابقة تحتاج مراجعة)"
            : " (historical value to review)"
          : ""),
    ]
      .filter(Boolean)
      .join(", ");
  };
  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success(isRtl ? "تم النسخ" : "Copied!");
  };

  const fmtDate = (value: string | null | undefined) => {
    const date = customerReportDate(value);
    return date ? formatAcademyDateTime(date, language) : "—";
  };
  if (!result)
    return (
      <DashboardLayout>
        <div className="space-y-3 p-4">
          <h1 className="text-2xl font-bold">
            {isRtl ? "الطلاب" : "Students"}
          </h1>
          {!verified && !accessQuery.error && !adminQuery.error ? (
            <p role="status">
              {isRtl ? "جارٍ التحقق من الصلاحية..." : "Checking access..."}
            </p>
          ) : !access || accessQuery.error || adminQuery.error ? (
            <p role="alert">
              {isRtl
                ? "تعذر التحقق من الصلاحية؛ بيانات العملاء مخفية."
                : "Access is unverified; customer data is hidden."}
            </p>
          ) : query.error || (!query.isFetching && query.data) ? (
            <p role="alert">
              {isRtl
                ? "تعذر تحميل القائمة أو لا تطابق الحساب الحالي؛ البيانات السابقة مخفية."
                : "Directory could not be loaded or did not match this account; previous data is hidden."}
            </p>
          ) : (
            <p role="status">{isRtl ? "جارٍ التحميل..." : "Loading..."}</p>
          )}
          <Button
            onClick={() =>
              void (!verified
                ? Promise.all([accessQuery.refetch(), adminQuery.refetch()])
                : query.refetch())
            }
          >
            {isRtl ? "إعادة المحاولة" : "Try again"}
          </Button>
        </div>
      </DashboardLayout>
    );

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-emerald-600" />
              {isRtl ? "الطلاب" : "Students"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isRtl
                ? `${totalItems} طالب من أصل ${totalStudents}`
                : `${totalItems} of ${totalStudents} students`}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {isRtl ? "تحديث" : "Refresh"}
          </Button>
        </div>

        <StudentDirectoryExport
          input={input}
          visible={allColumns
            .filter(
              column =>
                visibleCols.has(column.key) &&
                (column.key !== "spent" || canViewFinancials)
            )
            .map(column => column.key)}
          allColumns={allColumns
            .filter(column => column.key !== "spent" || canViewFinancials)
            .map(column => column.key)}
          language={isRtl ? "ar" : "en"}
          activeScope={activeScope}
          fetching={query.isFetching}
        />
        <details className="rounded border p-3 md:hidden">
          <summary className="min-h-10 cursor-pointer">
            {isRtl ? "الأعمدة الظاهرة" : "Visible columns"}
          </summary>
          <div className="flex flex-wrap gap-3">
            {allColumns
              .filter(column => column.key !== "spent" || canViewFinancials)
              .map(column => (
                <label
                  key={column.key}
                  className="flex min-h-11 items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={visibleCols.has(column.key)}
                    onChange={() => toggleCol(column.key)}
                  />
                  {isRtl ? column.ar : column.en}
                </label>
              ))}
          </div>
        </details>
        {/* Stats — clickable to filter */}
        <div
          className={`grid ${canViewFinancials ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"} gap-2`}
        >
          <button
            onClick={() => setPackageFilter("all")}
            className={`rounded-lg border px-3 py-2 text-center transition hover:shadow-sm ${packageFilter === "all" ? "ring-2 ring-emerald-400 bg-emerald-50" : "bg-white"}`}
          >
            <p className="text-lg font-bold text-emerald-600">
              {totalStudents}
            </p>
            <p className="text-[11px] text-gray-500 leading-tight">
              {isRtl ? "الإجمالي" : "Total"}
            </p>
          </button>
          <div
            className={`relative rounded-lg border transition hover:shadow-sm ${packageFilter === "active" ? "ring-2 ring-emerald-400 bg-emerald-50" : "bg-white"}`}
          >
            <button
              type="button"
              onClick={() => {
                setPackageFilter("active");
                setShowActivityBreakdown(shown => !shown);
              }}
              aria-expanded={showActivityBreakdown}
              aria-controls="student-activity-breakdown"
              title={
                isRtl
                  ? "عملاء لديهم باقة مسجلة كنشطة؛ لا يعني ذلك أن التوصيات سارية. اضغط لعرض التفاصيل."
                  : "Clients with a package marked active; recommendation access may have expired. Select to see the breakdown."
              }
              className="h-full w-full rounded-lg px-3 py-2 pe-11 text-center focus-visible:outline-2 focus-visible:outline-ring"
            >
              <p className="text-lg font-bold text-green-600">
                {isLoading ? "—" : activeStudents}
              </p>
              <p className="text-[11px] text-gray-500 leading-tight">
                {isRtl
                  ? "عملاء لديهم باقة نشطة"
                  : "Clients with active packages"}
              </p>
              <span className="mt-1 flex items-center justify-center gap-1 text-[11px] text-emerald-700">
                {isRtl ? "تفاصيل التوصيات" : "Recommendation breakdown"}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${showActivityBreakdown ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </span>
            </button>
            <div className="absolute end-0 top-0">
              <ActivityHelp
                label={
                  isRtl ? "شرح عدد العملاء النشطين" : "About active clients"
                }
              >
                {isRtl
                  ? "عملاء لديهم باقة مسجلة كنشطة. لا يعني هذا أنهم متصلون أو أن اشتراك التوصيات ما زال سارياً. اضغط البطاقة لعرض شجرة جمهور التوصيات وتصفية العملاء ذوي الباقات."
                  : "Clients with a package marked active. This does not mean they are online or their recommendation access is unexpired. Select this card to see the recommendation audience tree and filter clients with packages."}
              </ActivityHelp>
            </div>
          </div>
          <button
            onClick={() => setPackageFilter("none")}
            className={`rounded-lg border px-3 py-2 text-center transition hover:shadow-sm ${packageFilter === "none" ? "ring-2 ring-emerald-400 bg-emerald-50" : "bg-white"}`}
          >
            <p className="text-lg font-bold text-gray-500">
              {inactiveStudents}
            </p>
            <p className="text-[11px] text-gray-500 leading-tight">
              {isRtl ? "بدون باقة" : "No Package"}
            </p>
          </button>
          {includePayments && (
            <div className="rounded-lg border px-3 py-2 text-center bg-white">
              <p className="text-lg font-bold text-emerald-600">
                {totalConfirmedPaidMinor == null
                  ? isRtl
                    ? "غير متاح"
                    : "Unavailable"
                  : formatAdminCurrencyFromIls(
                      totalConfirmedPaidMinor / 100,
                      language
                    )}
              </p>
              <p className="text-[11px] text-gray-500 leading-tight">
                {isRtl
                  ? "صافي موثق لجميع الحسابات المطابقة · أدلة طوال الحساب قد تكون ناقصة"
                  : "Net confirmed for all matching accounts · lifetime evidence may be incomplete"}
              </p>
            </div>
          )}
        </div>

        {showActivityBreakdown && (
          <StudentActivityBreakdown
            activeClients={activeStudents}
            isRtl={isRtl}
          />
        )}

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <form
              onSubmit={event => {
                event.preventDefault();
                setAppliedSearch(search.trim());
                setPage(0);
              }}
              className="flex flex-col sm:flex-row gap-3"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  className="pl-10"
                  placeholder={
                    isRtl
                      ? "بحث بالاسم، الإيميل، الهاتف..."
                      : "Search by name, email, phone..."
                  }
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={query.isFetching}>
                {isRtl ? "تطبيق البحث" : "Apply search"}
              </Button>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {isRtl ? "جميع البلدان" : "All Countries"}
                  </SelectItem>
                  {countries.map(c => (
                    <SelectItem key={c.value} value={c.value}>
                      {isRtl ? c.labelAr : c.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={packageFilter} onValueChange={setPackageFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isRtl ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="active">
                    {isRtl ? "لديه باقة" : "Has Package"}
                  </SelectItem>
                  <SelectItem value="none">
                    {isRtl ? "بدون باقة" : "No Package"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          {isRtl ? "بدأت القراءة: " : "Read started: "}
          {formatAcademyDateTime(
            result.generatedAt,
            isRtl ? "ar" : "en"
          )} · {isRtl ? ACADEMY_TIME_LABEL_AR : ACADEMY_TIME_LABEL_EN}.{" "}
          {isRtl
            ? "ترتيب الموقع حسب المدينة ثم اسم البلد بالإنجليزية."
            : "Location ordering uses city, then English country name."}
        </p>
        <Card className="border-amber-200 bg-amber-50/70">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-amber-900">
                  {isRtl ? "ترتيب الترحيل المعتمد" : "Approved Migration Order"}
                </p>
                <p className="text-amber-800">
                  {isRtl
                    ? "المسار الصحيح هو: تعيين أو تفعيل المفتاح أولاً، ثم تخطي الوسيط فقط إذا أنهى العميل خطوات الوسيط خارج الموقع، ثم التأكد من الملف والملفات وLexAI والتوصيات. تخطي الدورة لا يفعّل الخدمات؛ هو فقط يعلّم الدورة كمكتملة ويحافظ على التقدم الحقيقي."
                    : "The correct path is: assign or activate the key first, then use broker skip only if the client already completed broker steps outside the site, then verify the profile, documents, LexAI, and Recommendations. Course skip does not activate services; it only marks the course complete and preserves real progress."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {paged.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    {isRtl ? "لا توجد نتائج" : "No results found"}
                  </CardContent>
                </Card>
              ) : (
                paged.map((s: any) => (
                  <Card key={s.id}>
                    <CardContent className="p-4 space-y-3">
                      {/* Name + badges */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate">
                            {s.name || "—"}
                            {s.loginRestricted && (
                              <span className="block text-xs text-amber-800">
                                {isRtl
                                  ? "تسجيل الدخول مقيّد"
                                  : "Login restricted"}
                              </span>
                            )}
                          </p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <p
                              className="text-xs text-gray-500 truncate"
                              dir="ltr"
                            >
                              {s.email}
                            </p>
                            <button
                              onClick={() => copyEmail(s.email)}
                              className="text-gray-400 hover:text-emerald-600 shrink-0"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        {(s.activePackages || []).length > 0 ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-xs shrink-0">
                            <UserCheck className="w-3 h-3 me-1" />
                            {isRtl ? "نشط" : "Active"}
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-xs shrink-0"
                          >
                            <UserX className="w-3 h-3 me-1" />
                            {isRtl ? "غير مشترك" : "Inactive"}
                          </Badge>
                        )}
                      </div>

                      {/* Packages */}
                      {(s.activePackages || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {(isRtl
                            ? s.activePackagesAr || s.activePackages
                            : s.activePackages
                          ).map((p: string, i: number) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className={`text-xs gap-1 ${pkgBadgeClass(p)}`}
                            >
                              <Package className="w-3 h-3" />
                              {p}
                            </Badge>
                          ))}
                          {s.renewalCount > 0 && (
                            <Badge className="text-xs bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                              {s.renewalCount} {isRtl ? "تجديد" : "renewal"}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        {visibleCols.has("phone") && s.phone && (
                          <div>
                            <span className="text-gray-400 block">
                              {isRtl ? "الهاتف" : "Phone"}
                            </span>
                            <span className="font-medium" dir="ltr">
                              {s.phone}
                            </span>
                          </div>
                        )}
                        {visibleCols.has("location") &&
                          (s.city || s.country) && (
                            <div>
                              <span className="text-gray-400 block">
                                {isRtl ? "الموقع" : "Location"}
                              </span>
                              <span className="font-medium">{location(s)}</span>
                            </div>
                          )}
                        {includePayments && (
                          <div>
                            <span className="text-gray-400 block">
                              {isRtl
                                ? "المدفوعات الموثقة"
                                : "Recorded payments"}
                            </span>
                            <ClientPaymentSummary
                              summary={s.paymentSummary}
                              language={language}
                            />
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400 block">
                            {isRtl ? "التسجيل" : "Registered"}
                          </span>
                          <span className="font-medium">
                            {fmtDate(s.createdAt)}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">
                            {isRtl ? "آخر دخول" : "Last Sign In"}
                          </span>
                          <span className="font-medium">
                            {fmtDate(s.lastSignedIn)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-2 border-t flex gap-2 items-center flex-wrap">
                        {canManageCourseSkip &&
                          (s.isAdminSkipped ? (
                            <>
                              <Badge
                                variant="outline"
                                className="text-amber-600 border-amber-300 bg-amber-50 text-xs"
                              >
                                {isRtl ? "الدورة" : "Course"}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1"
                                onClick={() =>
                                  setRollbackConfirm({
                                    id: s.id,
                                    name: s.name || s.email,
                                  })
                                }
                              >
                                <Undo2 className="w-3 h-3" />
                                {isRtl ? "تراجع" : "Undo"}
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={() =>
                                setSkipConfirm({
                                  id: s.id,
                                  name: s.name || s.email,
                                })
                              }
                            >
                              <FastForward className="w-3 h-3" />
                              {isRtl ? "تخطي الدورة" : "Skip Course"}
                            </Button>
                          ))}
                        {canManageBrokerSkip &&
                          (s.brokerOnboardingComplete ? (
                            <>
                              <Badge
                                variant="outline"
                                className="text-teal-600 border-teal-300 bg-teal-50 text-xs"
                              >
                                <Building2 className="w-3 h-3 me-1" />
                                {isRtl ? "الوسيط" : "Broker"}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs gap-1"
                                onClick={() =>
                                  setRollbackBrokerConfirm({
                                    id: s.id,
                                    name: s.name || s.email,
                                  })
                                }
                              >
                                <Undo2 className="w-3 h-3" />
                                {isRtl ? "تراجع" : "Undo"}
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={() =>
                                setSkipBrokerConfirm({
                                  id: s.id,
                                  name: s.name || s.email,
                                })
                              }
                            >
                              <FastForward className="w-3 h-3" />
                              {isRtl ? "تخطي الوسيط" : "Skip Broker"}
                            </Button>
                          ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => setProfileUserId(s.id)}
                        >
                          <Info className="w-3 h-3" />
                          {isRtl ? "الملف" : "Profile"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <Card className="hidden md:block">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {isRtl ? "قائمة الطلاب" : "Student List"}{" "}
                    <span className="text-gray-400 font-normal">
                      ({totalItems})
                    </span>
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {isRtl ? "الأعمدة" : "Columns"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align={isRtl ? "start" : "end"}
                      className="w-48"
                    >
                      <DropdownMenuLabel>
                        {isRtl ? "إظهار / إخفاء الأعمدة" : "Toggle Columns"}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {allColumns
                        .filter(col => col.key !== "spent" || canViewFinancials)
                        .map(col => (
                          <DropdownMenuCheckboxItem
                            key={col.key}
                            checked={visibleCols.has(col.key)}
                            onCheckedChange={() => toggleCol(col.key)}
                            onSelect={e => e.preventDefault()}
                          >
                            {isRtl ? col.ar : col.en}
                          </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {visibleCols.has("name") && (
                          <TableHead>
                            <SortableHeader
                              label={isRtl ? "الاسم" : "Name"}
                              sortKey="name"
                              currentSortKey={sortKey}
                              currentSortDir={sortDir}
                              onSort={handleSort}
                            />
                          </TableHead>
                        )}
                        {visibleCols.has("email") && (
                          <TableHead>
                            <SortableHeader
                              label={isRtl ? "الإيميل" : "Email"}
                              sortKey="email"
                              currentSortKey={sortKey}
                              currentSortDir={sortDir}
                              onSort={handleSort}
                            />
                          </TableHead>
                        )}
                        {visibleCols.has("phone") && (
                          <TableHead>{isRtl ? "الهاتف" : "Phone"}</TableHead>
                        )}
                        {visibleCols.has("location") && (
                          <TableHead>
                            <SortableHeader
                              label={isRtl ? "الموقع" : "Location"}
                              sortKey="location"
                              currentSortKey={sortKey}
                              currentSortDir={sortDir}
                              onSort={handleSort}
                            />
                          </TableHead>
                        )}
                        {visibleCols.has("package") && (
                          <TableHead>
                            <SortableHeader
                              label={isRtl ? "الباقة" : "Package"}
                              sortKey="package"
                              currentSortKey={sortKey}
                              currentSortDir={sortDir}
                              onSort={handleSort}
                            />
                          </TableHead>
                        )}
                        {canViewFinancials && visibleCols.has("spent") && (
                          <TableHead>
                            <SortableHeader
                              label={
                                isRtl
                                  ? "صافي المدفوع الموثق"
                                  : "Net confirmed paid"
                              }
                              sortKey="spent"
                              currentSortKey={sortKey}
                              currentSortDir={sortDir}
                              onSort={handleSort}
                            />
                          </TableHead>
                        )}
                        {visibleCols.has("renewals") && (
                          <TableHead>
                            <SortableHeader
                              label={isRtl ? "التجديدات" : "Renewals"}
                              sortKey="renewals"
                              currentSortKey={sortKey}
                              currentSortDir={sortDir}
                              onSort={handleSort}
                            />
                          </TableHead>
                        )}
                        {visibleCols.has("registered") && (
                          <TableHead>
                            <SortableHeader
                              label={isRtl ? "التسجيل" : "Registered"}
                              sortKey="registered"
                              currentSortKey={sortKey}
                              currentSortDir={sortDir}
                              onSort={handleSort}
                            />
                          </TableHead>
                        )}
                        {visibleCols.has("lastSignIn") && (
                          <TableHead>
                            <SortableHeader
                              label={isRtl ? "آخر دخول" : "Last Sign In"}
                              sortKey="lastSignIn"
                              currentSortKey={sortKey}
                              currentSortDir={sortDir}
                              onSort={handleSort}
                            />
                          </TableHead>
                        )}
                        <TableHead className="w-[160px]">
                          {isRtl ? "إجراءات" : "Actions"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={visibleColCount + 1}
                            className="text-center py-8 text-gray-500"
                          >
                            {isRtl ? "لا توجد نتائج" : "No results found"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        paged.map((s: any, i: number) => (
                          <TableRow key={s.id} className={zebraRow(i)}>
                            {visibleCols.has("name") && (
                              <TableCell className="font-medium">
                                {s.name || "—"}
                                {s.loginRestricted && (
                                  <span className="block text-xs text-amber-800">
                                    {isRtl
                                      ? "تسجيل الدخول مقيّد"
                                      : "Login restricted"}
                                  </span>
                                )}
                              </TableCell>
                            )}
                            {visibleCols.has("email") && (
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <span className="text-sm" dir="ltr">
                                    {s.email}
                                  </span>
                                  <button
                                    onClick={() => copyEmail(s.email)}
                                    className="text-gray-400 hover:text-emerald-600 transition-colors"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </div>
                              </TableCell>
                            )}
                            {visibleCols.has("phone") && (
                              <TableCell className="text-sm" dir="ltr">
                                {s.phone || "—"}
                              </TableCell>
                            )}
                            {visibleCols.has("location") && (
                              <TableCell className="text-sm text-gray-500">
                                {location(s)}
                              </TableCell>
                            )}
                            {visibleCols.has("package") && (
                              <TableCell>
                                {(s.activePackages || []).length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {(isRtl
                                      ? s.activePackagesAr || s.activePackages
                                      : s.activePackages
                                    ).map((p: string, i: number) => (
                                      <Badge
                                        key={i}
                                        variant="outline"
                                        className={`text-xs gap-1 ${pkgBadgeClass(p)}`}
                                      >
                                        <Package className="w-3 h-3" />
                                        {p}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">
                                    —
                                  </span>
                                )}
                              </TableCell>
                            )}
                            {canViewFinancials && visibleCols.has("spent") && (
                              <TableCell>
                                <ClientPaymentSummary
                                  summary={s.paymentSummary}
                                  language={language}
                                />
                              </TableCell>
                            )}
                            {visibleCols.has("renewals") && (
                              <TableCell className="text-center">
                                {s.renewalCount > 0 ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-xs">
                                    {s.renewalCount}
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            )}
                            {visibleCols.has("registered") && (
                              <TableCell className="text-xs text-gray-500">
                                {fmtDate(s.createdAt)}
                              </TableCell>
                            )}
                            {visibleCols.has("lastSignIn") && (
                              <TableCell className="text-xs text-gray-500">
                                {fmtDate(s.lastSignedIn)}
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1">
                                {canManageCourseSkip &&
                                  (s.isAdminSkipped ? (
                                    <div className="flex items-center gap-1">
                                      <Badge
                                        variant="outline"
                                        className="text-amber-600 border-amber-300 bg-amber-50 text-xs"
                                      >
                                        {isRtl ? "الدورة" : "Course"}
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs gap-1 h-7"
                                        onClick={() =>
                                          setRollbackConfirm({
                                            id: s.id,
                                            name: s.name || s.email,
                                          })
                                        }
                                      >
                                        <Undo2 className="w-3 h-3" />
                                        {isRtl ? "تراجع" : "Undo"}
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs gap-1 h-7"
                                      onClick={() =>
                                        setSkipConfirm({
                                          id: s.id,
                                          name: s.name || s.email,
                                        })
                                      }
                                    >
                                      <FastForward className="w-3 h-3" />
                                      {isRtl ? "تخطي" : "Skip"}
                                    </Button>
                                  ))}
                                {canManageBrokerSkip &&
                                  (s.brokerOnboardingComplete ? (
                                    <div className="flex items-center gap-1">
                                      <Badge
                                        variant="outline"
                                        className="text-teal-600 border-teal-300 bg-teal-50 text-xs"
                                      >
                                        <Building2 className="w-3 h-3 me-0.5" />
                                        {isRtl ? "الوسيط" : "Broker"}
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs gap-1 h-7"
                                        onClick={() =>
                                          setRollbackBrokerConfirm({
                                            id: s.id,
                                            name: s.name || s.email,
                                          })
                                        }
                                      >
                                        <Undo2 className="w-3 h-3" />
                                        {isRtl ? "تراجع" : "Undo"}
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs gap-1 h-7"
                                      onClick={() =>
                                        setSkipBrokerConfirm({
                                          id: s.id,
                                          name: s.name || s.email,
                                        })
                                      }
                                    >
                                      <FastForward className="w-3 h-3" />
                                      {isRtl ? "وسيط" : "Broker"}
                                    </Button>
                                  ))}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs gap-1 h-7"
                                  onClick={() => setProfileUserId(s.id)}
                                  title={
                                    isRtl
                                      ? "فتح ملف العميل"
                                      : "Open client profile"
                                  }
                                >
                                  <Info className="w-3 h-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Pagination */}
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              totalItems={totalItems}
              setPage={setPage}
              changePageSize={changePageSize}
              isRtl={isRtl}
            />
          </>
        )}
      </div>

      {/* Skip Course Confirmation Dialog */}
      <AlertDialog
        open={canManageCourseSkip && !!skipConfirm}
        onOpenChange={open => {
          if (!open) {
            setSkipConfirm(null);
            setConfirmNameInput("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRtl ? "تخطي الدورة التعليمية" : "Skip Trading Course"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <span className="block">
                  {isRtl
                    ? `سيتم فقط تعليم الدورة كمكتملة من جهة الإدارة مع الحفاظ على التقدم الحقيقي للطالب. هذا الإجراء لا يفعّل LexAI أو التوصيات؛ تخطي الوسيط هو بوابة التفعيل الوحيدة للخدمات الزمنية.`
                    : `This only marks the course as completed from the admin side while preserving the student's real progress. It does not activate LexAI or Recommendations; broker skip remains the only activation gate for timed services.`}
                </span>
                <span className="block font-medium text-foreground">
                  {isRtl
                    ? `للتأكيد، اكتب اسم الطالب: "${skipConfirm?.name}"`
                    : `To confirm, type the student's name: "${skipConfirm?.name}"`}
                </span>
                <Input
                  value={confirmNameInput}
                  onChange={e => setConfirmNameInput(e.target.value)}
                  placeholder={skipConfirm?.name ?? ""}
                  className="mt-1"
                  dir="auto"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (skipConfirm) {
                  skipCourseMutation.mutate({
                    userId: skipConfirm.id,
                    courseId: 1,
                  });
                }
              }}
              disabled={
                skipCourseMutation.isPending ||
                confirmNameInput.trim() !== skipConfirm?.name?.trim()
              }
            >
              {skipCourseMutation.isPending
                ? isRtl
                  ? "جاري التخطي..."
                  : "Skipping..."
                : isRtl
                  ? "تأكيد التخطي"
                  : "Confirm Skip"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rollback Skip Confirmation Dialog */}
      <AlertDialog
        open={canManageCourseSkip && !!rollbackConfirm}
        onOpenChange={open => {
          if (!open) {
            setRollbackConfirm(null);
            setConfirmNameInput("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRtl ? "التراجع عن تخطي الدورة" : "Undo Course Skip"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <span className="block">
                  {isRtl
                    ? `سيتم فقط إزالة علامة تخطي الدورة من جهة الإدارة. حالة LexAI والتوصيات لن تتغير هنا لأن بوابة التفعيل الوحيدة هي حالة الوسيط.`
                    : `This only removes the admin course-skip flag. LexAI and Recommendations stay in their current state here because broker status is the only activation gate.`}
                </span>
                <span className="block font-medium text-foreground">
                  {isRtl
                    ? `للتأكيد، اكتب اسم الطالب: "${rollbackConfirm?.name}"`
                    : `To confirm, type the student's name: "${rollbackConfirm?.name}"`}
                </span>
                <Input
                  value={confirmNameInput}
                  onChange={e => setConfirmNameInput(e.target.value)}
                  placeholder={rollbackConfirm?.name ?? ""}
                  className="mt-1"
                  dir="auto"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rollbackConfirm) {
                  rollbackSkipMutation.mutate({
                    userId: rollbackConfirm.id,
                    courseId: 1,
                  });
                }
              }}
              disabled={
                rollbackSkipMutation.isPending ||
                confirmNameInput.trim() !== rollbackConfirm?.name?.trim()
              }
            >
              {rollbackSkipMutation.isPending
                ? isRtl
                  ? "جاري التراجع..."
                  : "Rolling back..."
                : isRtl
                  ? "تأكيد التراجع"
                  : "Confirm Rollback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Skip Broker Confirmation Dialog */}
      <AlertDialog
        open={canManageBrokerSkip && !!skipBrokerConfirm}
        onOpenChange={open => {
          if (!open) {
            setSkipBrokerConfirm(null);
            setConfirmNameInput("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRtl ? "تخطي فتح حساب الوسيط" : "Skip Broker Onboarding"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <span className="block">
                  {isRtl
                    ? `سيتم اعتماد جميع خطوات فتح الحساب (اختيار الوسيط، فتح الحساب، الإيداع) للطالب. إذا كانت هناك اشتراكات LexAI أو توصيات بانتظار الوسيط فسيتم تفعيلها مباشرة بعد هذه الخطوة.`
                    : `All broker onboarding steps (select broker, open account, deposit) will be marked as approved for this student. If LexAI or Recommendations are currently waiting on broker completion, they will activate right after this step.`}
                </span>
                <span className="block font-medium text-foreground">
                  {isRtl
                    ? `للتأكيد، اكتب اسم الطالب: "${skipBrokerConfirm?.name}"`
                    : `To confirm, type the student's name: "${skipBrokerConfirm?.name}"`}
                </span>
                <Input
                  value={confirmNameInput}
                  onChange={e => setConfirmNameInput(e.target.value)}
                  placeholder={skipBrokerConfirm?.name ?? ""}
                  className="mt-1"
                  dir="auto"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (skipBrokerConfirm) {
                  skipBrokerMutation.mutate({ userId: skipBrokerConfirm.id });
                }
              }}
              disabled={
                skipBrokerMutation.isPending ||
                confirmNameInput.trim() !== skipBrokerConfirm?.name?.trim()
              }
            >
              {skipBrokerMutation.isPending
                ? isRtl
                  ? "جاري التخطي..."
                  : "Skipping..."
                : isRtl
                  ? "تأكيد التخطي"
                  : "Confirm Skip"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rollback Broker Skip Confirmation Dialog */}
      <AlertDialog
        open={canManageBrokerSkip && !!rollbackBrokerConfirm}
        onOpenChange={open => {
          if (!open) {
            setRollbackBrokerConfirm(null);
            setConfirmNameInput("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRtl ? "التراجع عن تخطي الوسيط" : "Undo Broker Skip"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <span className="block">
                  {isRtl
                    ? `سيتم حذف جميع خطوات فتح الحساب وإعادة حالة الوسيط إلى غير مكتمل. راجع ملف العميل بعد ذلك لأن هذه العملية لا تُصلح أو تُعيد مزامنة الخدمات تلقائياً.`
                    : `All broker onboarding steps will be removed and broker status will reset to incomplete. Review the client profile afterward because this action does not automatically repair or resync service access.`}
                </span>
                <span className="block font-medium text-foreground">
                  {isRtl
                    ? `للتأكيد، اكتب اسم الطالب: "${rollbackBrokerConfirm?.name}"`
                    : `To confirm, type the student's name: "${rollbackBrokerConfirm?.name}"`}
                </span>
                <Input
                  value={confirmNameInput}
                  onChange={e => setConfirmNameInput(e.target.value)}
                  placeholder={rollbackBrokerConfirm?.name ?? ""}
                  className="mt-1"
                  dir="auto"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rollbackBrokerConfirm) {
                  rollbackBrokerSkipMutation.mutate({
                    userId: rollbackBrokerConfirm.id,
                  });
                }
              }}
              disabled={
                rollbackBrokerSkipMutation.isPending ||
                confirmNameInput.trim() !== rollbackBrokerConfirm?.name?.trim()
              }
            >
              {rollbackBrokerSkipMutation.isPending
                ? isRtl
                  ? "جاري التراجع..."
                  : "Rolling back..."
                : isRtl
                  ? "تأكيد التراجع"
                  : "Confirm Rollback"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminClientProfileSheet
        userId={profileUserId}
        open={!!profileUserId}
        onOpenChange={open => {
          if (!open) setProfileUserId(null);
        }}
      />
    </DashboardLayout>
  );
}
