import { useState } from "react";
import { Briefcase, CheckCircle2, Loader2, ShieldCheck, SlidersHorizontal } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";

type RuleForm = {
  jobId: string;
  minCompletedEpisodes: number;
  minPassedQuizzes: number;
  minPointsBalance: number;
  requireActiveSubscription: boolean;
  requireProfile: boolean;
  requireAdminReview: boolean;
  isEnabled: boolean;
  instructions: string;
};

const defaultRuleForm: RuleForm = {
  jobId: "",
  minCompletedEpisodes: 0,
  minPassedQuizzes: 0,
  minPointsBalance: 0,
  requireActiveSubscription: true,
  requireProfile: true,
  requireAdminReview: true,
  isEnabled: true,
  instructions: "",
};

const reviewStatuses = ["submitted", "returned", "eligible", "ineligible"] as const;

export default function AdminJobEligibility() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const copy = isRtl
    ? {
        title: "أهلية الطلاب للوظائف",
        subtitle: "إدارة قواعد الأهلية ومراجعة طلبات الطلاب قبل ترشيحهم للفرص.",
        disabledTitle: "الميزة غير مفعّلة",
        disabledBody: "لوحة أهلية الوظائف جاهزة لكنها مخفية حتى تفعيل student_job_eligibility_enabled بموافقة منفصلة.",
        rules: "قواعد الأهلية",
        reviews: "طلبات المراجعة",
        job: "الوظيفة",
        episodes: "الدروس المكتملة",
        quizzes: "الاختبارات المكتملة",
        points: "النقاط المطلوبة",
        activeSubscription: "يتطلب اشتراكاً نشطاً",
        profile: "يتطلب ملفاً مهنياً",
        adminReview: "يتطلب مراجعة مدير",
        enabled: "مفعّل",
        instructions: "تعليمات إضافية للطالب",
        saveRule: "حفظ القاعدة",
        savedRule: "تم حفظ القاعدة",
        filterStatus: "فلترة الحالة",
        allStatuses: "كل الحالات",
        approve: "مؤهل",
        return: "إرجاع",
        reject: "غير مؤهل",
        decisionSaved: "تم حفظ القرار",
        notePlaceholder: "ملاحظة القرار...",
        noReviews: "لا توجد طلبات مراجعة.",
      }
    : {
        title: "Student Job Eligibility",
        subtitle: "Manage eligibility rules and review student requests before job nomination.",
        disabledTitle: "Feature is not enabled",
        disabledBody: "The job eligibility console is ready but hidden until student_job_eligibility_enabled is enabled with separate approval.",
        rules: "Eligibility rules",
        reviews: "Review requests",
        job: "Job",
        episodes: "Completed lessons",
        quizzes: "Completed quizzes",
        points: "Required points",
        activeSubscription: "Requires active subscription",
        profile: "Requires career profile",
        adminReview: "Requires manager review",
        enabled: "Enabled",
        instructions: "Extra student instructions",
        saveRule: "Save rule",
        savedRule: "Rule saved",
        filterStatus: "Filter status",
        allStatuses: "All statuses",
        approve: "Eligible",
        return: "Return",
        reject: "Ineligible",
        decisionSaved: "Decision saved",
        notePlaceholder: "Decision note...",
        noReviews: "No review requests.",
      };

  const utils = trpc.useUtils();
  const [ruleForm, setRuleForm] = useState<RuleForm>(defaultRuleForm);
  const [status, setStatus] = useState<string>("");
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data: availability, isLoading: availabilityLoading } = trpc.studentJobEligibility.availability.useQuery(undefined, { retry: false });
  const enabled = availability?.enabled === true;
  const { data: jobs } = trpc.jobs.adminList.useQuery(undefined, { enabled, retry: false });
  const { data: rules } = trpc.studentJobEligibility.adminRules.useQuery(undefined, { enabled, retry: false });
  const { data: reviews, isLoading: reviewsLoading } = trpc.studentJobEligibility.adminReviews.useQuery(
    status ? { status: status as any, limit: 100 } : { limit: 100 },
    { enabled, retry: false },
  );

  const saveRule = trpc.studentJobEligibility.adminUpsertRule.useMutation({
    onSuccess: async () => {
      await utils.studentJobEligibility.adminRules.invalidate();
      toast.success(copy.savedRule);
    },
    onError: (error) => toast.error(error.message),
  });

  const decide = trpc.studentJobEligibility.adminReviewDecision.useMutation({
    onSuccess: async () => {
      await utils.studentJobEligibility.adminReviews.invalidate();
      toast.success(copy.decisionSaved);
    },
    onError: (error) => toast.error(error.message),
  });

  const editRule = (rule: any) => {
    setRuleForm({
      jobId: String(rule.jobId),
      minCompletedEpisodes: rule.minCompletedEpisodes ?? 0,
      minPassedQuizzes: rule.minPassedQuizzes ?? 0,
      minPointsBalance: rule.minPointsBalance ?? 0,
      requireActiveSubscription: !!rule.requireActiveSubscription,
      requireProfile: !!rule.requireProfile,
      requireAdminReview: !!rule.requireAdminReview,
      isEnabled: !!rule.isEnabled,
      instructions: rule.instructions ?? "",
    });
  };

  if (availabilityLoading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!enabled) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-2xl border bg-white p-8 text-center shadow-sm">
            <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-emerald-600" />
            <h1 className="text-2xl font-bold">{copy.disabledTitle}</h1>
            <p className="mt-2 text-sm text-gray-500">{copy.disabledBody}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <Briefcase className="h-5 w-5" />
            <span className="text-sm font-semibold">{copy.title}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold">{copy.title}</h1>
          <p className="text-gray-500">{copy.subtitle}</p>
        </div>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <SlidersHorizontal className="h-5 w-5 text-emerald-600" />
            {copy.rules}
          </h2>
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="rounded-lg border px-3 py-2 text-sm"
              value={ruleForm.jobId}
              onChange={(event) => setRuleForm({ ...ruleForm, jobId: event.target.value })}
            >
              <option value="">{copy.job}</option>
              {jobs?.map((job: any) => (
                <option key={job.id} value={job.id}>{isRtl ? job.titleAr : job.titleEn || job.titleAr}</option>
              ))}
            </select>
            <Input type="number" min={0} placeholder={copy.episodes} value={ruleForm.minCompletedEpisodes} onChange={(e) => setRuleForm({ ...ruleForm, minCompletedEpisodes: Number(e.target.value) })} />
            <Input type="number" min={0} placeholder={copy.quizzes} value={ruleForm.minPassedQuizzes} onChange={(e) => setRuleForm({ ...ruleForm, minPassedQuizzes: Number(e.target.value) })} />
            <Input type="number" min={0} placeholder={copy.points} value={ruleForm.minPointsBalance} onChange={(e) => setRuleForm({ ...ruleForm, minPointsBalance: Number(e.target.value) })} />
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            {[
              ["requireActiveSubscription", copy.activeSubscription],
              ["requireProfile", copy.profile],
              ["requireAdminReview", copy.adminReview],
              ["isEnabled", copy.enabled],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean((ruleForm as any)[key])}
                  onChange={(event) => setRuleForm({ ...ruleForm, [key]: event.target.checked } as RuleForm)}
                />
                {label}
              </label>
            ))}
          </div>
          <textarea
            className="mt-3 min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder={copy.instructions}
            value={ruleForm.instructions}
            onChange={(event) => setRuleForm({ ...ruleForm, instructions: event.target.value })}
          />
          <Button
            className="mt-3 bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!ruleForm.jobId || saveRule.isPending}
            onClick={() => saveRule.mutate({ ...ruleForm, jobId: Number(ruleForm.jobId) })}
          >
            {copy.saveRule}
          </Button>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {rules?.map((rule: any) => (
              <button
                key={rule.id}
                type="button"
                className="rounded-xl border p-4 text-start hover:bg-emerald-50"
                onClick={() => editRule(rule)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold">{isRtl ? rule.jobTitleAr : rule.jobTitleEn || rule.jobTitleAr}</div>
                  <Badge className={rule.isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-700"}>
                    {rule.isEnabled ? copy.enabled : "off"}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {copy.episodes}: {rule.minCompletedEpisodes} · {copy.quizzes}: {rule.minPassedQuizzes} · {copy.points}: {rule.minPointsBalance}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{copy.reviews}</h2>
            <select className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{copy.allStatuses}</option>
              {reviewStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          {reviewsLoading ? (
            <div className="p-8 text-center text-gray-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : !reviews?.length ? (
            <div className="rounded-xl bg-gray-50 p-6 text-center text-gray-500">{copy.noReviews}</div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review: any) => (
                <div key={review.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold">{review.studentName || review.studentEmail}</div>
                      <div className="text-sm text-gray-500">{review.studentEmail} · {review.studentPhone || "—"}</div>
                      <div className="mt-1 text-sm">{isRtl ? review.jobTitleAr : review.jobTitleEn || review.jobTitleAr}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="bg-slate-100 text-slate-700">{review.status}</Badge>
                      <Badge className={review.systemEligible ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                        {review.score}%
                      </Badge>
                    </div>
                  </div>
                  {review.studentNote && <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">{review.studentNote}</div>}
                  <textarea
                    className="mt-3 min-h-20 w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder={copy.notePlaceholder}
                    value={notes[review.id] ?? review.adminNote ?? ""}
                    onChange={(event) => setNotes({ ...notes, [review.id]: event.target.value })}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => decide.mutate({ reviewId: review.id, status: "eligible", adminNote: notes[review.id] })}>
                      <CheckCircle2 className="h-4 w-4" />
                      {copy.approve}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide.mutate({ reviewId: review.id, status: "returned", adminNote: notes[review.id] })}>
                      {copy.return}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => decide.mutate({ reviewId: review.id, status: "ineligible", adminNote: notes[review.id] })}>
                      {copy.reject}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
