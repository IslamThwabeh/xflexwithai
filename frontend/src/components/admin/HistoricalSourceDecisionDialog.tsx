import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { isFinanceAccessDenied } from "@/lib/financeWorkspaceCache";
import { formatAdminCurrencyFromIls } from "@/lib/adminCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAcademyDateTime } from "@shared/academyLocale";
import {
  formatHistoricalReviewDate,
  parseReconciliationIls,
  reconciliationLabel,
  reconciliationSourcePath,
  type ReconciliationDecision,
  type ReconciliationDecisionPreview,
} from "@shared/financialReconciliation";
import { toast } from "sonner";
import { X } from "lucide-react";

type Cursor = { createdAt: string; id: number };
export default function HistoricalSourceDecisionDialog({
  itemId,
  viewerId,
  visible,
  onClose,
  onChanged,
  onAccessFailure,
}: {
  itemId: number | null;
  viewerId: number;
  visible: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
  onAccessFailure: (error: unknown) => void;
}) {
  const { language } = useLanguage(),
    ar = language === "ar",
    utils = trpc.useUtils();
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const money = (minor: number) =>
    formatAdminCurrencyFromIls(minor / 100, language);
  const [before, setBefore] = useState<Cursor>(),
    [previous, setPrevious] = useState<Array<Cursor | undefined>>([]);
  const [auditOpen, setAuditOpen] = useState(false);
  const [decision, setDecision] =
    useState<ReconciliationDecision["decision"]>("excluded");
  const [date, setDate] = useState(""),
    [amount, setAmount] = useState(""),
    [reason, setReason] = useState("");
  const [preview, setPreview] = useState<ReconciliationDecisionPreview | null>(
      null
    ),
    [accepted, setAccepted] = useState(false);
  const [previewing, setPreviewing] = useState(false),
    [previewError, setPreviewError] = useState("");
  const scope = { viewerId, access: "owner" as const };
  const sourceQuery = trpc.financialReconciliation.sourceReview.useQuery(
    { ...scope, itemId: itemId ?? 0, before },
    {
      enabled: visible && itemId !== null,
      staleTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );
  const context =
    visible &&
    !sourceQuery.error &&
    !sourceQuery.isFetching &&
    sourceQuery.data?.viewerId === viewerId &&
    sourceQuery.data.access === "owner" &&
    sourceQuery.data.item.id === itemId
      ? sourceQuery.data
      : undefined;
  const request: ReconciliationDecision = {
    itemId: itemId ?? 0,
    decision,
    reason: reason.trim(),
    effectiveDate: decision === "excluded" ? null : date,
    amountIlsMinor:
      decision === "excluded" ? null : parseReconciliationIls(amount, true),
  };
  const requestKey = JSON.stringify(request),
    latestRequest = useRef(requestKey);
  latestRequest.current = requestKey;
  const resetPreview = () => {
    setPreview(null);
    setAccepted(false);
    setPreviewError("");
  };
  useEffect(() => {
    if (!visible) {
      setPreview(null);
      setAccepted(false);
    }
  }, [visible]);
  useEffect(() => {
    if (preview && context && preview.reviewVersion !== context.reviewVersion) {
      setPreview(null);
      setAccepted(false);
    }
  }, [context?.reviewVersion, preview]);
  const resolve = trpc.financialReconciliation.resolveItem.useMutation({
    onSuccess: async result => {
      onClose();
      void onChanged();
      toast.success(
        result?.idempotent
          ? text(
              "This decision was already saved.",
              "كان القرار محفوظًا مسبقًا."
            )
          : text(
              "Owner decision saved with its audit trail.",
              "تم حفظ قرار المالك وسجل تدقيقه."
            )
      );
    },
    onError: error => {
      resetPreview();
      setPreviewError(error.message);
      if (isFinanceAccessDenied(error)) onAccessFailure(error);
      if (error.data?.code === "CONFLICT") {
        void sourceQuery.refetch();
        void onChanged();
      }
    },
  });
  const canPropose =
    context?.item.status === "unresolved" &&
    reason.trim().length >= 5 &&
    (decision === "excluded" ||
      (context.item.proposedTreatment === "historical_payment_known_date" &&
        !!context.source &&
        !context.source.paymentConfirmed &&
        !!date &&
        request.amountIlsMinor !== null));
  const verifiedPreview =
    preview &&
    context &&
    preview.reviewVersion === context.reviewVersion &&
    JSON.stringify(preview.request) === requestKey
      ? preview
      : null;
  const getPreview = async () => {
    if (!canPropose || previewing || resolve.isPending) return;
    const key = requestKey;
    setPreviewing(true);
    resetPreview();
    try {
      const result = await utils.financialReconciliation.decisionPreview.fetch({
        ...scope,
        request,
      });
      if (latestRequest.current !== key) return;
      if (
        result.viewerId !== viewerId ||
        result.access !== "owner" ||
        result.itemId !== itemId ||
        JSON.stringify(result.request) !== key
      ) {
        throw new Error(
          text(
            "The preview scope could not be verified. Retry the review.",
            "تعذر التحقق من نطاق المعاينة. أعد المراجعة."
          )
        );
      }
      if (result.reviewVersion !== context?.reviewVersion) {
        void sourceQuery.refetch();
        throw new Error(
          text(
            "The source changed. Review the refreshed source before previewing again.",
            "تغيّر المصدر. راجع المصدر المحدّث قبل معاينة القرار مجددًا."
          )
        );
      }
      setPreview(result);
    } catch (error) {
      if (latestRequest.current === key)
        setPreviewError(
          error instanceof Error
            ? error.message
            : text("Preview failed.", "تعذرت المعاينة.")
        );
      if (isFinanceAccessDenied(error)) onAccessFailure(error);
    } finally {
      setPreviewing(false);
    }
  };
  const submit = () => {
    if (!visible || !accepted || !verifiedPreview || resolve.isPending) return;
    resolve.mutate({
      ...verifiedPreview.request,
      expectedReviewVersion: verifiedPreview.reviewVersion,
      expectedPeriodLocked: verifiedPreview.periodLocked,
    });
  };
  const busy = previewing || resolve.isPending;
  const sourcePath = context?.source
    ? reconciliationSourcePath(
        context.item.sourceType,
        context.item.sourceReference,
        context.source.packageId
      )
    : null;
  const sourceValue = () => {
    const source = context?.source;
    if (!source || !Number.isFinite(source.nativeAmountMinor))
      return text("Unknown", "غير معروف");
    try {
      return new Intl.NumberFormat(language, {
        style: "currency",
        currency: source.currency,
      }).format(source.nativeAmountMinor / 100);
    } catch {
      return `${source.nativeAmountMinor / 100} ${source.currency}`;
    }
  };
  return (
    <Dialog
      open={visible && itemId !== null}
      onOpenChange={open => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl flex-col overflow-hidden p-0"
        dir={ar ? "rtl" : "ltr"}
        showCloseButton={false}
      >
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute end-2 top-2 h-11 w-11"
          aria-label={text("Close review", "إغلاق المراجعة")}
          disabled={busy}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
        <DialogHeader className="shrink-0 p-4 pe-14">
          <DialogTitle>
            {text("Review historical item", "مراجعة العنصر التاريخي")}{" "}
            <bdi>#{itemId ?? ""}</bdi>
          </DialogTitle>
          <DialogDescription>
            {text(
              "Review the source before deciding. Stored prices, key activation and candidate confidence do not prove payment.",
              "راجع المصدر قبل اتخاذ القرار. الأسعار المخزنة وتفعيل المفاتيح وثقة التصنيف لا تثبت وصول دفعة."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto px-4 pb-4">
          {!context ? (
            <div
              role={sourceQuery.isFetching ? "status" : "alert"}
              className="rounded-lg border p-4"
            >
              <p>
                {sourceQuery.isFetching
                  ? text(
                      "Loading verified source review…",
                      "جارٍ تحميل مراجعة المصدر…"
                    )
                  : text(
                      "The source review could not be verified. No decision can be posted.",
                      "تعذر التحقق من مراجعة المصدر. لا يمكن حفظ قرار."
                    )}
              </p>
              {!sourceQuery.isFetching && (
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => void sourceQuery.refetch()}
                >
                  {text("Retry source review", "إعادة تحميل المصدر")}
                </Button>
              )}
            </div>
          ) : (
            <>
              <section
                aria-label={text(
                  "Historical source context",
                  "سياق المصدر التاريخي"
                )}
                className="space-y-2 rounded-lg border bg-slate-50 p-3 text-sm break-words"
              >
                <p className="font-semibold">
                  {reconciliationLabel(context.item.issueType, language)}
                </p>
                <p>
                  {reconciliationLabel(context.item.sourceType, language)}{" "}
                  <bdi>#{context.item.sourceReference}</bdi> ·{" "}
                  {reconciliationLabel(context.item.status, language)}
                </p>
                <p>
                  {reconciliationLabel(context.item.confidenceLevel, language)}
                </p>
                <p>
                  {reconciliationLabel(
                    context.item.proposedTreatment,
                    language
                  )}
                </p>
                {context.item.notes && (
                  <p className="whitespace-pre-wrap">
                    {text("Review notes: ", "ملاحظات المراجعة: ")}
                    {context.item.notes}
                  </p>
                )}
                {!context.source ? (
                  <p role="alert" className="text-amber-900">
                    {text(
                      "Source missing or unsupported. Keep unresolved or document an exclusion; no receipt can be recognized.",
                      "المصدر غير موجود أو غير مدعوم. أبقِ العنصر غير محسوم أو وثّق الاستبعاد؛ لا يمكن احتساب دفعة."
                    )}
                  </p>
                ) : (
                  <>
                    <p>
                      {text(
                        "Stored source value, not verified cash: ",
                        "قيمة المصدر المخزنة وليست دفعة مؤكدة: "
                      )}
                      <bdi>{sourceValue()}</bdi>
                    </p>
                    <p>
                      {text("Source created: ", "إنشاء المصدر: ")}
                      {formatHistoricalReviewDate(
                        context.source.createdAt,
                        language
                      )}
                    </p>
                    {context.source.status && (
                      <p>
                        {text("Order status: ", "حالة الطلب: ")}
                        {reconciliationLabel(context.source.status, language)}
                      </p>
                    )}
                    {context.source.kind === "key" && (
                      <p>
                        {text("Key: ", "المفتاح: ")}
                        {context.source.activatedAt
                          ? text("has an activation date", "له تاريخ تفعيل")
                          : text("no activation date", "بلا تاريخ تفعيل")}{" "}
                        ·{" "}
                        {context.source.isActive
                          ? text("active flag", "مؤشره نشط")
                          : text("inactive flag", "مؤشره غير نشط")}
                      </p>
                    )}
                    {context.source.kind === "key" &&
                      context.source.packageId === null && (
                        <p>
                          {text(
                            "Legacy course key: its exact financial source is shown here; it is not part of the package-key inventory.",
                            "مفتاح دورة قديم: يظهر مصدره المالي المحدد هنا؛ وهو ليس ضمن مخزون مفاتيح الباقات."
                          )}
                        </p>
                      )}
                    <p>
                      {text("Receipt attachment: ", "مرفق إيصال: ")}
                      {context.source.proofAvailable
                        ? text(
                            "available in the order; verify the evidence",
                            "متاح داخل الطلب؛ يجب التحقق من الإثبات"
                          )
                        : text("not shown here", "غير ظاهر هنا")}
                    </p>
                    <p
                      className={
                        context.source.paymentConfirmed
                          ? "font-semibold text-amber-900"
                          : ""
                      }
                    >
                      {context.source.paymentConfirmed
                        ? text(
                            "Saved payment already covers this source. Do not recognize another receipt.",
                            "يوجد تأكيد دفع محفوظ لهذا المصدر. لا تحتسب دفعة أخرى."
                          )
                        : text(
                            "No saved order payment confirmation. This alone does not establish a payment.",
                            "لا يوجد تأكيد دفع طلب محفوظ. هذا وحده لا يثبت وجود دفعة."
                          )}
                    </p>
                    {context.source.confirmedAt && (
                      <p>
                        {text(
                          "Saved confirmation date: ",
                          "تاريخ التأكيد المحفوظ: "
                        )}
                        {formatHistoricalReviewDate(
                          context.source.confirmedAt,
                          language
                        )}{" "}
                        · {text("Palestine time", "بتوقيت فلسطين")}
                      </p>
                    )}
                    {sourcePath && (
                      <Link
                        className="inline-block text-emerald-800 underline"
                        href={sourcePath}
                      >
                        {text(
                          "Open exact operational source",
                          "فتح المصدر التشغيلي المحدد"
                        )}
                      </Link>
                    )}
                    {context.source.kind === "key" &&
                      context.source.orderId && (
                        <Link
                          className="ms-3 inline-block text-emerald-800 underline"
                          href={`/admin/orders?orderId=${context.source.orderId}`}
                        >
                          {text(
                            `Linked order #${context.source.orderId}`,
                            `الطلب المرتبط #${context.source.orderId}`
                          )}
                        </Link>
                      )}
                  </>
                )}
                <p className="text-xs text-muted-foreground">
                  {text("Source loaded: ", "تحميل المصدر: ")}
                  {formatAcademyDateTime(context.generatedAt, language)} ·{" "}
                  {text("Palestine time", "بتوقيت فلسطين")}
                </p>
              </section>
              <section
                aria-label={text(
                  "Historical review audit",
                  "تدقيق المراجعة التاريخية"
                )}
                className="rounded-lg border p-3 text-sm"
              >
                <details
                  open={auditOpen}
                  onToggle={event => setAuditOpen(event.currentTarget.open)}
                >
                  <summary className="cursor-pointer font-semibold">
                    {text("Review history", "سجل المراجعة")}
                    <span className="ms-2 text-xs font-normal text-muted-foreground">
                      ({context.events.length})
                    </span>
                  </summary>
                  {!context.events.length ? (
                    <p className="mt-2 text-muted-foreground">
                      {text(
                        "No review events on this page.",
                        "لا توجد أحداث مراجعة في هذه الصفحة."
                      )}
                    </p>
                  ) : (
                    <ol className="mt-2 space-y-3">
                      {context.events.map(event => (
                        <li
                          key={Number(event.id)}
                          className="break-words border-s-2 ps-3"
                        >
                          <p>
                            {reconciliationLabel(
                              String(event.action),
                              language
                            )}{" "}
                            · <bdi>#{String(event.id)}</bdi>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatHistoricalReviewDate(
                              String(event.createdAt),
                              language
                            )}{" "}
                            ·{" "}
                            {event.actorType === "admin"
                              ? text("Admin", "إدارة")
                              : event.actorType === "staff"
                                ? text("Staff", "موظف")
                                : text("System", "النظام")}{" "}
                            <bdi>#{String(event.actorId ?? "—")}</bdi>
                          </p>
                          {Boolean(event.reason) && (
                            <p>{String(event.reason)}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!previous.length || busy}
                      onClick={() => {
                        setBefore(previous.at(-1));
                        setPrevious(values => values.slice(0, -1));
                      }}
                    >
                      {text("Newer events", "أحداث أحدث")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!context.nextEventCursor || busy}
                      onClick={() => {
                        if (context.nextEventCursor) {
                          setPrevious(values => [...values, before]);
                          setBefore(context.nextEventCursor);
                        }
                      }}
                    >
                      {text("Older events", "أحداث أقدم")}
                    </Button>
                  </div>
                </details>
              </section>
              {context.item.status === "unresolved" && (
                <section
                  className="space-y-3"
                  aria-label={text(
                    "Historical owner decision",
                    "قرار المالك التاريخي"
                  )}
                >
                  <div className="space-y-2">
                    <Label htmlFor="historical-decision">
                      {text("Proposed decision", "القرار المقترح")}
                    </Label>
                    <select
                      id="historical-decision"
                      className="min-h-11 w-full min-w-0 rounded-md border bg-background p-2"
                      value={decision}
                      disabled={busy}
                      onChange={event => {
                        setDecision(event.target.value as typeof decision);
                        resetPreview();
                      }}
                    >
                      <option value="excluded">
                        {text(
                          "Exclude; no new cash entry",
                          "استبعاد دون قيد مالي جديد"
                        )}
                      </option>
                      <option value="approved_adjustment">
                        {text(
                          "Recognize a verified historical receipt",
                          "احتساب دفعة تاريخية موثقة"
                        )}
                      </option>
                    </select>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {decision === "excluded"
                      ? text(
                          "Exclusion preserves the source and any existing payment. It does not delete records or reverse cash.",
                          "الاستبعاد يحفظ المصدر وأي دفعة قائمة؛ لا يحذف سجلات ولا يعكس أموالًا."
                        )
                      : text(
                          "Use only the genuine payment date and independently verified ILS amount. Leave unknown cash/date unresolved.",
                          "استخدم تاريخ الدفع الحقيقي والمبلغ الذي تم التحقق منه بالشيكل. أبقِ المبلغ أو التاريخ غير المؤكد غير محسوم."
                        )}
                  </p>
                  {decision === "approved_adjustment" && (
                    <>
                      {context.item.proposedTreatment !==
                        "historical_payment_known_date" && (
                        <p
                          role="alert"
                          className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950"
                        >
                          {text(
                            "First update the draft classification after verifying the payment date and amount. A proposed price is insufficient.",
                            "حدّث تصنيف المسودة أولًا بعد التحقق من تاريخ الدفع والمبلغ. السعر المقترح لا يكفي."
                          )}
                        </p>
                      )}
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="min-w-0 space-y-2">
                          <Label htmlFor="historical-paid-date">
                            {text(
                              "Genuine payment date (UTC)",
                              "تاريخ الدفع الحقيقي (UTC)"
                            )}
                          </Label>
                          <Input
                            id="historical-paid-date"
                            className="block min-w-0 max-w-full"
                            dir="ltr"
                            type="date"
                            max={new Date().toISOString().slice(0, 10)}
                            value={date}
                            disabled={busy}
                            onChange={event => {
                              setDate(event.target.value);
                              resetPreview();
                            }}
                          />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <Label htmlFor="historical-paid-amount">
                            {text(
                              "Verified ILS receipt amount",
                              "مبلغ الدفعة المؤكد بالشيكل"
                            )}
                          </Label>
                          <Input
                            id="historical-paid-amount"
                            dir="ltr"
                            inputMode="decimal"
                            value={amount}
                            disabled={busy}
                            onChange={event => {
                              setAmount(event.target.value);
                              resetPreview();
                            }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                  <Label htmlFor="historical-reason">
                    {text(
                      "Evidence and decision reason",
                      "الإثبات وسبب القرار"
                    )}
                  </Label>
                  <Textarea
                    id="historical-reason"
                    maxLength={1000}
                    value={reason}
                    disabled={busy}
                    onChange={event => {
                      setReason(event.target.value);
                      resetPreview();
                    }}
                  />
                  <Button
                    variant="outline"
                    disabled={!canPropose || busy}
                    onClick={() => void getPreview()}
                  >
                    {previewing
                      ? text("Preparing preview…", "جارٍ تجهيز المعاينة…")
                      : text("Preview decision", "معاينة القرار")}
                  </Button>
                  {verifiedPreview && (
                    <div
                      role="region"
                      aria-label={text(
                        "Historical decision preview",
                        "معاينة القرار التاريخي"
                      )}
                      className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm"
                    >
                      <p className="font-semibold">
                        {text(
                          "Proposed new ledger movement: ",
                          "القيد المالي الجديد المقترح: "
                        )}
                        <bdi>{money(verifiedPreview.amountIlsMinor)}</bdi>
                      </p>
                      {verifiedPreview.effectiveAt && (
                        <p>
                          {text(
                            "Genuine payment date (UTC): ",
                            "تاريخ الدفع الحقيقي (UTC): "
                          )}
                          <bdi>{verifiedPreview.effectiveAt.slice(0, 10)}</bdi>
                        </p>
                      )}
                      <p>
                        {verifiedPreview.periodLocked
                          ? text(
                              "This is an owner correction in a locked month. The month remains locked.",
                              "هذه تسوية مالك في شهر مغلق. يبقى الشهر مغلقًا."
                            )
                          : text(
                              "This preview has not posted any financial entry.",
                              "لم تُنشئ هذه المعاينة أي قيد مالي."
                            )}
                      </p>
                      <p>
                        {text(
                          "No order, key, access or bank transaction changes.",
                          "لا يتغير الطلب أو المفتاح أو الوصول أو المعاملة البنكية."
                        )}
                      </p>
                      <label className="flex items-start gap-2">
                        <Checkbox
                          checked={accepted}
                          disabled={busy}
                          onCheckedChange={value => setAccepted(value === true)}
                        />
                        <span>
                          {text(
                            "I reviewed the source, genuine evidence and this exact decision.",
                            "راجعت المصدر والإثبات الحقيقي وهذا القرار المحدد."
                          )}
                        </span>
                      </label>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
          {previewError && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 p-3 text-sm text-red-800"
            >
              {previewError}
            </p>
          )}
        </div>
        <DialogFooter className="shrink-0 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {text("Back without changes", "رجوع دون تغيير")}
          </Button>
          {context?.item.status === "unresolved" && (
            <Button
              className="h-auto min-h-11 whitespace-normal"
              disabled={busy || !verifiedPreview || !accepted}
              onClick={submit}
            >
              {resolve.isPending
                ? text("Saving…", "جارٍ الحفظ…")
                : text(
                    "Confirm and save owner decision",
                    "تأكيد وحفظ قرار المالك"
                  )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
