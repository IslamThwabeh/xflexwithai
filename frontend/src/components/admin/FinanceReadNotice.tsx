import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

export default function FinanceReadNotice({
  title,
  state,
  onRetry,
}: {
  title: string;
  state: "loading" | "denied" | "failure";
  onRetry: () => void;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const message =
    state === "loading"
      ? ar
        ? "جارٍ التحقق من الصلاحيات وتحميل العرض…"
        : "Checking access and loading the workspace…"
      : state === "denied"
        ? ar
          ? "لا تملك صلاحية هذا العرض المالي، أو تغيّرت صلاحياتك. أعد التحقق من الوصول."
          : "This financial workspace is not available with your current access. Recheck your access."
        : ar
          ? "تعذّر تحميل البيانات المالية أو التحقق منها. أعد المحاولة قبل المراجعة أو إجراء أي تغيير."
          : "The financial data could not be loaded or verified. Retry before reviewing or changing records.";
  return (
    <DashboardLayout>
      <main className="space-y-4" dir={ar ? "rtl" : "ltr"}>
        <h1 className="text-2xl font-bold">{title}</h1>
        <div
          role={state === "loading" ? "status" : "alert"}
          className="rounded-xl border p-5"
        >
          <p>{message}</p>
          {state !== "loading" && (
            <Button className="mt-3" variant="outline" onClick={onRetry}>
              {ar ? "إعادة المحاولة" : "Retry"}
            </Button>
          )}
        </div>
      </main>
    </DashboardLayout>
  );
}
