import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type FinancialActionReview = {
  title: string;
  lines: string[];
  confirm: () => void;
};
export default function FinancialActionConfirmation({
  review,
  busy,
  onClose,
}: {
  review: FinancialActionReview | null;
  busy: boolean;
  onClose: () => void;
}) {
  const { language } = useLanguage(),
    ar = language === "ar",
    [accepted, setAccepted] = useState(false);
  useEffect(() => setAccepted(false), [review]);
  return (
    <Dialog
      open={!!review}
      onOpenChange={open => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        dir={ar ? "rtl" : "ltr"}
        className="max-h-[calc(100dvh-1rem)] overflow-y-auto"
      >
        <DialogHeader className="text-start">
          <DialogTitle>{review?.title}</DialogTitle>
          <DialogDescription>
            {ar
              ? "راجع التفاصيل قبل تنفيذ الإجراء. يبقى التحقق من الصلاحية والحالة والفترة مطلوباً عند الحفظ."
              : "Review the details before proceeding. Authority, current state and period controls are checked again when saving."}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 break-words text-sm">
          {review?.lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={accepted}
            disabled={busy}
            onCheckedChange={value => setAccepted(value === true)}
          />
          <span>
            {ar
              ? "راجعت التفاصيل وأؤكد هذا الإجراء."
              : "I reviewed the details and confirm this action."}
          </span>
        </label>
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            {ar ? "رجوع دون تغيير" : "Back without changes"}
          </Button>
          <Button
            disabled={!accepted || busy}
            onClick={() => {
              if (accepted && !busy) review?.confirm();
            }}
          >
            {busy
              ? ar
                ? "جاري الحفظ..."
                : "Saving…"
              : ar
                ? "تأكيد الإجراء"
                : "Confirm action"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
