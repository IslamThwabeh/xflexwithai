import { useMemo, useState } from "react";
import { Bug, CheckCircle2, Filter, Loader2, MessageSquareText, ShieldX, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { BUG_REPORT_RISK_LEVELS } from "@shared/const";

type FilterValue = "all" | "pending" | "rewarded" | "rejected";
type RiskLevel = typeof BUG_REPORT_RISK_LEVELS[number];

function formatDate(value: string, isRTL: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(isRTL ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const riskTone: Record<RiskLevel, string> = {
  low: "bg-slate-100 text-slate-700 border-slate-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  critical: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function AdminBugReports() {
  const { language } = useLanguage();
  const isRTL = language === "ar";
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<FilterValue>("pending");
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [awardedPoints, setAwardedPoints] = useState(50);
  const [adminNote, setAdminNote] = useState("");

  const { data: reports, isLoading } = trpc.bugReports.list.useQuery();
  const reviewMutation = trpc.bugReports.review.useMutation({
    onSuccess: async (_, variables) => {
      toast.success(
        variables.decision === "rewarded"
          ? (isRTL ? "تم اعتماد البلاغ ومنح النقاط" : "Bug report rewarded")
          : (isRTL ? "تم رفض البلاغ" : "Bug report rejected")
      );
      setActiveReportId(null);
      setAdminNote("");
      await utils.bugReports.list.invalidate();
      await utils.points.leaderboard.invalidate();
      await utils.staffNotifications.countByRoute.invalidate();
      await utils.staffNotifications.unreadCount.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const counts = useMemo(() => {
    const base = { pending: 0, rewarded: 0, rejected: 0 };
    for (const report of reports ?? []) {
      if (report.status === "pending") base.pending += 1;
      if (report.status === "rewarded") base.rewarded += 1;
      if (report.status === "rejected") base.rejected += 1;
    }
    return base;
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    if (filter === "all") return reports;
    return reports.filter((report: any) => report.status === filter);
  }, [filter, reports]);

  const openReview = (report: any) => {
    setActiveReportId(report.id);
    setRiskLevel((report.riskLevel as RiskLevel) || "medium");
    setAwardedPoints(Number(report.awardedPoints ?? 0) > 0 ? Number(report.awardedPoints) : 50);
    setAdminNote(report.adminNote || "");
  };

  const submitReview = (decision: "rewarded" | "rejected") => {
    if (!activeReportId) return;

    reviewMutation.mutate({
      reportId: activeReportId,
      decision,
      riskLevel: decision === "rewarded" ? riskLevel : null,
      awardedPoints: decision === "rewarded" ? awardedPoints : undefined,
      adminNote: adminNote.trim() || undefined,
    });
  };

  const closeReview = () => {
    setActiveReportId(null);
    setAdminNote("");
  };

  const filterButtons: Array<{ key: FilterValue; label: string; count?: number }> = [
    { key: "pending", label: isRTL ? "قيد المراجعة" : "Pending", count: counts.pending },
    { key: "rewarded", label: isRTL ? "مقبولة" : "Accepted", count: counts.rewarded },
    { key: "rejected", label: isRTL ? "مرفوضة" : "Rejected", count: counts.rejected },
    { key: "all", label: isRTL ? "الكل" : "All" },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-col gap-3 rounded-3xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                <Bug className="h-4 w-4" />
                {isRTL ? "بلاغات الأخطاء" : "Bug Reports"}
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                {isRTL ? "مراجعة بلاغات العملاء ومنح النقاط" : "Review client bug reports and assign points"}
              </h1>
              <p className="text-sm text-slate-600">
                {isRTL
                  ? "يعرض هذا القسم البلاغات الجديدة، ويتيح تحديد مستوى الخطورة ثم منح النقاط أو رفض البلاغ."
                  : "This queue shows incoming client bug reports so your team can assess risk and assign points or reject the report."}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-2xl bg-slate-50 p-3 text-center text-sm sm:min-w-[280px]">
              <div>
                <p className="text-xl font-semibold text-amber-700">{counts.pending}</p>
                <p className="text-slate-500">{isRTL ? "معلّق" : "Pending"}</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-emerald-700">{counts.rewarded}</p>
                <p className="text-slate-500">{isRTL ? "مقبول" : "Accepted"}</p>
              </div>
              <div>
                <p className="text-xl font-semibold text-rose-700">{counts.rejected}</p>
                <p className="text-slate-500">{isRTL ? "مرفوض" : "Rejected"}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-sm">
            <div className="inline-flex items-center gap-2 px-2 text-sm text-slate-500">
              <Filter className="h-4 w-4" />
              {isRTL ? "تصفية" : "Filter"}
            </div>
            {filterButtons.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition ${
                  filter === item.key
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                <span>{item.label}</span>
                {typeof item.count === "number" && (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${filter === item.key ? "bg-white/20 text-white" : "bg-white text-slate-600"}`}>
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="rounded-3xl border border-dashed bg-white px-4 py-16 text-center text-sm text-slate-500 shadow-sm">
              {isRTL ? "لا توجد بلاغات ضمن هذا الفلتر حالياً." : "No bug reports match this filter right now."}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReports.map((report: any) => {
                const isPending = report.status === "pending";
                const isActive = activeReportId === report.id;
                return (
                  <article key={report.id} className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1 space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="rounded-full border-slate-200 px-3 py-1 text-xs text-slate-600">
                            #{report.id}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`rounded-full border px-3 py-1 text-xs ${
                              report.status === "rewarded"
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                                : report.status === "rejected"
                                  ? "bg-rose-100 text-rose-700 border-rose-200"
                                  : "bg-amber-100 text-amber-700 border-amber-200"
                            }`}
                          >
                            {report.status === "rewarded"
                              ? (isRTL ? "تمت المكافأة" : "Rewarded")
                              : report.status === "rejected"
                                ? (isRTL ? "مرفوض" : "Rejected")
                                : (isRTL ? "قيد المراجعة" : "Pending review")}
                          </Badge>
                          {report.riskLevel && (
                            <Badge variant="outline" className={`rounded-full border px-3 py-1 text-xs ${riskTone[report.riskLevel as RiskLevel]}`}>
                              {report.riskLevel === "low"
                                ? (isRTL ? "منخفضة" : "Low")
                                : report.riskLevel === "medium"
                                  ? (isRTL ? "متوسطة" : "Medium")
                                  : report.riskLevel === "high"
                                    ? (isRTL ? "عالية" : "High")
                                    : (isRTL ? "حرجة" : "Critical")}
                            </Badge>
                          )}
                          {Number(report.awardedPoints ?? 0) > 0 && (
                            <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                              +{report.awardedPoints} {isRTL ? "نقطة" : "pts"}
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                          <div>
                            <span className="font-medium text-slate-900">{isRTL ? "العميل:" : "Client:"}</span>{" "}
                            {report.userName || report.userEmail}
                          </div>
                          <div>
                            <span className="font-medium text-slate-900">{isRTL ? "التاريخ:" : "Date:"}</span>{" "}
                            {formatDate(report.createdAt, isRTL)}
                          </div>
                        </div>

                        {report.description && (
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                            {report.description}
                          </div>
                        )}

                        {report.imageUrl && (
                          <a
                            href={report.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 lg:max-w-xl"
                          >
                            <img src={report.imageUrl} alt={isRTL ? "صورة البلاغ" : "Bug report evidence"} className="max-h-80 w-full object-cover" />
                          </a>
                        )}

                        {report.adminNote && !isPending && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                            <p className="mb-1 font-medium text-slate-900">{isRTL ? "ملاحظة المراجع" : "Reviewer note"}</p>
                            <p className="whitespace-pre-wrap">{report.adminNote}</p>
                          </div>
                        )}
                      </div>

                      <div className="w-full lg:max-w-sm">
                        {isPending ? (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{isRTL ? "قرار المراجعة" : "Review decision"}</p>
                                <p className="text-xs text-slate-500">
                                  {isRTL ? "اختر مستوى الخطورة ثم حدد النقاط المناسبة" : "Choose the risk level and assign the right points"}
                                </p>
                              </div>
                              {!isActive && (
                                <Button size="sm" variant="outline" className="rounded-xl" onClick={() => openReview(report)}>
                                  {isRTL ? "مراجعة" : "Review"}
                                </Button>
                              )}
                            </div>

                            {isActive ? (
                              <div className="space-y-3">
                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-slate-700">{isRTL ? "مستوى الخطورة" : "Risk level"}</label>
                                  <select
                                    value={riskLevel}
                                    onChange={(event) => setRiskLevel(event.target.value as RiskLevel)}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  >
                                    {BUG_REPORT_RISK_LEVELS.map((level) => (
                                      <option key={level} value={level}>
                                        {level === "low"
                                          ? (isRTL ? "منخفضة" : "Low")
                                          : level === "medium"
                                            ? (isRTL ? "متوسطة" : "Medium")
                                            : level === "high"
                                              ? (isRTL ? "عالية" : "High")
                                              : (isRTL ? "حرجة" : "Critical")}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-slate-700">{isRTL ? "عدد النقاط" : "Points"}</label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={100000}
                                    value={awardedPoints}
                                    onChange={(event) => setAwardedPoints(Math.max(0, parseInt(event.target.value, 10) || 0))}
                                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  />
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-xs font-medium text-slate-700">{isRTL ? "ملاحظة للمستخدم" : "Note for client"}</label>
                                  <textarea
                                    value={adminNote}
                                    onChange={(event) => setAdminNote(event.target.value)}
                                    rows={4}
                                    maxLength={1000}
                                    placeholder={isRTL ? "سبب القبول أو الرفض" : "Reason for approval or rejection"}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                                  />
                                </div>

                                <div className="flex flex-col gap-2 sm:flex-row">
                                  <Button
                                    onClick={() => submitReview("rewarded")}
                                    disabled={reviewMutation.isPending || awardedPoints < 1}
                                    className="flex-1 rounded-xl"
                                  >
                                    {reviewMutation.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="me-2 h-4 w-4" />}
                                    {isRTL ? "اعتماد ومنح نقاط" : "Accept and reward"}
                                  </Button>
                                  <Button
                                    onClick={() => submitReview("rejected")}
                                    disabled={reviewMutation.isPending}
                                    variant="outline"
                                    className="flex-1 rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50"
                                  >
                                    <ShieldX className="me-2 h-4 w-4" />
                                    {isRTL ? "رفض البلاغ" : "Reject report"}
                                  </Button>
                                  <Button
                                    onClick={closeReview}
                                    disabled={reviewMutation.isPending}
                                    variant="ghost"
                                    className="rounded-xl text-slate-600 hover:bg-white"
                                  >
                                    {isRTL ? "إلغاء" : "Cancel"}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                                <TriangleAlert className="h-4 w-4 text-amber-500" />
                                {isRTL ? "افتح البطاقة لإضافة النقاط أو رفض البلاغ" : "Open this card to assign points or reject the report"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                            <div className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900">
                              <MessageSquareText className="h-4 w-4 text-emerald-600" />
                              {isRTL ? "نتيجة المراجعة" : "Review outcome"}
                            </div>
                            <p>
                              {report.status === "rewarded"
                                ? (isRTL ? "تم قبول البلاغ ومنح النقاط للعميل." : "The report was accepted and points were granted.")
                                : (isRTL ? "تم رفض البلاغ بعد المراجعة." : "The report was rejected after review.")}
                            </p>
                            {report.reviewedAt && (
                              <p className="mt-2 text-xs text-slate-400">{formatDate(report.reviewedAt, isRTL)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
