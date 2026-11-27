import { useState } from "react";
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
import {
  RECONCILIATION_CONFIDENCE,
  RECONCILIATION_SOURCES,
  RECONCILIATION_STATUSES,
  RECONCILIATION_TREATMENTS,
  formatHistoricalReviewDate,
  parseReconciliationIls,
  reconciliationLabel,
  type ReconciliationFilter,
  type ReconciliationItem,
  type ReconciliationTreatment,
} from "@shared/financialReconciliation";
import HistoricalSourceDecisionDialog from "./HistoricalSourceDecisionDialog";
import { toast } from "sonner";
import { X } from "lucide-react";

type Cursor = NonNullable<ReconciliationFilter["before"]>;
const initialFilter: ReconciliationFilter = { status: "unresolved" };
export default function HistoricalReviewQueue({
  viewerId,
  access,
  active,
  onChanged,
  onAccessFailure,
}: {
  viewerId: number;
  access: "owner" | "manager";
  active: boolean;
  onChanged: () => Promise<void>;
  onAccessFailure: (error: unknown) => void;
}) {
  const { language } = useLanguage(),
    ar = language === "ar",
    utils = trpc.useUtils();
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const money = (minor: number) =>
    formatAdminCurrencyFromIls(minor / 100, language);
  const [draftFilter, setDraftFilter] =
      useState<ReconciliationFilter>(initialFilter),
    [filter, setFilter] = useState<ReconciliationFilter>(initialFilter);
  const [exactType, setExactType] = useState<"item" | "order" | "key">("item"),
    [exactId, setExactId] = useState(""),
    [filterError, setFilterError] = useState("");
  const [previous, setPrevious] = useState<Array<Cursor | undefined>>([]),
    [selected, setSelected] = useState<number | null>(null);
  const [draft, setDraft] = useState<ReconciliationItem | null>(null),
    [treatment, setTreatment] = useState<ReconciliationTreatment>(
      "requires_owner_review"
    );
  const [proposedAmount, setProposedAmount] = useState(""),
    [notes, setNotes] = useState(""),
    [draftConfirmed, setDraftConfirmed] = useState(false),
    [draftError, setDraftError] = useState("");
  const scope = { viewerId, access };
  const query = trpc.financialReconciliation.items.useQuery(
    { ...scope, ...filter, limit: 20 },
    {
      enabled: active,
      staleTime: 5 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );
  const data =
    active &&
    !query.error &&
    !query.isFetching &&
    query.data?.viewerId === viewerId &&
    query.data.access === access
      ? query.data
      : undefined;
  const refreshQueue = async () => {
    setFilter(value => ({ ...value, before: undefined }));
    setPrevious([]);
    await Promise.all([
      utils.financialReconciliation.items.invalidate(scope),
      onChanged(),
    ]);
  };
  const saveDraft = trpc.financialReconciliation.updateDraft.useMutation({
    onSuccess: () => {
      setDraft(null);
      toast.success(
        text(
          "Proposal and audit saved; no income recognized.",
          "تم حفظ الاقتراح والتدقيق دون احتساب دخل."
        )
      );
      void refreshQueue();
    },
    onError: error => {
      setDraftConfirmed(false);
      setDraftError(error.message);
      if (isFinanceAccessDenied(error)) onAccessFailure(error);
    },
  });
  const apply = () => {
    const value = exactId.trim(),
      id = Number(value);
    if (
      value &&
      (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0)
    ) {
      setFilterError(
        text("Use a positive exact numeric ID.", "أدخل رقم سجل صحيحًا وموجبًا.")
      );
      return;
    }
    setFilterError("");
    setPrevious([]);
    setFilter({
      ...draftFilter,
      before: undefined,
      exact: value ? { type: exactType, id } : undefined,
    });
  };
  const clear = () => {
    setDraftFilter(initialFilter);
    setFilter(initialFilter);
    setExactId("");
    setExactType("item");
    setPrevious([]);
    setFilterError("");
  };
  const edit = (item: ReconciliationItem) => {
    setDraft(item);
    setTreatment(
      RECONCILIATION_TREATMENTS.includes(item.proposedTreatment as any)
        ? (item.proposedTreatment as ReconciliationTreatment)
        : "requires_owner_review"
    );
    setProposedAmount(
      item.proposedAmountIlsMinor == null
        ? ""
        : String(item.proposedAmountIlsMinor / 100)
    );
    setNotes(item.notes ?? "");
    setDraftConfirmed(false);
    setDraftError("");
  };
  const amountMinor = proposedAmount.trim()
    ? parseReconciliationIls(proposedAmount)
    : null;
  const draftValid =
    !!draft?.draftVersion &&
    (!proposedAmount.trim() || amountMinor !== null) &&
    notes.length <= 1000;
  const save = () => {
    if (
      !active ||
      !draft ||
      !draftValid ||
      !draftConfirmed ||
      saveDraft.isPending
    )
      return;
    saveDraft.mutate({
      itemId: draft.id,
      proposedTreatment: treatment,
      proposedAmountIlsMinor: amountMinor,
      notes,
      expectedDraftVersion: draft.draftVersion,
    });
  };
  const selectClass =
    "block min-h-11 w-full min-w-0 max-w-full rounded-md border bg-background px-2 text-sm";
  return (
    <>
      <section
        hidden={!active}
        aria-label={text("Historical review queue", "قائمة المراجعة التاريخية")}
        className="overflow-hidden rounded-xl border bg-white"
      >
        <div className="space-y-4 border-b p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">
                {text("Historical review queue", "قائمة المراجعة التاريخية")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {text(
                  "20 candidates per page. Summary counts above cover all statuses; these filters affect only this list.",
                  "20 مرشحًا لكل صفحة. مؤشرات الملخص أعلاه تشمل كل الحالات؛ تؤثر هذه المرشحات على القائمة فقط."
                )}
              </p>
            </div>
            <Button
              variant="outline"
              disabled={query.isFetching || saveDraft.isPending}
              onClick={() => void query.refetch()}
            >
              {text("Refresh queue", "تحديث القائمة")}
            </Button>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="history-status">
                {text("Review status", "حالة المراجعة")}
              </Label>
              <select
                id="history-status"
                className={selectClass}
                value={draftFilter.status}
                onChange={e =>
                  setDraftFilter(v => ({
                    ...v,
                    status: e.target.value as ReconciliationFilter["status"],
                  }))
                }
              >
                {RECONCILIATION_STATUSES.map(value => (
                  <option key={value} value={value}>
                    {reconciliationLabel(value, language)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="history-source">
                {text("Source type", "نوع المصدر")}
              </Label>
              <select
                id="history-source"
                className={selectClass}
                value={draftFilter.sourceType ?? ""}
                onChange={e =>
                  setDraftFilter(v => ({
                    ...v,
                    sourceType: e.target.value
                      ? (e.target.value as ReconciliationFilter["sourceType"])
                      : undefined,
                  }))
                }
              >
                <option value="">{text("All sources", "كل المصادر")}</option>
                {RECONCILIATION_SOURCES.map(value => (
                  <option key={value} value={value}>
                    {reconciliationLabel(value, language)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="history-treatment">
                {text("Proposed treatment", "المعالجة المقترحة")}
              </Label>
              <select
                id="history-treatment"
                className={selectClass}
                value={draftFilter.treatment ?? ""}
                onChange={e =>
                  setDraftFilter(v => ({
                    ...v,
                    treatment: e.target.value
                      ? (e.target.value as ReconciliationTreatment)
                      : undefined,
                  }))
                }
              >
                <option value="">
                  {text("All treatments", "كل المعالجات")}
                </option>
                {RECONCILIATION_TREATMENTS.map(value => (
                  <option key={value} value={value}>
                    {reconciliationLabel(value, language)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="history-confidence">
                {text("Candidate confidence", "ثقة تصنيف المرشح")}
              </Label>
              <select
                id="history-confidence"
                className={selectClass}
                value={draftFilter.confidence ?? ""}
                onChange={e =>
                  setDraftFilter(v => ({
                    ...v,
                    confidence: e.target.value
                      ? (e.target.value as ReconciliationFilter["confidence"])
                      : undefined,
                  }))
                }
              >
                <option value="">
                  {text("All confidence levels", "كل مستويات الثقة")}
                </option>
                {RECONCILIATION_CONFIDENCE.map(value => (
                  <option key={value} value={value}>
                    {reconciliationLabel(value, language)}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="history-id-type">
                {text("Exact ID type", "نوع الرقم المحدد")}
              </Label>
              <select
                id="history-id-type"
                className={selectClass}
                value={exactType}
                onChange={e => setExactType(e.target.value as typeof exactType)}
              >
                <option value="item">
                  {text("Review item", "عنصر مراجعة")}
                </option>
                <option value="order">{text("Order", "طلب")}</option>
                <option value="key">{text("Key", "مفتاح")}</option>
              </select>
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="history-exact-id">
                {text("Exact ID (optional)", "الرقم المحدد (اختياري)")}
              </Label>
              <Input
                id="history-exact-id"
                dir="ltr"
                inputMode="numeric"
                value={exactId}
                onChange={e => setExactId(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={apply}
              disabled={query.isFetching || saveDraft.isPending}
            >
              {text("Apply filters", "تطبيق المرشحات")}
            </Button>
            <Button
              variant="outline"
              onClick={clear}
              disabled={query.isFetching || saveDraft.isPending}
            >
              {text("Clear filters", "مسح المرشحات")}
            </Button>
          </div>
          {filterError && (
            <p role="alert" className="text-sm text-red-800">
              {filterError}
            </p>
          )}
          <p className="break-words text-xs text-muted-foreground">
            {text("Applied: ", "المطبّق: ")}
            {reconciliationLabel(filter.status, language)}
            {filter.sourceType
              ? ` · ${reconciliationLabel(filter.sourceType, language)}`
              : ""}
            {filter.treatment
              ? ` · ${reconciliationLabel(filter.treatment, language)}`
              : ""}
            {filter.confidence
              ? ` · ${reconciliationLabel(filter.confidence, language)}`
              : ""}
            {filter.exact
              ? ` · ${text("Exact", "الرقم المحدد")} ${filter.exact.type === "item" ? text("review item", "عنصر مراجعة") : filter.exact.type === "order" ? text("order", "طلب") : text("key", "مفتاح")} #${filter.exact.id}`
              : ""}
          </p>
        </div>
        {!data ? (
          <div
            role={query.isFetching ? "status" : "alert"}
            className="p-5 text-sm"
          >
            <p>
              {query.isFetching
                ? text("Loading review page…", "جارٍ تحميل صفحة المراجعة…")
                : text(
                    "The review page could not be verified. Retry before reviewing candidates.",
                    "تعذر التحقق من صفحة المراجعة. أعد المحاولة قبل مراجعة المرشحين."
                  )}
            </p>
            {!query.isFetching && (
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => void query.refetch()}
              >
                {text("Retry queue", "إعادة تحميل القائمة")}
              </Button>
            )}
          </div>
        ) : (
          <>
            {!data.items.length ? (
              <p className="p-5 text-sm text-muted-foreground">
                {text(
                  "No matching review items. The summary above is unfiltered.",
                  "لا توجد عناصر مراجعة مطابقة. الملخص أعلاه غير مقيّد بالمرشحات."
                )}
              </p>
            ) : (
              <div className="divide-y">
                {data.items.map(item => (
                  <article
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-3 p-4"
                  >
                    <div className="min-w-0 flex-1 space-y-1 break-words text-sm">
                      <h3 className="font-semibold">
                        {reconciliationLabel(item.issueType, language)}
                      </h3>
                      <p>
                        {reconciliationLabel(item.sourceType, language)}{" "}
                        <bdi>#{item.sourceReference}</bdi> ·{" "}
                        {text("Review item", "عنصر مراجعة")}{" "}
                        <bdi>#{item.id}</bdi>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reconciliationLabel(item.confidenceLevel, language)} ·{" "}
                        {reconciliationLabel(item.proposedTreatment, language)}
                      </p>
                      {item.proposedAmountIlsMinor != null && (
                        <p>
                          {text("Proposed value only: ", "قيمة مقترحة فقط: ")}
                          <bdi>{money(item.proposedAmountIlsMinor)}</bdi>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {text("Updated: ", "آخر تحديث: ")}
                        {formatHistoricalReviewDate(
                          item.updatedAt,
                          language
                        )} · {text("Palestine time", "بتوقيت فلسطين")}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.status === "unresolved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => edit(item)}
                        >
                          {text("Edit proposal", "تعديل الاقتراح")}
                        </Button>
                      )}
                      {access === "owner" && (
                        <Button size="sm" onClick={() => setSelected(item.id)}>
                          {text("Review source", "مراجعة المصدر")}
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
              <p className="text-xs text-muted-foreground">
                {text(
                  `Page ${previous.length + 1}; ${data.items.length} matching items.`,
                  `الصفحة ${previous.length + 1}؛ ${data.items.length} عنصر مطابق.`
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!previous.length}
                  onClick={() => {
                    setFilter(v => ({ ...v, before: previous.at(-1) }));
                    setPrevious(v => v.slice(0, -1));
                  }}
                >
                  {text("Previous", "السابق")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!data.nextCursor}
                  onClick={() => {
                    if (data.nextCursor) {
                      setPrevious(v => [...v, filter.before]);
                      setFilter(v => ({ ...v, before: data.nextCursor! }));
                    }
                  }}
                >
                  {text("Next", "التالي")}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
      <HistoricalSourceDecisionDialog
        key={selected ?? "none"}
        itemId={selected}
        viewerId={viewerId}
        visible={active && access === "owner"}
        onClose={() => setSelected(null)}
        onChanged={refreshQueue}
        onAccessFailure={onAccessFailure}
      />
      <Dialog
        open={active && draft !== null}
        onOpenChange={open => {
          if (!open && !saveDraft.isPending) setDraft(null);
        }}
      >
        <DialogContent
          className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col overflow-hidden p-0"
          dir={ar ? "rtl" : "ltr"}
          showCloseButton={false}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute end-2 top-2 h-11 w-11"
            aria-label={text("Close proposal", "إغلاق الاقتراح")}
            disabled={saveDraft.isPending}
            onClick={() => setDraft(null)}
          >
            <X className="h-4 w-4" />
          </Button>
          <DialogHeader className="shrink-0 p-4 pe-14">
            <DialogTitle>
              {text("Edit proposal", "تعديل الاقتراح")}{" "}
              <bdi>#{draft?.id ?? ""}</bdi>
            </DialogTitle>
            <DialogDescription>
              {text(
                "This updates a candidate classification and audit only. It does not recognize cash or prove that payment happened.",
                "يحدّث هذا تصنيف المرشح وتدقيقه فقط. لا يحتسب أموالًا ولا يثبت حدوث دفع."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 space-y-3 overflow-y-auto px-4 pb-4">
            <Label htmlFor="history-draft-treatment">
              {text("Proposed treatment", "المعالجة المقترحة")}
            </Label>
            <select
              id="history-draft-treatment"
              className={selectClass}
              value={treatment}
              disabled={saveDraft.isPending}
              onChange={e => {
                setTreatment(e.target.value as ReconciliationTreatment);
                setDraftConfirmed(false);
              }}
            >
              {RECONCILIATION_TREATMENTS.map(value => (
                <option key={value} value={value}>
                  {reconciliationLabel(value, language)}
                </option>
              ))}
            </select>
            <Label htmlFor="history-proposed-amount">
              {text(
                "Proposed ILS value (optional)",
                "القيمة المقترحة بالشيكل (اختياري)"
              )}
            </Label>
            <Input
              id="history-proposed-amount"
              dir="ltr"
              inputMode="decimal"
              value={proposedAmount}
              disabled={saveDraft.isPending}
              onChange={e => {
                setProposedAmount(e.target.value);
                setDraftConfirmed(false);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {text(
                "Leave unknown amounts blank. A saved proposal is not a confirmed receipt.",
                "اترك المبلغ غير المعروف فارغًا. الاقتراح المحفوظ ليس دفعة مؤكدة."
              )}
            </p>
            <Label htmlFor="history-draft-notes">
              {text("Evidence notes", "ملاحظات الإثبات")}
            </Label>
            <Textarea
              id="history-draft-notes"
              value={notes}
              maxLength={1000}
              disabled={saveDraft.isPending}
              onChange={e => {
                setNotes(e.target.value);
                setDraftConfirmed(false);
              }}
            />
            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={draftConfirmed}
                disabled={saveDraft.isPending}
                onCheckedChange={value => setDraftConfirmed(value === true)}
              />
              <span>
                {text(
                  "I reviewed this proposal; no income is recognized by saving it.",
                  "راجعت هذا الاقتراح؛ حفظه لا يحتسب أي دخل."
                )}
              </span>
            </label>
            {(!draftValid || draftError) && (
              <p role="alert" className="text-sm text-red-800">
                {draftError ||
                  text(
                    "Verify the proposal version and use a valid nonzero amount or leave it blank.",
                    "تحقق من نسخة الاقتراح وأدخل مبلغًا صحيحًا غير صفري أو اتركه فارغًا."
                  )}
              </p>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t p-4">
            <Button
              variant="outline"
              disabled={saveDraft.isPending}
              onClick={() => setDraft(null)}
            >
              {text("Back without changes", "رجوع دون تغيير")}
            </Button>
            <Button
              disabled={!draftValid || !draftConfirmed || saveDraft.isPending}
              onClick={save}
            >
              {saveDraft.isPending
                ? text("Saving…", "جارٍ الحفظ…")
                : text("Save proposal", "حفظ الاقتراح")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
