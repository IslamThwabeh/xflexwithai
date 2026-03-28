import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { printReport } from "@/lib/printReport";
import {
  useDataTable,
  DataTablePagination,
  SortableHeader,
  zebraRow,
} from "@/components/DataTable";
import {
  Users,
  Search,
  Download,
  FileText,
  DollarSign,
  Package,
  UserCheck,
  UserX,
  Copy,
  SlidersHorizontal,
  FastForward,
} from "lucide-react";
import { toast } from "sonner";

const studentSortFns: Record<string, (a: any, b: any) => number> = {
  name: (a, b) => (a.name || "").localeCompare(b.name || ""),
  email: (a, b) => (a.email || "").localeCompare(b.email || ""),
  location: (a, b) =>
    [a.city, a.country].filter(Boolean).join(", ").localeCompare(
      [b.city, b.country].filter(Boolean).join(", ")
    ),
  package: (a, b) =>
    (a.activePackages || []).length - (b.activePackages || []).length,
  spent: (a, b) => (a.totalSpent || 0) - (b.totalSpent || 0),
  renewals: (a, b) => (a.renewalCount || 0) - (b.renewalCount || 0),
  registered: (a, b) =>
    new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
  lastSignIn: (a, b) =>
    new Date(a.lastSignedIn || 0).getTime() -
    new Date(b.lastSignedIn || 0).getTime(),
};

export default function AdminStudents() {
  const { language } = useLanguage();
  const isRtl = language === "ar";

  const { data: students, isLoading } = trpc.reports.subscribers.useQuery();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [skipConfirm, setSkipConfirm] = useState<{ id: number; name: string } | null>(null);

  const skipCourseMutation = trpc.enrollments.skipCourse.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? "تم تخطي الدورة بنجاح" : "Course skipped successfully");
      setSkipConfirm(null);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Column visibility
  const allColumns = [
    { key: 'name', en: 'Name', ar: 'الاسم' },
    { key: 'email', en: 'Email', ar: 'الإيميل' },
    { key: 'phone', en: 'Phone', ar: 'الهاتف' },
    { key: 'location', en: 'Location', ar: 'الموقع' },
    { key: 'package', en: 'Package', ar: 'الباقة' },
    { key: 'spent', en: 'Spent', ar: 'الإنفاق' },
    { key: 'renewals', en: 'Renewals', ar: 'التجديدات' },
    { key: 'registered', en: 'Registered', ar: 'التسجيل' },
    { key: 'lastSignIn', en: 'Last Sign In', ar: 'آخر دخول' },
  ] as const;
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('adminStudents_visibleCols');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set(['name', 'email', 'package', 'spent', 'registered', 'lastSignIn']);
  });
  const toggleCol = (col: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      localStorage.setItem('adminStudents_visibleCols', JSON.stringify(Array.from(next)));
      return next;
    });
  };
  const visibleColCount = visibleCols.size;

  // Package badge colors
  const pkgBadgeClass = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('comprehensive') || lower.includes('شامل'))
      return 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-100';
    return 'bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100';
  };

  // Derived data
  const countries = useMemo(() => {
    if (!students) return [];
    const c = new Set(students.map((s: any) => s.country).filter(Boolean));
    return Array.from(c).sort() as string[];
  }, [students]);

  const filtered = useMemo(() => {
    if (!students) return [];
    return students.filter((s: any) => {
      const matchSearch =
        !search ||
        (s.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (s.phone || "").includes(search);
      const matchCountry =
        countryFilter === "all" || s.country === countryFilter;
      const matchPackage =
        packageFilter === "all" ||
        (packageFilter === "active" && (s.activePackages || []).length > 0) ||
        (packageFilter === "none" && (s.activePackages || []).length === 0);
      return matchSearch && matchCountry && matchPackage;
    });
  }, [students, search, countryFilter, packageFilter]);

  // Pagination + sorting
  const {
    paged,
    page,
    pageSize,
    totalPages,
    totalItems,
    sortKey,
    sortDir,
    setPage,
    handleSort,
    changePageSize,
  } = useDataTable(filtered, studentSortFns);

  // Stats
  const totalStudents = students?.length || 0;
  const activeStudents = students?.filter(
    (s: any) => (s.activePackages || []).length > 0
  ).length || 0;
  const inactiveStudents = totalStudents - activeStudents;
  const totalRevenue = students?.reduce(
    (sum: number, s: any) => sum + (s.totalSpent || 0),
    0
  ) || 0;

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    toast.success(isRtl ? "تم النسخ" : "Copied!");
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = [
      "Name",
      "Email",
      "Phone",
      "City",
      "Country",
      "Registered",
      "Last Sign In",
      "Active Packages",
      "Spent ($)",
      "Renewals",
    ];
    const rows = filtered.map((s: any) => [
      s.name || "",
      s.email,
      s.phone || "",
      s.city || "",
      s.country || "",
      s.createdAt ? new Date(s.createdAt).toLocaleDateString("en-US") : "",
      s.lastSignedIn
        ? new Date(s.lastSignedIn).toLocaleDateString("en-US")
        : "",
      (s.activePackages || []).join("; "),
      s.totalSpent || 0,
      s.renewalCount || 0,
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((r: any) => r.map((v: any) => `"${v}"`).join(",")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmtDate = (d: string | null | undefined) => {
    if (!d) return "—";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-blue-600" />
              {isRtl ? "الطلاب" : "Students"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {isRtl
                ? `${filtered.length} طالب من أصل ${totalStudents}`
                : `${filtered.length} of ${totalStudents} students`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={exportCSV}
              variant="outline"
              size="sm"
              disabled={!filtered.length}
              className="no-print"
            >
              <Download className="w-4 h-4 me-1.5" />
              {isRtl ? "CSV" : "CSV"}
            </Button>
            <Button
              onClick={() =>
                printReport(isRtl ? "تقرير الطلاب" : "Students Report")
              }
              variant="outline"
              size="sm"
              className="no-print"
            >
              <FileText className="w-4 h-4 me-1.5" />
              {isRtl ? "طباعة" : "Print"}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-blue-600">
                {totalStudents}
              </p>
              <p className="text-xs text-gray-500">
                {isRtl ? "الإجمالي" : "Total"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-green-600">
                {activeStudents}
              </p>
              <p className="text-xs text-gray-500">
                {isRtl ? "نشط" : "Active"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-gray-500">
                {inactiveStudents}
              </p>
              <p className="text-xs text-gray-500">
                {isRtl ? "بدون باقة" : "No Package"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                ${totalRevenue}
              </p>
              <p className="text-xs text-gray-500">
                {isRtl ? "إجمالي الإيرادات" : "Total Revenue"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row gap-3">
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
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={countryFilter} onValueChange={setCountryFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {isRtl ? "جميع البلدان" : "All Countries"}
                  </SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={packageFilter} onValueChange={setPackageFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {isRtl ? "الكل" : "All"}
                  </SelectItem>
                  <SelectItem value="active">
                    {isRtl ? "لديه باقة" : "Has Package"}
                  </SelectItem>
                  <SelectItem value="none">
                    {isRtl ? "بدون باقة" : "No Package"}
                  </SelectItem>
                </SelectContent>
              </Select>
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
                              className="text-gray-400 hover:text-blue-600 shrink-0"
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
                          {(isRtl ? s.activePackagesAr || s.activePackages : s.activePackages).map(
                            (p: string, i: number) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className={`text-xs gap-1 ${pkgBadgeClass(p)}`}
                              >
                                <Package className="w-3 h-3" />
                                {p}
                              </Badge>
                            )
                          )}
                          {s.renewalCount > 0 && (
                            <Badge className="text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">
                              {s.renewalCount}{" "}
                              {isRtl ? "تجديد" : "renewal"}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                        {s.phone && (
                          <div>
                            <span className="text-gray-400 block">
                              {isRtl ? "الهاتف" : "Phone"}
                            </span>
                            <span className="font-medium" dir="ltr">
                              {s.phone}
                            </span>
                          </div>
                        )}
                        {(s.city || s.country) && (
                          <div>
                            <span className="text-gray-400 block">
                              {isRtl ? "الموقع" : "Location"}
                            </span>
                            <span className="font-medium">
                              {[s.city, s.country].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400 block">
                            {isRtl ? "الإنفاق" : "Spent"}
                          </span>
                          <span className="font-medium text-emerald-600">
                            {s.totalSpent > 0 ? `$${s.totalSpent}` : "—"}
                          </span>
                        </div>
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
                      <div className="pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                          onClick={() => setSkipConfirm({ id: s.id, name: s.name || s.email })}
                        >
                          <FastForward className="w-3 h-3" />
                          {isRtl ? "تخطي الدورة" : "Skip Course"}
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
                      ({filtered.length})
                    </span>
                  </CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        {isRtl ? 'الأعمدة' : 'Columns'}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={isRtl ? 'start' : 'end'} className="w-48">
                      <DropdownMenuLabel>{isRtl ? 'إظهار / إخفاء الأعمدة' : 'Toggle Columns'}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {allColumns.map(col => (
                        <DropdownMenuCheckboxItem
                          key={col.key}
                          checked={visibleCols.has(col.key)}
                          onCheckedChange={() => toggleCol(col.key)}
                          onSelect={(e) => e.preventDefault()}
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
                        {visibleCols.has('name') && <TableHead>
                          <SortableHeader label={isRtl ? "الاسم" : "Name"} sortKey="name" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                        </TableHead>}
                        {visibleCols.has('email') && <TableHead>
                          <SortableHeader label={isRtl ? "الإيميل" : "Email"} sortKey="email" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                        </TableHead>}
                        {visibleCols.has('phone') && <TableHead>
                          {isRtl ? "الهاتف" : "Phone"}
                        </TableHead>}
                        {visibleCols.has('location') && <TableHead>
                          <SortableHeader label={isRtl ? "الموقع" : "Location"} sortKey="location" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                        </TableHead>}
                        {visibleCols.has('package') && <TableHead>
                          <SortableHeader label={isRtl ? "الباقة" : "Package"} sortKey="package" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                        </TableHead>}
                        {visibleCols.has('spent') && <TableHead>
                          <SortableHeader label={isRtl ? "الإنفاق" : "Spent"} sortKey="spent" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                        </TableHead>}
                        {visibleCols.has('renewals') && <TableHead>
                          <SortableHeader label={isRtl ? "التجديدات" : "Renewals"} sortKey="renewals" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                        </TableHead>}
                        {visibleCols.has('registered') && <TableHead>
                          <SortableHeader label={isRtl ? "التسجيل" : "Registered"} sortKey="registered" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                        </TableHead>}
                        {visibleCols.has('lastSignIn') && <TableHead>
                          <SortableHeader label={isRtl ? "آخر دخول" : "Last Sign In"} sortKey="lastSignIn" currentSortKey={sortKey} currentSortDir={sortDir} onSort={handleSort} />
                        </TableHead>}
                        <TableHead className="w-[80px]">{isRtl ? "إجراءات" : "Actions"}</TableHead>
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
                            {visibleCols.has('name') && <TableCell className="font-medium">
                              {s.name || "—"}
                            </TableCell>}
                            {visibleCols.has('email') && <TableCell>
                              <div className="flex items-center gap-1">
                                <span className="text-sm" dir="ltr">
                                  {s.email}
                                </span>
                                <button
                                  onClick={() => copyEmail(s.email)}
                                  className="text-gray-400 hover:text-blue-600 transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </TableCell>}
                            {visibleCols.has('phone') && <TableCell className="text-sm" dir="ltr">
                              {s.phone || "—"}
                            </TableCell>}
                            {visibleCols.has('location') && <TableCell className="text-sm text-gray-500">
                              {[s.city, s.country]
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </TableCell>}
                            {visibleCols.has('package') && <TableCell>
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
                            </TableCell>}
                            {visibleCols.has('spent') && <TableCell className="text-sm font-medium text-emerald-600">
                              {s.totalSpent > 0 ? `$${s.totalSpent}` : "—"}
                            </TableCell>}
                            {visibleCols.has('renewals') && <TableCell className="text-center">
                              {s.renewalCount > 0 ? (
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">
                                  {s.renewalCount}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>}
                            {visibleCols.has('registered') && <TableCell className="text-xs text-gray-500">
                              {fmtDate(s.createdAt)}
                            </TableCell>}
                            {visibleCols.has('lastSignIn') && <TableCell className="text-xs text-gray-500">
                              {fmtDate(s.lastSignedIn)}
                            </TableCell>}
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs gap-1 h-7"
                                onClick={() => setSkipConfirm({ id: s.id, name: s.name || s.email })}
                              >
                                <FastForward className="w-3 h-3" />
                                {isRtl ? "تخطي" : "Skip"}
                              </Button>
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
      <AlertDialog open={!!skipConfirm} onOpenChange={(open) => !open && setSkipConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRtl ? "تخطي الدورة التعليمية" : "Skip Trading Course"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRtl
                ? `هل أنت متأكد من تخطي الدورة للطالب "${skipConfirm?.name}"؟ سيتم تعليم جميع الحلقات كمكتملة ونسبة التقدم 100%.`
                : `Are you sure you want to skip the course for "${skipConfirm?.name}"? All episodes will be marked as complete with 100% progress.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (skipConfirm) {
                  skipCourseMutation.mutate({ userId: skipConfirm.id, courseId: 1 });
                }
              }}
              disabled={skipCourseMutation.isPending}
            >
              {skipCourseMutation.isPending
                ? (isRtl ? "جاري التخطي..." : "Skipping...")
                : (isRtl ? "تأكيد التخطي" : "Confirm Skip")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
