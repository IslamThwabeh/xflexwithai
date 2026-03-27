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
import { printReport } from "@/lib/printReport";
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
} from "lucide-react";
import { toast } from "sonner";

export default function AdminStudents() {
  const { language } = useLanguage();
  const isRtl = language === "ar";

  const { data: students, isLoading } = trpc.reports.subscribers.useQuery();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");

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
              {filtered.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    {isRtl ? "لا توجد نتائج" : "No results found"}
                  </CardContent>
                </Card>
              ) : (
                filtered.map((s: any) => (
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
                                className="text-xs gap-1"
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
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop Table */}
            <Card className="hidden md:block">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {isRtl ? "قائمة الطلاب" : "Student List"}{" "}
                  <span className="text-gray-400 font-normal">
                    ({filtered.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {isRtl ? "الاسم" : "Name"}
                        </TableHead>
                        <TableHead>
                          {isRtl ? "الإيميل" : "Email"}
                        </TableHead>
                        <TableHead>
                          {isRtl ? "الهاتف" : "Phone"}
                        </TableHead>
                        <TableHead>
                          {isRtl ? "الموقع" : "Location"}
                        </TableHead>
                        <TableHead>
                          {isRtl ? "الباقة" : "Package"}
                        </TableHead>
                        <TableHead>
                          {isRtl ? "الإنفاق" : "Spent"}
                        </TableHead>
                        <TableHead>
                          {isRtl ? "التجديدات" : "Renewals"}
                        </TableHead>
                        <TableHead>
                          {isRtl ? "التسجيل" : "Registered"}
                        </TableHead>
                        <TableHead>
                          {isRtl ? "آخر دخول" : "Last Sign In"}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={9}
                            className="text-center py-8 text-gray-500"
                          >
                            {isRtl ? "لا توجد نتائج" : "No results found"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">
                              {s.name || "—"}
                            </TableCell>
                            <TableCell>
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
                            </TableCell>
                            <TableCell className="text-sm" dir="ltr">
                              {s.phone || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {[s.city, s.country]
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </TableCell>
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
                                      className="text-xs gap-1"
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
                            <TableCell className="text-sm font-medium text-emerald-600">
                              {s.totalSpent > 0 ? `$${s.totalSpent}` : "—"}
                            </TableCell>
                            <TableCell className="text-center">
                              {s.renewalCount > 0 ? (
                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">
                                  {s.renewalCount}
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {fmtDate(s.createdAt)}
                            </TableCell>
                            <TableCell className="text-xs text-gray-500">
                              {fmtDate(s.lastSignedIn)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
