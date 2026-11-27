import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatAdminCurrencyFromIls } from "@/lib/adminCurrency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FINANCIAL_PAYMENT_PURPOSES,
  FINANCIAL_TRANSACTION_PURPOSE_LABELS,
  isFinancialTransactionPurpose,
  type FinancialPaymentPurpose,
} from "@shared/financialTransactionPurpose";
import type {
  FinancialControlEntry,
  FinancialCorrectionRequest,
} from "@shared/financialCorrection";
import { formatAcademyDateTime } from "@shared/academyLocale";
import { toast } from "sonner";
import { isFinanceAccessDenied } from "@/lib/financeWorkspaceCache";

type Cursor = { effectiveAt: string; id: number };
type Filter = { ledgerId?: number; orderId?: number; before?: Cursor };
const today = () => new Date().toISOString().slice(0, 10);
function amount(value: string) {
  if (!/^-?\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const minor = Math.round(Number(value) * 100);
  return Number.isSafeInteger(minor) &&
    minor !== 0 &&
    Math.abs(minor) <= 100_000_000_00
    ? minor
    : null;
}

export default function FinancialCorrectionPicker({
  viewerId,
  onChanged,
  onAccessFailure,
}: {
  viewerId: number;
  onChanged: () => void;
  onAccessFailure: (cause: unknown) => void;
}) {
  const { language } = useLanguage(),
    ar = language === "ar",
    scope = { viewerId, access: "owner" as const };
  const money = (minor: number) =>
    formatAdminCurrencyFromIls(minor / 100, language);
  const purpose = (value: string | null) =>
    isFinancialTransactionPurpose(value)
      ? FINANCIAL_TRANSACTION_PURPOSE_LABELS[value][language]
      : ar
        ? "غير مصنف"
        : "Unclassified";
  const entryName = (value: string) =>
    ({
      payment: ar ? "دفعة" : "Payment",
      refund: ar ? "استرداد" : "Refund",
      expense: ar ? "مصروف" : "Expense",
      adjustment: ar ? "تسوية" : "Adjustment",
      opening_balance: ar ? "رصيد افتتاحي" : "Opening balance",
    })[value] ?? value;
  const [mode, setMode] = useState<"ledger" | "order">("ledger"),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState<Filter>({}),
    [previous, setPrevious] = useState<Array<Cursor | undefined>>([]);
  const [selected, setSelected] = useState<FinancialControlEntry | null>(null),
    [action, setAction] = useState<"reverse" | "reclassify">("reverse"),
    [date, setDate] = useState(today),
    [reason, setReason] = useState(""),
    [replacement, setReplacement] = useState(""),
    [description, setDescription] = useState(""),
    [category, setCategory] = useState<FinancialPaymentPurpose>("new_sale");
  const [request, setRequest] = useState<FinancialCorrectionRequest | null>(
      null
    ),
    [confirmed, setConfirmed] = useState(false);
  const query = trpc.financialControls.entries.useQuery(
    { ...scope, ...filter, limit: 20 },
    {
      staleTime: 5 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );
  const data =
    !query.error &&
    query.data?.viewerId === viewerId &&
    query.data.access === "owner"
      ? query.data
      : undefined;
  const preview = trpc.financialControls.previewCorrection.useQuery(
    {
      ...scope,
      request: request ?? {
        action: "reverse",
        entryId: 1,
        effectiveDate: today(),
        reason: "Not submitted",
      },
    },
    {
      enabled: !!request,
      staleTime: Infinity,
      gcTime: 0,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
    }
  );
  const reviewed =
    !!request &&
    !preview.error &&
    preview.data?.viewerId === viewerId &&
    preview.data.access === "owner" &&
    preview.data.original.id === selected?.id &&
    Object.entries(request).every(
      ([key, value]) => (preview.data!.request as any)[key] === value
    )
      ? preview.data
      : undefined;
  useEffect(() => {
    const denied = [query.error, preview.error].find(isFinanceAccessDenied);
    if (denied) onAccessFailure(denied);
  }, [query.error, preview.error]);
  const resetPreview = () => {
    setRequest(null);
    setConfirmed(false);
  };
  const fail = (error: unknown) => {
    resetPreview();
    onAccessFailure(error);
    void query.refetch();
  };
  const saved = () => {
    setSelected(null);
    resetPreview();
    toast.success(
      ar
        ? "تم تسجيل التصحيح مع حفظ الأصل"
        : "Correction recorded; original preserved"
    );
    onChanged();
  };
  const reverse = trpc.financialControls.reverseEntry.useMutation({
      onSuccess: saved,
      onError: fail,
    }),
    reclassify = trpc.financialControls.reclassifyPayment.useMutation({
      onSuccess: saved,
      onError: fail,
    }),
    busy = reverse.isPending || reclassify.isPending;
  const open = (entry: FinancialControlEntry) => {
    resetPreview();
    setSelected(entry);
    setAction("reverse");
    setDate(today());
    setReason("");
    setReplacement("");
    setDescription("");
    setCategory(
      FINANCIAL_PAYMENT_PURPOSES.find(
        value => value === entry.transactionPurpose
      ) ?? "new_sale"
    );
  };
  const apply = () => {
    if (search && !/^[1-9]\d*$/.test(search.trim())) {
      toast.error(
        ar ? "أدخل رقماً صحيحاً موجباً" : "Enter a positive whole ID"
      );
      return;
    }
    const id = search.trim() ? Number(search) : undefined;
    if (id !== undefined && !Number.isSafeInteger(id)) {
      toast.error(ar ? "الرقم غير صالح" : "Invalid ID");
      return;
    }
    setFilter(
      id ? (mode === "ledger" ? { ledgerId: id } : { orderId: id }) : {}
    );
    setPrevious([]);
    setSelected(null);
    resetPreview();
  };
  const valid =
    !!selected &&
    reason.trim().length >= (action === "reclassify" ? 5 : 3) &&
    (action === "reclassify"
      ? category !== selected.transactionPurpose
      : !!date &&
        (replacement === "" ||
          (amount(replacement) !== null && description.trim().length >= 3)));
  const loadPreview = () => {
    if (!valid || !selected) return;
    setConfirmed(false);
    setRequest(
      action === "reclassify"
        ? {
            action,
            entryId: selected.id,
            nextPurpose: category,
            reason: reason.trim(),
          }
        : {
            action,
            entryId: selected.id,
            effectiveDate: date,
            reason: reason.trim(),
            replacementAmountIlsMinor:
              replacement === "" ? null : amount(replacement),
            replacementDescription: description.trim() || null,
          }
    );
  };
  const confirm = () => {
    if (!reviewed || !request || !confirmed || busy || preview.isFetching)
      return;
    if (request.action === "reverse") {
      const { action: _, ...input } = request;
      reverse.mutate({ ...input, expectedPeriodLocked: reviewed.periodLocked });
    } else {
      const { action: _, ...input } = request;
      reclassify.mutate({
        ...input,
        expectedPeriodLocked: reviewed.periodLocked,
      });
    }
  };
  return (
    <section
      className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"
      aria-label={
        ar ? "مصادر التصحيحات المالية" : "Financial correction sources"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">
            {ar
              ? "مراجعة وتصحيح قيد معتمد"
              : "Review and correct an approved entry"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ar
              ? "اعرض ٢٠ قيداً في كل صفحة وافتح نموذجاً واحداً عند الحاجة. رقم القيد المحاسبي يختلف عن رقم الطلب."
              : "Browse 20 entries per page and open one action form when needed. A ledger entry ID is different from an order ID."}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={query.isFetching || busy}
          onClick={() => void query.refetch()}
        >
          {ar ? "تحديث القيود" : "Refresh entries"}
        </Button>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={event => {
          event.preventDefault();
          apply();
        }}
      >
        <div>
          <Label htmlFor="correction-search-type">
            {ar ? "نوع الرقم" : "ID type"}
          </Label>
          <select
            id="correction-search-type"
            className="mt-1 block h-10 rounded-md border bg-background px-3"
            value={mode}
            onChange={event => setMode(event.target.value as typeof mode)}
          >
            <option value="ledger">
              {ar ? "رقم القيد المحاسبي" : "Ledger entry ID"}
            </option>
            <option value="order">{ar ? "رقم الطلب" : "Order ID"}</option>
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor="correction-search-id">
            {ar ? "الرقم المطابق (اختياري)" : "Exact ID (optional)"}
          </Label>
          <Input
            id="correction-search-id"
            value={search}
            maxLength={16}
            inputMode="numeric"
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy}>
          {ar ? "تطبيق البحث" : "Apply search"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSearch("");
            setFilter({});
            setPrevious([]);
          }}
        >
          {ar ? "مسح البحث" : "Clear search"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {ar
          ? "يطبّق البحث عند الضغط على الزر. الترتيب حسب تاريخ القيد ثم رقمه من الأحدث. القيود المعكوسة تظهر للسياق فقط. النتائج ليست إجمالي الدفتر أو تقريراً مالياً."
          : "Search applies only on submission. Entries are ordered by posting date, then ID, newest first. Reversed sources remain visible for context. This list is not a ledger total or financial report."}
      </p>
      {query.error ? (
        <div role="alert">
          <p>
            {ar
              ? "تعذّر تحميل القيود؛ لا يمكن تأكيد أن القائمة فارغة."
              : "Entries could not be loaded; an empty list is not verified."}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              onAccessFailure(query.error);
              void query.refetch();
            }}
          >
            {ar ? "إعادة المحاولة" : "Retry entries"}
          </Button>
        </div>
      ) : !data ? (
        <div role={query.isPending ? "status" : "alert"}>
          <p>
            {query.isPending
              ? ar
                ? "جاري تحميل القيود..."
                : "Loading entries…"
              : ar
                ? "تعذّر التحقق من نطاق العرض. أعد المحاولة."
                : "The viewer scope could not be verified. Retry this read."}
          </p>
          {!query.isPending && (
            <Button variant="outline" onClick={() => void query.refetch()}>
              {ar ? "إعادة المحاولة" : "Retry entries"}
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {ar ? "وقت العرض: " : "Loaded: "}
            {formatAcademyDateTime(data.generatedAt, language)} ·{" "}
            {ar ? "بتوقيت فلسطين" : "Palestine time"}
          </p>
          <div className="space-y-2">
            {data.items.map(entry => (
              <article
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="min-w-0 break-words">
                  <strong>
                    {ar ? "قيد محاسبي" : "Ledger entry"} #{entry.id} ·{" "}
                    {entryName(entry.entryType)}
                  </strong>
                  <p className="text-sm">
                    <bdi dir="ltr">{String(entry.effectiveAt).slice(0, 10)} UTC</bdi> ·{" "}
                    {entry.description || entry.sourceReference}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.orderId
                      ? `${ar ? "الطلب" : "Order"} #${entry.orderId}`
                      : ar
                        ? "لا يوجد طلب مرتبط"
                        : "No linked order"}{" "}
                    · {purpose(entry.transactionPurpose)}
                  </p>
                </div>
                <strong>{money(entry.baseAmountIlsMinor)}</strong>
                {entry.reversed ? (
                  <span className="text-sm text-muted-foreground">
                    {ar
                      ? "تم عكس هذا القيد؛ يعرض للسياق فقط."
                      : "Already reversed; shown for context only."}
                  </span>
                ) : (
                  <Button variant="outline" onClick={() => open(entry)}>
                    {ar ? "مراجعة القيد" : "Review entry"} #{entry.id}
                  </Button>
                )}
              </article>
            ))}
          </div>
          {data.items.length === 0 && (
            <p className="py-4 text-center text-muted-foreground">
              {ar
                ? "لا توجد قيود مصدر معتمدة تطابق البحث."
                : "No approved source entries match this search."}
            </p>
          )}
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="outline"
              disabled={!previous.length || query.isFetching}
              onClick={() => {
                setFilter({ ...filter, before: previous.at(-1) });
                setPrevious(previous.slice(0, -1));
              }}
            >
              {ar ? "السابق" : "Previous"}
            </Button>
            <span className="text-sm">
              {ar ? "الصفحة" : "Page"} {previous.length + 1} ·{" "}
              {data.items.length} {ar ? "قيداً" : "entries"}
            </span>
            <Button
              variant="outline"
              disabled={!data.nextCursor || query.isFetching}
              onClick={() => {
                if (data.nextCursor) {
                  setPrevious([...previous, filter.before]);
                  setFilter({ ...filter, before: data.nextCursor });
                }
              }}
            >
              {ar ? "التالي" : "Next"}
            </Button>
          </div>
        </>
      )}
      <Dialog
        open={!!selected}
        onOpenChange={open => {
          if (!open && !busy) {
            setSelected(null);
            resetPreview();
          }
        }}
      >
        <DialogContent
          dir={ar ? "rtl" : "ltr"}
          className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-2xl"
        >
          <DialogHeader className="text-start">
            <DialogTitle>
              {ar ? "مراجعة القيد المحاسبي" : "Review ledger entry"} #
              {selected?.id}
            </DialogTitle>
            <DialogDescription>
              {ar
                ? "راجع المصدر ثم عاين الأثر قبل التأكيد. تبقى السجلات الأصلية محفوظة؛ لا تُجرى حوالة بنكية أو تغييرات وصول من هذا المسار."
                : "Review the source and preview the impact before confirmation. Original records are preserved; this workflow makes no bank transfer or access changes."}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-slate-50 p-3 text-sm">
                <p className="font-semibold">
                  {selected.description || selected.sourceReference}
                </p>
                <p>
                  {ar ? "المبلغ الأصلي" : "Original amount"}:{" "}
                  <bdi>{money(selected.baseAmountIlsMinor)}</bdi> ·{" "}
                  <bdi dir="ltr">{String(selected.effectiveAt).slice(0, 10)} UTC</bdi>
                </p>
                <p className="break-all">
                  {ar ? "مرجع المصدر" : "Source reference"}:{" "}
                  {selected.sourceReference}
                </p>
                {selected.orderId && (
                  <Link
                    href={`/admin/orders?orderId=${selected.orderId}`}
                    className="font-semibold underline"
                  >
                    {ar ? "فتح الطلب المرتبط" : "Open linked order"} #
                    {selected.orderId}
                  </Link>
                )}
              </div>
              <div>
                <Label htmlFor="correction-action">
                  {ar ? "نوع التصحيح" : "Correction action"}
                </Label>
                <select
                  id="correction-action"
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                  disabled={busy}
                  value={action}
                  onChange={event => {
                    setAction(event.target.value as typeof action);
                    resetPreview();
                  }}
                >
                  <option value="reverse">
                    {ar
                      ? "عكس القيد"
                      : "Reverse entry"}
                  </option>
                  {selected.entryType === "payment" &&
                    FINANCIAL_PAYMENT_PURPOSES.some(
                      value => value === selected.transactionPurpose
                    ) && (
                      <option value="reclassify">
                        {ar
                          ? "تغيير التصنيف"
                          : "Reclassify payment"}
                      </option>
                    )}
                </select>
              </div>
              {action === "reverse" ? (
                <>
                  <div>
                    <Label htmlFor="correction-date">
                      {ar
                        ? "تاريخ قيد التصحيح (UTC)"
                        : "Correction posting date (UTC)"}
                    </Label>
                    <Input
                      id="correction-date"
                      type="date"
                      disabled={busy}
                      value={date}
                      onChange={event => {
                        setDate(event.target.value);
                        resetPreview();
                      }}
                    />
                  </div>
                  <div>
                    <Label htmlFor="correction-replacement">
                      {ar
                        ? "مبلغ بديل اختياري بالشيكل"
                        : "Optional replacement amount in ILS"}
                    </Label>
                    <Input
                      id="correction-replacement"
                        aria-invalid={replacement !== '' && amount(replacement) === null}
                        aria-describedby={replacement !== '' && amount(replacement) === null ? 'correction-replacement-error' : undefined}
                      inputMode="decimal"
                      disabled={busy}
                      value={replacement}
                      onChange={event => {
                        setReplacement(event.target.value);
                        resetPreview();
                      }}
                    />
                  </div>
                  {replacement !== "" && (
                    <div>
                      <Label htmlFor="correction-description">
                        {ar ? "وصف القيد البديل" : "Replacement description"}
                      </Label>
                      <Input
                        id="correction-description"
                        maxLength={1000}
                        disabled={busy}
                        value={description}
                        onChange={event => {
                          setDescription(event.target.value);
                          resetPreview();
                        }}
                      />
                      {replacement !== '' && amount(replacement) === null && <p id="correction-replacement-error" role="alert" className="mt-1 text-xs text-red-700">{ar ? 'أدخل مبلغاً غير صفري بالشيكل، بمنزلتين عشريتين كحد أقصى.' : 'Enter a non-zero ILS amount with at most two decimal places.'}</p>}
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <Label htmlFor="correction-category">
                    {ar ? "التصنيف الجديد" : "New payment category"}
                  </Label>
                  <select
                    id="correction-category"
                    className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                    disabled={busy}
                    value={category}
                    onChange={event => {
                      setCategory(
                        event.target.value as FinancialPaymentPurpose
                      );
                      resetPreview();
                    }}
                  >
                    {FINANCIAL_PAYMENT_PURPOSES.map(value => (
                      <option key={value} value={value}>
                        {FINANCIAL_TRANSACTION_PURPOSE_LABELS[value][language]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <Label htmlFor="correction-reason">
                  {ar ? "سبب موثق للتصحيح" : "Documented correction reason"}
                </Label>
                <Input
                  id="correction-reason"
                    aria-describedby="correction-reason-help"
                  maxLength={1000}
                  disabled={busy}
                  value={reason}
                  onChange={event => {
                    setReason(event.target.value);
                    resetPreview();
                  }}
                />
                  <p id="correction-reason-help" className="mt-1 text-xs text-muted-foreground">{ar ? `الحد الأدنى ${action === 'reclassify' ? 5 : 3} أحرف لسبب واضح.` : `Use at least ${action === 'reclassify' ? 5 : 3} characters for a clear reason.`}</p>
              </div>
              <Button
                variant="outline"
                disabled={!valid || busy || preview.isFetching}
                onClick={() => {
                  if (request) void preview.refetch();
                  else loadPreview();
                  setConfirmed(false);
                }}
              >
                {preview.isFetching
                  ? ar
                    ? "جاري المعاينة..."
                    : "Loading preview…"
                  : ar
                    ? "معاينة التصحيح"
                    : "Preview correction"}
              </Button>
              {preview.error && request && (
                <p role="alert" className="text-sm text-red-700">
                  {preview.error.message}
                </p>
              )}
              {request &&
                !preview.isPending &&
                !preview.isFetching &&
                !preview.error &&
                !reviewed && (
                  <p role="alert">
                    {ar
                      ? "تعذّر التحقق من المعاينة لهذا الحساب والاختيار. أعد المعاينة."
                      : "The preview could not be verified for this account and selection. Preview again."}
                  </p>
                )}
              {reviewed && (
                <section
                  aria-label={
                    ar ? "أثر التصحيح المقترح" : "Proposed correction impact"
                  }
                  className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm"
                >
                  <h3 className="font-semibold">
                    {ar ? "أثر التصحيح المقترح" : "Proposed correction impact"}
                  </h3>
                  <p className="text-xs">
                    {formatAcademyDateTime(reviewed.generatedAt, language)} ·{" "}
                    {ar ? "بتوقيت فلسطين" : "Palestine time"}
                  </p>
                  <p>
                    {ar ? "فترة قيد التصحيح" : "Correction period"}:{" "}
                    <bdi dir="ltr">{reviewed.reportingMonth}</bdi> ·{" "}
                    <bdi dir="ltr">{reviewed.effectiveAt.slice(0, 10)} UTC</bdi>
                  </p>
                  {reviewed.periodLocked && (
                    <p className="font-semibold text-red-800">
                      {ar
                        ? "الفترة مقفلة. التأكيد يسمح للمالك بتسجيل هذا التصحيح المحدد في الفترة المقفلة؛ لا يفتح الفترة."
                        : "This period is locked. Confirmation authorizes the owner to post this specific correction in the locked period; it does not unlock it."}
                    </p>
                  )}
                  {action === "reverse" ? (
                    <>
                      <p>
                        {ar ? "القيد العكسي" : "Reversal"}:{" "}
                        <bdi>{money(reviewed.reversalAmountIlsMinor)}</bdi>
                      </p>
                      <p>
                        {ar ? "البديل" : "Replacement"}:{" "}
                        {reviewed.replacementAmountIlsMinor === null ? (
                          ar ? (
                            "لا يوجد"
                          ) : (
                            "None"
                          )
                        ) : (
                          <bdi>{money(reviewed.replacementAmountIlsMinor)}</bdi>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p>
                        {purpose(reviewed.previousPurpose)} →{" "}
                        {purpose(reviewed.nextPurpose)}
                      </p>
                      <p>
                        {ar
                          ? "يُضاف قيدان متوازنان بنفس تاريخ الدفع الأصلي. لا يتغير إجمالي النقد أو صلاحية الخدمات."
                          : "Two balanced entries use the original payment date. Total cash and service access stay unchanged."}
                      </p>
                    </>
                  )}
                  <p className="font-semibold">
                    {ar
                      ? "صافي التغير في حركة الدفتر"
                      : "Net ledger movement change"}
                    : <bdi>{money(reviewed.ledgerDeltaIlsMinor)}</bdi>
                  </p>
                  <p>
                    {ar
                      ? "هذا أثر محاسبي مقترح، وليس إثباتاً لاكتمال المطابقة مع البنك."
                      : "This is a proposed accounting impact, not proof of complete bank reconciliation."}
                  </p>
                  <label className="flex items-start gap-2">
                    <Checkbox
                      checked={confirmed}
                      disabled={busy || preview.isFetching}
                      onCheckedChange={value => setConfirmed(value === true)}
                    />
                    <span>
                      {ar
                        ? "راجعت المصدر والفترة والمبالغ والتصنيف والسبب، وأوافق على تسجيل هذا التصحيح."
                        : "I reviewed the source, period, amounts, category and reason, and confirm this correction."}
                    </span>
                  </label>
                </section>
              )}
            </div>
          )}
          <DialogFooter className="sticky bottom-0 border-t bg-background pt-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                setSelected(null);
                resetPreview();
              }}
            >
              {ar ? "رجوع دون تغيير" : "Back without changes"}
            </Button>
            <Button
              variant="destructive"
              disabled={!reviewed || !confirmed || busy || preview.isFetching}
              onClick={confirm}
            >
              {busy
                ? ar
                  ? "جاري التسجيل..."
                  : "Saving…"
                : ar
                  ? "تأكيد وتسجيل التصحيح"
                  : "Confirm and post correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
