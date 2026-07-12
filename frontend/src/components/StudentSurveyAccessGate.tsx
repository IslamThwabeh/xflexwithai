import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import ClientLayout from "@/components/ClientLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ClipboardCheck, Headphones } from "lucide-react";

const SURVEY_BLOCK_ALLOWLIST = ["/surveys", "/support"];

function isSurveyBlockAllowedRoute(path: string) {
  return SURVEY_BLOCK_ALLOWLIST.some((allowed) => path === allowed || path.startsWith(`${allowed}/`));
}

export default function StudentSurveyAccessGate({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const availabilityQuery = trpc.studentSurveys.availability.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
  });

  const path = location.split("?")[0] || "/";
  const shouldBlock = Boolean(
    availabilityQuery.data?.enabled &&
    availabilityQuery.data?.blockingEnabled &&
    availabilityQuery.data?.access === "student" &&
    availabilityQuery.data?.accessState === "blocked" &&
    !isSurveyBlockAllowedRoute(path),
  );

  if (!shouldBlock) {
    return <>{children}</>;
  }

  const copy = isRtl ? {
    title: "يلزم مراجعة الاستبيان قبل المتابعة",
    body: "انتهت مهلة استبيان مطلوب. يمكنك فتح صفحة الاستبيانات لمعرفة الحالة أو التواصل مع الدعم للمراجعة. تم إبقاء هذا الحجب خلف مفتاح تفعيل منفصل حتى لا يؤثر على التجارب المحدودة بالخطأ.",
    survey: "فتح الاستبيانات",
    support: "التواصل مع الدعم",
    noteTitle: "ملاحظة أمان",
    noteBody: "صفحات الاستبيانات والدعم تبقى متاحة دائماً حتى عند تفعيل الحجب التدريجي.",
  } : {
    title: "Survey review required before continuing",
    body: "A required survey has passed its blocking deadline. You can open Surveys to review the status or contact Support for help. This enforcement stays behind a separate feature flag so limited pilots are not blocked by accident.",
    survey: "Open surveys",
    support: "Contact support",
    noteTitle: "Safety note",
    noteBody: "Surveys and Support remain available even when gradual blocking is enabled.",
  };

  return (
    <ClientLayout>
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[var(--color-xf-cream)] px-4 py-10">
        <Card className="max-w-2xl">
          <CardContent className="space-y-5 pt-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900">{copy.title}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-600">{copy.body}</p>
            </div>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/surveys">
                <Button className="w-full bg-emerald-700 hover:bg-emerald-800 sm:w-auto">
                  <ClipboardCheck className="h-4 w-4" />
                  {copy.survey}
                </Button>
              </Link>
              <Link href="/support">
                <Button variant="outline" className="w-full sm:w-auto">
                  <Headphones className="h-4 w-4" />
                  {copy.support}
                </Button>
              </Link>
            </div>
            <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
              <ClipboardCheck className="h-4 w-4" />
              <AlertTitle>{copy.noteTitle}</AlertTitle>
              <AlertDescription>{copy.noteBody}</AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}
