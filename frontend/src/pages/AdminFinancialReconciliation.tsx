import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, RefreshCw, Scale } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  useFinanceWorkspaceAccess,
  type FinanceWorkspaceAccess,
} from "@/lib/useFinanceWorkspaceAccess";
import { isFinanceAccessDenied } from "@/lib/financeWorkspaceCache";
import { formatAdminCurrencyFromIls } from "@/lib/adminCurrency";
import HistoricalReviewQueue from "@/components/admin/HistoricalReviewQueue";
import FinancialActionConfirmation, {
  type FinancialActionReview,
} from "@/components/admin/FinancialActionConfirmation";
import { formatAcademyDateTime } from "@shared/academyLocale";
import { toast } from "sonner";

export default function AdminFinancialReconciliation() {
  const scope = useFinanceWorkspaceAccess("controls");
  return <ReconciliationWorkspace key={scope.identityKey} scope={scope} />;
}

function ReconciliationWorkspace({ scope }: { scope: FinanceWorkspaceAccess }) {
  const { language } = useLanguage(),
    ar = language === "ar",
    utils = trpc.useUtils();
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const money = (minor: number) =>
    formatAdminCurrencyFromIls(minor / 100, language);
  const access =
    scope.access === "owner" ? ("owner" as const) : ("manager" as const);
  const viewerScope = { viewerId: scope.viewerId, access };
  const [confirmation, setConfirmation] =
    useState<FinancialActionReview | null>(null);
  const options = {
    enabled: scope.allowed,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
  } as const;
  const previewQuery = trpc.financialReconciliation.preview.useQuery(
    viewerScope,
    options
  );
  const workspaceQuery = trpc.financialReconciliation.workspace.useQuery(
    { ...viewerScope, status: "unresolved", includeItems: false },
    options
  );
  const verified = <T extends { viewerId: number; access: string }>(
    data: T | undefined,
    error: unknown
  ) =>
    !error && data?.viewerId === scope.viewerId && data.access === scope.access
      ? data
      : undefined;
  const preview = verified(previewQuery.data, previewQuery.error),
    workspace = verified(workspaceQuery.data, workspaceQuery.error);
  const onAccessFailure = (error: unknown) => {
    if (isFinanceAccessDenied(error)) void scope.refetch();
  };
  const refreshStats = async () => {
    await Promise.all([
      utils.financialReconciliation.preview.invalidate(viewerScope),
      utils.financialReconciliation.workspace.invalidate({
        ...viewerScope,
        status: "unresolved",
        includeItems: false,
      }),
    ]);
  };
  const retryRead = async () => {
    const fresh = await scope.refetch(),
      freshAccess = fresh.data?.access;
    if (
      !fresh.error &&
      fresh.data?.viewerId === scope.viewerId &&
      (freshAccess === "owner" || freshAccess === "manager")
    ) {
      const freshScope = { viewerId: scope.viewerId, access: freshAccess };
      await Promise.all([
        utils.financialReconciliation.preview.invalidate(freshScope),
        utils.financialReconciliation.workspace.invalidate({
          ...freshScope,
          status: "unresolved",
          includeItems: false,
        }),
        utils.financialReconciliation.items.invalidate(freshScope),
      ]);
    }
  };
  const materialize = trpc.financialReconciliation.materializeQueue.useMutation(
    {
      onSuccess: result => {
        setConfirmation(null);
        toast.success(
          text(
            result.itemsAdded +
              " review candidates added; no income recognized.",
            "تمت إضافة " + result.itemsAdded + " مرشح مراجعة دون احتساب دخل."
          )
        );
        void Promise.all([
          refreshStats(),
          utils.financialReconciliation.items.invalidate(viewerScope),
        ]);
      },
      onError: error => {
        setConfirmation(null);
        onAccessFailure(error);
        toast.error(error.message);
      },
    }
  );
  const readError = scope.error || previewQuery.error || workspaceQuery.error;
  const readState = scope.checking
    ? "loading"
    : scope.error
      ? isFinanceAccessDenied(scope.error)
        ? "denied"
        : "failure"
      : !scope.verified
        ? "failure"
        : !scope.allowed
          ? "denied"
          : readError
            ? isFinanceAccessDenied(readError)
              ? "denied"
              : "failure"
            : previewQuery.isFetching || workspaceQuery.isFetching
              ? "loading"
              : !preview || !workspace
                ? "failure"
                : null;
  const ready = readState === null;
  const counts = preview?.counts,
    classifications = preview?.classifications;
  const createQueue = () => {
    if (!ready || !preview?.safeToMaterialize) return;
    setConfirmation({
      title: text("Build review queue", "إنشاء قائمة المراجعة"),
      lines: [
        text(
          preview.totalCandidates +
            " source candidates. Existing review items are preserved.",
          preview.totalCandidates +
            " مرشحًا من المصادر. تبقى عناصر المراجعة الموجودة محفوظة."
        ),
        text(
          "This adds review candidates and audit records only. It does not recognize cash or change orders, keys or customer access.",
          "تضيف هذه العملية مرشحي مراجعة وسجلات تدقيق فقط. لا تحتسب أموالًا ولا تغيّر الطلبات أو المفاتيح أو وصول العملاء."
        ),
      ],
      confirm: () => materialize.mutate(),
    });
  };
  return (
    <DashboardLayout>
      <main className="space-y-5 p-4 md:p-6" dir={ar ? "rtl" : "ltr"}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Scale className="h-6 w-6 shrink-0 text-emerald-700" />
              {text(
                "Historical Financial Reconciliation",
                "المطابقة المالية التاريخية"
              )}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {text(
                "Review source references and evidence. Source orders and keys remain unchanged; candidate prices and classifications do not prove payment.",
                "راجع أرقام المصادر وإثباتاتها. تبقى الطلبات والمفاتيح الأصلية دون تغيير؛ أسعار المرشحين وتصنيفاتهم لا تثبت الدفع."
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={readState === "loading" || materialize.isPending}
              onClick={() => void retryRead()}
            >
              <RefreshCw className="me-2 h-4 w-4" />
              {text("Refresh view", "تحديث العرض")}
            </Button>
            {ready && preview?.canMaterialize && (
              <Button
                onClick={createQueue}
                disabled={materialize.isPending || !preview.safeToMaterialize}
              >
                {text("Build review queue", "إنشاء قائمة المراجعة")}
              </Button>
            )}
          </div>
        </div>
        {readState && (
          <div
            role={readState === "loading" ? "status" : "alert"}
            className="space-y-3 rounded-xl border p-5"
          >
            <p>
              {readState === "loading"
                ? text(
                    "Checking access and loading the workspace…",
                    "جارٍ التحقق من الصلاحيات وتحميل العرض…"
                  )
                : readState === "denied"
                  ? text(
                      "This financial workspace is not available with your current access. Recheck access.",
                      "هذا العرض المالي غير متاح بصلاحياتك الحالية. أعد التحقق من الوصول."
                    )
                  : text(
                      "The financial data could not be loaded or verified. Retry before reviewing or changing records.",
                      "تعذر تحميل البيانات المالية أو التحقق منها. أعد المحاولة قبل المراجعة أو إجراء تغيير."
                    )}
            </p>
            {readState !== "loading" && (
              <Button variant="outline" onClick={() => void retryRead()}>
                {text("Retry", "إعادة المحاولة")}
              </Button>
            )}
          </div>
        )}
        {ready && preview && workspace && (
          <>
            <p className="text-xs text-muted-foreground">
              {text("Preview loaded: ", "تحميل المعاينة: ")}
              {formatAcademyDateTime(preview.generatedAt, language)} ·{" "}
              {text("Summary loaded: ", "تحميل الملخص: ")}
              {formatAcademyDateTime(workspace.generatedAt, language)} ·{" "}
              {text("Palestine time", "بتوقيت فلسطين")}
            </p>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="flex gap-2 font-semibold">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                {text(
                  "Candidates are not income and have no assumed payment date.",
                  "المرشحون ليسوا دخلًا وليس لهم تاريخ دفع مفترض."
                )}
              </p>
              <p className="mt-2">
                {text(
                  "Unknown cash or payment dates stay unresolved. A verified historical receipt requires an owner preview and confirmation using its genuine date and ILS amount. Exclusion deletes nothing.",
                  "تبقى الأموال أو تواريخ الدفع غير المؤكدة غير محسومة. تتطلب الدفعة التاريخية الموثقة معاينة وتأكيد المالك باستخدام تاريخها الحقيقي ومبلغها بالشيكل. الاستبعاد لا يحذف شيئًا."
                )}
              </p>
              {!preview.safeToMaterialize && (
                <p className="mt-2 font-semibold">
                  {text(
                    "A source category exceeds the queue-building safety limit. Ask the finance owner to review it; records will not be silently truncated.",
                    "تتجاوز إحدى فئات المصادر حد الأمان لإنشاء القائمة. اطلب مراجعة المالك؛ لن يتم اقتطاع السجلات بصمت."
                  )}
                </p>
              )}
            </div>
            <section
              aria-label={text(
                "Unfiltered reconciliation summary",
                "ملخص المطابقة دون مرشحات"
              )}
              className="space-y-3"
            >
              <h2 className="text-sm font-semibold">
                {text(
                  "Source candidates and all-status review summary",
                  "مرشحو المصادر وملخص المراجعة لكل الحالات"
                )}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [
                    text("Orders without confirmation", "طلبات بلا تأكيد دفع"),
                    counts?.ordersWithoutConfirmation ?? 0,
                  ],
                  [
                    text("Priced manual keys", "مفاتيح يدوية بسعر"),
                    counts?.manualPricedKeys ?? 0,
                  ],
                  [
                    text("Renewal keys", "مفاتيح تجديد"),
                    counts?.renewalKeys ?? 0,
                  ],
                  [
                    text("Upgrade keys", "مفاتيح ترقية"),
                    counts?.upgradeKeys ?? 0,
                  ],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border p-3">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
              <p className="rounded-lg bg-slate-50 p-3 text-sm">
                {text(
                  "Requires owner review: " +
                    (classifications?.requiresOwnerReview ?? 0) +
                    " · Unknown historic payment: " +
                    (classifications?.historicalPaymentUnknown ?? 0) +
                    " · Nonfinancial candidates: " +
                    (classifications?.excludedNonfinancial ?? 0),
                  "يتطلب مراجعة المالك: " +
                    (classifications?.requiresOwnerReview ?? 0) +
                    " · دفع تاريخي غير مؤكد: " +
                    (classifications?.historicalPaymentUnknown ?? 0) +
                    " · مرشحون بلا أثر مالي: " +
                    (classifications?.excludedNonfinancial ?? 0)
                )}
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [
                    text("Unresolved", "غير محسوم"),
                    workspace.counts.unresolved,
                  ],
                  [
                    text(
                      "Historical opening balances",
                      "أرصدة افتتاحية تاريخية"
                    ),
                    workspace.counts.approvedOpeningBalance,
                  ],
                  [
                    text(
                      "Approved historical adjustments",
                      "تسويات تاريخية معتمدة"
                    ),
                    workspace.counts.approvedAdjustment,
                  ],
                  [text("Excluded", "مستبعد"), workspace.counts.excluded],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl border p-3">
                    <p className="text-sm text-muted-foreground">{label}</p>
                    <p className="text-xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm">
                {text(
                  "Unresolved proposed value only: ",
                  "القيمة المقترحة للعناصر غير المحسومة فقط: "
                )}
                <bdi>{money(workspace.counts.unresolvedProposedMinor)}</bdi>
              </p>
            </section>
            <div className="space-y-2 rounded-xl border bg-slate-50 p-4 text-sm">
              <p className="font-semibold">
                {text(
                  "Original historical ledger postings: ",
                  "القيود التاريخية الأصلية: "
                )}
                <bdi>
                  {money(
                    workspace.recognized.originalPostingsMinor ??
                      workspace.recognized.historicalNetMinor
                  )}
                </bdi>
              </p>
              <p>
                {text(
                  "Includes historical opening balances and original adjustments before later corrections. This is not corrected net cash, period revenue or proof of bank reconciliation.",
                  "تشمل الأرصدة الافتتاحية والتسويات الأصلية قبل التصحيحات اللاحقة. ليست صافي أموال مصححًا أو إيراد فترة أو إثبات مطابقة بنكية."
                )}
              </p>
              <Link
                href="/admin/finance"
                className="text-emerald-800 underline"
              >
                {text(
                  "Open the corrected cash report",
                  "فتح تقرير الأموال المصحح"
                )}
              </Link>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
              <h2 className="font-semibold">
                {text(
                  "Operational indicators; not revenue",
                  "مؤشرات تشغيلية وليست إيرادًا"
                )}
              </h2>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <p>
                  {text(
                    "Saved payment confirmations: ",
                    "تأكيدات دفع محفوظة: "
                  )}
                  {workspace.operationalIndicators.confirmedPayments}
                </p>
                <p>
                  {text(
                    "Order-linked keys issued: ",
                    "مفاتيح مرتبطة بطلب صادرة: "
                  )}
                  {workspace.operationalIndicators.issuedOrderKeys}
                </p>
                <p>
                  {text(
                    "Order-linked keys activated: ",
                    "مفاتيح مرتبطة بطلب مفعّلة: "
                  )}
                  {workspace.operationalIndicators.activatedOrderKeys}
                </p>
              </div>
            </div>
          </>
        )}
        {/* Preserve drafts through transient checks; verified identity/role changes remount the workspace. */}
        <HistoricalReviewQueue
          viewerId={scope.viewerId}
          access={access}
          active={ready}
          onChanged={refreshStats}
          onAccessFailure={onAccessFailure}
        />
        <FinancialActionConfirmation
          review={ready ? confirmation : null}
          busy={materialize.isPending}
          onClose={() => setConfirmation(null)}
        />
      </main>
    </DashboardLayout>
  );
}
