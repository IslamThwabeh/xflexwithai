import { useEffect, useMemo, useState } from "react";
import { Briefcase, CheckCircle2, Clock, FileText, Loader2, ShieldCheck, XCircle } from "lucide-react";
import ClientLayout from "@/components/ClientLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

type ProfileForm = {
  headline: string;
  skills: string;
  experienceSummary: string;
  portfolioUrl: string;
  cvUrl: string;
  preferredRole: string;
  availability: string;
};

const emptyProfile: ProfileForm = {
  headline: "",
  skills: "",
  experienceSummary: "",
  portfolioUrl: "",
  cvUrl: "",
  preferredRole: "",
  availability: "",
};

const statusStyle: Record<string, string> = {
  submitted: "bg-amber-50 text-amber-700",
  resubmitted: "bg-indigo-50 text-indigo-700",
  returned: "bg-slate-100 text-slate-700",
  eligible: "bg-emerald-50 text-emerald-700",
  ineligible: "bg-red-50 text-red-700",
};

function reviewStatusLabel(status: string, isRtl: boolean) {
  const labels: Record<string, string> = isRtl
    ? { submitted: "بانتظار المراجعة", resubmitted: "أُعيد تقديمه", returned: "مُعاد لاستكمال البيانات", eligible: "مؤهل", ineligible: "غير مؤهل" }
    : { submitted: "Awaiting review", resubmitted: "Resubmitted", returned: "Returned for updates", eligible: "Eligible", ineligible: "Ineligible" };
  return labels[status] ?? status;
}

function eligibilityCheckLabel(key: string, isRtl: boolean) {
  const labels: Record<string, string> = isRtl
    ? { completedEpisodes: "الدروس المكتملة", completedQuizzes: "الاختبارات المجتازة", pointsBalance: "رصيد النقاط", activeSubscription: "الاشتراك النشط", profile: "الملف المهني" }
    : { completedEpisodes: "Completed lessons", completedQuizzes: "Passed quizzes", pointsBalance: "Points balance", activeSubscription: "Active subscription", profile: "Career profile" };
  return labels[key] ?? key;
}

function formatReviewHistoryDate(value: unknown, isRtl: boolean) {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : null;
  return date && Number.isFinite(date.getTime())
    ? date.toLocaleString(isRtl ? "ar-JO" : "en-GB")
    : (isRtl ? "وقت غير متاح" : "Time unavailable");
}

export default function StudentJobOpportunities() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const copy = isRtl
    ? {
        title: "فرص العمل للطلاب",
        subtitle: "أكمل ملفك المهني واطلب مراجعة أهليتك للفرص المناسبة.",
        disabledTitle: "الميزة غير مفعّلة حالياً",
        disabledBody: "تم تجهيز مسار أهلية الطلاب للوظائف، لكنه مخفي حتى تفعيل student_job_eligibility_enabled بموافقة منفصلة.",
        profile: "الملف المهني",
        headline: "العنوان المهني",
        preferredRole: "الدور المستهدف",
        availability: "التوفر",
        portfolioUrl: "رابط الأعمال",
        cvUrl: "رابط السيرة الذاتية",
        skills: "المهارات",
        experience: "ملخص الخبرة",
        save: "حفظ الملف",
        saving: "جاري الحفظ...",
        saved: "تم حفظ الملف",
        opportunities: "الفرص المتاحة",
        request: "طلب مراجعة الأهلية",
        resubmit: "إعادة تقديم الطلب",
        requesting: "جاري الإرسال...",
        requested: "تم إرسال طلب المراجعة",
        metrics: "مؤشراتك الحالية",
        completedEpisodes: "دروس مكتملة",
        completedQuizzes: "اختبارات مكتملة",
        points: "النقاط",
        activeSubscription: "اشتراك نشط",
        profileReady: "ملف مكتمل",
        noJobs: "لا توجد فرص مفعلة حالياً.",
        notePlaceholder: "ملاحظة اختيارية للمدير...",
        pendingBody: "طلبك لدى المدير الآن. لا تحتاج إلى إرساله مرة أخرى.",
        finalBody: "تم اتخاذ القرار النهائي لهذا الطلب.",
        managerNote: "ملاحظة المدير",
      }
    : {
        title: "Student Job Opportunities",
        subtitle: "Complete your career profile and request eligibility review for matching roles.",
        disabledTitle: "Feature is not enabled yet",
        disabledBody: "Student job eligibility is ready in code, but hidden until student_job_eligibility_enabled is enabled with separate approval.",
        profile: "Career profile",
        headline: "Professional headline",
        preferredRole: "Target role",
        availability: "Availability",
        portfolioUrl: "Portfolio URL",
        cvUrl: "CV URL",
        skills: "Skills",
        experience: "Experience summary",
        save: "Save profile",
        saving: "Saving...",
        saved: "Profile saved",
        opportunities: "Open opportunities",
        request: "Request eligibility review",
        resubmit: "Resubmit for review",
        requesting: "Submitting...",
        requested: "Eligibility review submitted",
        metrics: "Your current metrics",
        completedEpisodes: "Completed lessons",
        completedQuizzes: "Completed quizzes",
        points: "Points",
        activeSubscription: "Active subscription",
        profileReady: "Complete profile",
        noJobs: "No enabled opportunities right now.",
        notePlaceholder: "Optional note for the manager...",
        pendingBody: "Your request is with the manager now; no duplicate submission is needed.",
        finalBody: "A final decision has been recorded for this request.",
        managerNote: "Manager note",
      };

  const utils = trpc.useUtils();
  const { data: availability, isLoading: availabilityLoading } = trpc.studentJobEligibility.availability.useQuery(undefined, { retry: false });
  const enabled = availability?.enabled === true;
  const { data, isLoading } = trpc.studentJobEligibility.myOpportunities.useQuery(undefined, {
    enabled,
    retry: false,
  });
  const [profileForm, setProfileForm] = useState<ProfileForm>(emptyProfile);
  const [notes, setNotes] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!data?.profile) return;
    setProfileForm({
      headline: data.profile.headline ?? "",
      skills: data.profile.skills ?? "",
      experienceSummary: data.profile.experienceSummary ?? "",
      portfolioUrl: data.profile.portfolioUrl ?? "",
      cvUrl: data.profile.cvUrl ?? "",
      preferredRole: data.profile.preferredRole ?? "",
      availability: data.profile.availability ?? "",
    });
  }, [data?.profile]);

  const saveProfile = trpc.studentJobEligibility.updateMyProfile.useMutation({
    onSuccess: async () => {
      await utils.studentJobEligibility.myOpportunities.invalidate();
      toast.success(copy.saved);
    },
    onError: (error) => toast.error(error.message),
  });

  const submitReview = trpc.studentJobEligibility.submitReview.useMutation({
    onSuccess: async () => {
      await utils.studentJobEligibility.myOpportunities.invalidate();
      toast.success(copy.requested);
    },
    onError: (error) => toast.error(error.message),
  });

  const metrics = data?.metrics;
  const metricCards = useMemo(() => [
    { label: copy.completedEpisodes, value: metrics?.completedEpisodes ?? 0 },
    { label: copy.completedQuizzes, value: metrics?.completedQuizzes ?? 0 },
    { label: copy.points, value: metrics?.pointsBalance ?? 0 },
    { label: copy.activeSubscription, value: metrics?.hasActiveSubscription ? "✓" : "—" },
    { label: copy.profileReady, value: metrics?.hasProfile ? "✓" : "—" },
  ], [copy.activeSubscription, copy.completedEpisodes, copy.completedQuizzes, copy.points, copy.profileReady, metrics]);

  if (availabilityLoading) {
    return (
      <ClientLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </ClientLayout>
    );
  }

  if (!enabled) {
    return (
      <ClientLayout>
        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-emerald-600" />
            <h1 className="text-2xl font-bold">{copy.disabledTitle}</h1>
            <p className="mt-2 text-sm text-gray-500">{copy.disabledBody}</p>
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <Briefcase className="h-5 w-5" />
            <span className="text-sm font-semibold">{copy.title}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 md:text-3xl">{copy.title}</h1>
          <p className="mt-1 text-gray-500">{copy.subtitle}</p>
        </div>

        <section className="grid gap-3 md:grid-cols-5">
          {metricCards.map((card) => (
            <div key={card.label} className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-xs text-gray-500">{card.label}</div>
              <div className="mt-2 text-2xl font-bold text-gray-900">{card.value}</div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <FileText className="h-5 w-5 text-emerald-600" />
            {copy.profile}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            <Input placeholder={copy.headline} value={profileForm.headline} onChange={(e) => setProfileForm({ ...profileForm, headline: e.target.value })} />
            <Input placeholder={copy.preferredRole} value={profileForm.preferredRole} onChange={(e) => setProfileForm({ ...profileForm, preferredRole: e.target.value })} />
            <Input placeholder={copy.availability} value={profileForm.availability} onChange={(e) => setProfileForm({ ...profileForm, availability: e.target.value })} />
            <Input placeholder={copy.portfolioUrl} value={profileForm.portfolioUrl} onChange={(e) => setProfileForm({ ...profileForm, portfolioUrl: e.target.value })} dir="ltr" />
            <Input placeholder={copy.cvUrl} value={profileForm.cvUrl} onChange={(e) => setProfileForm({ ...profileForm, cvUrl: e.target.value })} dir="ltr" />
          </div>
          <textarea
            className="mt-3 min-h-24 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={copy.skills}
            value={profileForm.skills}
            onChange={(e) => setProfileForm({ ...profileForm, skills: e.target.value })}
          />
          <textarea
            className="mt-3 min-h-28 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={copy.experience}
            value={profileForm.experienceSummary}
            onChange={(e) => setProfileForm({ ...profileForm, experienceSummary: e.target.value })}
          />
          <Button className="mt-3 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => saveProfile.mutate(profileForm)} disabled={saveProfile.isPending}>
            {saveProfile.isPending ? copy.saving : copy.save}
          </Button>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold">{copy.opportunities}</h2>
          {isLoading ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
            </div>
          ) : !data?.opportunities?.length ? (
            <div className="rounded-2xl border bg-white p-8 text-center text-gray-500">{copy.noJobs}</div>
          ) : (
            data.opportunities.map((item: any) => (
              <div key={item.job.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold">{isRtl ? item.job.titleAr : item.job.titleEn || item.job.titleAr}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-500">{isRtl ? item.job.descriptionAr : item.job.descriptionEn || item.job.descriptionAr}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={item.systemEligible ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                      {item.score}%
                    </Badge>
                    {item.review?.status && (
                      <Badge className={statusStyle[item.review.status] ?? "bg-gray-100 text-gray-700"}>
                        {reviewStatusLabel(item.review.status, isRtl)}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-5">
                  {Object.entries(item.checks).map(([key, passed]) => (
                    <div key={key} className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-xs">
                      {passed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-500" />}
                      <span>{eligibilityCheckLabel(key, isRtl)}</span>
                    </div>
                  ))}
                </div>

                {item.review?.adminNote && (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="mb-1 text-xs font-semibold text-amber-700">{copy.managerNote}</p>
                    {item.review.adminNote}
                  </div>
                )}

                <StudentReviewHistory history={item.reviewHistory} studentUserId={item.review?.userId} isRtl={isRtl} />

                {(!item.review || item.review.status === "returned") ? (
                  <>
                    <textarea
                      className="mt-4 min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
                      placeholder={copy.notePlaceholder}
                      value={notes[item.job.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [item.job.id]: e.target.value })}
                    />
                    <Button
                      className="mt-3 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={submitReview.isPending}
                      onClick={() => submitReview.mutate({ jobId: item.job.id, studentNote: notes[item.job.id] })}
                    >
                      {submitReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                      {submitReview.isPending ? copy.requesting : (item.review?.status === "returned" ? copy.resubmit : copy.request)}
                    </Button>
                  </>
                ) : (
                  <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    {item.review.status === "submitted" || item.review.status === "resubmitted" ? copy.pendingBody : copy.finalBody}
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      </div>
    </ClientLayout>
  );
}

function StudentReviewHistory({ history, studentUserId, isRtl }: { history: any[] | undefined; studentUserId?: number; isRtl: boolean }) {
  if (!history?.length) return null;
  const actions: Record<string, string> = isRtl
    ? { review_submitted: "تم تقديم الطلب", review_resubmitted: "تمت إعادة التقديم", review_decision: "سجّل المدير قراراً" }
    : { review_submitted: "Request submitted", review_resubmitted: "Request resubmitted", review_decision: "Manager decision recorded" };
  return (
    <div className="mt-3 rounded-xl border p-3">
      <p className="text-xs font-semibold text-slate-500">{isRtl ? "سجل الطلب" : "Request history"}</p>
      <div className="mt-2 space-y-2">
        {history.map((entry) => {
          let details: any = null;
          try { details = entry.details ? JSON.parse(entry.details) : null; } catch { details = null; }
          const note = details?.adminNote || details?.studentNote;
          const actor = entry.actorUserId === studentUserId ? (isRtl ? "أنت" : "You") : (isRtl ? "المدير" : "Manager");
          return (
            <div key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-semibold">{actions[entry.action] || entry.action}{entry.toStatus ? ` · ${reviewStatusLabel(entry.toStatus, isRtl)}` : ""}</span>
                <span className="text-slate-500">{actor} · {formatReviewHistoryDate(entry.createdAt, isRtl)}</span>
              </div>
              {note && <p className="mt-1 text-slate-700">{note}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
