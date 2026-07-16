import { useState, type ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLegalVersionLinks } from "@/lib/legalVersions";
import { trpc } from "@/lib/trpc";
import { FileCheck2, Loader2, LogOut, ShieldCheck } from "lucide-react";

const LEGAL_REVIEW_PATHS = new Set([
  "/ar/terms",
  "/en/terms",
  "/ar/refund-policy",
  "/en/refund-policy",
  "/ar/privacy",
  "/en/privacy",
]);

export default function TermsAcceptanceGate({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const [confirmed, setConfirmed] = useState(false);
  const utils = trpc.useUtils();
  const isLegalReviewPath = typeof window !== "undefined" && LEGAL_REVIEW_PATHS.has(window.location.pathname);

  const statusQuery = trpc.auth.termsStatus.useQuery(undefined, {
    enabled: isAuthenticated && !isLegalReviewPath,
    retry: false,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const acceptMutation = trpc.auth.acceptTerms.useMutation({
    onSuccess: async () => {
      await utils.auth.termsStatus.invalidate();
    },
  });

  if (isLegalReviewPath || (!authLoading && !user)) return <>{children}</>;

  if (authLoading || (isAuthenticated && statusQuery.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <Loader2 className="h-9 w-9 animate-spin text-emerald-400" />
      </div>
    );
  }

  if (!statusQuery.data?.requiresAcceptance) {
    if (statusQuery.error && isAuthenticated) {
      return (
        <GateShell isRtl={isRtl}>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">
            {isRtl
              ? "تعذر التحقق من حالة الموافقة حالياً. لم يتم فتح خدمات الحساب لحماية سجلّك. يرجى المحاولة لاحقاً أو التواصل مع الدعم."
              : "We could not verify your acceptance status. Account services remain closed to protect your record. Please try again or contact support."}
          </div>
          <Button variant="outline" onClick={() => logout()} className="mt-5 w-full">
            <LogOut className="me-2 h-4 w-4" />
            {isRtl ? "تسجيل الخروج" : "Sign out"}
          </Button>
        </GateShell>
      );
    }
    return <>{children}</>;
  }

  const version = statusQuery.data.currentVersion;
  const legalLinks = getLegalVersionLinks(version);

  return (
    <GateShell isRtl={isRtl}>
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        <FileCheck2 className="h-7 w-7" />
      </div>
      <h1 className="text-2xl font-bold text-slate-950">
        {isRtl ? "مطلوب قبول الشروط والأحكام" : "Terms acceptance required"}
      </h1>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        {isRtl
          ? "قبل متابعة استخدام الباقة والخدمات، نحتاج موافقتك الصريحة على الشروط والأحكام وسياسة الاسترداد. لن نعتبرك موافقاً إلا بعد اختيار مربع الموافقة والضغط على الزر أدناه."
          : "Before continuing to your package and services, we need your explicit acceptance of the Terms & Conditions and Refund Policy. We will not record acceptance until you check the box and press the button below."}
      </p>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-slate-800">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>{user?.email}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {isRtl ? `نسخة المستند: ${version}` : `Document version: ${version}`}
        </p>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <Button asChild variant="outline">
          <a href={legalLinks.terms} target="_blank" rel="noopener noreferrer">
            {isRtl ? "قراءة الشروط والأحكام" : "Read Terms & Conditions"}
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={legalLinks.refund} target="_blank" rel="noopener noreferrer">
            {isRtl ? "قراءة سياسة الاسترداد" : "Read Refund Policy"}
          </a>
        </Button>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
        <Checkbox
          checked={confirmed}
          onCheckedChange={(value) => setConfirmed(value === true)}
          className="mt-0.5"
        />
        <span>
          {isRtl
            ? "أقر بأنني قرأت وفهمت وأوافق على الشروط والأحكام وسياسة الاسترداد."
            : "I confirm that I have read, understood, and agree to the Terms & Conditions and Refund Policy."}
        </span>
      </label>

      {acceptMutation.error && (
        <p className="mt-3 text-sm text-rose-700">
          {isRtl ? "تعذر حفظ الموافقة. يرجى المحاولة مرة أخرى." : "Acceptance could not be saved. Please try again."}
        </p>
      )}

      <Button
        className="mt-5 w-full bg-emerald-600 text-white hover:bg-emerald-700"
        size="lg"
        disabled={!confirmed || acceptMutation.isPending}
        onClick={() => acceptMutation.mutate({ accepted: true, termsVersion: version })}
      >
        {acceptMutation.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
        {isRtl ? "أوافق وأتابع إلى حسابي" : "Accept and continue to my account"}
      </Button>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
        <button type="button" onClick={() => logout()} className="underline underline-offset-4">
          {isRtl ? "لا أوافق — تسجيل الخروج" : "I do not agree — sign out"}
        </button>
        <a href="mailto:support@xflexacademy.com" className="underline underline-offset-4">
          {isRtl ? "التواصل مع الدعم" : "Contact support"}
        </a>
      </div>
    </GateShell>
  );
}

function GateShell({ children, isRtl }: { children: ReactNode; isRtl: boolean }) {
  return (
    <div className="min-h-screen bg-[#050505] px-4 py-10" dir={isRtl ? "rtl" : "ltr"}>
      <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-white p-6 shadow-2xl sm:p-9">
        {children}
      </div>
    </div>
  );
}
