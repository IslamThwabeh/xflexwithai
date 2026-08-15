import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  SEO_OWNER_INTAKE_QUESTIONS,
  SEO_OWNER_INTAKE_REQUIRED_IDS,
  SEO_OWNER_INTAKE_SECTIONS,
} from "@shared/seoOwnerIntake";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ar", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Amman",
  }).format(date);
};

export default function AdminSeoOwnerIntake() {
  const utils = trpc.useUtils();
  const intakeQuery = trpc.seoOwnerIntake.get.useQuery();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [intakeStatus, setIntakeStatus] = useState<"draft" | "submitted">(
    "draft"
  );
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const answersRef = useRef<Record<string, string>>({});
  const dirtyQuestionIdsRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  const saveMutation = trpc.seoOwnerIntake.save.useMutation();
  const submitMutation = trpc.seoOwnerIntake.submit.useMutation();

  useEffect(() => {
    if (!intakeQuery.data || initializedRef.current) return;
    initializedRef.current = true;
    answersRef.current = intakeQuery.data.answers;
    setAnswers(intakeQuery.data.answers);
    setLastSavedAt(intakeQuery.data.updatedAt);
    setIntakeStatus(intakeQuery.data.status);
    setSubmittedAt(intakeQuery.data.submittedAt);
    setSaveState("saved");
  }, [intakeQuery.data]);

  const answeredCount = useMemo(
    () =>
      SEO_OWNER_INTAKE_QUESTIONS.filter(item => answers[item.id]?.trim())
        .length,
    [answers]
  );
  const missingRequiredIds = useMemo(
    () => SEO_OWNER_INTAKE_REQUIRED_IDS.filter(id => !answers[id]?.trim()),
    [answers]
  );
  const progress = Math.round(
    (answeredCount / SEO_OWNER_INTAKE_QUESTIONS.length) * 100
  );

  const flushDirtyAnswers = async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const questionIds = [...dirtyQuestionIdsRef.current];
    if (questionIds.length === 0) return;
    const patch = Object.fromEntries(
      questionIds.map(questionId => [
        questionId,
        answersRef.current[questionId] ?? "",
      ])
    );
    questionIds.forEach(questionId =>
      dirtyQuestionIdsRef.current.delete(questionId)
    );
    setSaveState("saving");
    try {
      const result = await saveMutation.mutateAsync({ answers: patch });
      setLastSavedAt(result.savedAt);
      setIntakeStatus("draft");
      setSubmittedAt(null);
      setSaveState(dirtyQuestionIdsRef.current.size > 0 ? "dirty" : "saved");
    } catch (error) {
      questionIds.forEach(questionId =>
        dirtyQuestionIdsRef.current.add(questionId)
      );
      setSaveState("error");
      toast.error("تعذر الحفظ التلقائي. حاولي مرة أخرى قبل مغادرة الصفحة.");
    }
  };

  const updateAnswer = (questionId: string, value: string) => {
    const next = { ...answersRef.current, [questionId]: value };
    answersRef.current = next;
    setAnswers(next);
    dirtyQuestionIdsRef.current.add(questionId);
    setIntakeStatus("draft");
    setSubmittedAt(null);
    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushDirtyAnswers(), 900);
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "hidden" &&
        dirtyQuestionIdsRef.current.size > 0
      ) {
        void flushDirtyAnswers();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // The handler reads current values from refs intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (missingRequiredIds.length > 0) {
      toast.error(
        `أكملي ${missingRequiredIds.length} إجابة أساسية قبل الإرسال.`
      );
      return;
    }
    if (
      !window.confirm("هل راجعتِ الإجابات الأساسية وتريدين إرسالها للمراجعة؟")
    )
      return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaveState("saving");
    try {
      const result = await submitMutation.mutateAsync({
        answers: answersRef.current,
      });
      dirtyQuestionIdsRef.current.clear();
      setSaveState("saved");
      setIntakeStatus("submitted");
      setSubmittedAt(result.submittedAt);
      setLastSavedAt(result.submittedAt);
      await utils.seoOwnerIntake.get.invalidate();
      toast.success("تم حفظ الإجابات وإرسالها للمراجعة.");
    } catch {
      setSaveState("error");
      toast.error(
        "تعذر إرسال الإجابات. راجعي الحقول المطلوبة وحاولي مرة أخرى."
      );
    }
  };

  if (intakeQuery.isLoading) {
    return (
      <DashboardLayout>
        <div
          className="flex min-h-[60vh] items-center justify-center"
          dir="rtl"
        >
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (intakeQuery.error) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-3xl p-6" dir="rtl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
            تعذر تحميل نموذج الظهور العضوي. حدّثي الصفحة أو تواصلي مع الإدارة.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-7" dir="rtl">
        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-950 to-slate-950 p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex items-center gap-2 text-emerald-200">
                <ClipboardList className="h-5 w-5" />
                <span className="text-sm font-semibold">
                  خطة الظهور العضوي ونتائج البحث بالذكاء الاصطناعي
                </span>
              </div>
              <h1 className="text-2xl font-bold md:text-3xl">
                أسئلة صاحبة العمل
              </h1>
              <p className="mt-3 leading-7 text-slate-200">
                تساعدنا إجاباتك على كتابة محتوى عربي أصلي ودقيق عن XFlex. تُحفظ
                الإجابات تلقائياً في قاعدة البيانات، ويمكنك العودة إلى الرابط
                نفسه ومتابعة التعبئة.
              </p>
            </div>
            <Badge
              className={
                intakeStatus === "submitted"
                  ? "bg-emerald-500 text-white"
                  : "bg-amber-400 text-slate-950"
              }
            >
              {intakeStatus === "submitted" ? "مُرسل للمراجعة" : "مسودة محفوظة"}
            </Badge>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-sm text-slate-300">التقدم</div>
              <div className="mt-1 text-2xl font-bold">
                {answeredCount} / {SEO_OWNER_INTAKE_QUESTIONS.length}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-sm text-slate-300">
                الإجابات الأساسية المتبقية
              </div>
              <div className="mt-1 text-2xl font-bold">
                {missingRequiredIds.length}
              </div>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-sm text-slate-300">آخر حفظ بتوقيت عمّان</div>
              <div className="mt-1 text-sm font-semibold">
                {formatDateTime(lastSavedAt)}
              </div>
            </div>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="space-y-1 text-sm leading-6">
              <p className="font-bold">مهم قبل الإجابة</p>
              <p>
                اكتبي معلومات يمكن نشرها للعامة فقط. لا تضعي كلمات مرور أو
                بيانات خاصة بالعملاء. اكتبي «غير متاح للنشر» عندما لا ينبغي نشر
                الإجابة.
              </p>
              <p>
                الحقول المعلّمة «أساسي للمقال الأول» يجب مراجعتها قبل إرسال
                النموذج.
              </p>
            </div>
          </div>
        </section>

        {SEO_OWNER_INTAKE_SECTIONS.map(section => (
          <section
            key={section.id}
            className="rounded-3xl border bg-white p-5 shadow-sm md:p-7"
          >
            <h2 className="mb-6 text-xl font-bold text-slate-900">
              {section.title}
            </h2>
            <div className="space-y-6">
              {section.questions.map(item => (
                <label key={item.id} className="block">
                  <div className="mb-2 flex flex-wrap items-start gap-2 text-sm font-semibold text-slate-800">
                    <span>
                      {item.number}. {item.text}
                    </span>
                    {item.requiredForFirstArticle ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 text-emerald-800"
                      >
                        أساسي للمقال الأول
                      </Badge>
                    ) : null}
                  </div>
                  <textarea
                    value={answers[item.id] ?? ""}
                    onChange={event =>
                      updateAnswer(item.id, event.target.value)
                    }
                    onBlur={() => void flushDirtyAnswers()}
                    maxLength={5000}
                    rows={4}
                    className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base leading-7 text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
                    placeholder="اكتبي الإجابة هنا…"
                  />
                  <div
                    className="mt-1 text-left text-xs text-slate-400"
                    dir="ltr"
                  >
                    {(answers[item.id] ?? "").length} / 5000
                  </div>
                </label>
              ))}
            </div>
          </section>
        ))}

        <section className="sticky bottom-3 z-10 rounded-2xl border bg-white/95 p-4 shadow-2xl backdrop-blur md:flex md:items-center md:justify-between">
          <div className="mb-3 flex items-center gap-2 text-sm md:mb-0">
            {saveState === "saving" ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            ) : null}
            {saveState === "saved" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : null}
            {saveState === "dirty" ? (
              <Save className="h-4 w-4 text-amber-600" />
            ) : null}
            {saveState === "error" ? (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            ) : null}
            <span className="text-slate-600">
              {saveState === "saving"
                ? "جارٍ الحفظ…"
                : saveState === "dirty"
                  ? "توجد تعديلات بانتظار الحفظ"
                  : saveState === "error"
                    ? "تعذر الحفظ"
                    : "تم حفظ الإجابات تلقائياً"}
            </span>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => void flushDirtyAnswers()}
              disabled={
                saveMutation.isPending || dirtyQuestionIdsRef.current.size === 0
              }
            >
              <Save className="h-4 w-4" />
              حفظ الآن
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={
                submitMutation.isPending || missingRequiredIds.length > 0
              }
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {submitMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              إرسال للمراجعة
            </Button>
          </div>
        </section>

        {intakeStatus === "submitted" ? (
          <p className="pb-5 text-center text-sm text-slate-500">
            تم الإرسال في {formatDateTime(submittedAt)}. أي تعديل جديد سيعيد
            الحالة إلى مسودة حتى يتم الإرسال مرة أخرى.
          </p>
        ) : null}
      </main>
    </DashboardLayout>
  );
}
