import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ORDER_CANCELLATION_MESSAGES,
  ORDER_REVIEW_STATUS_LABELS,
} from "@shared/orderCancellation";
import { formatAcademyDateTime } from "@shared/academyLocale";
import OrderRelatedHistory from "./OrderRelatedHistory";

type ReviewOrder = {
  id: number;
  userName?: string | null;
  userEmail?: string | null;
  packageItems?: Array<{
    packageNameEn?: string | null;
    packageNameAr?: string | null;
  }>;
};

export default function OrderCancellationDialog({
  order,
  onClose,
  onCancelled,
}: {
  order: ReviewOrder;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const query = trpc.orders.adminCancellationReview.useQuery(
    { orderId: order.id },
    {
      retry: false,
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    }
  );
  const review =
    !query.error && query.data?.orderId === order.id ? query.data : undefined;
  const utils = trpc.useUtils();
  const cancel = trpc.orders.adminUpdateStatus.useMutation({
    onSuccess: () => {
      void utils.orders.adminList.invalidate();
      void utils.orders.adminStatusHistory.invalidate({ orderId: order.id });
      toast.success(
        ar
          ? "تم إلغاء الطلب غير المدفوع وحفظ السبب في سجل المتابعة."
          : "Unpaid request cancelled and reason saved in its audit history."
      );
      onCancelled();
    },
    onError: error => {
      toast.error(error.message);
      setConfirmed(false);
      void query.refetch();
      void utils.orders.adminList.invalidate();
      void utils.orders.adminStatusHistory.invalidate({ orderId: order.id });
    },
  });
  const busy = cancel.isPending;
  const proofUrl = (() => {
    try {
      const value = new URL(review?.version.paymentProofUrl ?? "");
      return value.protocol === "https:" ? value.href : null;
    } catch {
      return null;
    }
  })();
  const submit = () => {
    if (!review?.canCancel || !confirmed || reason.trim().length < 5 || busy)
      return;
    cancel.mutate({
      orderId: order.id,
      status: "cancelled",
      reason: reason.trim(),
      cancellationReview: {
        confirmed: true,
        version: {
          ...review.version,
          status: review.version.status as "pending" | "awaiting_confirmation",
        },
      },
    });
  };
  const flag = (value: boolean) =>
    value ? (ar ? "نعم" : "Yes") : ar ? "لا" : "No";
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        dir={ar ? "rtl" : "ltr"}
        className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <button
          type="button"
          aria-label={ar ? "إغلاق" : "Close"}
          disabled={busy}
          onClick={onClose}
          className="absolute end-2 top-2 flex h-11 w-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>
        <DialogHeader className="shrink-0 p-4 pe-14 text-start sm:p-6 sm:pe-14">
          <DialogTitle>
            {ar
              ? `مراجعة إلغاء الطلب #${order.id}`
              : `Review cancellation of order #${order.id}`}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? "راجع الطلب والأدلة والطلبات المرتبطة قبل اتخاذ القرار. الطلب وسجلاته تبقى محفوظة."
              : "Review the request, evidence and related orders before deciding. The order and its records remain preserved."}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 pt-0 sm:px-6">
          <p className="break-words text-sm">
            {order.userName || order.userEmail || `#${order.id}`} ·{" "}
            {order.packageItems
              ?.map(item => (ar ? item.packageNameAr : item.packageNameEn))
              .filter(Boolean)
              .join("، ")}
          </p>
          {query.isFetching ? (
            <p role="status">
              {ar
                ? "جارٍ تحميل المراجعة الحالية…"
                : "Loading the current review…"}
            </p>
          ) : !review ? (
            <div role="alert" className="space-y-2">
              <p>
                {ar
                  ? "تعذّر تحميل مراجعة موثوقة. أعد المحاولة قبل أي تغيير."
                  : "A verified review could not be loaded. Retry before making a change."}
              </p>
              <Button variant="outline" onClick={() => void query.refetch()}>
                {ar ? "إعادة المحاولة" : "Retry"}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium">
                {ar ? "حالة الطلب الحالية: " : "Current order status: "}
                {ORDER_REVIEW_STATUS_LABELS[review.facts.status]?.[language] ??
                  (ar ? "غير معروفة" : "Unknown")}
              </p>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {ar ? "آخر تغيير للطلب: " : "Order last changed: "}
                  {formatAcademyDateTime(
                    review.version.updatedAt,
                    language
                  )} · {ar ? "بتوقيت فلسطين" : "Palestine time"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setConfirmed(false);
                    void query.refetch();
                  }}
                >
                  {ar ? "إعادة فحص الحالة" : "Recheck current state"}
                </Button>
              </div>
              <dl className="grid grid-cols-1 gap-2 rounded-xl border p-3 text-sm sm:grid-cols-2">
                {[
                  [
                    ar ? "إيصال مرفق" : "Receipt attached",
                    review.facts.receiptPresent,
                  ],
                  [
                    ar ? "دفع مؤكد" : "Confirmed payment",
                    review.facts.paymentConfirmed,
                  ],
                  [
                    ar ? "مفاتيح صادرة" : "Keys issued",
                    review.facts.keysIssued,
                  ],
                  [
                    ar ? "قيود مالية مرتبطة" : "Linked financial records",
                    review.facts.financialHistory,
                  ],
                  [
                    ar
                      ? "سجل وصول أو خدمة مرتبط"
                      : "Linked service/access history",
                    review.facts.accessHistory,
                  ],
                  [
                    ar ? "سجل استبدال محفوظ" : "Existing retirement record",
                    review.facts.retired,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="flex justify-between gap-3"
                  >
                    <dt>{label}</dt>
                    <dd className="font-semibold">{flag(Boolean(value))}</dd>
                  </div>
                ))}
              </dl>
              {proofUrl && (
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-emerald-700 underline"
                >
                  {ar
                    ? "فتح الإيصال الحالي للمراجعة"
                    : "Open current receipt for review"}
                </a>
              )}
              {review.block && (
                <p
                  role="alert"
                  className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                >
                  {ORDER_CANCELLATION_MESSAGES[review.block][language]}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "الإيصال وحده لا يثبت القبض. إلغاء طلب بإيصال يتطلب مراجعة المالية، وأي دفع مؤكد أو مفتاح أو سجل مالي/وصول مرتبط يمنع الإلغاء العادي."
                  : "An attachment alone does not establish receipt of money. Receipt-bearing cancellation requires finance review; confirmed payment, keys or linked financial/access history block ordinary cancellation."}
              </p>
              <OrderRelatedHistory orderId={order.id} />
              {review.canCancel && (
                <div className="space-y-3">
                  <Label htmlFor="order-cancellation-reason">
                    {ar
                      ? "سبب الإلغاء الموثّق (إلزامي)"
                      : "Documented cancellation reason (required)"}
                  </Label>
                  <Textarea
                    id="order-cancellation-reason"
                    minLength={5}
                    maxLength={500}
                    value={reason}
                    disabled={busy}
                    onChange={event => {
                      setReason(event.target.value);
                      setConfirmed(false);
                    }}
                  />
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="order-cancellation-confirm"
                      checked={confirmed}
                      disabled={busy}
                      onCheckedChange={value => setConfirmed(value === true)}
                    />
                    <Label
                      htmlFor="order-cancellation-confirm"
                      className="text-sm leading-6"
                    >
                      {review.facts.receiptPresent
                        ? ar
                          ? "راجعت الإيصال والمصادر المالية وأؤكد أن هذا الطلب غير المدفوع يجب إلغاؤه للسبب أعلاه."
                          : "I reviewed the receipt and financial sources and confirm this unpaid request should be cancelled for the reason above."
                        : ar
                          ? "راجعت تفاصيل الطلب والطلبات المرتبطة وأؤكد الإلغاء للسبب أعلاه."
                          : "I reviewed the request and related orders and confirm cancellation for the reason above."}
                    </Label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="shrink-0 gap-2 border-t p-4 sm:px-6">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={busy}
            onClick={onClose}
          >
            {ar ? "العودة دون تغيير" : "Back without changes"}
          </Button>
          <Button
            variant="destructive"
            className="min-h-11"
            disabled={
              busy ||
              query.isFetching ||
              !review?.canCancel ||
              !confirmed ||
              reason.trim().length < 5
            }
            onClick={submit}
          >
            {busy
              ? ar
                ? "جارٍ الحفظ…"
                : "Saving…"
              : ar
                ? "تأكيد إلغاء الطلب"
                : "Confirm cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
