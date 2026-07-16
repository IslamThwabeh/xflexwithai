import { useMemo, useState } from "react";
import { Download, FileCheck, Search, ShieldAlert } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { DataTablePagination, useDataTable } from "@/components/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatLocalizedDate } from "@/lib/dateLocale";
import { getLegalVersionLinks } from "@/lib/legalVersions";
import { trpc } from "@/lib/trpc";

const complianceSortFns: Record<string, (a: any, b: any) => number> = {
  accepted: (a, b) => {
    if (!a.termsAcceptedAt && !b.termsAcceptedAt) return 0;
    if (!a.termsAcceptedAt) return -1;
    if (!b.termsAcceptedAt) return 1;
    return new Date(a.termsAcceptedAt).getTime() - new Date(b.termsAcceptedAt).getTime();
  },
};

export default function AdminTermsAcceptance() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const { data, isLoading } = trpc.orders.termsCompliance.useQuery();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "accepted" | "missing">("");

  const rows = data ?? [];
  const acceptedCount = rows.filter((row: any) => !!row.termsAcceptedAt).length;
  const missingCount = rows.length - acceptedCount;
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row: any) => {
      const isAccepted = !!row.termsAcceptedAt;
      const matchesStatus = !statusFilter
        || (statusFilter === "accepted" ? isAccepted : !isAccepted);
      const matchesSearch = !query || [
        row.userId,
        row.userName,
        row.userEmail,
        row.userPhone,
        row.termsAcceptedVersion,
        row.acceptanceSource,
        row.termsAcceptedIpAddress,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter]);

  const table = useDataTable(filtered, complianceSortFns);

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ["User ID", "Client", "Email", "Phone", "Compliance", "Accepted At", "Version", "Source", "Order ID", "IP Address", "User Agent"];
    const csvRows = filtered.map((row: any) => [
      row.userId,
      row.userName || "",
      row.userEmail || "",
      row.userPhone || "",
      row.termsAcceptedAt ? "accepted" : "missing",
      row.termsAcceptedAt || "",
      row.termsAcceptedVersion || "",
      row.acceptanceSource || "",
      row.orderId || "",
      row.termsAcceptedIpAddress || "",
      row.termsAcceptedUserAgent || "",
    ]);
    const csv = [headers, ...csvRows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `client-terms-compliance-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="p-6" dir={isRtl ? "rtl" : "ltr"}>
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <FileCheck className="mt-1 h-6 w-6 text-emerald-600" />
            <div>
              <h1 className="text-2xl font-bold">{isRtl ? "امتثال العملاء للشروط والأحكام" : "Client Terms Compliance"}</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {isRtl
                  ? "سجل على مستوى الحساب يشمل موافقات الطلبات وموافقات بوابة الدخول، ويُظهر العملاء الذين ما زال قبولهم مفقوداً."
                  : "Account-level evidence from checkout and the login gate, including clients whose acceptance is still missing."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-100 text-emerald-800">{isRtl ? `${acceptedCount} مقبول` : `${acceptedCount} accepted`}</Badge>
            <Badge className="bg-amber-100 text-amber-800">{isRtl ? `${missingCount} مفقود` : `${missingCount} missing`}</Badge>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="me-2 h-4 w-4" />
              {isRtl ? "تصدير CSV" : "Export CSV"}
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px]">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={isRtl ? "بحث بالعميل أو الإيميل أو IP" : "Search client, email, or IP"}
              className="ps-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{isRtl ? "كل حالات الامتثال" : "All compliance states"}</option>
            <option value="accepted">{isRtl ? "تم القبول" : "Accepted"}</option>
            <option value="missing">{isRtl ? "القبول مفقود" : "Missing"}</option>
          </select>
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">{isRtl ? "جاري التحميل..." : "Loading..."}</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border bg-white p-10 text-center text-muted-foreground">
            {isRtl ? "لا توجد نتائج مطابقة" : "No matching clients"}
          </div>
        ) : (
          <div className="space-y-3">
            {table.paged.map((row: any) => {
              const accepted = !!row.termsAcceptedAt;
              const legalLinks = getLegalVersionLinks(row.termsAcceptedVersion);
              return (
                <div key={row.userId} className={`rounded-xl border bg-white p-5 shadow-sm ${accepted ? "border-emerald-100" : "border-amber-200"}`}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-bold text-slate-900">{row.userName || row.userEmail || `#${row.userId}`}</h2>
                        <Badge className={accepted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                          {accepted
                            ? (isRtl ? "تم قبول الشروط" : "Accepted")
                            : (isRtl ? "مطلوب القبول عند الدخول" : "Login acceptance required")}
                        </Badge>
                        {row.termsAcceptedVersion && <Badge variant="outline">{row.termsAcceptedVersion}</Badge>}
                      </div>
                      <p className="mt-2 text-sm text-slate-600" dir="ltr">{row.userEmail}</p>
                      {row.userPhone && <p className="mt-1 text-xs text-muted-foreground" dir="ltr">{row.userPhone}</p>}
                    </div>

                    {accepted ? (
                      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:min-w-[560px]">
                        <Evidence label={isRtl ? "وقت القبول" : "Accepted At"} value={formatLocalizedDate(String(row.termsAcceptedAt).replace(" ", "T"), language) || String(row.termsAcceptedAt)} />
                        <Evidence label={isRtl ? "المصدر" : "Source"} value={row.acceptanceSource === "login_gate" ? (isRtl ? "بوابة الدخول" : "Login gate") : (isRtl ? "طلب شراء" : "Checkout order")} />
                        <Evidence label={isRtl ? "رقم الطلب" : "Order ID"} value={row.orderId ? `#${row.orderId}` : "-"} />
                        <Evidence label={isRtl ? "عنوان IP" : "IP Address"} value={row.termsAcceptedIpAddress || "-"} />
                      </div>
                    ) : (
                      <div className="flex max-w-xl items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{isRtl ? "لم يتم إنشاء موافقة افتراضية. ستظهر للعميل بوابة غير قابلة للتجاوز في تسجيل الدخول القادم." : "No acceptance was fabricated. The client will receive a non-bypassable gate at the next sign-in."}</span>
                      </div>
                    )}
                  </div>

                  {accepted && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline"><a href={legalLinks.terms} target="_blank" rel="noopener noreferrer">{isRtl ? "الشروط المقبولة" : "Accepted terms"}</a></Button>
                      <Button asChild size="sm" variant="outline"><a href={legalLinks.refund} target="_blank" rel="noopener noreferrer">{isRtl ? "سياسة الاسترداد" : "Refund policy"}</a></Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <DataTablePagination
            page={table.page}
            pageSize={table.pageSize}
            totalPages={table.totalPages}
            totalItems={table.totalItems}
            setPage={table.setPage}
            changePageSize={table.changePageSize}
            isRtl={isRtl}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

function Evidence({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-medium text-slate-800">{value || "-"}</p>
    </div>
  );
}
