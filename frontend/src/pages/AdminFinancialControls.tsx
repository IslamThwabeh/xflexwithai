import { useState } from "react";
import {
  RefreshCw,
  Check,
  Lock,
  Pencil,
  Plus,
  Send,
  ShieldCheck,
  Unlock,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatAdminCurrencyFromIls } from "@/lib/adminCurrency";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  useFinanceWorkspaceAccess,
  type FinanceWorkspaceAccess,
} from "@/lib/useFinanceWorkspaceAccess";
import { isFinanceAccessDenied } from "@/lib/financeWorkspaceCache";
import FinanceReadNotice from "@/components/admin/FinanceReadNotice";
import FinancialCorrectionPicker from "@/components/admin/FinancialCorrectionPicker";
import FinancialActionConfirmation, {
  type FinancialActionReview,
} from "@/components/admin/FinancialActionConfirmation";
import { formatAcademyDateTime } from "@shared/academyLocale";

type AdjustmentDraft = {
  effectiveDate: string;
  amountIls: string;
  description: string;
  reason: string;
  internalNotes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyAdjustment = (): AdjustmentDraft => ({
  effectiveDate: today(),
  amountIls: "",
  description: "",
  reason: "",
  internalNotes: "",
});
const toMinor = (value: string) =>
  Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0;

const statuses: Record<string, { en: string; ar: string }> = {
  draft: { en: "Draft", ar: "مسودة" },
  pending_approval: { en: "Awaiting approval", ar: "بانتظار الموافقة" },
  approved: { en: "Approved", ar: "معتمد" },
  rejected: { en: "Rejected", ar: "مرفوض" },
};

export default function AdminFinancialControls() {
  const scope = useFinanceWorkspaceAccess("controls");
  return (
    <AdminFinancialControlsWorkspace key={scope.identityKey} scope={scope} />
  );
}

function AdminFinancialControlsWorkspace({
  scope,
}: {
  scope: FinanceWorkspaceAccess;
}) {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const utils = trpc.useUtils();
  const [confirmation, setConfirmation] =
    useState<FinancialActionReview | null>(null);
  const query = trpc.financialControls.workspace.useQuery(
    {
      viewerId: scope.viewerId,
      access: scope.access ?? "manager",
      includeLegacyEntries: false,
    },
    {
      enabled: scope.allowed,
      staleTime: 5 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: true,
    }
  );
  const data =
    scope.allowed &&
    !scope.checking &&
    !query.error &&
    query.data?.viewerId === scope.viewerId &&
    query.data?.access === scope.access
      ? query.data
      : undefined;
  const [draft, setDraft] = useState<AdjustmentDraft>(emptyAdjustment);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<number, string>>(
    {}
  );
  const [lockMonth, setLockMonth] = useState(today().slice(0, 7));
  const [lockReason, setLockReason] = useState("");
  const [unlockReasons, setUnlockReasons] = useState<Record<string, string>>(
    {}
  );

  const refresh = async () => {
    await utils.financialControls.workspace.invalidate();
    await utils.financialReports.dashboard.invalidate();
    if (scope.access === "owner")
      await utils.financialControls.entries.invalidate({
        viewerId: scope.viewerId,
        access: "owner",
      });
  };
  const fail = (cause: unknown) => {
    setConfirmation(null);
    if (
      (cause as { data?: { code?: string } } | null)?.data?.code === "CONFLICT"
    )
      void utils.financialControls.workspace.invalidate();
    if (isFinanceAccessDenied(cause)) void scope.refetch();
    toast.error(
      cause instanceof Error
        ? cause.message
        : isRtl
          ? "تعذر إكمال العملية"
          : "Action failed"
    );
  };
  const complete = (messageEn: string, messageAr: string) => {
    setConfirmation(null);
    toast.success(isRtl ? messageAr : messageEn);
    void refresh();
  };

  const create = trpc.financialControls.createAdjustment.useMutation({
    onSuccess: () => {
      complete("Adjustment draft saved", "تم حفظ مسودة التسوية");
      setDraft(emptyAdjustment());
    },
    onError: fail,
  });
  const update = trpc.financialControls.updateAdjustment.useMutation({
    onSuccess: () => {
      complete("Adjustment draft updated", "تم تحديث مسودة التسوية");
      setEditingId(null);
      setDraft(emptyAdjustment());
    },
    onError: fail,
  });
  const submit = trpc.financialControls.submitAdjustment.useMutation({
    onSuccess: () =>
      complete(
        "Submitted for independent review",
        "تم الإرسال للمراجعة المستقلة"
      ),
    onError: fail,
  });
  const review = trpc.financialControls.reviewAdjustment.useMutation({
    onSuccess: () => complete("Review recorded", "تم تسجيل قرار المراجعة"),
    onError: fail,
  });
  const setLock = trpc.financialControls.setPeriodLock.useMutation({
    onSuccess: () => {
      complete("Period control updated", "تم تحديث إقفال الفترة");
      setLockReason("");
    },
    onError: fail,
  });

  const adjustmentPayload = () => ({
    effectiveDate: draft.effectiveDate,
    amountIlsMinor: toMinor(draft.amountIls),
    description: draft.description,
    reason: draft.reason,
    internalNotes: draft.internalNotes || null,
  });
  const saveAdjustment = () => {
    if (
      !draft.effectiveDate ||
      !toMinor(draft.amountIls) ||
      draft.description.trim().length < 3 ||
      draft.reason.trim().length < 3
    ) {
      toast.error(
        isRtl
          ? "أدخل التاريخ ومبلغاً غير صفري والوصف والسبب"
          : "Enter a date, non-zero amount, description, and reason"
      );
      return;
    }
    if (editingId)
      update.mutate({ adjustmentId: editingId, ...adjustmentPayload() });
    else create.mutate(adjustmentPayload());
  };
  const editAdjustment = (item: any) => {
    setEditingId(item.id);
    setDraft({
      effectiveDate: String(item.effectiveAt).slice(0, 10),
      amountIls: (Number(item.amountIlsMinor) / 100).toFixed(2),
      description: item.description,
      reason: item.reason,
      internalNotes: item.internalNotes || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const workspaceTitle = isRtl
    ? "الضوابط والتسويات المالية"
    : "Financial Controls & Adjustments";
  const retryRead = async () => {
    const fresh = await scope.refetch();
    const access = fresh.data?.access;
    if (
      !fresh.error &&
      fresh.data?.viewerId === scope.viewerId &&
      (access === "owner" || access === "manager")
    ) {
      await utils.financialControls.workspace.invalidate({
        viewerId: scope.viewerId,
        access,
      });
      if (access === "owner")
        await utils.financialControls.entries.invalidate({
          viewerId: scope.viewerId,
          access: "owner",
        });
    }
  };
  if (scope.checking)
    return (
      <FinanceReadNotice
        title={workspaceTitle}
        state="loading"
        onRetry={() => void retryRead()}
      />
    );
  if (scope.error)
    return (
      <FinanceReadNotice
        title={workspaceTitle}
        state={isFinanceAccessDenied(scope.error) ? "denied" : "failure"}
        onRetry={() => void retryRead()}
      />
    );
  if (!scope.verified)
    return (
      <FinanceReadNotice
        title={workspaceTitle}
        state="failure"
        onRetry={() => void retryRead()}
      />
    );
  if (!scope.allowed)
    return (
      <FinanceReadNotice
        title={workspaceTitle}
        state="denied"
        onRetry={() => void retryRead()}
      />
    );
  if (query.error)
    return (
      <FinanceReadNotice
        title={workspaceTitle}
        state={isFinanceAccessDenied(query.error) ? "denied" : "failure"}
        onRetry={() => void retryRead()}
      />
    );
  if (query.isPending)
    return (
      <FinanceReadNotice
        title={workspaceTitle}
        state="loading"
        onRetry={() => void retryRead()}
      />
    );
  if (!data)
    return (
      <FinanceReadNotice
        title={workspaceTitle}
        state="failure"
        onRetry={() => void retryRead()}
      />
    );

  return (
    <DashboardLayout>
      <main className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <ShieldCheck className="h-6 w-6 text-indigo-700" />
              {isRtl
                ? "الضوابط والتسويات المالية"
                : "Financial Controls & Adjustments"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isRtl
                ? "كل تصحيح يحفظ الأصل ويضيف قيداً عكسياً مدققاً. لا يوجد حذف أو تعديل صامت."
                : "Every correction preserves the original and appends an audited reversal. Nothing is silently deleted or rewritten."}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={query.isFetching || scope.checking}
            onClick={() => void retryRead()}
          >
            <RefreshCw className="me-2 h-4 w-4" />
            {isRtl ? "تحديث العرض" : "Refresh view"}
          </Button>
        </header>
        <p className="text-xs text-muted-foreground">
          {isRtl ? "وقت تحميل العرض: " : "Workspace loaded: "}
          {formatAcademyDateTime(data.generatedAt, language)} ·{" "}
          {isRtl ? "بتوقيت فلسطين" : "Palestine time"}
        </p>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">
              {editingId
                ? isRtl
                  ? `تعديل المسودة #${editingId}`
                  : `Edit draft #${editingId}`
                : isRtl
                  ? "تسوية يدوية جديدة"
                  : "New manual adjustment"}
            </h2>
            {editingId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingId(null);
                  setDraft(emptyAdjustment());
                }}
              >
                <X className="me-1 h-4 w-4" />
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{isRtl ? "تاريخ القيد" : "Posting date"}</Label>
              <Input
                type="date"
                value={draft.effectiveDate}
                onChange={event =>
                  setDraft({ ...draft, effectiveDate: event.target.value })
                }
              />
            </div>
            <div>
              <Label>
                {isRtl
                  ? "المبلغ بالشيكل (+ زيادة، − تخفيض)"
                  : "Amount in ILS (+ increase, − decrease)"}
              </Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={draft.amountIls}
                onChange={event =>
                  setDraft({ ...draft, amountIls: event.target.value })
                }
              />
            </div>
            <div>
              <Label>{isRtl ? "الوصف" : "Description"}</Label>
              <Input
                value={draft.description}
                onChange={event =>
                  setDraft({ ...draft, description: event.target.value })
                }
              />
            </div>
            <div>
              <Label>
                {isRtl
                  ? "سبب التسوية (إلزامي)"
                  : "Adjustment reason (required)"}
              </Label>
              <Input
                value={draft.reason}
                onChange={event =>
                  setDraft({ ...draft, reason: event.target.value })
                }
              />
            </div>
            <div className="md:col-span-2">
              <Label>{isRtl ? "ملاحظات داخلية" : "Internal notes"}</Label>
              <Textarea
                value={draft.internalNotes}
                onChange={event =>
                  setDraft({ ...draft, internalNotes: event.target.value })
                }
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={saveAdjustment}
              disabled={create.isPending || update.isPending}
            >
              <Plus className="me-2 h-4 w-4" />
              {editingId
                ? isRtl
                  ? "حفظ التعديل"
                  : "Save changes"
                : isRtl
                  ? "حفظ كمسودة"
                  : "Save draft"}
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {isRtl
              ? "بعد المراجعة المستقلة تظهر التسوية العامة ضمن حركة الدفتر والتسويات غير المخصصة؛ اعتمادها لا يضيفها تلقائياً للنتيجة التشغيلية. لتصحيح دفعة أو استرداد أو مصروف، استخدم مسار التصحيح المرتبط بمصدره. الفترة المقفلة تتطلب اعتماد المالك."
              : "After independent approval, a general adjustment appears in the ledger bridge as an unallocated movement; approval alone does not add it to operating cash results. Correct a receipt, refund or expense through its source workflow. A locked period requires owner approval."}
          </p>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">
            {isRtl ? "طلبات التسوية" : "Adjustment requests"}
          </h2>
          <div className="space-y-3">
            {data.adjustments.map((item: any) => {
              const reviewReason = reviewReasons[item.id] || "";
              return (
                <article key={item.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <strong>#{item.id}</strong>
                        <Badge variant="outline">
                          {statuses[item.status]?.[language] || item.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm">
                        {String(item.effectiveAt).slice(0, 10)} ·{" "}
                        {item.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.reason}
                      </p>
                    </div>
                    <strong
                      className={
                        Number(item.amountIlsMinor) >= 0
                          ? "text-emerald-700"
                          : "text-red-700"
                      }
                    >
                      {formatAdminCurrencyFromIls(
                        Number(item.amountIlsMinor) / 100,
                        language
                      )}
                    </strong>
                  </div>
                  {item.canEdit && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => editAdjustment(item)}
                      >
                        <Pencil className="me-1 h-4 w-4" />
                        {isRtl ? "تعديل" : "Edit"}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() =>
                          setConfirmation({
                            title: isRtl
                              ? "إرسال التسوية للمراجعة"
                              : "Submit adjustment for review",
                            lines: [
                              (isRtl ? "طلب تسوية #" : "Adjustment request #") +
                                item.id,
                              item.description,
                              String(item.effectiveAt).slice(0, 10) + " UTC",
                              formatAdminCurrencyFromIls(
                                Number(item.amountIlsMinor) / 100,
                                language
                              ),
                              isRtl
                                ? "لا ينشأ قيد مالي قبل الاعتماد المستقل."
                                : "No ledger entry is created before independent approval.",
                            ],
                            confirm: () =>
                              submit.mutate({ adjustmentId: item.id }),
                          })
                        }
                      >
                        <Send className="me-1 h-4 w-4" />
                        {isRtl ? "إرسال" : "Submit"}
                      </Button>
                    </div>
                  )}
                  {item.canReview && (
                    <div className="mt-3 flex flex-col gap-2 md:flex-row">
                      <Input
                        placeholder={
                          isRtl ? "سبب قرار المراجعة" : "Review decision reason"
                        }
                        value={reviewReason}
                        onChange={event =>
                          setReviewReasons(current => ({
                            ...current,
                            [item.id]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        disabled={reviewReason.trim().length < 3}
                        onClick={() => {
                          const locked = data.locks.some(
                            (lock: any) => lock.month === item.reportingMonth
                          );
                          if (locked && scope.access !== "owner") {
                            toast.error(
                              isRtl
                                ? "الفترة مقفلة؛ يلزم اعتماد المالك."
                                : "This period is locked; owner approval is required."
                            );
                            return;
                          }
                          setConfirmation({
                            title: isRtl
                              ? "اعتماد التسوية"
                              : "Approve adjustment",
                            lines: [
                              (isRtl ? "طلب تسوية #" : "Adjustment request #") +
                                item.id,
                              item.description,
                              String(item.effectiveAt).slice(0, 10) + " UTC",
                              formatAdminCurrencyFromIls(
                                Number(item.amountIlsMinor) / 100,
                                language
                              ),
                              isRtl
                                ? "التصنيف: حركة غير موزعة ضمن الدفتر؛ لا تدخل تلقائياً في النتيجة التشغيلية."
                                : "Classification: unallocated ledger movement; not automatically part of operating cash results.",
                              locked
                                ? isRtl
                                  ? "الفترة مقفلة؛ التأكيد يجيز هذه التسوية للمالك دون فتح الفترة."
                                  : "Locked period: confirmation authorizes this owner adjustment without unlocking the period."
                                : isRtl
                                  ? "الفترة غير مقفلة وقت العرض."
                                  : "Period unlocked at the displayed snapshot.",
                              reviewReason,
                            ],
                            confirm: () =>
                              review.mutate({
                                adjustmentId: item.id,
                                decision: "approved",
                                reason: reviewReason,
                                expectedPeriodLocked: locked,
                              }),
                          });
                        }}
                      >
                        <Check className="me-1 h-4 w-4" />
                        {isRtl ? "اعتماد" : "Approve"}
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={reviewReason.trim().length < 3}
                        onClick={() =>
                          setConfirmation({
                            title: isRtl ? "رفض التسوية" : "Reject adjustment",
                            lines: [
                              (isRtl ? "طلب تسوية #" : "Adjustment request #") +
                                item.id,
                              item.description,
                              reviewReason,
                              isRtl
                                ? "يحفظ قرار الرفض دون إنشاء قيد مالي."
                                : "The rejection is audited; no ledger entry is created.",
                            ],
                            confirm: () =>
                              review.mutate({
                                adjustmentId: item.id,
                                decision: "rejected",
                                reason: reviewReason,
                              }),
                          })
                        }
                      >
                        <X className="me-1 h-4 w-4" />
                        {isRtl ? "رفض" : "Reject"}
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
            {data.adjustments.length === 0 && (
              <p className="py-6 text-center text-muted-foreground">
                {isRtl ? "لا توجد طلبات تسوية." : "No adjustment requests."}
              </p>
            )}
          </div>
        </section>

        {data.canManageLocks && (
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 font-semibold">
              <Lock className="h-4 w-4" />
              {isRtl ? "إقفال الفترات" : "Period locks"}
            </h2>
            <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
              <Input
                type="month"
                value={lockMonth}
                onChange={event => setLockMonth(event.target.value)}
              />
              <Input
                placeholder={isRtl ? "سبب الإقفال" : "Lock reason"}
                value={lockReason}
                onChange={event => setLockReason(event.target.value)}
              />
              <Button
                disabled={lockReason.trim().length < 3}
                onClick={() =>
                  setConfirmation({
                    title: isRtl ? "إقفال الفترة" : "Lock period",
                    lines: [
                      lockMonth,
                      lockReason,
                      isRtl
                        ? "يمنع القيد العادي في هذه الفترة؛ لا يثبت اكتمال المطابقة مع البنك."
                        : "Blocks ordinary postings in this period; does not certify bank reconciliation.",
                    ],
                    confirm: () =>
                      setLock.mutate({
                        month: lockMonth,
                        action: "locked",
                        reason: lockReason,
                      }),
                  })
                }
              >
                <Lock className="me-1 h-4 w-4" />
                {isRtl ? "إقفال" : "Lock"}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {data.locks.map((lock: any) => (
                <div
                  key={lock.month}
                  className="grid items-center gap-2 rounded-lg border p-3 md:grid-cols-[100px_1fr_auto]"
                >
                  <strong>{lock.month}</strong>
                  <Input
                    placeholder={
                      isRtl
                        ? "سبب فتح الفترة (إلزامي)"
                        : "Unlock reason (required)"
                    }
                    value={unlockReasons[lock.month] || ""}
                    onChange={event =>
                      setUnlockReasons(current => ({
                        ...current,
                        [lock.month]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      (unlockReasons[lock.month] || "").trim().length < 3
                    }
                    onClick={() =>
                      setConfirmation({
                        title: isRtl ? "فتح الفترة" : "Unlock period",
                        lines: [
                          lock.month,
                          unlockReasons[lock.month],
                          isRtl
                            ? "يسمح مجدداً بالقيد العادي مع حفظ سجل القرار."
                            : "Allows ordinary postings again; the decision remains audited.",
                        ],
                        confirm: () =>
                          setLock.mutate({
                            month: lock.month,
                            action: "unlocked",
                            reason: unlockReasons[lock.month],
                          }),
                      })
                    }
                  >
                    <Unlock className="me-1 h-4 w-4" />
                    {isRtl ? "فتح" : "Unlock"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {data.canReverse && (
          <FinancialCorrectionPicker
            viewerId={scope.viewerId}
            onChanged={() => void refresh()}
            onAccessFailure={fail}
          />
        )}
        <FinancialActionConfirmation
          review={confirmation}
          busy={submit.isPending || review.isPending || setLock.isPending}
          onClose={() => setConfirmation(null)}
        />
      </main>
    </DashboardLayout>
  );
}
