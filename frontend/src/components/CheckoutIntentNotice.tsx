import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { CheckoutIntentState } from "@/lib/useCheckoutIntent";

export default function CheckoutIntentNotice({
  intent,
  busy,
  onNewPrepared,
}: {
  intent: CheckoutIntentState;
  busy: boolean;
  onNewPrepared: () => void;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    setConfirming(false);
  }, [intent.contextKey]);
  if (intent.error)
    return (
      <p
        role="alert"
        className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
      >
        {intent.error === "customer_account_required"
          ? ar
            ? "استخدم حساب طالب لإنشاء طلب شراء."
            : "Use a customer account to create a purchase request."
          : ar
            ? "تعذّر تجهيز الطلب. حدّث الصفحة وأعد المحاولة."
            : "The request could not be prepared. Reload the page and retry."}
      </p>
    );
  return (
    <>
      {intent.hasRecord ? (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
          <p>
            {intent.freshChoice
              ? ar
                ? "جهّزنا طلباً منفصلاً. راجع التفاصيل ثم اضغط زر الإرسال لإنشائه؛ الطلب السابق يبقى محفوظاً."
                : "A separate request is prepared. Review the details and submit below to create it; your earlier request remains preserved."
              : intent.activeOrderId
                ? ar
                  ? "يوجد طلب سابق محفوظ لهذا الاختيار. إعادة الإرسال تفتح نفس الطلب دون إنشاء نسخة أخرى."
                  : "An earlier request is saved for this selection. Submitting again opens the same request without creating another copy."
                : ar
                  ? "قد تكون المحاولة السابقة قيد الحفظ. أعد الإرسال لمتابعة نفس الطلب؛ لا تنشئ طلباً منفصلاً لمجرد تأخر الرد."
                  : "An earlier submission may still be saving. Submit again to resume it; a delayed response does not require a separate request."}
          </p>
          <div className="flex flex-wrap gap-2">
            {intent.priorOrderId && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/orders/${intent.priorOrderId}`}>
                  {intent.activeOrderId
                    ? ar
                      ? `فتح الطلب #${intent.priorOrderId}`
                      : `Open request #${intent.priorOrderId}`
                    : ar
                      ? `فتح الطلب السابق #${intent.priorOrderId}`
                      : `Open earlier request #${intent.priorOrderId}`}
                </Link>
              </Button>
            )}
            {!intent.freshChoice && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !intent.ready}
                onClick={() => setConfirming(true)}
              >
                {ar ? "تجهيز طلب آخر" : "Start another request"}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer">
            {ar ? "هل سبق أن أرسلت طلباً؟" : "Already placed a request?"}
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/orders">{ar ? "عرض طلباتي" : "View my orders"}</Link>
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || !intent.ready}
              onClick={() => setConfirming(true)}
            >
              {ar ? "تجهيز طلب آخر" : "Start another request"}
            </Button>
          </div>
        </details>
      )}
      <Dialog
        open={confirming}
        onOpenChange={open => {
          if (!busy) setConfirming(open);
        }}
      >
        <DialogContent
          dir={ar ? "rtl" : "ltr"}
          className="max-h-[calc(100dvh-1rem)] overflow-y-auto"
        >
          <DialogHeader className="text-start">
            <DialogTitle>
              {ar ? "هل تريد طلباً منفصلاً؟" : "Prepare a separate request?"}
            </DialogTitle>
            <DialogDescription>
              {ar
                ? "هذا لا يلغي الطلب السابق ولا يغيّر أي دفعة. إذا أرسلت حوالة من قبل، افتح الطلب السابق وراجع الإيصال أولاً. لن يُنشأ الطلب الآخر قبل مراجعة التفاصيل والموافقة على الشروط والإرسال."
                : "This does not cancel an earlier request or change a payment. If you already transferred money, open the earlier request and review its receipt first. The separate request is created only after you review its details, accept the terms and submit."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {ar ? "رجوع" : "Back"}
            </Button>
            <Button
              type="button"
              disabled={busy || !intent.ready}
              onClick={() => {
                if (intent.startAnother()) {
                  onNewPrepared();
                  setConfirming(false);
                }
              }}
            >
              {ar ? "نعم، أجهّز طلباً منفصلاً" : "Yes, prepare another request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
