import { useMemo, useState } from "react";
import {
  Eye,
  CheckCircle2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  menuSectionsDef,
  employeeTrainingSection,
} from "@/lib/adminNavigationCatalog";
import { getStaffReviewMenuSections } from "@/lib/adminNavigationAccess";
import {
  groupAdminDestinations,
  matchNavigationQuery,
} from "@/lib/navigationV2";
import { ROLE_LABELS } from "@/lib/staffRoleMetadata";
import {
  STAFF_REVIEW_CAPABILITIES,
  canReviewCapability,
} from "@/lib/staffReviewCapabilities";
import { ALL_STAFF_ROLES, ROLE_PAGE_ACCESS } from "@shared/const";
import {
  formatAcademyDateTime,
  ACADEMY_TIME_LABEL_AR,
  ACADEMY_TIME_LABEL_EN,
} from "@shared/academyLocale";

const roleKeys = [
  ...new Set([...ALL_STAFF_ROLES, ...Object.keys(ROLE_LABELS)]),
];
const legacyLabels: Record<string, { ar: string; en: string }> = {
  live_sessions_manager: {
    ar: "مدير جلسات اللايف",
    en: "Live sessions manager",
  },
  live_notifications_manager: {
    ar: "مدير إشعارات اللايف",
    en: "Live notifications manager",
  },
};
const pageCatalog = menuSectionsDef.flatMap(section => section.items);
const inputClass = "h-11 w-full rounded-lg border bg-background px-3 text-sm";

export default function AdminStaffReview() {
  const { language, t } = useLanguage();
  const ar = language === "ar";
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [pageSearch, setPageSearch] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const staffQuery = trpc.roles.listStaff.useQuery(undefined, {
    refetchOnWindowFocus: false,
    retry: false,
  });
  // Shared with DashboardLayout: no extra polling or per-role availability requests.
  const performanceQuery = trpc.staffPerformance.availability.useQuery(
    undefined,
    { retry: false }
  );
  const previewQuery = trpc.roles.getStaffAccessPreview.useQuery(
    { userId: selectedStaffId! },
    {
      enabled: selectedStaffId !== null,
      refetchOnWindowFocus: false,
      retry: false,
    }
  );
  // Never show the previous employee's cached details while another employee loads.
  const preview =
    previewQuery.data?.userId === selectedStaffId
      ? previewQuery.data
      : undefined;
  const label = (item: {
    labelKey: string;
    label?: { ar: string; en: string };
  }) => item.label?.[language] ?? t(item.labelKey);
  const roleLabel = (role: string) => {
    const key = ROLE_LABELS[role]?.labelKey;
    return (
      (key && t(key) !== key ? t(key) : legacyLabels[role]?.[language]) ?? role
    );
  };
  const filteredStaff = (staffQuery.data ?? []).filter(staff =>
    `${staff.name ?? ""} ${staff.email}`
      .toLocaleLowerCase()
      .includes(staffSearch.trim().toLocaleLowerCase())
  );
  const selectStaff = (id: number | null) => {
    setSelectedStaffId(id);
    setPageSearch("");
    setPermissionSearch("");
  };
  const selectedMember = staffQuery.data?.find(
    staff => staff.id === selectedStaffId
  );
  const reviewSections = useMemo(
    () =>
      preview
        ? getStaffReviewMenuSections({
            isStaff: !!preview.isStaff,
            roles: preview.roles,
            loginBlockedAt: preview.loginBlockedAt,
            hasEmployeeTraining: preview.hasEmployeeTraining,
            performanceEnabled: performanceQuery.data?.enabled,
          })
        : [],
    [preview, performanceQuery.data?.enabled]
  );
  const accessiblePaths = new Set(
    reviewSections.flatMap(section => section.items.map(item => item.path))
  );
  const catalog = preview?.hasEmployeeTraining
    ? [...pageCatalog, ...employeeTrainingSection.items]
    : pageCatalog;
  const destinations = catalog.map(item => ({
    ...item,
    label: label(item),
    keywords: `${item.label?.en ?? ""} ${item.label?.ar ?? ""} ${item.path}`,
  }));
  const groups = groupAdminDestinations(destinations, language);
  const active = !!preview?.isStaff && !preview.loginBlockedAt;
  const rolePaths = new Set(
    (preview?.roles ?? []).flatMap(role => ROLE_PAGE_ACCESS[role] ?? [])
  );
  const unavailableReason = (path: string) =>
    !active
      ? ar
        ? "الحساب غير نشط أو الدخول ممنوع"
        : "Staff access is inactive or login is blocked"
      : rolePaths.has(path)
        ? ar
          ? "غير ظاهر وفق حالة الميزة أو أولوية الدور"
          : "Hidden by feature availability or role precedence"
        : ar
          ? "لا يمنحه دور مسند"
          : "No assigned role grants this page";
  // SQLite's zone-less datetime strings represent UTC, not the browser's timezone.
  const loginTimestamp = preview?.lastSignIn?.replace(
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/,
    "$1T$2Z"
  );
  const lastLogin =
    loginTimestamp && Number.isFinite(Date.parse(loginTimestamp))
      ? formatAcademyDateTime(loginTimestamp, language)
      : ar
        ? "غير متاح"
        : "Unavailable";
  const renderPages = (allowed: boolean) =>
    groups.map(group => {
      const items = group.items.filter(
        item =>
          accessiblePaths.has(item.path) === allowed &&
          matchNavigationQuery(item, pageSearch)
      );
      if (!items.length) return null;
      return (
        <section key={group.id} className="space-y-2" aria-label={group.label}>
          <h3 className="text-sm font-semibold text-muted-foreground">
            {group.label}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map(item => (
              <div
                key={item.path}
                className={`flex min-w-0 items-start gap-3 rounded-xl border p-3 ${allowed ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/20" : "bg-muted/30"}`}
              >
                <item.icon
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-medium">
                    {item.label}
                  </p>
                  {!allowed && (
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {unavailableReason(item.path)}
                    </p>
                  )}
                </div>
                {allowed ? (
                  <CheckCircle2
                    className="size-4 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : (
                  <LockKeyhole
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </div>
            ))}
          </div>
        </section>
      );
    });

  return (
    <DashboardLayout>
      <div
        className="mx-auto w-full max-w-7xl space-y-6"
        dir={ar ? "rtl" : "ltr"}
      >
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Eye className="size-6 text-emerald-600" />
              {ar ? "مراجعة صلاحيات الموظفين" : "Staff access review"}
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              {ar
                ? "راجع الأدوار والصفحات المتاحة وفق قائمة مساحة العمل الحالية."
                : "Review assigned roles and available pages using the current workspace navigation."}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              void staffQuery.refetch();
              void performanceQuery.refetch();
              if (selectedStaffId) void previewQuery.refetch();
            }}
            disabled={staffQuery.isFetching || previewQuery.isFetching}
          >
            <RefreshCw className="size-4" />
            {ar ? "تحديث" : "Refresh"}
          </Button>
        </header>
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm leading-6 dark:border-emerald-800 dark:bg-emerald-950/20">
          <ShieldCheck className="mt-1 size-5 shrink-0 text-emerald-600" />
          <p>
            {ar
              ? "مراجعة للقراءة فقط. لا يتم الدخول بحساب الموظف أو تعديل صلاحياته. تظل فحوص الأمان الخاصة بكل إجراء مطبّقة."
              : "Read-only review. This does not sign in as the employee or change their permissions. Each action still applies its own security checks."}
          </p>
        </div>
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="min-w-0">
            <CardHeader className="space-y-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4" />
                {ar ? "الموظفون" : "Employees"}
                <Badge variant="secondary" className="ms-auto">
                  {staffQuery.data?.length ?? 0}
                </Badge>
              </CardTitle>
              <label htmlFor="staff-review-search" className="sr-only">
                {ar ? "بحث عن موظف" : "Search employees"}
              </label>
              <input
                id="staff-review-search"
                type="search"
                value={staffSearch}
                onChange={event => setStaffSearch(event.target.value)}
                placeholder={
                  ar ? "بحث بالاسم أو البريد" : "Search by name or email"
                }
                className={inputClass}
              />
              <label htmlFor="staff-review-select" className="sr-only">
                {ar ? "اختر الموظف" : "Select employee"}
              </label>
              <select
                id="staff-review-select"
                value={selectedStaffId ?? ""}
                onChange={event =>
                  selectStaff(
                    event.target.value ? Number(event.target.value) : null
                  )
                }
                className={`${inputClass} px-2 xl:hidden`}
              >
                <option value="">
                  {ar ? "اختر موظفاً" : "Select an employee"}
                </option>
                {selectedMember &&
                  !filteredStaff.some(
                    staff => staff.id === selectedMember.id
                  ) && (
                    <option value={selectedMember.id}>
                      {selectedMember.name || selectedMember.email}
                    </option>
                  )}
                {filteredStaff.map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name || staff.email}
                  </option>
                ))}
              </select>
            </CardHeader>
            <CardContent className="space-y-2 px-3 pb-3">
              {staffQuery.isError ? (
                <p role="alert" className="px-2 text-sm text-red-600">
                  {ar
                    ? "تعذر تحميل الموظفين. أعد المحاولة بالتحديث."
                    : "Employees could not load. Use Refresh to retry."}
                </p>
              ) : staffQuery.isLoading ? (
                <p role="status" className="p-2 text-sm">
                  {ar ? "جارٍ التحميل…" : "Loading…"}
                </p>
              ) : !filteredStaff.length ? (
                <p className="p-2 text-sm text-muted-foreground">
                  {ar ? "لا توجد نتائج" : "No matching employees"}
                </p>
              ) : (
                <div className="hidden space-y-2 xl:block">
                  {filteredStaff.map(staff => (
                    <button
                      type="button"
                      key={staff.id}
                      aria-pressed={selectedStaffId === staff.id}
                      onClick={() => selectStaff(staff.id)}
                      className={`w-full rounded-xl border p-3 text-start transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 ${selectedStaffId === staff.id ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30" : "border-transparent hover:bg-muted"}`}
                    >
                      <p className="break-words text-sm font-semibold">
                        {staff.name || staff.email}
                      </p>
                      <p
                        dir="ltr"
                        className="mt-1 truncate text-start text-xs text-muted-foreground"
                      >
                        {staff.email}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {staff.roles.slice(0, 3).map(role => (
                          <span
                            key={role}
                            className="rounded bg-muted px-1.5 py-1 text-xs"
                          >
                            {roleLabel(role)}
                          </span>
                        ))}
                        {staff.roles.length > 3 && (
                          <span className="px-1 py-1 text-xs text-muted-foreground">
                            +{staff.roles.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <div
            className="min-w-0 space-y-5"
            aria-live="polite"
            aria-busy={previewQuery.isFetching}
          >
            {!selectedStaffId ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <Eye className="mx-auto mb-4 size-8 text-emerald-600" />
                  <h2 className="text-lg font-semibold">
                    {ar
                      ? "اختر موظفاً لبدء المراجعة"
                      : "Select an employee to start reviewing"}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {ar
                      ? "ستظهر أدواره وصفحاته وصلاحياته هنا."
                      : "Their roles, pages, and permissions will appear here."}
                  </p>
                </CardContent>
              </Card>
            ) : previewQuery.isError || performanceQuery.isError ? (
              <Card>
                <CardContent className="py-10">
                  <p role="alert" className="text-sm text-red-600">
                    {ar
                      ? "تعذر تحميل صلاحيات الموظف أو حالة الميزات. استخدم التحديث لإعادة المحاولة."
                      : "Employee access or feature availability could not load. Use Refresh to retry."}
                  </p>
                </CardContent>
              </Card>
            ) : !preview || !performanceQuery.data ? (
              <Card>
                <CardContent
                  role="status"
                  className="py-12 text-center text-sm"
                >
                  {ar
                    ? "جارٍ تحميل صلاحيات الموظف…"
                    : "Loading employee access…"}
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="break-words text-xl font-bold">
                          {preview.name || preview.email}
                        </h2>
                        <p
                          className="mt-1 break-all text-sm text-muted-foreground"
                          dir="ltr"
                        >
                          {preview.email}
                        </p>
                      </div>
                      <Badge variant={active ? "secondary" : "destructive"}>
                        {active
                          ? ar
                            ? "موظف نشط"
                            : "Active employee"
                          : ar
                            ? "الوصول غير نشط"
                            : "Access inactive"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {ar ? "آخر دخول: " : "Last login: "}
                      {lastLogin}{" "}
                      <span className="text-xs">
                        ({ar ? ACADEMY_TIME_LABEL_AR : ACADEMY_TIME_LABEL_EN})
                      </span>
                    </p>
                    <div>
                      <h3 className="mb-2 text-sm font-semibold">
                        {ar ? "الأدوار المسندة" : "Assigned roles"}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {preview.roles.length ? (
                          preview.roles.map(role => (
                            <Badge
                              key={role}
                              className={`${ROLE_LABELS[role]?.color ?? "bg-muted text-foreground"} whitespace-normal text-start text-xs`}
                            >
                              {roleLabel(role)}
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {ar ? "لا توجد أدوار مسندة" : "No roles assigned"}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 border-t pt-4">
                      <div>
                        <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                          {accessiblePaths.size}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {ar ? "صفحات متاحة" : "Available pages"}
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {catalog.length - accessiblePaths.size}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {ar ? "صفحات غير متاحة" : "Unavailable pages"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Tabs
                  key={preview.userId}
                  defaultValue="pages"
                  dir={ar ? "rtl" : "ltr"}
                >
                  <TabsList className="h-auto min-h-11 w-full flex-wrap justify-start">
                    <TabsTrigger className="min-h-10" value="pages">
                      {ar ? "صفحات مساحة العمل" : "Workspace pages"}
                    </TabsTrigger>
                    <TabsTrigger className="min-h-10" value="permissions">
                      {ar ? "صلاحيات الإجراءات" : "Action permissions"}
                    </TabsTrigger>
                    <TabsTrigger className="min-h-10" value="matrix">
                      {ar ? "مقارنة الأدوار" : "Role comparison"}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="pages">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {ar
                            ? "معاينة قائمة مساحة العمل"
                            : "Workspace navigation preview"}
                        </CardTitle>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {ar
                            ? "نفس مجموعات القائمة وقواعد الظهور الحالية. لا تشمل المعاينة المفضلة الشخصية أو أعداد الرسائل غير المقروءة."
                            : "Uses the current navigation groups and visibility rules. Personal favorites and unread counts are not reproduced."}
                        </p>
                        <label
                          htmlFor="staff-review-page-search"
                          className="sr-only"
                        >
                          {ar ? "بحث في الصفحات" : "Search pages"}
                        </label>
                        <input
                          id="staff-review-page-search"
                          type="search"
                          value={pageSearch}
                          onChange={event => setPageSearch(event.target.value)}
                          placeholder={ar ? "بحث في الصفحات" : "Search pages"}
                          className={inputClass}
                        />
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div
                          className="space-y-5"
                          data-review-pages="available"
                        >
                          {renderPages(true)}
                          {!destinations.some(
                            item =>
                              accessiblePaths.has(item.path) &&
                              matchNavigationQuery(item, pageSearch)
                          ) && (
                            <p className="text-sm text-muted-foreground">
                              {ar
                                ? "لا توجد صفحات متاحة تطابق البحث."
                                : "No available pages match this search."}
                            </p>
                          )}
                        </div>
                        <details className="rounded-xl border p-4">
                          <summary className="cursor-pointer text-sm font-semibold">
                            {ar ? "الصفحات غير المتاحة" : "Unavailable pages"} (
                            {catalog.length - accessiblePaths.size})
                          </summary>
                          <div
                            className="mt-5 space-y-5"
                            data-review-pages="unavailable"
                          >
                            {renderPages(false)}
                          </div>
                        </details>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="permissions">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {ar ? "صلاحيات الإجراءات" : "Action permissions"}
                        </CardTitle>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {ar
                            ? "السماح بالدور لا يتجاوز فحوص الملكية والحالة ومتطلبات الإجراء. قد تختلف صلاحية الإجراء عن ظهور الصفحة في القائمة."
                            : "Role eligibility remains subject to ownership, state, and action-specific requirements. Action access can differ from menu visibility."}
                        </p>
                        <label
                          htmlFor="staff-review-permission-search"
                          className="sr-only"
                        >
                          {ar ? "بحث في الصلاحيات" : "Search permissions"}
                        </label>
                        <input
                          id="staff-review-permission-search"
                          type="search"
                          value={permissionSearch}
                          onChange={event =>
                            setPermissionSearch(event.target.value)
                          }
                          placeholder={
                            ar ? "بحث في الصلاحيات" : "Search permissions"
                          }
                          className={inputClass}
                        />
                      </CardHeader>
                      <CardContent>
                        <ul className="divide-y">
                          {STAFF_REVIEW_CAPABILITIES.filter(capability =>
                            `${capability.en} ${capability.ar}`
                              .toLocaleLowerCase()
                              .includes(
                                permissionSearch.trim().toLocaleLowerCase()
                              )
                          ).map(capability => (
                            <li
                              key={capability.endpoint}
                              className="flex items-start justify-between gap-3 py-3 text-sm"
                            >
                              <span className="min-w-0 leading-6">
                                {capability[language]}
                              </span>
                              <Badge
                                variant={
                                  canReviewCapability(
                                    preview.roles,
                                    capability,
                                    active
                                  )
                                    ? "secondary"
                                    : "outline"
                                }
                                className="shrink-0"
                              >
                                {canReviewCapability(
                                  preview.roles,
                                  capability,
                                  active
                                )
                                  ? ar
                                    ? "يسمح به الدور"
                                    : "Role permits"
                                  : capability.immutable
                                    ? ar
                                      ? "محمي للجميع"
                                      : "Protected for all"
                                    : ar
                                      ? "غير متاح"
                                      : "Unavailable"}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  <TabsContent value="matrix">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">
                          {ar
                            ? "مقارنة الأدوار والصفحات"
                            : "Compare roles and pages"}
                        </CardTitle>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {ar
                            ? "اختر دوراً لعرض صفحاته وفق قواعد مساحة العمل الحالية. تعتمد الدورة التدريبية على تسجيل الموظف، ولا يمنحها الدور وحده."
                            : "Expand a role to inspect its pages under the current workspace rules. Employee training depends on enrollment, not a role alone."}
                        </p>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {roleKeys.map(role => {
                          const pages = getStaffReviewMenuSections({
                            isStaff: true,
                            roles: [role],
                            performanceEnabled: performanceQuery.data?.enabled,
                          }).flatMap(section => section.items);
                          const assigned = preview.roles.includes(role);
                          return (
                            <details
                              key={role}
                              className={`rounded-xl border p-3 ${assigned ? "border-emerald-200 dark:border-emerald-800" : ""}`}
                            >
                              <summary className="cursor-pointer text-sm leading-6">
                                <span className="font-medium">
                                  {roleLabel(role)}
                                </span>
                                <span className="ms-2 text-xs text-muted-foreground">
                                  {pages.length} {ar ? "صفحات" : "pages"}
                                  {assigned
                                    ? ar
                                      ? " · مسند حالياً"
                                      : " · currently assigned"
                                    : ""}
                                </span>
                              </summary>
                              <div className="mt-3 space-y-2">
                                {pages.length ? (
                                  groupAdminDestinations(
                                    pages.map(item => ({
                                      ...item,
                                      label: label(item),
                                    })),
                                    language
                                  ).map(group => (
                                    <div key={group.id}>
                                      <p className="text-xs font-semibold text-muted-foreground">
                                        {group.label}
                                      </p>
                                      <ul className="mt-1 flex flex-wrap gap-2">
                                        {group.items.map(item => (
                                          <li
                                            key={item.path}
                                            className="rounded-lg bg-muted px-2 py-1 text-sm"
                                          >
                                            {item.label}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    {ar
                                      ? "لا تظهر صفحات لهذا الدور وحده في الحالة الحالية."
                                      : "This role alone exposes no pages in the current state."}
                                  </p>
                                )}
                              </div>
                            </details>
                          );
                        })}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
