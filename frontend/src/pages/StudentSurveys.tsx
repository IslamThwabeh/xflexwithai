import ClientLayout from "@/components/ClientLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileLock2,
  Loader2,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

type AssignmentSummary = {
  id: number;
  status: "pending" | "postponed" | "submitted" | "blocked";
  accessState: "clear" | "survey_due" | "blocked";
  dueAt: string | null;
  blockAt?: string | null;
  surveyTitle: string;
  surveyIsRequired: boolean;
  postponementsUsed: number;
  maxPostponements: number;
};

type SurveyQuestion = {
  id: number;
  questionText: string;
  questionType: "short_text" | "long_text" | "single_choice" | "multiple_choice" | "rating";
  isRequired: boolean;
  optionsJson?: string | null;
};

type AnswerValue = string | string[];

function parseOptions(optionsJson: string | null | undefined): string[] {
  if (!optionsJson) return [];
  try {
    const parsed = JSON.parse(optionsJson);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function formatDateTime(value: string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitialAnswerValue(question: SurveyQuestion, answers: Array<{ questionId: number; answerText?: string | null; answerJson?: string | null }>): AnswerValue {
  const answer = answers.find((item) => item.questionId === question.id);
  if (question.questionType === "multiple_choice") {
    if (!answer?.answerJson) return [];
    try {
      const parsed = JSON.parse(answer.answerJson);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return answer?.answerText ?? "";
}

function statusBadgeClass(status: AssignmentSummary["status"]) {
  if (status === "submitted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  if (status === "postponed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function StudentSurveys() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const locale = isRtl ? "ar-JO" : "en-US";
  const utils = trpc.useUtils();
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, AnswerValue>>({});

  const labels = isRtl ? {
    title: "استبيانات الطلاب",
    subtitle: "أكمل الاستبيانات المطلوبة أو أجّلها ضمن الحدود المسموحة. هذه المرحلة لا تفعّل الحجب التلقائي على الموقع.",
    disabledTitle: "الميزة غير مفعّلة",
    disabledBody: "صفحة الاستبيانات جاهزة لكنها تبقى مخفية حتى تفعيل الخاصية بموافقة منفصلة.",
    noAssignmentsTitle: "لا توجد استبيانات حالياً",
    noAssignmentsBody: "عند تعيين استبيان لك سيظهر هنا لتعبئته.",
    loading: "جار التحميل...",
    required: "إلزامي",
    optional: "اختياري",
    status: "الحالة",
    dueAt: "موعد الاستحقاق",
    blockAt: "موعد الحجب النظري",
    postponements: "التأجيل",
    postpone: "تأجيل",
    submit: "إرسال الاستبيان",
    submitted: "تم إرسال هذا الاستبيان.",
    blockedTitle: "الاستبيان محجوب",
    blockedBody: "انتهت مهلة هذا الاستبيان. تواصل مع الدعم أو الإدارة لمراجعته.",
    dueNoticeTitle: "استبيان مستحق",
    dueNoticeBody: "يرجى إكمال الاستبيان أو استخدام التأجيل إذا كان ما زال متاحاً.",
    draftNoticeTitle: "جاهز للتعبئة",
    draftNoticeBody: "يمكنك إرسال الإجابات قبل موعد الاستحقاق أيضاً.",
    selectPlaceholder: "اختر إجابة",
    answerPlaceholder: "اكتب إجابتك",
    longAnswerPlaceholder: "اكتب تفاصيل أكثر هنا",
    missingRequired: "يرجى تعبئة كل الأسئلة الإلزامية.",
    submitSuccess: "تم إرسال الاستبيان بنجاح",
    postponeSuccess: "تم تأجيل الاستبيان",
  } : {
    title: "Student Surveys",
    subtitle: "Complete assigned surveys or postpone within the allowed limits. This phase does not enforce site-wide blocking.",
    disabledTitle: "Feature not enabled",
    disabledBody: "The survey page is ready but remains hidden until the feature is enabled with separate approval.",
    noAssignmentsTitle: "No surveys right now",
    noAssignmentsBody: "Assigned surveys will appear here when a manager starts a pilot.",
    loading: "Loading…",
    required: "Required",
    optional: "Optional",
    status: "Status",
    dueAt: "Due at",
    blockAt: "Theoretical block at",
    postponements: "Postponements",
    postpone: "Postpone",
    submit: "Submit survey",
    submitted: "This survey has been submitted.",
    blockedTitle: "Survey blocked",
    blockedBody: "This survey is past its blocking deadline. Contact support or administration for review.",
    dueNoticeTitle: "Survey due",
    dueNoticeBody: "Please complete the survey or postpone it if postponement is still available.",
    draftNoticeTitle: "Ready to complete",
    draftNoticeBody: "You can submit your answers before the due time too.",
    selectPlaceholder: "Choose an answer",
    answerPlaceholder: "Write your answer",
    longAnswerPlaceholder: "Write more detail here",
    missingRequired: "Please answer all required questions.",
    submitSuccess: "Survey submitted",
    postponeSuccess: "Survey postponed",
  };

  const availabilityQuery = trpc.studentSurveys.availability.useQuery(undefined, { retry: false });
  const isEnabled = availabilityQuery.data?.enabled === true;
  const assignmentsQuery = trpc.studentSurveys.myAssignments.useQuery(
    { limit: 50 },
    { enabled: isEnabled, retry: false },
  );
  const assignmentQuery = trpc.studentSurveys.getMyAssignment.useQuery(
    { id: selectedAssignmentId ?? 0 },
    { enabled: Boolean(isEnabled && selectedAssignmentId), retry: false },
  );

  const assignments = (assignmentsQuery.data ?? []) as AssignmentSummary[];
  const selectedAssignment = assignmentQuery.data;
  const questions = (selectedAssignment?.questions ?? []) as SurveyQuestion[];

  useEffect(() => {
    if (assignments.length === 0) {
      setSelectedAssignmentId(null);
      return;
    }

    if (selectedAssignmentId && assignments.some((assignment) => assignment.id === selectedAssignmentId)) {
      return;
    }

    const firstActionable = assignments.find((assignment) => assignment.status !== "submitted") ?? assignments[0];
    setSelectedAssignmentId(firstActionable.id);
  }, [assignments, selectedAssignmentId]);

  useEffect(() => {
    if (!selectedAssignment) {
      setAnswers({});
      return;
    }

    const nextAnswers: Record<number, AnswerValue> = {};
    for (const question of questions) {
      nextAnswers[question.id] = getInitialAnswerValue(question, selectedAssignment.answers ?? []);
    }
    setAnswers(nextAnswers);
  }, [questions, selectedAssignment]);

  const postponeSurvey = trpc.studentSurveys.postpone.useMutation({
    onSuccess: async () => {
      toast.success(labels.postponeSuccess);
      await utils.studentSurveys.myAssignments.invalidate();
      if (selectedAssignmentId) await utils.studentSurveys.getMyAssignment.invalidate({ id: selectedAssignmentId });
    },
    onError: (error) => toast.error(error.message),
  });

  const submitSurvey = trpc.studentSurveys.submit.useMutation({
    onSuccess: async () => {
      toast.success(labels.submitSuccess);
      await utils.studentSurveys.myAssignments.invalidate();
      if (selectedAssignmentId) await utils.studentSurveys.getMyAssignment.invalidate({ id: selectedAssignmentId });
    },
    onError: (error) => toast.error(error.message),
  });

  const statusLabel = useMemo(() => ({
    pending: isRtl ? "بانتظار التعبئة" : "Pending",
    postponed: isRtl ? "مؤجل" : "Postponed",
    submitted: isRtl ? "مرسل" : "Submitted",
    blocked: isRtl ? "محجوب" : "Blocked",
  }), [isRtl]);

  const canPostpone = Boolean(
    selectedAssignment &&
    ["pending", "postponed"].includes(selectedAssignment.status) &&
    selectedAssignment.accessState !== "blocked" &&
    selectedAssignment.postponementsUsed < selectedAssignment.maxPostponements,
  );
  const canSubmit = Boolean(
    selectedAssignment &&
    selectedAssignment.status !== "submitted" &&
    selectedAssignment.accessState !== "blocked" &&
    questions.length > 0,
  );

  const updateAnswer = (questionId: number, value: AnswerValue) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  };

  const toggleMultiChoice = (questionId: number, option: string, checked: boolean) => {
    const current = answers[questionId];
    const values = Array.isArray(current) ? current : [];
    updateAnswer(
      questionId,
      checked ? [...values, option] : values.filter((value) => value !== option),
    );
  };

  const handleSubmit = () => {
    if (!selectedAssignment) return;

    const hasMissingRequired = questions.some((question) => {
      const value = answers[question.id];
      if (question.questionType === "multiple_choice") {
        return question.isRequired && (!Array.isArray(value) || value.length === 0);
      }
      return question.isRequired && String(value ?? "").trim().length === 0;
    });

    if (hasMissingRequired) {
      toast.error(labels.missingRequired);
      return;
    }

    submitSurvey.mutate({
      id: selectedAssignment.id,
      answers: questions.map((question) => {
        const value = answers[question.id];
        if (question.questionType === "multiple_choice") {
          const values = Array.isArray(value) ? value : [];
          return {
            questionId: question.id,
            answerText: values.join(", "),
            answerJson: JSON.stringify(values),
          };
        }
        return {
          questionId: question.id,
          answerText: String(value ?? "").trim(),
          answerJson: null,
        };
      }),
    });
  };

  if (availabilityQuery.isLoading) {
    return <PageState title={labels.loading} icon={<Loader2 className="h-6 w-6 animate-spin" />} />;
  }

  if (!isEnabled) {
    return <PageState title={labels.disabledTitle} body={labels.disabledBody} icon={<FileLock2 className="h-7 w-7" />} />;
  }

  if (assignmentsQuery.isLoading) {
    return <PageState title={labels.loading} icon={<Loader2 className="h-6 w-6 animate-spin" />} />;
  }

  if (assignments.length === 0) {
    return <PageState title={labels.noAssignmentsTitle} body={labels.noAssignmentsBody} icon={<ClipboardCheck className="h-7 w-7" />} />;
  }

  const notice = selectedAssignment?.accessState === "blocked"
    ? { icon: <AlertCircle className="h-4 w-4" />, title: labels.blockedTitle, body: labels.blockedBody, className: "border-red-200 bg-red-50 text-red-900" }
    : selectedAssignment?.accessState === "survey_due"
      ? { icon: <CalendarClock className="h-4 w-4" />, title: labels.dueNoticeTitle, body: labels.dueNoticeBody, className: "border-amber-200 bg-amber-50 text-amber-900" }
      : { icon: <Clock3 className="h-4 w-4" />, title: labels.draftNoticeTitle, body: labels.draftNoticeBody, className: "border-emerald-200 bg-emerald-50 text-emerald-900" };

  return (
    <ClientLayout>
      <div className="min-h-[calc(100vh-64px)] bg-[var(--color-xf-cream)]">
        <main className="container mx-auto px-4 py-8">
          <div className="mb-6">
            <Badge className="mb-3 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Phase 2C</Badge>
            <h1 className="text-3xl font-bold text-slate-900">{labels.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{labels.subtitle}</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                  {labels.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignments.map((assignment) => (
                  <button
                    key={assignment.id}
                    type="button"
                    onClick={() => setSelectedAssignmentId(assignment.id)}
                    className={`w-full rounded-xl border p-3 text-start transition ${
                      assignment.id === selectedAssignmentId
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-emerald-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{assignment.surveyTitle}</p>
                      <Badge variant="outline" className={statusBadgeClass(assignment.status)}>
                        {statusLabel[assignment.status]}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{labels.dueAt}: {formatDateTime(assignment.dueAt, locale)}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Alert className={notice.className}>
                {notice.icon}
                <AlertTitle>{notice.title}</AlertTitle>
                <AlertDescription>{notice.body}</AlertDescription>
              </Alert>

              <Card>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-2xl">{selectedAssignment?.surveyTitle}</CardTitle>
                      {selectedAssignment?.surveyDescription && (
                        <p className="mt-2 text-sm leading-6 text-slate-600">{selectedAssignment.surveyDescription}</p>
                      )}
                    </div>
                    {selectedAssignment && (
                      <Badge variant="outline" className={statusBadgeClass(selectedAssignment.status)}>
                        {statusLabel[selectedAssignment.status]}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {selectedAssignment && (
                    <div className="grid gap-3 md:grid-cols-4">
                      <MetricCard label={labels.status} value={statusLabel[selectedAssignment.status]} />
                      <MetricCard label={labels.dueAt} value={formatDateTime(selectedAssignment.dueAt, locale)} />
                      <MetricCard label={labels.blockAt} value={formatDateTime(selectedAssignment.blockAt, locale)} />
                      <MetricCard label={labels.postponements} value={`${selectedAssignment.postponementsUsed}/${selectedAssignment.maxPostponements}`} />
                    </div>
                  )}

                  {assignmentQuery.isLoading ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">
                      <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                      {labels.loading}
                    </div>
                  ) : selectedAssignment?.status === "submitted" ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                      <CheckCircle2 className="mb-2 h-5 w-5" />
                      {labels.submitted}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {questions.map((question, index) => (
                        <QuestionField
                          key={question.id}
                          index={index}
                          question={question}
                          value={answers[question.id]}
                          labels={labels}
                          disabled={!canSubmit || submitSurvey.isPending}
                          onChange={(value) => updateAnswer(question.id, value)}
                          onToggle={(option, checked) => toggleMultiChoice(question.id, option, checked)}
                        />
                      ))}
                    </div>
                  )}

                  {selectedAssignment?.status !== "submitted" && (
                    <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
                      <Button
                        variant="outline"
                        onClick={() => selectedAssignment && postponeSurvey.mutate({ id: selectedAssignment.id })}
                        disabled={!canPostpone || postponeSurvey.isPending}
                      >
                        {postponeSurvey.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        {labels.postpone}
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={!canSubmit || submitSurvey.isPending}
                        className="bg-emerald-700 hover:bg-emerald-800"
                      >
                        {submitSurvey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {labels.submit}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </ClientLayout>
  );
}

function QuestionField({
  index,
  question,
  value,
  labels,
  disabled,
  onChange,
  onToggle,
}: {
  index: number;
  question: SurveyQuestion;
  value: AnswerValue | undefined;
  labels: Record<string, string>;
  disabled: boolean;
  onChange: (value: AnswerValue) => void;
  onToggle: (option: string, checked: boolean) => void;
}) {
  const options = parseOptions(question.optionsJson);

  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {index + 1}. {question.questionText}
          </p>
        </div>
        <Badge variant="outline" className={question.isRequired ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"}>
          {question.isRequired ? labels.required : labels.optional}
        </Badge>
      </div>

      {question.questionType === "long_text" && (
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={labels.longAnswerPlaceholder}
          disabled={disabled}
          rows={4}
        />
      )}

      {question.questionType === "short_text" && (
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={labels.answerPlaceholder}
          disabled={disabled}
        />
      )}

      {question.questionType === "single_choice" && (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="">{labels.selectPlaceholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      )}

      {question.questionType === "multiple_choice" && (
        <div className="space-y-2">
          {options.map((option) => {
            const values = Array.isArray(value) ? value : [];
            return (
              <label key={option} className="flex items-center gap-2 rounded-lg border border-slate-100 p-3 text-sm">
                <Checkbox
                  checked={values.includes(option)}
                  onCheckedChange={(checked) => onToggle(option, checked === true)}
                  disabled={disabled}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      )}

      {question.questionType === "rating" && (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        >
          <option value="">{labels.selectPlaceholder}</option>
          {[1, 2, 3, 4, 5].map((rating) => (
            <option key={rating} value={String(rating)}>{rating}</option>
          ))}
        </select>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PageState({ title, body, icon }: { title: string; body?: string; icon: ReactNode }) {
  return (
    <ClientLayout>
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[var(--color-xf-cream)] px-4">
        <Card className="max-w-lg text-center">
          <CardContent className="pt-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              {icon}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{title}</h1>
            {body && <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}
