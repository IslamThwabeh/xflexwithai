import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import {
  AlertCircle,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FileLock2,
  Loader2,
  Plus,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type SurveyForm = {
  code: string;
  title: string;
  description: string;
  isActive: boolean;
  isRequired: boolean;
  maxPostponements: string;
  postponeHours: string;
  blockAfterHours: string;
};

type QuestionForm = {
  questionText: string;
  questionType: "short_text" | "long_text" | "single_choice" | "multiple_choice" | "rating";
  isRequired: boolean;
  options: string;
  sortOrder: string;
};

type AssignmentForm = {
  userId: string;
  dueAt: string;
  blockAt: string;
};

type AssignmentSummary = {
  id: number;
  surveyId: number;
  userId: number;
  status: "pending" | "postponed" | "submitted" | "blocked";
  accessState: "clear" | "survey_due" | "blocked";
  dueAt: string | null;
  blockAt: string | null;
  postponementsUsed: number;
  maxPostponements: number;
  submittedAt: string | null;
  studentName?: string | null;
  studentEmail?: string | null;
};

type SurveyAnswer = {
  questionId: number;
  answerText?: string | null;
  answerJson?: string | null;
};

const emptySurveyForm = (): SurveyForm => ({
  code: "",
  title: "",
  description: "",
  isActive: false,
  isRequired: true,
  maxPostponements: "2",
  postponeHours: "24",
  blockAfterHours: "72",
});

const emptyQuestionForm = (): QuestionForm => ({
  questionText: "",
  questionType: "short_text",
  isRequired: true,
  options: "",
  sortOrder: "0",
});

const defaultAssignmentForm = (): AssignmentForm => {
  const now = new Date();
  const due = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const block = new Date(now.getTime() + 72 * 60 * 60 * 1000);
  return {
    userId: "",
    dueAt: toDatetimeLocalValue(due),
    blockAt: toDatetimeLocalValue(block),
  };
};

const questionTypeLabels: Record<string, [string, string]> = {
  short_text: ["Short text", "نص قصير"],
  long_text: ["Long text", "نص طويل"],
  single_choice: ["Single choice", "اختيار واحد"],
  multiple_choice: ["Multiple choice", "اختيارات متعددة"],
  rating: ["Rating 1–5", "تقييم 1–5"],
};

export default function AdminStudentSurveys() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const utils = trpc.useUtils();
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [surveyForm, setSurveyForm] = useState<SurveyForm>(emptySurveyForm);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>(defaultAssignmentForm);

  const availabilityQuery = trpc.studentSurveys.availability.useQuery(undefined, { retry: false });
  const canManage = availabilityQuery.data?.enabled && availabilityQuery.data.access === "admin";

  const surveysQuery = trpc.studentSurveys.listSurveys.useQuery(
    { limit: 100 },
    { enabled: Boolean(canManage), retry: false },
  );
  const surveyQuery = trpc.studentSurveys.getSurvey.useQuery(
    { id: selectedSurveyId ?? 0 },
    { enabled: Boolean(canManage && selectedSurveyId), retry: false },
  );
  const studentsQuery = trpc.notifications.targetStudents.useQuery(undefined, {
    enabled: Boolean(canManage),
    retry: false,
  });
  const assignmentsQuery = trpc.studentSurveys.listAssignments.useQuery(
    { surveyId: selectedSurveyId ?? undefined, limit: 100 },
    { enabled: Boolean(canManage && selectedSurveyId), retry: false },
  );
  const assignmentDetailQuery = trpc.studentSurveys.getMyAssignment.useQuery(
    { id: selectedAssignmentId ?? 0 },
    { enabled: Boolean(canManage && selectedAssignmentId), retry: false },
  );

  useEffect(() => {
    const surveys = surveysQuery.data ?? [];
    if (surveys.length === 0) {
      setSelectedSurveyId(null);
      return;
    }
    if (!surveys.some((survey) => survey.id === selectedSurveyId)) {
      setSelectedSurveyId(surveys[0].id);
    }
  }, [selectedSurveyId, surveysQuery.data]);

  useEffect(() => {
    const assignments = assignmentsQuery.data ?? [];
    if (assignments.length === 0) {
      setSelectedAssignmentId(null);
      return;
    }
    if (!assignments.some((assignment) => assignment.id === selectedAssignmentId)) {
      setSelectedAssignmentId(assignments[0].id);
    }
  }, [assignmentsQuery.data, selectedAssignmentId]);

  const labels = isRtl ? {
    phase: "Phase 2F–2H",
    title: "استبيانات الطلاب",
    subtitle: "إعداد الاستبيانات ومراقبة التعيينات التجريبية وإجابات الطلاب مع جاهزية الإطلاق، التصدير، والتذكير اليدوي الآمن.",
    disabledTitle: "الميزة غير مفعّلة",
    disabledBody: "واجهة إدارة الاستبيانات جاهزة لكنها تبقى مخفية حتى تطبيق migration وتفعيل الخاصية بموافقة منفصلة.",
    forbiddenTitle: "صلاحية المدير مطلوبة",
    forbiddenBody: "إدارة الاستبيانات متاحة للمدير فقط.",
    surveys: "الاستبيانات",
    noSurveys: "لا توجد استبيانات بعد.",
    newSurvey: "استبيان جديد",
    addQuestion: "إضافة سؤال",
    assignPilot: "تعيين تجربة محدودة",
    surveyCode: "كود الاستبيان",
    surveyTitle: "عنوان الاستبيان",
    description: "الوصف",
    active: "نشط محلياً",
    required: "إلزامي",
    maxPostponements: "مرات التأجيل",
    postponeHours: "ساعات التأجيل",
    blockAfterHours: "ساعات قبل الحجب",
    questions: "الأسئلة",
    noQuestions: "أضف سؤالاً واحداً على الأقل قبل التعيين التجريبي.",
    questionText: "نص السؤال",
    questionType: "نوع السؤال",
    options: "الخيارات",
    optionsHint: "اكتب كل خيار في سطر مستقل.",
    student: "الطالب",
    searchStudent: "ابحث بالاسم أو البريد",
    dueAt: "موعد الاستحقاق",
    blockAt: "موعد الحجب النظري",
    pilotGuardrail: "هذه المرحلة لا تحجب أي طالب تلقائياً. التذكير يدوي فقط من المدير ويسجل في سجل التدقيق.",
    save: "حفظ",
    cancel: "إلغاء",
    createSuccess: "تم إنشاء الاستبيان",
    questionSuccess: "تمت إضافة السؤال",
    assignSuccess: "تم تعيين الاستبيان للطالب",
    assignments: "التعيينات التجريبية والإجابات",
    noAssignments: "لا توجد تعيينات لهذا الاستبيان بعد.",
    answers: "إجابات الطالب",
    noAnswers: "لم يتم إرسال إجابات بعد.",
    openAssignment: "عرض",
    submittedAt: "أرسل في",
    status: "الحالة",
    accessState: "حالة الوصول",
    studentEmail: "بريد الطالب",
    blockingOff: "الحجب التدريجي ما زال خلف مفتاح منفصل ومعطل افتراضياً.",
    readiness: "جاهزية الإطلاق التجريبي",
    readinessIntro: "استخدم هذه القائمة قبل طلب تفعيل الاستبيانات على مجموعة صغيرة.",
    featureFlagReady: "مفتاح الاستبيانات مفعل في البيئة الحالية",
    blockingFlagSafe: "مفتاح الحجب التدريجي غير مفعل",
    surveyHasQuestions: "يوجد سؤال واحد على الأقل",
    hasPilotAssignments: "توجد تعيينات تجربة محدودة",
    hasSubmittedAnswers: "توجد إجابات مرسلة للمراجعة",
    pending: "بانتظار التعبئة",
    postponed: "مؤجل",
    submitted: "مرسل",
    blocked: "محجوب",
    exportAssignments: "تصدير التعيينات CSV",
    exportAnswers: "تصدير الإجابات CSV",
    exportEmpty: "لا توجد بيانات للتصدير",
    reminder: "إرسال تذكير",
    reminderSuccess: "تم إرسال التذكير للطالب",
  } : {
    phase: "Phase 2F–2H",
    title: "Student Surveys",
    subtitle: "Prepare surveys, monitor pilot assignments, review answers, and complete rollout readiness, CSV export, and safe manual reminders.",
    disabledTitle: "Feature not enabled",
    disabledBody: "The survey admin interface is ready but remains hidden until the migration is applied and the feature is enabled with separate approval.",
    forbiddenTitle: "Admin access required",
    forbiddenBody: "Survey administration is available only to admins.",
    surveys: "Surveys",
    noSurveys: "No surveys have been created yet.",
    newSurvey: "New survey",
    addQuestion: "Add question",
    assignPilot: "Assign pilot",
    surveyCode: "Survey code",
    surveyTitle: "Survey title",
    description: "Description",
    active: "Locally active",
    required: "Required",
    maxPostponements: "Postponements",
    postponeHours: "Postpone hours",
    blockAfterHours: "Hours before block",
    questions: "Questions",
    noQuestions: "Add at least one question before assigning a pilot.",
    questionText: "Question text",
    questionType: "Question type",
    options: "Options",
    optionsHint: "Put each option on its own line.",
    student: "Student",
    searchStudent: "Search by name or email",
    dueAt: "Due at",
    blockAt: "Theoretical block at",
    pilotGuardrail: "This phase does not automatically block students. Reminders are manual admin actions only and are recorded in the audit log.",
    save: "Save",
    cancel: "Cancel",
    createSuccess: "Survey created",
    questionSuccess: "Question added",
    assignSuccess: "Survey assigned to student",
    assignments: "Pilot assignments & answers",
    noAssignments: "No assignments exist for this survey yet.",
    answers: "Student answers",
    noAnswers: "No answers have been submitted yet.",
    openAssignment: "View",
    submittedAt: "Submitted at",
    status: "Status",
    accessState: "Access state",
    studentEmail: "Student email",
    blockingOff: "Gradual blocking remains behind a separate flag and disabled by default.",
    readiness: "Pilot readiness",
    readinessIntro: "Use this checklist before requesting enablement for a small pilot group.",
    featureFlagReady: "Survey feature flag is enabled in this environment",
    blockingFlagSafe: "Gradual blocking flag is not enabled",
    surveyHasQuestions: "At least one question exists",
    hasPilotAssignments: "Pilot assignments exist",
    hasSubmittedAnswers: "Submitted answers are available for review",
    pending: "Pending",
    postponed: "Postponed",
    submitted: "Submitted",
    blocked: "Blocked",
    exportAssignments: "Export assignments CSV",
    exportAnswers: "Export answers CSV",
    exportEmpty: "No data to export",
    reminder: "Send reminder",
    reminderSuccess: "Reminder sent to student",
  };

  const selectedSurvey = surveyQuery.data;
  const assignments = (assignmentsQuery.data ?? []) as AssignmentSummary[];
  const selectedAssignment = assignmentDetailQuery.data;
  const students = studentsQuery.data ?? [];
  const assignmentStats = useMemo(() => {
    const base = { pending: 0, postponed: 0, submitted: 0, blocked: 0, due: 0 };
    for (const assignment of assignments) {
      base[assignment.status] += 1;
      if (assignment.accessState === "survey_due") base.due += 1;
    }
    return base;
  }, [assignments]);
  const readinessItems = [
    { label: labels.featureFlagReady, ready: Boolean(availabilityQuery.data?.enabled) },
    { label: labels.blockingFlagSafe, ready: !availabilityQuery.data?.blockingEnabled },
    { label: labels.surveyHasQuestions, ready: Boolean(selectedSurvey?.questions?.length) },
    { label: labels.hasPilotAssignments, ready: assignments.length > 0 },
    { label: labels.hasSubmittedAnswers, ready: assignmentStats.submitted > 0 },
  ];
  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    const filtered = query
      ? students.filter((student) =>
        (student.name || "").toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query)
      )
      : students;
    return filtered.slice(0, 50);
  }, [studentSearch, students]);

  const createSurvey = trpc.studentSurveys.createSurvey.useMutation({
    onSuccess: async (survey) => {
      setSurveyDialogOpen(false);
      setSurveyForm(emptySurveyForm());
      setSelectedSurveyId(survey.id);
      await utils.studentSurveys.listSurveys.invalidate();
      toast.success(labels.createSuccess);
    },
    onError: (error) => toast.error(error.message),
  });

  const createQuestion = trpc.studentSurveys.createQuestion.useMutation({
    onSuccess: async () => {
      setQuestionDialogOpen(false);
      setQuestionForm(emptyQuestionForm());
      if (selectedSurveyId) await utils.studentSurveys.getSurvey.invalidate({ id: selectedSurveyId });
      toast.success(labels.questionSuccess);
    },
    onError: (error) => toast.error(error.message),
  });

  const assignSurvey = trpc.studentSurveys.assignSurvey.useMutation({
    onSuccess: async () => {
      setAssignmentDialogOpen(false);
      setAssignmentForm(defaultAssignmentForm());
      setStudentSearch("");
      await utils.studentSurveys.listAssignments.invalidate();
      toast.success(labels.assignSuccess);
    },
    onError: (error) => toast.error(error.message),
  });

  const sendReminder = trpc.studentSurveys.sendAssignmentReminder.useMutation({
    onSuccess: async () => {
      await utils.studentSurveys.listAssignments.invalidate();
      toast.success(labels.reminderSuccess);
    },
    onError: (error) => toast.error(error.message),
  });

  const saveSurvey = () => {
    if (!surveyForm.code.trim() || !surveyForm.title.trim()) return;
    createSurvey.mutate({
      code: surveyForm.code.trim().toLowerCase(),
      title: surveyForm.title.trim(),
      description: surveyForm.description.trim() || null,
      isActive: surveyForm.isActive,
      isRequired: surveyForm.isRequired,
      maxPostponements: Number(surveyForm.maxPostponements) || 0,
      postponeHours: Number(surveyForm.postponeHours) || 24,
      blockAfterHours: Number(surveyForm.blockAfterHours) || 72,
    });
  };

  const saveQuestion = () => {
    if (!selectedSurveyId || !questionForm.questionText.trim()) return;
    const options = questionForm.options
      .split(/\r?\n/)
      .map((option) => option.trim())
      .filter(Boolean);
    createQuestion.mutate({
      surveyId: selectedSurveyId,
      questionText: questionForm.questionText.trim(),
      questionType: questionForm.questionType,
      isRequired: questionForm.isRequired,
      options: options.length > 0 ? options : undefined,
      sortOrder: Number(questionForm.sortOrder) || 0,
    });
  };

  const exportAssignments = () => {
    if (assignments.length === 0) {
      toast.info(labels.exportEmpty);
      return;
    }
    downloadCsvRows(`student-survey-assignments-${selectedSurvey?.code ?? selectedSurveyId ?? "all"}.csv`, assignments.map((assignment) => ({
      assignmentId: assignment.id,
      surveyId: assignment.surveyId,
      surveyTitle: selectedSurvey?.title ?? "",
      studentId: assignment.userId,
      studentName: assignment.studentName ?? "",
      studentEmail: assignment.studentEmail ?? "",
      status: assignment.status,
      accessState: assignment.accessState,
      dueAt: assignment.dueAt ?? "",
      blockAt: assignment.blockAt ?? "",
      submittedAt: assignment.submittedAt ?? "",
      postponementsUsed: assignment.postponementsUsed,
      maxPostponements: assignment.maxPostponements,
    })));
  };

  const exportSelectedAnswers = () => {
    if (!selectedAssignment || selectedAssignment.answers.length === 0) {
      toast.info(labels.exportEmpty);
      return;
    }
    const assignment = assignments.find((item) => item.id === selectedAssignment.id);
    downloadCsvRows(`student-survey-answers-${selectedAssignment.id}.csv`, selectedAssignment.questions.map((question) => {
      const answer = (selectedAssignment.answers as SurveyAnswer[]).find((item) => item.questionId === question.id);
      return {
        assignmentId: selectedAssignment.id,
        surveyId: selectedAssignment.surveyId,
        surveyTitle: selectedAssignment.surveyTitle,
        studentId: selectedAssignment.userId,
        studentEmail: assignment?.studentEmail ?? "",
        questionId: question.id,
        questionType: question.questionType,
        questionText: question.questionText,
        answer: formatAnswer(answer),
        submittedAt: selectedAssignment.submittedAt ?? "",
      };
    }));
  };

  const assignSelectedSurvey = () => {
    if (!selectedSurveyId || !assignmentForm.userId || !assignmentForm.dueAt || !assignmentForm.blockAt) return;
    assignSurvey.mutate({
      surveyId: selectedSurveyId,
      userId: Number(assignmentForm.userId),
      dueAt: datetimeLocalToIso(assignmentForm.dueAt),
      blockAt: datetimeLocalToIso(assignmentForm.blockAt),
    });
  };

  if (availabilityQuery.isLoading) {
    return <PageState icon={<Loader2 className="h-6 w-6 animate-spin" />} title={isRtl ? "جار التحميل..." : "Loading…"} />;
  }

  if (!availabilityQuery.data?.enabled) {
    return <PageState icon={<FileLock2 className="h-7 w-7" />} title={labels.disabledTitle} body={labels.disabledBody} />;
  }

  if (!canManage) {
    return <PageState icon={<AlertCircle className="h-7 w-7" />} title={labels.forbiddenTitle} body={labels.forbiddenBody} />;
  }

  return (
    <DashboardLayout>
      <main className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-emerald-700">
              <ClipboardList className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">{labels.phase}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{labels.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{labels.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setSurveyDialogOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
              <Plus className="h-4 w-4" /> {labels.newSurvey}
            </Button>
            <Button variant="outline" onClick={() => setQuestionDialogOpen(true)} disabled={!selectedSurveyId}>
              <Plus className="h-4 w-4" /> {labels.addQuestion}
            </Button>
            <Button variant="outline" onClick={() => setAssignmentDialogOpen(true)} disabled={!selectedSurveyId || !(selectedSurvey?.questions?.length)}>
              <Send className="h-4 w-4" /> {labels.assignPilot}
            </Button>
            <Button variant="outline" onClick={exportAssignments} disabled={!selectedSurveyId || assignments.length === 0}>
              <Download className="h-4 w-4" /> {labels.exportAssignments}
            </Button>
          </div>
        </header>

        <Card className="border-emerald-200 bg-emerald-50/70 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <p className="text-sm leading-6 text-emerald-950">{labels.pilotGuardrail}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarClock className="h-5 w-5 text-emerald-700" />
              {labels.readiness}
            </CardTitle>
            <p className="text-xs leading-5 text-slate-500">{labels.readinessIntro}</p>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-2 sm:grid-cols-2">
              {readinessItems.map((item) => (
                <div key={item.label} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    item.ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                  }`}>
                    {item.ready ? "✓" : "•"}
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:grid-cols-2">
              <MetricCard label={labels.pending} value={String(assignmentStats.pending)} />
              <MetricCard label={labels.postponed} value={String(assignmentStats.postponed)} />
              <MetricCard label={labels.submitted} value={String(assignmentStats.submitted)} />
              <MetricCard label={labels.blocked} value={String(assignmentStats.blocked)} />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4 text-emerald-700" />
                {labels.surveys}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {surveysQuery.isLoading ? (
                <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
              ) : !(surveysQuery.data?.length) ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">{labels.noSurveys}</p>
              ) : surveysQuery.data.map((survey) => (
                <button
                  key={survey.id}
                  type="button"
                  onClick={() => setSelectedSurveyId(survey.id)}
                  className={`w-full rounded-xl border p-3 text-start transition ${
                    selectedSurveyId === survey.id
                      ? "border-emerald-300 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-emerald-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold text-slate-900">{survey.title}</span>
                    <Badge variant="outline" className={survey.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
                      {survey.isActive ? (isRtl ? "نشط" : "Active") : (isRtl ? "غير نشط" : "Inactive")}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500">{survey.code}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <section className="min-w-0">
            {!selectedSurveyId ? (
              <Card className="border-dashed border-slate-300 bg-slate-50/60">
                <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
                  <ClipboardList className="mb-3 h-9 w-9 text-slate-400" />
                  <p className="max-w-sm text-sm leading-6 text-slate-500">{labels.noSurveys}</p>
                  <Button className="mt-4" onClick={() => setSurveyDialogOpen(true)}>
                    <Plus className="h-4 w-4" /> {labels.newSurvey}
                  </Button>
                </CardContent>
              </Card>
            ) : surveyQuery.isLoading || !selectedSurvey ? (
              <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>
            ) : (
              <div className="space-y-5">
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                  <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500" />
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold text-slate-950">{selectedSurvey.title}</h2>
                          <Badge variant="outline" className={selectedSurvey.isRequired ? "border-amber-200 bg-amber-50 text-amber-700" : ""}>
                            {selectedSurvey.isRequired ? labels.required : (isRtl ? "اختياري" : "Optional")}
                          </Badge>
                        </div>
                        <p className="mt-1 text-sm font-medium text-emerald-700">{selectedSurvey.code}</p>
                        {selectedSurvey.description && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedSurvey.description}</p>}
                      </div>
                      <Button variant="outline" onClick={() => setAssignmentDialogOpen(true)} disabled={selectedSurvey.questions.length === 0}>
                        <Send className="h-4 w-4" /> {labels.assignPilot}
                      </Button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <MetricCard label={labels.maxPostponements} value={String(selectedSurvey.maxPostponements)} />
                      <MetricCard label={labels.postponeHours} value={String(selectedSurvey.postponeHours)} />
                      <MetricCard label={labels.blockAfterHours} value={String(selectedSurvey.blockAfterHours)} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <CheckCircle2 className="h-5 w-5 text-emerald-700" />
                        {labels.questions}
                      </CardTitle>
                      <p className="mt-1 text-xs text-slate-500">{labels.noQuestions}</p>
                    </div>
                    <Button size="sm" onClick={() => setQuestionDialogOpen(true)} className="bg-emerald-700 hover:bg-emerald-800">
                      <Plus className="h-4 w-4" /> {labels.addQuestion}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {selectedSurvey.questions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                        <ClipboardList className="mx-auto mb-2 h-7 w-7 text-slate-400" />
                        <p className="text-sm text-slate-500">{labels.noQuestions}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedSurvey.questions.map((question, index) => (
                          <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700">
                                {index + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <h3 className="font-semibold text-slate-950">{question.questionText}</h3>
                                  <div className="flex flex-wrap gap-2">
                                    <Badge variant="outline">{questionTypeLabel(question.questionType, isRtl)}</Badge>
                                    {question.isRequired && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">{labels.required}</Badge>}
                                  </div>
                                </div>
                                {question.optionsJson && (
                                  <p className="mt-2 text-xs leading-5 text-slate-500">{parseOptionsLabel(question.optionsJson)}</p>
                                )}
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <UserRound className="h-5 w-5 text-emerald-700" />
                      {labels.assignments}
                    </CardTitle>
                    <p className="text-xs leading-5 text-slate-500">{labels.blockingOff}</p>
                  </CardHeader>
                  <CardContent>
                    {assignmentsQuery.isLoading ? (
                      <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
                    ) : assignments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                        <UserRound className="mx-auto mb-2 h-7 w-7 text-slate-400" />
                        <p className="text-sm text-slate-500">{labels.noAssignments}</p>
                      </div>
                    ) : (
                      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                        <div className="space-y-3">
                          {assignments.map((assignment) => (
                            <button
                              key={assignment.id}
                              type="button"
                              onClick={() => setSelectedAssignmentId(assignment.id)}
                              className={`w-full rounded-xl border p-4 text-start transition ${
                                selectedAssignmentId === assignment.id
                                  ? "border-emerald-300 bg-emerald-50"
                                  : "border-slate-200 bg-white hover:border-emerald-200"
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-slate-950">{assignment.studentName || assignment.studentEmail}</p>
                                  <p className="mt-1 text-xs text-slate-500">{assignment.studentEmail}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant="outline" className={statusBadgeClass(assignment.status)}>
                                    {statusLabel(assignment.status, isRtl)}
                                  </Badge>
                                  <Badge variant="outline" className={accessBadgeClass(assignment.accessState)}>
                                    {accessStateLabel(assignment.accessState, isRtl)}
                                  </Badge>
                                </div>
                              </div>
                              <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-3">
                                <span>{labels.dueAt}: {formatDateTime(assignment.dueAt, isRtl)}</span>
                                <span>{labels.submittedAt}: {formatDateTime(assignment.submittedAt, isRtl)}</span>
                                <span>{labels.postponeHours}: {assignment.postponementsUsed}/{assignment.maxPostponements}</span>
                              </div>
                            </button>
                          ))}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          {assignmentDetailQuery.isLoading ? (
                            <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
                          ) : !selectedAssignment ? (
                            <p className="text-sm text-slate-500">{labels.noAssignments}</p>
                          ) : (
                            <div className="space-y-4">
                              <div>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div>
                                    <h3 className="font-semibold text-slate-950">{labels.answers}</h3>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {labels.studentEmail}: {assignments.find((item) => item.id === selectedAssignment.id)?.studentEmail ?? "—"}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" variant="outline" onClick={exportSelectedAnswers} disabled={selectedAssignment.answers.length === 0}>
                                      <Download className="h-4 w-4" /> {labels.exportAnswers}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => sendReminder.mutate({ id: selectedAssignment.id })}
                                      disabled={sendReminder.isPending || selectedAssignment.status === "submitted" || selectedAssignment.status === "blocked" || selectedAssignment.accessState === "blocked"}
                                    >
                                      {sendReminder.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                                      {labels.reminder}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <MetricCard label={labels.status} value={statusLabel(selectedAssignment.status, isRtl)} />
                                <MetricCard label={labels.accessState} value={accessStateLabel(selectedAssignment.accessState, isRtl)} />
                              </div>
                              {selectedAssignment.answers.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">
                                  {labels.noAnswers}
                                </p>
                              ) : (
                                <div className="space-y-3">
                                  {selectedAssignment.questions.map((question) => {
                                    const answer = (selectedAssignment.answers as SurveyAnswer[]).find((item) => item.questionId === question.id);
                                    return (
                                      <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-3">
                                        <p className="text-sm font-semibold text-slate-900">{question.questionText}</p>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                                          {formatAnswer(answer) || "—"}
                                        </p>
                                      </article>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog open={surveyDialogOpen} onOpenChange={setSurveyDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{labels.newSurvey}</DialogTitle>
            <DialogDescription>{labels.pilotGuardrail}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label={labels.surveyCode} required>
              <Input value={surveyForm.code} maxLength={80} placeholder="pilot-checkin" onChange={(event) => setSurveyForm({ ...surveyForm, code: event.target.value })} />
            </Field>
            <Field label={labels.surveyTitle} required>
              <Input value={surveyForm.title} maxLength={300} onChange={(event) => setSurveyForm({ ...surveyForm, title: event.target.value })} />
            </Field>
            <Field label={labels.description}>
              <Textarea rows={4} value={surveyForm.description} maxLength={5000} onChange={(event) => setSurveyForm({ ...surveyForm, description: event.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={labels.maxPostponements}>
                <Input type="number" min={0} max={30} value={surveyForm.maxPostponements} onChange={(event) => setSurveyForm({ ...surveyForm, maxPostponements: event.target.value })} />
              </Field>
              <Field label={labels.postponeHours}>
                <Input type="number" min={1} max={720} value={surveyForm.postponeHours} onChange={(event) => setSurveyForm({ ...surveyForm, postponeHours: event.target.value })} />
              </Field>
              <Field label={labels.blockAfterHours}>
                <Input type="number" min={1} max={2160} value={surveyForm.blockAfterHours} onChange={(event) => setSurveyForm({ ...surveyForm, blockAfterHours: event.target.value })} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={surveyForm.isRequired} onChange={(event) => setSurveyForm({ ...surveyForm, isRequired: event.target.checked })} />
                {labels.required}
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={surveyForm.isActive} onChange={(event) => setSurveyForm({ ...surveyForm, isActive: event.target.checked })} />
                {labels.active}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSurveyDialogOpen(false)}>{labels.cancel}</Button>
            <Button onClick={saveSurvey} disabled={createSurvey.isPending || !surveyForm.code.trim() || !surveyForm.title.trim()}>
              {createSurvey.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={questionDialogOpen} onOpenChange={setQuestionDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{labels.addQuestion}</DialogTitle>
            <DialogDescription>{selectedSurvey?.title ?? labels.surveys}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label={labels.questionText} required>
              <Input value={questionForm.questionText} maxLength={300} onChange={(event) => setQuestionForm({ ...questionForm, questionText: event.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={labels.questionType}>
                <select
                  value={questionForm.questionType}
                  onChange={(event) => setQuestionForm({ ...questionForm, questionType: event.target.value as QuestionForm["questionType"] })}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                >
                  {Object.keys(questionTypeLabels).map((type) => (
                    <option key={type} value={type}>{questionTypeLabel(type, isRtl)}</option>
                  ))}
                </select>
              </Field>
              <Field label={isRtl ? "الترتيب" : "Sort order"}>
                <Input type="number" min={0} max={1000} value={questionForm.sortOrder} onChange={(event) => setQuestionForm({ ...questionForm, sortOrder: event.target.value })} />
              </Field>
            </div>
            {["single_choice", "multiple_choice"].includes(questionForm.questionType) && (
              <Field label={labels.options} required>
                <Textarea rows={5} value={questionForm.options} placeholder={labels.optionsHint} onChange={(event) => setQuestionForm({ ...questionForm, options: event.target.value })} />
              </Field>
            )}
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={questionForm.isRequired} onChange={(event) => setQuestionForm({ ...questionForm, isRequired: event.target.checked })} />
              {labels.required}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuestionDialogOpen(false)}>{labels.cancel}</Button>
            <Button onClick={saveQuestion} disabled={createQuestion.isPending || !selectedSurveyId || !questionForm.questionText.trim()}>
              {createQuestion.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {labels.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignmentDialogOpen} onOpenChange={setAssignmentDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{labels.assignPilot}</DialogTitle>
            <DialogDescription>{labels.pilotGuardrail}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label={labels.searchStudent}>
              <Input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} />
            </Field>
            <Field label={labels.student} required>
              <select
                value={assignmentForm.userId}
                onChange={(event) => setAssignmentForm({ ...assignmentForm, userId: event.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">{isRtl ? "اختر طالباً..." : "Select a student..."}</option>
                {filteredStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name || student.email} — {student.email}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={labels.dueAt} required>
                <Input type="datetime-local" value={assignmentForm.dueAt} onChange={(event) => setAssignmentForm({ ...assignmentForm, dueAt: event.target.value })} />
              </Field>
              <Field label={labels.blockAt} required>
                <Input type="datetime-local" value={assignmentForm.blockAt} onChange={(event) => setAssignmentForm({ ...assignmentForm, blockAt: event.target.value })} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignmentDialogOpen(false)}>{labels.cancel}</Button>
            <Button onClick={assignSelectedSurvey} disabled={assignSurvey.isPending || !assignmentForm.userId || !assignmentForm.dueAt || !assignmentForm.blockAt}>
              {assignSurvey.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {labels.assignPilot}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function PageState({ icon, title, body }: { icon: React.ReactNode; title: string; body?: string }) {
  return (
    <DashboardLayout>
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg border-slate-200 text-center shadow-sm">
          <CardContent className="flex flex-col items-center p-8">
            <div className="mb-4 rounded-2xl bg-slate-100 p-3 text-slate-600">{icon}</div>
            <h1 className="text-xl font-bold text-slate-950">{title}</h1>
            {body && <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  );
}

function questionTypeLabel(type: string, isRtl: boolean) {
  return questionTypeLabels[type]?.[isRtl ? 1 : 0] ?? type;
}

function parseOptionsLabel(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.join(" · ") : value;
  } catch {
    return value;
  }
}

function statusLabel(status: string, isRtl: boolean) {
  const labels: Record<string, [string, string]> = {
    pending: ["Pending", "بانتظار التعبئة"],
    postponed: ["Postponed", "مؤجل"],
    submitted: ["Submitted", "مرسل"],
    blocked: ["Blocked", "محجوب"],
  };
  return labels[status]?.[isRtl ? 1 : 0] ?? status;
}

function accessStateLabel(accessState: string, isRtl: boolean) {
  const labels: Record<string, [string, string]> = {
    clear: ["Clear", "سليم"],
    survey_due: ["Due", "مستحق"],
    blocked: ["Blocked", "محجوب"],
  };
  return labels[accessState]?.[isRtl ? 1 : 0] ?? accessState;
}

function statusBadgeClass(status: string) {
  if (status === "submitted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  if (status === "postponed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function accessBadgeClass(accessState: string) {
  if (accessState === "blocked") return "border-red-200 bg-red-50 text-red-700";
  if (accessState === "survey_due") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function formatAnswer(answer: SurveyAnswer | undefined) {
  if (!answer) return "";
  if (answer.answerJson) {
    try {
      const parsed = JSON.parse(answer.answerJson);
      if (Array.isArray(parsed)) return parsed.join(" · ");
      if (parsed && typeof parsed === "object") return JSON.stringify(parsed);
    } catch {
      return answer.answerJson;
    }
  }
  return answer.answerText ?? "";
}

function formatDateTime(value: string | null | undefined, isRtl: boolean) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(isRtl ? "ar-JO" : "en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDatetimeLocalValue(date: Date) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function datetimeLocalToIso(value: string) {
  return new Date(value).toISOString();
}

function downloadCsvRows(filename: string, rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.map(csvEscapeCell).join(","),
    ...rows.map((row) => headers.map((header) => csvEscapeCell(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvEscapeCell(value: string | number | boolean | null | undefined) {
  const text = value == null ? "" : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}
