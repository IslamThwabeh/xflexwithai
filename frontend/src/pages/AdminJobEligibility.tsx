import { useState } from "react";
import { ArrowRight, Briefcase, CheckCircle2, CircleAlert, Eye, GraduationCap, Loader2, RefreshCw, ShieldCheck, SlidersHorizontal, Sparkles, UserRound } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminFeatureSetupCard, SafeAdminPreview } from "@/components/admin/SafeAdminPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { Link } from "wouter";

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
type ReviewDecision = "returned" | "eligible" | "ineligible";

type EligibilitySnapshot = {
  metrics?: {
    completedEpisodes?: number;
    completedQuizzes?: number;
    pointsBalance?: number;
    hasActiveSubscription?: boolean;
    hasProfile?: boolean;
  };
  rule?: {
    minCompletedEpisodes?: number;
    minPassedQuizzes?: number;
    minPointsBalance?: number;
    requireActiveSubscription?: boolean;
    requireProfile?: boolean;
  };
  checks?: Partial<Record<"completedEpisodes" | "completedQuizzes" | "pointsBalance" | "activeSubscription" | "profile", boolean>>;
  capturedAt?: string;
};

function parseEligibilitySnapshot(value: unknown): EligibilitySnapshot | null {
  if (!value) return null;
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" ? parsed as EligibilitySnapshot : null;
  } catch {
    return null;
  }
}

function getInitialJobPreview() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "student";
}

export default function AdminJobEligibility() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const copy = isRtl
    ? {
        title: "أهلية الطلاب للوظائف",
        subtitle: "إدارة قواعد الأهلية ومراجعة طلبات الطلاب قبل ترشيحهم للفرص.",
        disabledTitle: "أهلية الوظائف غير متاحة للطلاب بعد",
        disabledBody: "مساحة الأهلية مخفية عن الطلاب حالياً، بينما تبقى أدوات الإدارة متاحة لتجهيز القواعد ومراجعة السجل بأمان قبل الإطلاق.",
        studentDeliveryOff: "وصول الطلاب متوقف",
        studentDeliveryOn: "وصول الطلاب مفعّل",
        studentDeliveryOffBody: "يمكنك حفظ قواعد مسودة ومراجعة الطلبات السابقة الآن. لن تظهر الميزة للطلاب حتى تفعيلها من مركز الميزات.",
        openFeatureCenter: "فتح مركز الميزات",
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
        disabled: "غير مفعّل",
        instructions: "تعليمات إضافية للطالب",
        saveRule: "حفظ القاعدة",
        savingRule: "جارٍ الحفظ...",
        savedRule: "تم حفظ القاعدة",
        filterStatus: "فلترة الحالة",
        allStatuses: "كل الحالات",
        approve: "مؤهل",
        return: "إرجاع",
        reject: "غير مؤهل",
        decisionSaved: "تم حفظ القرار",
        notePlaceholder: "ملاحظة القرار...",
        noteRequired: "اكتب سبباً واضحاً قبل إرجاع الطلب أو رفضه.",
        confirmDecision: "تأكيد قرار الأهلية",
        confirmDecisionBody: "راجع الطالب والوظيفة والأدلة قبل حفظ هذا القرار. لن يُرسل إشعار تلقائي من هذه الخطوة.",
        cancel: "إلغاء",
        confirm: "حفظ القرار",
        currentStatus: "الحالة الحالية",
        proposedDecision: "القرار الجديد",
        systemEvidence: "دليل النظام وقت تقديم الطلب",
        evidenceUnavailable: "تعذر قراءة لقطة الأدلة لهذا الطلب. راجع بيانات الطالب يدوياً قبل اتخاذ القرار.",
        capturedAt: "تم الالتقاط",
        actual: "القيمة",
        required: "المطلوب",
        passed: "مستوفى",
        missing: "غير مستوفى",
        yes: "نعم",
        no: "لا",
        notRequired: "غير مطلوب",
        loadFailed: "تعذر تحميل بيانات مساحة الأهلية.",
        retry: "إعادة المحاولة",
        rulesLoadFailed: "تعذر تحميل الوظائف أو القواعد. لم يتم تفسير الخطأ على أنه قائمة فارغة.",
        reviewsLoadFailed: "تعذر تحميل طلبات المراجعة. حاول مرة أخرى قبل اتخاذ أي قرار.",
        noReviews: "لا توجد طلبات مراجعة.",
        noReviewsBody: "ستظهر طلبات الطلاب هنا بعد مطابقة القواعد وطلب المراجعة. استخدم المعاينة لشرح الرحلة الآن.",
        noRules: "لا توجد قواعد أهلية بعد",
        noRulesBody: "اختر وظيفة وحدد متطلبات واضحة حتى يستطيع النظام شرح ما اجتازه الطالب وما ينقصه.",
        previewStudent: "معاينة تجربة الطالب",
        closePreview: "إغلاق المعاينة",
        workspace: "مساحة الأهلية والترشيح",
      }
    : {
        title: "Student Job Eligibility",
        subtitle: "Manage eligibility rules and review student requests before job nomination.",
        disabledTitle: "Job eligibility is not live for students yet",
        disabledBody: "Eligibility is currently hidden from students, while the admin workspace remains available for safely preparing rules and reviewing history before launch.",
        studentDeliveryOff: "Student delivery is off",
        studentDeliveryOn: "Student delivery is on",
        studentDeliveryOffBody: "You can save draft rules and review earlier requests now. Students will not see this feature until it is enabled from Feature Center.",
        openFeatureCenter: "Open Feature Center",
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
        disabled: "Off",
        instructions: "Extra student instructions",
        saveRule: "Save rule",
        savingRule: "Saving...",
        savedRule: "Rule saved",
        filterStatus: "Filter status",
        allStatuses: "All statuses",
        approve: "Eligible",
        return: "Return",
        reject: "Ineligible",
        decisionSaved: "Decision saved",
        notePlaceholder: "Decision note...",
        noteRequired: "Enter a clear reason before returning or rejecting this request.",
        confirmDecision: "Confirm eligibility decision",
        confirmDecisionBody: "Review the student, job, and captured evidence before saving this decision. This step does not send an automatic notification.",
        cancel: "Cancel",
        confirm: "Save decision",
        currentStatus: "Current status",
        proposedDecision: "New decision",
        systemEvidence: "System evidence captured at submission",
        evidenceUnavailable: "The evidence snapshot for this request could not be read. Review the student data manually before deciding.",
        capturedAt: "Captured",
        actual: "Actual",
        required: "Required",
        passed: "Passed",
        missing: "Missing",
        yes: "Yes",
        no: "No",
        notRequired: "Not required",
        loadFailed: "The eligibility workspace could not be loaded.",
        retry: "Retry",
        rulesLoadFailed: "Jobs or rules could not be loaded. This error is not being shown as an empty list.",
        reviewsLoadFailed: "Review requests could not be loaded. Retry before making any decision.",
        noReviews: "No review requests.",
        noReviewsBody: "Student requests will appear here after matching rules and asking for review. Use the preview to explain the journey now.",
        noRules: "No eligibility rules yet",
        noRulesBody: "Select a job and define clear requirements so the system can explain what a student passed and what is still missing.",
        previewStudent: "Preview student experience",
        closePreview: "Close preview",
        workspace: "Eligibility & nomination workspace",
      };

  const utils = trpc.useUtils();
  const [ruleForm, setRuleForm] = useState<RuleForm>(defaultRuleForm);
  const [status, setStatus] = useState<string>("");
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [decisionTarget, setDecisionTarget] = useState<{ review: any; status: ReviewDecision } | null>(null);
  const [directStudentPreview] = useState(getInitialJobPreview);
  const [showStudentPreview, setShowStudentPreview] = useState(directStudentPreview);

  const availabilityQuery = trpc.studentJobEligibility.availability.useQuery(undefined, { retry: false });
  const { data: availability, isLoading: availabilityLoading } = availabilityQuery;
  const enabled = availability?.enabled === true;
  const jobsQuery = trpc.studentJobEligibility.adminJobs.useQuery(undefined, { retry: false });
  const rulesQuery = trpc.studentJobEligibility.adminRules.useQuery(undefined, { retry: false });
  const reviewsQuery = trpc.studentJobEligibility.adminReviews.useQuery(
    status ? { status: status as any, limit: 100 } : { limit: 100 },
    { retry: false },
  );
  const jobs = jobsQuery.data;
  const rules = rulesQuery.data;
  const reviews = reviewsQuery.data;
  const reviewsLoading = reviewsQuery.isLoading;

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
      setDecisionTarget(null);
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

  const statusLabel = (value: string) => {
    const labels: Record<string, string> = isRtl
      ? { submitted: "بانتظار المراجعة", returned: "مُعاد للطالب", eligible: "مؤهل", ineligible: "غير مؤهل" }
      : { submitted: "Awaiting review", returned: "Returned", eligible: "Eligible", ineligible: "Ineligible" };
    return labels[value] ?? value;
  };

  const decisionNote = decisionTarget
    ? (notes[decisionTarget.review.id] ?? decisionTarget.review.adminNote ?? "").trim()
    : "";
  const decisionNeedsNote = decisionTarget?.status === "returned" || decisionTarget?.status === "ineligible";
  const canConfirmDecision = Boolean(decisionTarget) && (!decisionNeedsNote || decisionNote.length > 0) && !decide.isPending;

  const confirmDecision = () => {
    if (!decisionTarget || !canConfirmDecision) return;
    decide.mutate({
      reviewId: decisionTarget.review.id,
      status: decisionTarget.status,
      adminNote: decisionNote || undefined,
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

  if (availabilityQuery.isError) {
    return (
      <DashboardLayout>
        <main className="p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
          <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <CircleAlert className="mx-auto h-9 w-9 text-red-600" />
            <h1 className="mt-3 text-xl font-bold text-red-950">{copy.loadFailed}</h1>
            <p className="mt-2 text-sm text-red-800">{availabilityQuery.error.message}</p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => availabilityQuery.refetch()} disabled={availabilityQuery.isFetching}>
              <RefreshCw className={`h-4 w-4 ${availabilityQuery.isFetching ? "animate-spin" : ""}`} />
              {copy.retry}
            </Button>
          </div>
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-700">
              <Briefcase className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">{copy.workspace}</span>
            </div>
            <h1 className="mt-2 text-2xl font-bold">{copy.title}</h1>
            <p className="text-gray-500">{copy.subtitle}</p>
          </div>
          <Button
            type="button"
            variant={showStudentPreview ? "default" : "outline"}
            className={showStudentPreview ? "bg-indigo-600 text-white hover:bg-indigo-700" : ""}
            onClick={() => setShowStudentPreview((current) => !current)}
          >
            <Eye className="h-4 w-4" />
            {showStudentPreview ? copy.closePreview : copy.previewStudent}
          </Button>
        </header>

        {showStudentPreview && <JobEligibilityStudentPreview isRtl={isRtl} focusOnMount={directStudentPreview} />}

        {!enabled ? (
          <AdminFeatureSetupCard
            isRtl={isRtl}
            title={copy.disabledTitle}
            description={copy.studentDeliveryOffBody}
            items={[
              { label: isRtl ? "راجع تجربة الطالب التجريبية" : "Review the sample student experience", complete: true },
              { label: isRtl ? "جهّز قواعد الوظائف أدناه" : "Prepare job rules below", complete: Boolean(rules?.length) },
              {
                label: isRtl ? "صلاحية المراجعة متاحة لهذا الحساب" : "Review access is ready for this account",
                complete: true,
                detail: isRtl ? "يمكن تعيين مسؤولين إضافيين من مركز الميزات" : "Assign additional owners from Feature Center when needed",
              },
            ]}
            action={(
              <Button asChild variant="outline" className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100">
                <Link href="/admin/features">{copy.openFeatureCenter}</Link>
              </Button>
            )}
          />
        ) : (
          <div className="flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 font-semibold text-emerald-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              {copy.studentDeliveryOn}
            </div>
            <Button asChild size="sm" variant="outline" className="border-emerald-300 bg-white text-emerald-900">
              <Link href="/admin/features">{copy.openFeatureCenter}</Link>
            </Button>
          </div>
        )}

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
            <SlidersHorizontal className="h-5 w-5 text-emerald-600" />
            {copy.rules}
          </h2>
          {jobsQuery.isError || rulesQuery.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
              <CircleAlert className="mx-auto h-7 w-7 text-red-600" />
              <p className="mt-2 font-semibold text-red-950">{copy.rulesLoadFailed}</p>
              <p className="mt-1 text-xs text-red-800">{jobsQuery.error?.message || rulesQuery.error?.message}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-3"
                disabled={jobsQuery.isFetching || rulesQuery.isFetching}
                onClick={() => Promise.all([jobsQuery.refetch(), rulesQuery.refetch()])}
              >
                <RefreshCw className={`h-4 w-4 ${jobsQuery.isFetching || rulesQuery.isFetching ? "animate-spin" : ""}`} />
                {copy.retry}
              </Button>
            </div>
          ) : jobsQuery.isLoading || rulesQuery.isLoading ? (
            <div className="p-8 text-center text-slate-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-4">
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  <span>{copy.job}</span>
                  <select
                    className="h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm font-normal"
                    value={ruleForm.jobId}
                    onChange={(event) => setRuleForm({ ...ruleForm, jobId: event.target.value })}
                  >
                    <option value="">{isRtl ? "اختر وظيفة" : "Select a job"}</option>
                    {jobs?.map((job: any) => (
                      <option key={job.id} value={job.id}>{isRtl ? job.titleAr : job.titleEn || job.titleAr}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  <span>{copy.episodes}</span>
                  <Input type="number" min={0} value={ruleForm.minCompletedEpisodes} onChange={(e) => setRuleForm({ ...ruleForm, minCompletedEpisodes: Number(e.target.value) })} />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  <span>{copy.quizzes}</span>
                  <Input type="number" min={0} value={ruleForm.minPassedQuizzes} onChange={(e) => setRuleForm({ ...ruleForm, minPassedQuizzes: Number(e.target.value) })} />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  <span>{copy.points}</span>
                  <Input type="number" min={0} value={ruleForm.minPointsBalance} onChange={(e) => setRuleForm({ ...ruleForm, minPointsBalance: Number(e.target.value) })} />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
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
              <label className="mt-4 block space-y-1.5 text-sm font-medium text-slate-700">
                <span>{copy.instructions}</span>
                <textarea
                  className="min-h-20 w-full rounded-lg border px-3 py-2 text-sm font-normal"
                  value={ruleForm.instructions}
                  onChange={(event) => setRuleForm({ ...ruleForm, instructions: event.target.value })}
                />
              </label>
              <Button
                type="button"
                className="mt-3 bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={!ruleForm.jobId || saveRule.isPending}
                onClick={() => saveRule.mutate({ ...ruleForm, jobId: Number(ruleForm.jobId) })}
              >
                {saveRule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {saveRule.isPending ? copy.savingRule : copy.saveRule}
              </Button>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {!rules?.length ? (
                  <div className="rounded-xl border border-dashed bg-slate-50 p-6 text-center md:col-span-2">
                    <SlidersHorizontal className="mx-auto h-7 w-7 text-slate-400" />
                    <p className="mt-2 font-semibold text-slate-800">{copy.noRules}</p>
                    <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-500">{copy.noRulesBody}</p>
                  </div>
                ) : rules.map((rule: any) => (
                  <button
                    key={rule.id}
                    type="button"
                    className="rounded-xl border p-4 text-start transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                    onClick={() => editRule(rule)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold">{isRtl ? rule.jobTitleAr : rule.jobTitleEn || rule.jobTitleAr}</div>
                      <Badge className={rule.isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-700"}>
                        {rule.isEnabled ? copy.enabled : copy.disabled}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {copy.episodes}: {rule.minCompletedEpisodes} · {copy.quizzes}: {rule.minPassedQuizzes} · {copy.points}: {rule.minPointsBalance}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">{copy.reviews}</h2>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span>{copy.filterStatus}</span>
              <select className="rounded-lg border bg-white px-3 py-2 text-sm font-normal" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">{copy.allStatuses}</option>
                {reviewStatuses.map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}
              </select>
            </label>
          </div>

          {reviewsQuery.isError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
              <CircleAlert className="mx-auto h-7 w-7 text-red-600" />
              <p className="mt-2 font-semibold text-red-950">{copy.reviewsLoadFailed}</p>
              <p className="mt-1 text-xs text-red-800">{reviewsQuery.error.message}</p>
              <Button type="button" variant="outline" className="mt-3" onClick={() => reviewsQuery.refetch()} disabled={reviewsQuery.isFetching}>
                <RefreshCw className={`h-4 w-4 ${reviewsQuery.isFetching ? "animate-spin" : ""}`} />
                {copy.retry}
              </Button>
            </div>
          ) : reviewsLoading ? (
            <div className="p-8 text-center text-gray-500"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
          ) : !reviews?.length ? (
            <div className="rounded-xl border border-dashed bg-gray-50 p-6 text-center">
              <UserRound className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-2 font-semibold text-slate-700">{copy.noReviews}</p>
              <p className="mx-auto mt-1 max-w-xl text-sm leading-6 text-slate-500">{copy.noReviewsBody}</p>
            </div>
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
                      <Badge className="bg-slate-100 text-slate-700">{statusLabel(review.status)}</Badge>
                      <Badge className={review.systemEligible ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}>
                        {review.score}%
                      </Badge>
                    </div>
                  </div>
                  {review.studentNote && (
                    <div className="mt-3 rounded-lg border bg-gray-50 p-3 text-sm">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{isRtl ? "ملاحظة الطالب" : "Student note"}</p>
                      <p className="text-slate-800">{review.studentNote}</p>
                    </div>
                  )}
                  <EligibilityEvidencePanel review={review} isRtl={isRtl} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={decide.isPending} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setDecisionTarget({ review, status: "eligible" })}>
                      <CheckCircle2 className="h-4 w-4" />
                      {copy.approve}
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={decide.isPending} onClick={() => setDecisionTarget({ review, status: "returned" })}>
                      {copy.return}
                    </Button>
                    <Button type="button" size="sm" variant="destructive" disabled={decide.isPending} onClick={() => setDecisionTarget({ review, status: "ineligible" })}>
                      {copy.reject}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <Dialog
          open={Boolean(decisionTarget)}
          onOpenChange={(open) => {
            if (!open && !decide.isPending) setDecisionTarget(null);
          }}
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" dir={isRtl ? "rtl" : "ltr"}>
            <DialogHeader>
              <DialogTitle>{copy.confirmDecision}</DialogTitle>
              <DialogDescription>{copy.confirmDecisionBody}</DialogDescription>
            </DialogHeader>
            {decisionTarget && (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{isRtl ? "الطالب" : "Student"}</p>
                    <p className="mt-1 font-semibold text-slate-950">{decisionTarget.review.studentName || decisionTarget.review.studentEmail}</p>
                    <p className="text-xs text-slate-500">{decisionTarget.review.studentEmail}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.job}</p>
                    <p className="mt-1 font-semibold text-slate-950">{isRtl ? decisionTarget.review.jobTitleAr : decisionTarget.review.jobTitleEn || decisionTarget.review.jobTitleAr}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{copy.currentStatus}</p>
                    <p className="font-semibold text-slate-900">{statusLabel(decisionTarget.review.status)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{copy.proposedDecision}</p>
                    <p className="font-semibold text-slate-900">{statusLabel(decisionTarget.status)}</p>
                  </div>
                </div>
                <EligibilityEvidencePanel review={decisionTarget.review} isRtl={isRtl} compact />
                <label className="block space-y-1.5 text-sm font-medium text-slate-800">
                  <span>{copy.notePlaceholder}{decisionNeedsNote ? " *" : ""}</span>
                  <textarea
                    className="min-h-24 w-full rounded-lg border px-3 py-2 text-sm font-normal"
                    value={notes[decisionTarget.review.id] ?? decisionTarget.review.adminNote ?? ""}
                    onChange={(event) => setNotes({ ...notes, [decisionTarget.review.id]: event.target.value })}
                    autoFocus
                  />
                </label>
                {decisionNeedsNote && !decisionNote && <p className="text-sm font-medium text-red-600">{copy.noteRequired}</p>}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setDecisionTarget(null)} disabled={decide.isPending}>{copy.cancel}</Button>
              <Button type="button" onClick={confirmDecision} disabled={!canConfirmDecision} className={decisionTarget?.status === "ineligible" ? "bg-red-600 text-white hover:bg-red-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}>
                {decide.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {copy.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function EligibilityEvidencePanel({ review, isRtl, compact = false }: { review: any; isRtl: boolean; compact?: boolean }) {
  const snapshot = parseEligibilitySnapshot(review.snapshotJson);
  const copy = isRtl
    ? {
        title: "دليل النظام وقت تقديم الطلب",
        unavailable: "تعذر قراءة لقطة الأدلة. راجع بيانات الطالب يدوياً قبل اتخاذ القرار.",
        captured: "تم الالتقاط",
        actual: "القيمة",
        required: "المطلوب",
        passed: "مستوفى",
        missing: "غير مستوفى",
        lessons: "الدروس المكتملة",
        quizzes: "الاختبارات المجتازة",
        points: "رصيد النقاط",
        subscription: "الاشتراك النشط",
        profile: "الملف المهني",
        yes: "نعم",
        no: "لا",
        notRequired: "غير مطلوب",
      }
    : {
        title: "System evidence captured at submission",
        unavailable: "The evidence snapshot could not be read. Review the student data manually before deciding.",
        captured: "Captured",
        actual: "Actual",
        required: "Required",
        passed: "Passed",
        missing: "Missing",
        lessons: "Completed lessons",
        quizzes: "Passed quizzes",
        points: "Points balance",
        subscription: "Active subscription",
        profile: "Career profile",
        yes: "Yes",
        no: "No",
        notRequired: "Not required",
      };

  if (!snapshot?.metrics || !snapshot.rule || !snapshot.checks) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>{copy.unavailable}</span>
      </div>
    );
  }

  const evidence = [
    {
      key: "completedEpisodes",
      label: copy.lessons,
      actual: String(snapshot.metrics.completedEpisodes ?? 0),
      required: String(snapshot.rule.minCompletedEpisodes ?? 0),
      passed: snapshot.checks.completedEpisodes,
    },
    {
      key: "completedQuizzes",
      label: copy.quizzes,
      actual: String(snapshot.metrics.completedQuizzes ?? 0),
      required: String(snapshot.rule.minPassedQuizzes ?? 0),
      passed: snapshot.checks.completedQuizzes,
    },
    {
      key: "pointsBalance",
      label: copy.points,
      actual: String(snapshot.metrics.pointsBalance ?? 0),
      required: String(snapshot.rule.minPointsBalance ?? 0),
      passed: snapshot.checks.pointsBalance,
    },
    {
      key: "activeSubscription",
      label: copy.subscription,
      actual: snapshot.metrics.hasActiveSubscription ? copy.yes : copy.no,
      required: snapshot.rule.requireActiveSubscription ? copy.yes : copy.notRequired,
      passed: snapshot.checks.activeSubscription,
    },
    {
      key: "profile",
      label: copy.profile,
      actual: snapshot.metrics.hasProfile ? copy.yes : copy.no,
      required: snapshot.rule.requireProfile ? copy.yes : copy.notRequired,
      passed: snapshot.checks.profile,
    },
  ];

  const capturedDate = snapshot.capturedAt ? new Date(snapshot.capturedAt) : null;
  const capturedAt = capturedDate && !Number.isNaN(capturedDate.getTime())
    ? new Intl.DateTimeFormat(isRtl ? "ar-JO" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(capturedDate)
    : null;

  return (
    <div className={`mt-3 rounded-xl border border-slate-200 bg-slate-50 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">{copy.title}</p>
        {capturedAt && <p className="text-xs text-slate-500">{copy.captured}: {capturedAt}</p>}
      </div>
      <div className={`mt-3 grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
        {evidence.map((item) => (
          <div key={item.key} className={`rounded-lg border p-3 ${item.passed ? "border-emerald-200 bg-white" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-slate-800">{item.label}</p>
              {item.passed
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                : <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />}
            </div>
            <p className="mt-1 text-xs text-slate-600">{copy.actual}: <span className="font-semibold text-slate-900">{item.actual}</span></p>
            <p className="text-xs text-slate-600">{copy.required}: <span className="font-semibold text-slate-900">{item.required}</span></p>
            <p className={`mt-1 text-xs font-semibold ${item.passed ? "text-emerald-700" : "text-amber-700"}`}>{item.passed ? copy.passed : copy.missing}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobEligibilityStudentPreview({ isRtl, focusOnMount = false }: { isRtl: boolean; focusOnMount?: boolean }) {
  const copy = isRtl
    ? {
        audience: "طالبة تجريبية — سارة أحمد",
        title: "تجربة الطالب: فهم الأهلية وطلب المراجعة",
        description: "توضح المعاينة كيف تُحسب الأهلية، وما المتطلبات المكتملة، وما الذي يحتاجه الطالب قبل الترشيح.",
        workflow: "رحلة الأهلية والترشيح",
        rule: "قواعد الوظيفة",
        calculation: "حساب الأهلية",
        review: "مراجعة الإدارة",
        nomination: "الترشيح والتواصل",
        job: "أخصائي نجاح عملاء بالذكاء الاصطناعي",
        company: "فرصة تجريبية · عمّان / عمل هجين",
        match: "درجة الأهلية",
        almost: "قريبة من الأهلية",
        profile: "الملف المهني مكتمل بنسبة 92٪",
        active: "الاشتراك نشط",
        requirements: "تفاصيل المتطلبات",
        lessons: "الدروس المكتملة",
        quizzes: "الاختبارات المجتازة",
        points: "رصيد النقاط",
        portfolio: "رابط نموذج العمل",
        passed: "مكتمل",
        missing: "مطلوب",
        lessonValue: "18 من 15",
        quizValue: "7 من 6",
        pointsValue: "680 من 500",
        portfolioValue: "أضف رابطاً واحداً",
        guidance: "الخطوة التالية",
        guidanceBody: "أضف نموذج عمل إلى ملفك المهني. بعد ذلك يمكنك طلب مراجعة الإدارة لهذه الفرصة.",
        request: "طلب مراجعة الأهلية",
        managerView: "ما يصل إلى المدير",
        managerBody: "طلب واحد يحتوي على بيانات الطالب، نتيجة الحساب، المتطلبات الناقصة، وملاحظته. يستطيع المدير اعتماد الأهلية أو إعادتها أو رفضها مع توضيح السبب.",
        notification: "بعد الاعتماد، يمكن للمدير إرسال تفاصيل الترشيح للطلاب المؤهلين مباشرة.",
        sample: "مثال توضيحي",
      }
    : {
        audience: "Sample student — Sara Ahmad",
        title: "Student experience: understand eligibility and request review",
        description: "This preview explains how eligibility is calculated, which requirements have passed, and what a student needs before nomination.",
        workflow: "Eligibility and nomination journey",
        rule: "Job rules",
        calculation: "Eligibility calculation",
        review: "Admin review",
        nomination: "Nomination & contact",
        job: "AI Customer Success Specialist",
        company: "Sample opportunity · Amman / Hybrid",
        match: "Eligibility score",
        almost: "Almost eligible",
        profile: "Career profile 92% complete",
        active: "Subscription active",
        requirements: "Requirement details",
        lessons: "Completed lessons",
        quizzes: "Passed quizzes",
        points: "Points balance",
        portfolio: "Work sample link",
        passed: "Passed",
        missing: "Required",
        lessonValue: "18 of 15",
        quizValue: "7 of 6",
        pointsValue: "680 of 500",
        portfolioValue: "Add one link",
        guidance: "Next step",
        guidanceBody: "Add a work sample to your career profile. You can then request an admin eligibility review for this opportunity.",
        request: "Request eligibility review",
        managerView: "What the manager receives",
        managerBody: "One request containing the student profile, calculated result, missing requirements, and student note. The manager can approve, return, or reject it with a clear reason.",
        notification: "After approval, the manager can send nomination details directly to eligible students.",
        sample: "Demonstration",
      };

  const workflow = [copy.rule, copy.calculation, copy.review, copy.nomination];
  const requirements = [
    { label: copy.lessons, value: copy.lessonValue, passed: true },
    { label: copy.quizzes, value: copy.quizValue, passed: true },
    { label: copy.points, value: copy.pointsValue, passed: true },
    { label: copy.portfolio, value: copy.portfolioValue, passed: false },
  ];

  return (
    <SafeAdminPreview
      isRtl={isRtl}
      audience={copy.audience}
      title={copy.title}
      description={copy.description}
      anchorId="job-student-preview"
      focusOnMount={focusOnMount}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.workflow}</p>
          <div className="flex flex-wrap items-center gap-2">
            {workflow.map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${index === 1 ? "border-indigo-300 bg-indigo-100 text-indigo-800" : "border-slate-200 bg-white text-slate-600"}`}>{step}</span>
                {index < workflow.length - 1 && <ArrowRight className={`h-3.5 w-3.5 text-slate-400 ${isRtl ? "rotate-180" : ""}`} />}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-5 text-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge className="mb-3 bg-white/15 text-white hover:bg-white/15">{copy.sample}</Badge>
                  <h3 className="text-xl font-bold">{copy.job}</h3>
                  <p className="mt-1 text-sm text-white/80">{copy.company}</p>
                </div>
                <Briefcase className="h-8 w-8 text-white/70" />
              </div>
              <div className="mt-5 rounded-xl bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-end justify-between gap-3">
                  <div><p className="text-xs text-white/75">{copy.match}</p><p className="mt-1 text-3xl font-black">82%</p></div>
                  <Badge className="border border-amber-200 bg-amber-100 text-amber-800">{copy.almost}</Badge>
                </div>
                <Progress value={82} className="mt-3 h-2 bg-white/20" />
              </div>
            </div>

            <div className="p-5">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><UserRound className="me-1 h-3 w-3" />{copy.profile}</Badge>
                <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><ShieldCheck className="me-1 h-3 w-3" />{copy.active}</Badge>
              </div>
              <h4 className="mt-5 font-bold text-slate-950">{copy.requirements}</h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {requirements.map((item) => (
                  <div key={item.label} className={`rounded-xl border p-3 ${item.passed ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{item.value}</p>
                      </div>
                      {item.passed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <CircleAlert className="h-5 w-5 text-amber-600" />}
                    </div>
                    <p className={`mt-2 text-xs font-semibold ${item.passed ? "text-emerald-700" : "text-amber-700"}`}>{item.passed ? copy.passed : copy.missing}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-950">{copy.guidance}</p>
                <p className="mt-1 text-sm leading-6 text-amber-900">{copy.guidanceBody}</p>
              </div>
              <Button className="mt-4 w-full" disabled><GraduationCap className="h-4 w-4" />{copy.request}</Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5">
              <h3 className="flex items-center gap-2 font-bold text-indigo-950"><Sparkles className="h-5 w-5" />{copy.managerView}</h3>
              <p className="mt-2 text-sm leading-6 text-indigo-900">{copy.managerBody}</p>
              <div className="mt-4 space-y-2">
                {[
                  isRtl ? "نتيجة النظام: 82٪" : "System result: 82%",
                  isRtl ? "حالة الطالب: بانتظار استكمال الملف" : "Student state: profile action needed",
                  isRtl ? "قرار المدير: لم يُتخذ بعد" : "Manager decision: not reviewed",
                ].map((item) => (
                  <div key={item} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-700">{item}</div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm leading-6 text-emerald-900">{copy.notification}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SafeAdminPreview>
  );
}
