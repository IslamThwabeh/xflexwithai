import DashboardLayout from "@/components/DashboardLayout";
import {
  SurveyStudentPreview,
  type PreviewSurvey,
} from "@/components/student-surveys/SurveyStudentPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  generateStudentSurveyReference,
  getStudentSurveyCreateErrorMessage,
  isValidStudentSurveyReference,
} from "@/lib/studentSurveyReference";
import { trpc } from "@/lib/trpc";
import {
  MAX_STUDENT_SURVEY_CHOICE_OPTIONS,
  isStudentSurveyChoiceQuestionType,
  validateStudentSurveyChoiceOptions,
} from "@shared/studentSurveyQuestionOptions";
import {
  AlertCircle,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Eye,
  FileLock2,
  History,
  ListChecks,
  Loader2,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

type WorkspaceTab = "overview" | "builder" | "distribution" | "responses" | "preview" | "audit";
type AudienceMode = "single" | "selected" | "active_package" | "inactive_package" | "all";
type ResponseFilter = "all" | "awaiting" | "overdue" | "submitted" | "blocked";

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
  options: string[];
  sortOrder: string;
};

type DistributionForm = {
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
  surveyIsActive: boolean;
  surveyIsRequired: boolean;
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

const newSurveyForm = (): SurveyForm => ({
  ...emptySurveyForm(),
  code: generateStudentSurveyReference(),
});

const emptyQuestionForm = (): QuestionForm => ({
  questionText: "",
  questionType: "short_text",
  isRequired: true,
  options: ["", ""],
  sortOrder: "0",
});

const defaultDistributionForm = (): DistributionForm => {
  const now = new Date();
  return {
    dueAt: toDatetimeLocalValue(new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    blockAt: toDatetimeLocalValue(new Date(now.getTime() + 72 * 60 * 60 * 1000)),
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
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(getInitialTab);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false);
  const [editingSurveyId, setEditingSurveyId] = useState<number | null>(null);
  const [questionDialogOpen, setQuestionDialogOpen] = useState(false);
  const [surveyForm, setSurveyForm] = useState<SurveyForm>(emptySurveyForm);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(emptyQuestionForm);
  const [audienceMode, setAudienceMode] = useState<AudienceMode>("single");
  const [audienceUserIds, setAudienceUserIds] = useState<number[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [distributionForm, setDistributionForm] = useState<DistributionForm>(defaultDistributionForm);
  const [distributionConfirmed, setDistributionConfirmed] = useState(false);
  const [responseFilter, setResponseFilter] = useState<ResponseFilter>("all");

  const availabilityQuery = trpc.studentSurveys.availability.useQuery(undefined, { retry: false });
  const canManage = availabilityQuery.data?.access === "admin";
  const studentDeliveryEnabled = availabilityQuery.data?.enabled === true;
  const surveysQuery = trpc.studentSurveys.listSurveys.useQuery(
    { limit: 100 },
    { enabled: canManage, retry: false },
  );
  const surveyQuery = trpc.studentSurveys.getSurvey.useQuery(
    { id: selectedSurveyId ?? 0 },
    { enabled: canManage && Boolean(selectedSurveyId), retry: false },
  );
  const assignmentsQuery = trpc.studentSurveys.listAssignments.useQuery(
    { surveyId: selectedSurveyId ?? undefined, limit: 500 },
    { enabled: canManage && Boolean(selectedSurveyId), retry: false },
  );
  const assignmentDetailQuery = trpc.studentSurveys.getMyAssignment.useQuery(
    { id: selectedAssignmentId ?? 0 },
    { enabled: canManage && Boolean(selectedAssignmentId), retry: false },
  );
  const studentsQuery = trpc.studentSurveys.listAudienceStudents.useQuery(undefined, {
    enabled: canManage && activeTab === "distribution",
    retry: false,
  });
  const auditQuery = trpc.studentSurveys.auditLog.useQuery(
    { entityType: "survey", entityId: selectedSurveyId ?? 0, limit: 100 },
    { enabled: canManage && activeTab === "audit" && Boolean(selectedSurveyId), retry: false },
  );

  const audienceInput = useMemo(() => ({
    mode: audienceMode,
    userIds: ["single", "selected"].includes(audienceMode) ? audienceUserIds : [],
  }), [audienceMode, audienceUserIds]);
  const hasValidAudienceSelection = !["single", "selected"].includes(audienceMode)
    || (audienceMode === "single" ? audienceUserIds.length === 1 : audienceUserIds.length > 0);
  const audiencePreviewQuery = trpc.studentSurveys.previewAudience.useQuery(
    { surveyId: selectedSurveyId ?? 0, audience: audienceInput },
    {
      enabled: canManage && activeTab === "distribution" && Boolean(selectedSurveyId) && hasValidAudienceSelection,
      retry: false,
    },
  );
  const audiencePreviewSnapshotKey = audiencePreviewQuery.data?.snapshotStudentIds.join(",") ?? "";

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
    setAudienceUserIds([]);
    setStudentSearch("");
    setDistributionConfirmed(false);
    setSelectedAssignmentId(null);
  }, [selectedSurveyId]);

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

  useEffect(() => {
    setDistributionConfirmed(false);
  }, [
    audienceInput,
    audiencePreviewSnapshotKey,
    distributionForm.blockAt,
    distributionForm.dueAt,
  ]);

  const copy = getCopy(isRtl);
  const selectedSurvey = surveyQuery.data;
  const assignments = (assignmentsQuery.data ?? []) as AssignmentSummary[];
  const selectedAssignment = assignmentDetailQuery.data;
  const students = studentsQuery.data ?? [];
  const knownAssignedIds = useMemo(() => new Set(assignments.map((item) => item.userId)), [assignments]);
  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    return students.filter((student) => !query
      || (student.name ?? "").toLowerCase().includes(query)
      || student.email.toLowerCase().includes(query));
  }, [studentSearch, students]);

  const assignmentStats = useMemo(() => {
    const result = { total: assignments.length, awaiting: 0, overdue: 0, submitted: 0, blocked: 0, postponed: 0 };
    for (const assignment of assignments) {
      if (assignment.status === "submitted") result.submitted += 1;
      else result.awaiting += 1;
      if (assignment.status === "postponed") result.postponed += 1;
      if (assignment.accessState === "survey_due") result.overdue += 1;
      if (assignment.accessState === "blocked" || assignment.status === "blocked") result.blocked += 1;
    }
    return result;
  }, [assignments]);

  const visibleAssignments = useMemo(() => assignments.filter((assignment) => {
    if (responseFilter === "all") return true;
    if (responseFilter === "awaiting") return assignment.status !== "submitted";
    if (responseFilter === "overdue") return assignment.accessState === "survey_due";
    if (responseFilter === "submitted") return assignment.status === "submitted";
    return assignment.accessState === "blocked" || assignment.status === "blocked";
  }), [assignments, responseFilter]);

  const createSurvey = trpc.studentSurveys.createSurvey.useMutation({
    onSuccess: async (survey) => {
      setSurveyDialogOpen(false);
      setSurveyForm(emptySurveyForm());
      setSelectedSurveyId(survey.id);
      await utils.studentSurveys.listSurveys.invalidate();
      toast.success(copy.surveyCreated);
    },
    onError: (error) => toast.error(
      getStudentSurveyCreateErrorMessage(error.message, isRtl),
    ),
  });

  const updateSurvey = trpc.studentSurveys.updateSurvey.useMutation({
    onSuccess: async () => {
      setSurveyDialogOpen(false);
      setEditingSurveyId(null);
      setSurveyForm(emptySurveyForm());
      await Promise.all([
        utils.studentSurveys.listSurveys.invalidate(),
        selectedSurveyId
          ? utils.studentSurveys.getSurvey.invalidate({ id: selectedSurveyId })
          : Promise.resolve(),
      ]);
      toast.success(copy.surveyUpdated);
    },
    onError: (error) => toast.error(error.message),
  });

  const setSurveyActive = trpc.studentSurveys.setSurveyActive.useMutation({
    onSuccess: async (survey) => {
      await Promise.all([
        utils.studentSurveys.listSurveys.invalidate(),
        utils.studentSurveys.getSurvey.invalidate({ id: survey.id }),
        utils.studentSurveys.myAssignments.invalidate(),
      ]);
      toast.success(survey.isActive ? copy.surveyActivated : copy.surveyDeactivated);
    },
    onError: (error) => toast.error(error.message),
  });

  const createQuestion = trpc.studentSurveys.createQuestion.useMutation({
    onSuccess: async () => {
      setQuestionDialogOpen(false);
      setQuestionForm(emptyQuestionForm());
      if (selectedSurveyId) await utils.studentSurveys.getSurvey.invalidate({ id: selectedSurveyId });
      toast.success(copy.questionAdded);
    },
    onError: (error) => toast.error(error.message),
  });

  const assignAudience = trpc.studentSurveys.assignAudience.useMutation({
    onSuccess: async (result) => {
      setDistributionConfirmed(false);
      await Promise.all([
        utils.studentSurveys.listAssignments.invalidate(),
        utils.studentSurveys.previewAudience.invalidate(),
      ]);
      toast.success(isRtl
        ? `تم تعيين الاستبيان إلى ${result.assignedCount} طالب${result.alreadyAssignedCount ? `، وتخطي ${result.alreadyAssignedCount} معيّن مسبقاً` : ""}. لم تُرسل إشعارات.`
        : `Survey assigned to ${result.assignedCount} student${result.assignedCount === 1 ? "" : "s"}${result.alreadyAssignedCount ? `; ${result.alreadyAssignedCount} already assigned` : ""}. No notifications were sent.`);
    },
    onError: async (error) => {
      setDistributionConfirmed(false);
      await utils.studentSurveys.previewAudience.invalidate();
      toast.error(error.message);
    },
  });

  const sendReminder = trpc.studentSurveys.sendAssignmentReminder.useMutation({
    onSuccess: async () => {
      await utils.studentSurveys.listAssignments.invalidate();
      toast.success(copy.reminderSent);
    },
    onError: (error) => toast.error(error.message),
  });

  const changeTab = (tab: WorkspaceTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "preview") url.searchParams.set("preview", "student");
      else url.searchParams.delete("preview");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  };

  const saveSurvey = () => {
    if (!surveyForm.code.trim() || !surveyForm.title.trim()) return;
    if (editingSurveyId) {
      updateSurvey.mutate({
        id: editingSurveyId,
        title: surveyForm.title.trim(),
        description: surveyForm.description.trim() || null,
        isRequired: surveyForm.isRequired,
        maxPostponements: Number(surveyForm.maxPostponements) || 0,
        postponeHours: Number(surveyForm.postponeHours) || 24,
        blockAfterHours: Number(surveyForm.blockAfterHours) || 72,
      });
      return;
    }
    const normalizedCode = surveyForm.code.trim().toLowerCase();
    const safeCode = isValidStudentSurveyReference(normalizedCode)
      ? normalizedCode
      : generateStudentSurveyReference();
    if (safeCode !== surveyForm.code) {
      setSurveyForm((current) => ({ ...current, code: safeCode }));
    }
    createSurvey.mutate({
      code: safeCode,
      title: surveyForm.title.trim(),
      description: surveyForm.description.trim() || null,
      isActive: false,
      isRequired: surveyForm.isRequired,
      maxPostponements: Number(surveyForm.maxPostponements) || 0,
      postponeHours: Number(surveyForm.postponeHours) || 24,
      blockAfterHours: Number(surveyForm.blockAfterHours) || 72,
    });
  };

  const openCreateSurvey = () => {
    setEditingSurveyId(null);
    setSurveyForm(newSurveyForm());
    setSurveyDialogOpen(true);
  };

  const openEditSurvey = () => {
    if (!selectedSurvey) return;
    setEditingSurveyId(selectedSurvey.id);
    setSurveyForm({
      code: selectedSurvey.code,
      title: selectedSurvey.title,
      description: selectedSurvey.description ?? "",
      isActive: selectedSurvey.isActive,
      isRequired: selectedSurvey.isRequired,
      maxPostponements: String(selectedSurvey.maxPostponements),
      postponeHours: String(selectedSurvey.postponeHours),
      blockAfterHours: String(selectedSurvey.blockAfterHours),
    });
    setSurveyDialogOpen(true);
  };

  const toggleSelectedSurveyActive = () => {
    if (!selectedSurvey || setSurveyActive.isPending) return;
    if (selectedSurvey.isActive && !window.confirm(copy.deactivateConfirm)) return;
    setSurveyActive.mutate({ id: selectedSurvey.id, isActive: !selectedSurvey.isActive });
  };

  const saveQuestion = () => {
    if (!selectedSurveyId || !questionForm.questionText.trim()) return;
    let options: string[] | undefined;
    if (isStudentSurveyChoiceQuestionType(questionForm.questionType)) {
      const validation = validateStudentSurveyChoiceOptions(
        normalizeQuestionOptionFields(questionForm.options)
      );
      if (!validation.valid) {
        toast.error(getChoiceQuestionCopy(isRtl).errors[validation.error]);
        return;
      }
      options = validation.options;
    }
    createQuestion.mutate({
      surveyId: selectedSurveyId,
      questionText: questionForm.questionText.trim(),
      questionType: questionForm.questionType,
      isRequired: questionForm.isRequired,
      options,
      sortOrder: Number(questionForm.sortOrder) || 0,
    });
  };

  const confirmDistribution = () => {
    const preview = audiencePreviewQuery.data;
    if (!selectedSurveyId || !preview || !distributionConfirmed || preview.recipientCount === 0) return;
    assignAudience.mutate({
      surveyId: selectedSurveyId,
      audience: audienceInput,
      dueAt: datetimeLocalToIso(distributionForm.dueAt),
      blockAt: datetimeLocalToIso(distributionForm.blockAt),
      expectedRecipientIds: preview.recipientIds,
      expectedMatchedStudentIds: preview.snapshotStudentIds,
      confirmed: true,
    });
  };

  const exportAssignments = () => {
    if (!assignments.length) return toast.info(copy.nothingToExport);
    downloadCsvRows(`student-survey-assignments-${selectedSurvey?.code ?? selectedSurveyId}.csv`, assignments.map((assignment) => ({
      assignmentId: assignment.id,
      surveyTitle: selectedSurvey?.title ?? "",
      studentId: assignment.userId,
      studentName: assignment.studentName ?? "",
      studentEmail: assignment.studentEmail ?? "",
      status: assignment.status,
      deadlineState: assignment.accessState,
      dueAt: assignment.dueAt ?? "",
      finalDeadline: assignment.blockAt ?? "",
      submittedAt: assignment.submittedAt ?? "",
      postponementsUsed: assignment.postponementsUsed,
    })));
  };

  const exportSelectedAnswers = () => {
    if (!selectedAssignment?.answers.length) return toast.info(copy.nothingToExport);
    const summary = assignments.find((item) => item.id === selectedAssignment.id);
    downloadCsvRows(`student-survey-answers-${selectedAssignment.id}.csv`, selectedAssignment.questions.map((question) => {
      const answer = (selectedAssignment.answers as SurveyAnswer[]).find((item) => item.questionId === question.id);
      return {
        assignmentId: selectedAssignment.id,
        surveyTitle: selectedAssignment.surveyTitle,
        studentId: selectedAssignment.userId,
        studentEmail: summary?.studentEmail ?? "",
        questionType: question.questionType,
        questionText: question.questionText,
        answer: formatAnswer(answer),
        submittedAt: selectedAssignment.submittedAt ?? "",
      };
    }));
  };

  if (availabilityQuery.isLoading) {
    return <PageState icon={<Loader2 className="h-6 w-6 animate-spin" />} title={copy.loading} />;
  }

  if (availabilityQuery.isError) {
    return (
      <PageState
        icon={<AlertCircle className="h-7 w-7" />}
        title={copy.workspaceUnavailable}
        body={copy.workspaceUnavailableBody}
        action={copy.retry}
        onAction={() => availabilityQuery.refetch()}
      />
    );
  }

  const availability = availabilityQuery.data;
  if (!availability) {
    return <PageState icon={<AlertCircle className="h-7 w-7" />} title={copy.workspaceUnavailable} body={copy.workspaceUnavailableBody} />;
  }

  if (!canManage) {
    return <PageState icon={<AlertCircle className="h-7 w-7" />} title={copy.noAccess} body={copy.noAccessBody} />;
  }

  const tabs: Array<{ id: WorkspaceTab; label: string; icon: ReactNode }> = [
    { id: "overview", label: copy.overview, icon: <BarChart3 /> },
    { id: "builder", label: copy.builder, icon: <ListChecks /> },
    { id: "distribution", label: copy.distribution, icon: <UsersRound /> },
    { id: "responses", label: copy.responses, icon: <ClipboardCheck /> },
    { id: "preview", label: copy.studentPreview, icon: <Eye /> },
    { id: "audit", label: copy.auditTrail, icon: <History /> },
  ];
  const dueAtMs = new Date(distributionForm.dueAt).getTime();
  const blockAtMs = new Date(distributionForm.blockAt).getTime();
  const dueDatesValid = Boolean(distributionForm.dueAt && distributionForm.blockAt)
    && dueAtMs > Date.now()
    && blockAtMs > dueAtMs;
  const workspaceError = surveysQuery.error
    ?? (selectedSurveyId ? surveyQuery.error : null)
    ?? (selectedSurveyId ? assignmentsQuery.error : null)
    ?? (activeTab === "distribution" ? studentsQuery.error ?? audiencePreviewQuery.error : null)
    ?? (activeTab === "audit" ? auditQuery.error : null);
  const retryWorkspace = () => {
    void surveysQuery.refetch();
    if (selectedSurveyId) {
      void surveyQuery.refetch();
      void assignmentsQuery.refetch();
    }
    if (activeTab === "distribution") {
      void studentsQuery.refetch();
      if (hasValidAudienceSelection && selectedSurveyId) void audiencePreviewQuery.refetch();
    }
    if (activeTab === "audit" && selectedSurveyId) void auditQuery.refetch();
  };

  return (
    <DashboardLayout>
      <main className="space-y-5 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        {!studentDeliveryEnabled && (
          <Card className="border-amber-300 bg-amber-50 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-amber-100 p-2 text-amber-800"><FileLock2 className="h-5 w-5" /></div>
                <div>
                  <p className="font-semibold text-amber-950">{copy.setupMode}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-900">{copy.setupModeBody}</p>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0 border-amber-400 bg-white text-amber-950 hover:bg-amber-100">
                <Link href="/admin/features"><Settings2 />{copy.reviewActivation}</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <header className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-emerald-50/50 to-sky-50/70 p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className={studentDeliveryEnabled
                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                  : "bg-amber-100 text-amber-900 hover:bg-amber-100"}>
                  {studentDeliveryEnabled
                    ? <CheckCircle2 className="me-1 h-3.5 w-3.5" />
                    : <FileLock2 className="me-1 h-3.5 w-3.5" />}
                  {studentDeliveryEnabled ? copy.available : copy.setupModeShort}
                </Badge>
                <Badge variant="outline" className={availability.blockingEnabled
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-slate-200 bg-white text-slate-600"}>
                  {!studentDeliveryEnabled && availability.blockingEnabled
                    ? copy.protectionDormant
                    : availability.blockingEnabled ? copy.protectionOn : copy.protectionOff}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{copy.title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy.subtitle}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => changeTab("preview")}>
                <Eye /> {copy.previewAsStudent}
              </Button>
              <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={openCreateSurvey}>
                <Plus /> {copy.newSurvey}
              </Button>
            </div>
          </div>
        </header>

        <nav className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" aria-label={copy.workspaceSections}>
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => changeTab(tab.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition [&_svg]:h-4 [&_svg]:w-4 ${
                  activeTab === tab.id
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </nav>

        {workspaceError && (
          <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{copy.workspaceDataError}</p>
              <p className="mt-1 text-sm text-red-800">{workspaceError.message}</p>
            </div>
            <Button type="button" variant="outline" className="shrink-0 border-red-300 bg-white" onClick={retryWorkspace}>{copy.retry}</Button>
          </div>
        )}

        {activeTab !== "overview" && activeTab !== "builder" && (surveysQuery.data?.length ?? 0) > 0 && (
          <SurveySelector
            surveys={surveysQuery.data ?? []}
            selectedSurveyId={selectedSurveyId}
            onChange={setSelectedSurveyId}
            isRtl={isRtl}
            label={copy.workingSurvey}
          />
        )}

        {activeTab === "overview" && (
          <OverviewTab
            copy={copy}
            surveys={surveysQuery.data ?? []}
            selectedSurvey={selectedSurvey}
            assignments={assignments}
            stats={assignmentStats}
            blockingEnabled={availability.blockingEnabled}
            onCreate={openCreateSurvey}
            onBuild={() => changeTab("builder")}
            onDistribute={() => changeTab("distribution")}
            onPreview={() => changeTab("preview")}
          />
        )}

        {activeTab === "builder" && (
          <BuilderTab
            copy={copy}
            isRtl={isRtl}
            surveys={surveysQuery.data ?? []}
            surveysLoading={surveysQuery.isLoading}
            selectedSurveyId={selectedSurveyId}
            selectedSurvey={selectedSurvey}
            surveyLoading={surveyQuery.isLoading}
            onSelect={setSelectedSurveyId}
            onCreate={openCreateSurvey}
            onAddQuestion={() => setQuestionDialogOpen(true)}
            onPreview={() => changeTab("preview")}
            onEdit={openEditSurvey}
            onToggleActive={toggleSelectedSurveyActive}
            togglingActive={setSurveyActive.isPending}
            onDistribute={() => changeTab("distribution")}
          />
        )}

        {activeTab === "distribution" && (
          <DistributionTab
            copy={copy}
            isRtl={isRtl}
            selectedSurvey={selectedSurvey}
            audienceMode={audienceMode}
            audienceUserIds={audienceUserIds}
            onAudienceMode={(mode: AudienceMode) => {
              setAudienceMode(mode);
              setAudienceUserIds([]);
              setStudentSearch("");
            }}
            onAudienceUserIds={setAudienceUserIds}
            students={filteredStudents}
            studentsLoading={studentsQuery.isLoading}
            totalStudents={students.length}
            knownAssignedIds={knownAssignedIds}
            search={studentSearch}
            onSearch={setStudentSearch}
            preview={audiencePreviewQuery.data}
            previewLoading={audiencePreviewQuery.isLoading || audiencePreviewQuery.isFetching}
            dates={distributionForm}
            onDates={setDistributionForm}
            datesValid={dueDatesValid}
            blockingEnabled={availability.blockingEnabled}
            confirmed={distributionConfirmed}
            onConfirmed={setDistributionConfirmed}
            onAssign={confirmDistribution}
            assigning={assignAudience.isPending}
            onBuilder={() => changeTab("builder")}
            onActivate={toggleSelectedSurveyActive}
            activating={setSurveyActive.isPending}
          />
        )}

        {activeTab === "responses" && (
          <ResponsesTab
            copy={copy}
            isRtl={isRtl}
            assignments={visibleAssignments}
            allAssignments={assignments}
            loading={assignmentsQuery.isLoading}
            filter={responseFilter}
            onFilter={setResponseFilter}
            selectedAssignmentId={selectedAssignmentId}
            onSelect={setSelectedAssignmentId}
            selectedAssignment={selectedAssignment}
            detailLoading={assignmentDetailQuery.isLoading}
            blockingEnabled={availability.blockingEnabled}
            onExport={exportAssignments}
            onExportAnswers={exportSelectedAnswers}
            onReminder={(id: number) => sendReminder.mutate({ id })}
            reminderPending={sendReminder.isPending}
            remindersEnabled={studentDeliveryEnabled}
            onDistribute={() => changeTab("distribution")}
          />
        )}

        {activeTab === "preview" && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-emerald-700" /> {copy.studentPreview}
              </CardTitle>
              <p className="text-sm leading-6 text-slate-500">{copy.previewHelp}</p>
            </CardHeader>
            <CardContent>
              <SurveyStudentPreview
                key={`${selectedSurvey?.id ?? "sample"}-${language}`}
                survey={selectedSurvey as PreviewSurvey | undefined}
                isRtl={isRtl}
              />
            </CardContent>
          </Card>
        )}

        {activeTab === "audit" && (
          <AuditTab
            copy={copy}
            isRtl={isRtl}
            selectedSurvey={selectedSurvey}
            logs={auditQuery.data ?? []}
            loading={auditQuery.isLoading}
          />
        )}
      </main>

      <SurveyDialog
        open={surveyDialogOpen}
        onOpenChange={setSurveyDialogOpen}
        form={surveyForm}
        onForm={setSurveyForm}
        onSave={saveSurvey}
        pending={createSurvey.isPending || updateSurvey.isPending}
        editing={Boolean(editingSurveyId)}
        copy={copy}
        isRtl={isRtl}
      />
      <QuestionDialog
        open={questionDialogOpen}
        onOpenChange={setQuestionDialogOpen}
        form={questionForm}
        onForm={setQuestionForm}
        onSave={saveQuestion}
        pending={createQuestion.isPending}
        surveyTitle={selectedSurvey?.title}
        copy={copy}
        isRtl={isRtl}
      />
    </DashboardLayout>
  );
}

function OverviewTab({ copy, surveys, selectedSurvey, assignments, stats, blockingEnabled, onCreate, onBuild, onDistribute, onPreview }: any) {
  const readiness = [
    { ready: surveys.length > 0, label: copy.readinessSurvey },
    { ready: Boolean(selectedSurvey?.questions?.length), label: copy.readinessQuestions },
    { ready: Boolean(selectedSurvey?.isActive), label: copy.readinessActive },
    { ready: assignments.length > 0, label: copy.readinessPilot },
    { ready: !blockingEnabled, label: copy.readinessSafeBlocking },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label={copy.surveys} value={String(surveys.length)} hint={copy.configured} />
        <MetricCard label={copy.totalAssignments} value={String(stats.total)} hint={copy.studentsReached} />
        <MetricCard label={copy.awaiting} value={String(stats.awaiting)} hint={copy.needResponse} tone="blue" />
        <MetricCard label={copy.overdue} value={String(stats.overdue)} hint={copy.pastDue} tone="amber" />
        <MetricCard label={copy.submitted} value={String(stats.submitted)} hint={copy.readyToReview} tone="emerald" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><Sparkles className="h-5 w-5 text-emerald-700" />{copy.quickDemo}</CardTitle>
            <p className="text-sm leading-6 text-slate-500">{copy.quickDemoHelp}</p>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <QuickAction icon={<ListChecks />} title={copy.builder} body={copy.builderAction} onClick={onBuild} />
            <QuickAction icon={<UsersRound />} title={copy.distribution} body={copy.distributionAction} onClick={surveys.length ? onDistribute : onCreate} />
            <QuickAction icon={<Eye />} title={copy.studentPreview} body={copy.previewAction} onClick={onPreview} />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-emerald-700" />{copy.pilotReadiness}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {readiness.map((item: any) => (
              <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.ready ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                  {item.ready ? <Check className="h-4 w-4" /> : "•"}
                </span>
                <span className={item.ready ? "text-slate-800" : "text-slate-500"}>{item.label}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {surveys.length === 0 && (
        <EmptyState icon={<ClipboardCheck />} title={copy.noSurveysTitle} body={copy.noSurveysBody} action={copy.createFirstSurvey} onAction={onCreate} />
      )}
    </div>
  );
}

function BuilderTab({ copy, isRtl, surveys, surveysLoading, selectedSurveyId, selectedSurvey, surveyLoading, onSelect, onCreate, onAddQuestion, onPreview, onEdit, onToggleActive, togglingActive, onDistribute }: any) {
  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="h-fit border-slate-200 shadow-sm">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{copy.surveys}</CardTitle>
          <Button size="sm" variant="outline" onClick={onCreate}><Plus />{copy.new}</Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {surveysLoading ? <CenteredLoader /> : surveys.length === 0 ? (
            <EmptyMini text={copy.noSurveysBody} />
          ) : surveys.map((survey: any) => (
            <button
              key={survey.id}
              type="button"
              onClick={() => onSelect(survey.id)}
              className={`w-full rounded-xl border p-3 text-start transition ${selectedSurveyId === survey.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:border-emerald-200"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-slate-900">{survey.title}</span>
                <Badge variant="outline" className={survey.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}>
                  {survey.isActive ? copy.active : copy.draft}
                </Badge>
              </div>
              <p className="mt-1 truncate text-xs text-slate-500">{copy.reference}: {survey.code}</p>
            </button>
          ))}
        </CardContent>
      </Card>

      {!selectedSurveyId ? (
        <EmptyState icon={<ListChecks />} title={copy.noSurveySelected} body={copy.chooseOrCreate} action={copy.createFirstSurvey} onAction={onCreate} />
      ) : surveyLoading || !selectedSurvey ? <CenteredLoader /> : (
        <div className="space-y-5">
          <Card className={selectedSurvey.isActive ? "border-emerald-200 bg-emerald-50/70" : selectedSurvey.questions.length ? "border-amber-200 bg-amber-50/70" : "border-sky-200 bg-sky-50/70"}>
            <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{copy.nextStep}</p>
                <p className="mt-1 font-semibold text-slate-950">
                  {selectedSurvey.questions.length === 0
                    ? copy.nextAddQuestion
                    : selectedSurvey.isActive ? copy.nextDistribute : copy.nextActivate}
                </p>
              </div>
              {selectedSurvey.questions.length === 0 ? (
                <Button onClick={onAddQuestion}><Plus />{copy.addQuestion}</Button>
              ) : selectedSurvey.isActive ? (
                <Button onClick={onDistribute}><UsersRound />{copy.distributeSurvey}</Button>
              ) : (
                <Button onClick={onToggleActive} disabled={togglingActive} className="bg-emerald-700 hover:bg-emerald-800">
                  {togglingActive ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}{copy.activateSurvey}
                </Button>
              )}
            </CardContent>
          </Card>
          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-sky-500" />
            <CardContent className="p-5 md:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-950">{selectedSurvey.title}</h2>
                    <Badge variant="outline">{selectedSurvey.isRequired ? copy.required : copy.optional}</Badge>
                    <Badge variant="outline" className={selectedSurvey.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-slate-50"}>
                      {selectedSurvey.isActive ? copy.availableForAssignment : copy.draft}
                    </Badge>
                  </div>
                  {selectedSurvey.description && <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedSurvey.description}</p>}
                  <p className="mt-2 text-xs text-slate-400">{copy.reference}: {selectedSurvey.code}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={onEdit}><Settings2 />{copy.editSettings}</Button>
                  <Button variant="outline" onClick={onPreview}><Eye />{copy.preview}</Button>
                  {selectedSurvey.questions.length > 0 && (
                    <Button
                      variant={selectedSurvey.isActive ? "destructive" : "default"}
                      onClick={onToggleActive}
                      disabled={togglingActive}
                    >
                      {togglingActive && <Loader2 className="animate-spin" />}
                      {selectedSurvey.isActive ? copy.deactivateSurvey : copy.activateSurvey}
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MetricCard label={copy.postponements} value={String(selectedSurvey.maxPostponements)} />
                <MetricCard label={copy.postponeWindow} value={`${selectedSurvey.postponeHours}h`} />
                <MetricCard label={copy.finalDeadlineWindow} value={`${selectedSurvey.blockAfterHours}h`} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg"><ListChecks className="h-5 w-5 text-emerald-700" />{copy.questions}</CardTitle>
                <p className="mt-1 text-sm text-slate-500">{copy.questionsHelp}</p>
              </div>
              <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={onAddQuestion}><Plus />{copy.addQuestion}</Button>
            </CardHeader>
            <CardContent>
              {selectedSurvey.questions.length === 0 ? (
                <EmptyState icon={<ListChecks />} title={copy.noQuestionsTitle} body={copy.noQuestionsBody} action={copy.addFirstQuestion} onAction={onAddQuestion} compact />
              ) : (
                <div className="space-y-3">
                  {selectedSurvey.questions.map((question: any, index: number) => (
                    <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 font-bold text-emerald-700">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <h3 className="font-semibold text-slate-950">{question.questionText}</h3>
                            <div className="flex gap-2">
                              <Badge variant="outline">{questionTypeLabel(question.questionType, isRtl)}</Badge>
                              {question.isRequired && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">{copy.required}</Badge>}
                            </div>
                          </div>
                          {question.optionsJson && <p className="mt-2 text-xs leading-5 text-slate-500">{parseOptionsLabel(question.optionsJson)}</p>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function DistributionTab(props: any) {
  const {
    copy, isRtl, selectedSurvey, audienceMode, audienceUserIds, onAudienceMode, onAudienceUserIds,
    students, studentsLoading, totalStudents, knownAssignedIds, search, onSearch, preview, previewLoading,
    dates, onDates, datesValid, blockingEnabled, confirmed, onConfirmed, onAssign, assigning, onBuilder,
    onActivate, activating,
  } = props;
  const modes: Array<{ id: AudienceMode; title: string; body: string }> = [
    { id: "single", title: copy.oneStudent, body: copy.oneStudentHelp },
    { id: "selected", title: copy.selectedStudents, body: copy.selectedStudentsHelp },
    { id: "active_package", title: copy.activeStudents, body: copy.activeStudentsHelp },
    { id: "inactive_package", title: copy.inactiveStudents, body: copy.inactiveStudentsHelp },
    { id: "all", title: copy.allStudents, body: copy.allStudentsHelp },
  ];
  const selectedSet = new Set(audienceUserIds);
  const protectionApplies = Boolean(
    blockingEnabled && selectedSurvey?.isActive && selectedSurvey?.isRequired,
  );
  const toggleStudent = (id: number) => {
    if (audienceMode === "single") onAudienceUserIds([id]);
    else if (selectedSet.has(id)) onAudienceUserIds(audienceUserIds.filter((item: number) => item !== id));
    else if (audienceUserIds.length >= 20) toast.error(isRtl
      ? "يمكن مراجعة وتعيين 20 طالباً جديداً كحد أقصى في كل دفعة."
      : "You can review and assign up to 20 new students per batch.");
    else onAudienceUserIds([...audienceUserIds, id]);
  };

  if (!selectedSurvey) {
    return <EmptyState icon={<UsersRound />} title={copy.chooseSurveyFirst} body={copy.chooseSurveyFirstBody} action={copy.openBuilder} onAction={onBuilder} />;
  }
  if (!selectedSurvey.questions.length) {
    return <EmptyState icon={<ListChecks />} title={copy.questionsRequired} body={copy.questionsRequiredBody} action={copy.addQuestions} onAction={onBuilder} />;
  }
  if (!selectedSurvey.isActive) {
    return <EmptyState icon={<FileLock2 />} title={copy.activationRequired} body={copy.activationRequiredBody} action={copy.activateSurvey} onAction={onActivate} />;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="space-y-5">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">1 · {copy.audience}</p>
                <CardTitle className="mt-1 text-lg">{copy.chooseAudience}</CardTitle>
              </div>
              <Badge variant="outline">{selectedSurvey.title}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {modes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onAudienceMode(mode.id)}
                  className={`rounded-2xl border p-4 text-start transition ${audienceMode === mode.id ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100" : "border-slate-200 hover:border-emerald-200"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${audienceMode === mode.id ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                      {audienceMode === mode.id && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="font-semibold text-slate-900">{mode.title}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{mode.body}</p>
                </button>
              ))}
            </div>

            {["single", "selected"].includes(audienceMode) && (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="relative">
                  <Search className={`absolute top-2.5 h-4 w-4 text-slate-400 ${isRtl ? "right-3" : "left-3"}`} />
                  <Input className={isRtl ? "pr-9" : "pl-9"} value={search} onChange={(event) => onSearch(event.target.value)} placeholder={copy.searchStudents} />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{copy.showing} {Math.min(students.length, 100)} {copy.of} {totalStudents}</span>
                  <span>{audienceUserIds.length} {copy.selected}</span>
                </div>
                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {studentsLoading ? <CenteredLoader /> : students.length === 0 ? <EmptyMini text={copy.noStudentsMatch} /> : students.slice(0, 100).map((student: any) => {
                    const selected = selectedSet.has(student.id);
                    return (
                      <button key={student.id} type="button" onClick={() => toggleStudent(student.id)} className={`flex w-full items-center gap-3 px-3 py-3 text-start hover:bg-slate-50 ${selected ? "bg-emerald-50/70" : ""}`}>
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${audienceMode === "single" ? "rounded-full" : "rounded"} border ${selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300"}`}>
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">{student.name || student.email}</span>
                          <span className="block truncate text-xs text-slate-500">{student.email}</span>
                        </span>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant="outline" className={student.hasActivePackage ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}>
                            {student.hasActivePackage ? copy.activePackage : copy.noActivePackage}
                          </Badge>
                          {knownAssignedIds.has(student.id) && <span className="text-[11px] text-slate-400">{copy.alreadyAssigned}</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">2 · {copy.schedule}</p>
            <CardTitle className="text-lg">{copy.setDeadlines}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={copy.responseDue} required>
                <Input type="datetime-local" value={dates.dueAt} onChange={(event) => onDates({ ...dates, dueAt: event.target.value })} />
              </Field>
              <Field label={copy.finalDeadline} required>
                <Input type="datetime-local" value={dates.blockAt} onChange={(event) => onDates({ ...dates, blockAt: event.target.value })} />
              </Field>
            </div>
            {!datesValid && <p className="text-sm font-medium text-red-600">{copy.deadlineError}</p>}
            <div className={`flex items-start gap-3 rounded-2xl border p-4 ${protectionApplies ? "border-red-200 bg-red-50 text-red-950" : "border-emerald-200 bg-emerald-50 text-emerald-950"}`}>
              {protectionApplies ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" /> : <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />}
              <div>
                <p className="font-semibold">{protectionApplies ? copy.blockingWarningTitle : copy.safePilotTitle}</p>
                <p className="mt-1 text-sm leading-6">{protectionApplies
                  ? copy.blockingWarningBody
                  : blockingEnabled && !selectedSurvey.isRequired
                    ? isRtl
                      ? "هذا الاستبيان اختياري، لذلك لن يقيّد وصول الطالب حتى مع تفعيل الحماية."
                      : "This survey is optional, so it will not restrict student access even while protection is on."
                    : blockingEnabled && !selectedSurvey.isActive
                      ? isRtl
                        ? "هذا الاستبيان غير نشط، لذلك لن يقيّد وصول الطالب."
                        : "This survey is inactive, so it will not restrict student access."
                      : copy.safePilotBody}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit border-slate-200 shadow-sm xl:sticky xl:top-5">
        <CardHeader>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">3 · {copy.reviewConfirm}</p>
          <CardTitle className="text-lg">{copy.recipientPreview}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasAudienceChoice(audienceMode, audienceUserIds) ? (
            <EmptyMini text={copy.chooseRecipientsPrompt} />
          ) : previewLoading ? <CenteredLoader /> : !preview ? <EmptyMini text={copy.previewUnavailable} /> : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <MiniMetric label={copy.matching} value={preview.matchedCount} />
                <MiniMetric label={copy.newAssignments} value={preview.recipientCount} accent />
                <MiniMetric label={copy.alreadyAssigned} value={preview.alreadyAssignedCount} />
              </div>
              {preview.exceedsSafeLimit && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
                  {preview.exceedsTotalLimit
                    ? isRtl
                      ? `يمكن تعيين ${preview.maxAssignmentsPerSurvey} طالب كحد أقصى لكل استبيان. المتاح حالياً ${preview.remainingAssignmentCapacity}.`
                      : `Each survey supports up to ${preview.maxAssignmentsPerSurvey} assigned students. ${preview.remainingAssignmentCapacity} places remain.`
                    : isRtl
                      ? `راجع وعيّن حتى ${preview.maxBatchRecipients} طالباً جديداً في كل دفعة. اختر مجموعة أصغر.`
                      : `Review and assign up to ${preview.maxBatchRecipients} new students per batch. Choose a narrower group.`}
                </div>
              )}
              {preview.invalidRequestedCount > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{copy.studentsUnavailable}</div>
              )}
              <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {preview.students.slice(0, 25).map((student: any) => (
                  <div key={student.id} className="flex items-center gap-2 px-3 py-2.5 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800">{student.name || student.email}</span>
                    <span className="max-w-36 truncate text-slate-400">{student.email}</span>
                    {student.alreadyAssigned && <Badge variant="outline" className="bg-slate-50 text-[10px]">{copy.assigned}</Badge>}
                  </div>
                ))}
                {preview.students.length > 25 && <p className="p-3 text-center text-xs text-slate-500">+{preview.students.length - 25} {copy.more}</p>}
              </div>
              <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-900">
                <Bell className="me-2 inline h-4 w-4" />{copy.noAutomaticMessages}
              </div>
              <label className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${confirmed ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}>
                <input className="mt-1" type="checkbox" checked={confirmed} onChange={(event) => onConfirmed(event.target.checked)} />
                <span>{isRtl
                  ? `راجعت قائمة ${preview.recipientCount} طالباً جديداً وأؤكد التعيين${protectionApplies ? " مع علمي بأن الحماية قد تقيّد الوصول بعد الموعد النهائي" : " مع بقاء وصول الطلاب دون تغيير بسبب هذا الاستبيان"}.`
                  : `I reviewed the ${preview.recipientCount} new recipient${preview.recipientCount === 1 ? "" : "s"} and confirm assignment${protectionApplies ? "; access protection may restrict them after the final deadline" : "; this survey will not change student access"}.`}</span>
              </label>
              <Button
                className="w-full bg-emerald-700 hover:bg-emerald-800"
                onClick={onAssign}
                disabled={assigning || !confirmed || !datesValid || preview.recipientCount === 0 || preview.exceedsSafeLimit || preview.invalidRequestedCount > 0}
              >
                {assigning ? <Loader2 className="animate-spin" /> : <Send />}
                {copy.assignTo} {preview.recipientCount} {copy.students}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ResponsesTab(props: any) {
  const {
    copy, isRtl, assignments, allAssignments, loading, filter, onFilter, selectedAssignmentId, onSelect,
    selectedAssignment, detailLoading, blockingEnabled, onExport, onExportAnswers, onReminder,
    reminderPending, remindersEnabled, onDistribute,
  } = props;
  const filterItems: Array<{ id: ResponseFilter; label: string }> = [
    { id: "all", label: copy.all },
    { id: "awaiting", label: copy.awaiting },
    { id: "overdue", label: copy.overdue },
    { id: "submitted", label: copy.submitted },
    { id: "blocked", label: blockingEnabled
      ? isRtl ? "الموعد النهائي / تقييد الوصول" : "Final deadline / access restriction"
      : copy.finalDeadlinePassed },
  ];

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck className="h-5 w-5 text-emerald-700" />{copy.responsesAssignments}</CardTitle>
          <p className="mt-1 text-sm text-slate-500">{copy.responsesHelp}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onExport} disabled={!allAssignments.length}><Download />{copy.exportAssignments}</Button>
          <Button onClick={onDistribute} className="bg-emerald-700 hover:bg-emerald-800"><UsersRound />{copy.distributeSurvey}</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {filterItems.map((item) => (
            <button key={item.id} type="button" onClick={() => onFilter(item.id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === item.id ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200"}`}>
              {item.label}
            </button>
          ))}
        </div>

        {loading ? <CenteredLoader /> : allAssignments.length === 0 ? (
          <EmptyState icon={<UserRound />} title={copy.noAssignmentsTitle} body={copy.noAssignmentsBody} action={copy.distributeSurvey} onAction={onDistribute} compact />
        ) : assignments.length === 0 ? <EmptyMini text={copy.noResultsForFilter} /> : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
            <div className="max-h-[720px] space-y-2 overflow-y-auto pe-1">
              {assignments.map((assignment: AssignmentSummary) => (
                <button key={assignment.id} type="button" onClick={() => onSelect(assignment.id)} className={`w-full rounded-2xl border p-4 text-start transition ${selectedAssignmentId === assignment.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 hover:border-emerald-200"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-950">{assignment.studentName || assignment.studentEmail}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">{assignment.studentEmail}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={statusBadgeClass(assignment.status)}>{statusLabel(
                        assignment.status,
                        isRtl,
                        blockingEnabled && assignment.surveyIsActive && assignment.surveyIsRequired,
                      )}</Badge>
                      {assignment.accessState !== "clear" && (
                        <Badge variant="outline" className={assignment.accessState === "blocked" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                          {deadlineStateLabel(
                            assignment.accessState,
                            isRtl,
                            blockingEnabled && assignment.surveyIsActive && assignment.surveyIsRequired,
                          )}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
                    <span>{copy.responseDue}: {formatDateTime(assignment.dueAt, isRtl)}</span>
                    <span>{copy.submittedAt}: {formatDateTime(assignment.submittedAt, isRtl)}</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {detailLoading ? <CenteredLoader /> : !selectedAssignment ? <EmptyMini text={copy.selectAssignment} /> : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-950">{copy.studentResponse}</h3>
                      <p className="mt-1 text-xs text-slate-500">{allAssignments.find((item: AssignmentSummary) => item.id === selectedAssignment.id)?.studentEmail ?? "—"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={onExportAnswers} disabled={!selectedAssignment.answers.length}><Download />{copy.exportAnswers}</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        title={remindersEnabled ? copy.reminderHelp : copy.remindersDisabled}
                        onClick={() => onReminder(selectedAssignment.id)}
                        disabled={!remindersEnabled || reminderPending || selectedAssignment.status === "submitted"}
                      >
                        {reminderPending ? <Loader2 className="animate-spin" /> : <Bell />}{copy.sendOneReminder}
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <MetricCard label={copy.status} value={statusLabel(
                      selectedAssignment.status,
                      isRtl,
                      blockingEnabled && selectedAssignment.surveyIsActive && selectedAssignment.surveyIsRequired,
                    )} />
                    <MetricCard label={copy.deadlineState} value={deadlineStateLabel(
                      selectedAssignment.accessState,
                      isRtl,
                      blockingEnabled && selectedAssignment.surveyIsActive && selectedAssignment.surveyIsRequired,
                    )} />
                  </div>
                  <p className={`rounded-xl border p-3 text-xs leading-5 ${remindersEnabled
                    ? "border-sky-200 bg-sky-50 text-sky-900"
                    : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                    {remindersEnabled ? copy.reminderHelp : copy.remindersDisabled}
                  </p>
                  {!selectedAssignment.answers.length ? <EmptyMini text={copy.noAnswers} /> : (
                    <div className="space-y-3">
                      {selectedAssignment.questions.map((question: any) => {
                        const answer = (selectedAssignment.answers as SurveyAnswer[]).find((item) => item.questionId === question.id);
                        return (
                          <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-sm font-semibold text-slate-900">{question.questionText}</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{formatAnswer(answer) || "—"}</p>
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
  );
}

function AuditTab({ copy, isRtl, selectedSurvey, logs, loading }: any) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><History className="h-5 w-5 text-emerald-700" />{copy.auditTrail}</CardTitle>
        <p className="mt-1 text-sm leading-6 text-slate-500">{copy.auditTrailHelp}</p>
      </CardHeader>
      <CardContent>
        {!selectedSurvey ? (
          <EmptyMini text={copy.chooseSurveyFirstBody} />
        ) : loading ? (
          <CenteredLoader />
        ) : logs.length === 0 ? (
          <EmptyMini text={copy.noAuditEvents} />
        ) : (
          <div className="space-y-3">
            {logs.map((log: any) => {
              const details = parseAuditDetails(log.details);
              const referenceCode = typeof details?.code === "string" || typeof details?.code === "number"
                ? String(details.code)
                : null;
              const reviewedRecipients = typeof details?.requestedCount === "number"
                ? details.requestedCount
                : null;
              const dueAt = typeof details?.dueAt === "string" ? details.dueAt : null;
              const blockAt = typeof details?.blockAt === "string" ? details.blockAt : null;
              return (
                <article key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{surveyAuditActionLabel(log.action, isRtl)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {log.actorUserId < 0
                          ? `${copy.adminActor} #${Math.abs(log.actorUserId)}`
                          : `${copy.staffOrStudentActor} #${log.actorUserId}`}
                      </p>
                    </div>
                    <time className="text-xs font-medium text-slate-500" dateTime={log.createdAt}>{formatDateTime(log.createdAt, isRtl)}</time>
                  </div>
                  {details && (
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      {referenceCode !== null && <span className="rounded-lg bg-slate-50 px-3 py-2">{copy.reference}: {referenceCode}</span>}
                      {reviewedRecipients !== null && <span className="rounded-lg bg-slate-50 px-3 py-2">{copy.reviewedRecipients}: {reviewedRecipients}</span>}
                      {dueAt && <span className="rounded-lg bg-slate-50 px-3 py-2">{copy.responseDue}: {formatDateTime(dueAt, isRtl)}</span>}
                      {blockAt && <span className="rounded-lg bg-slate-50 px-3 py-2">{copy.finalDeadline}: {formatDateTime(blockAt, isRtl)}</span>}
                    </div>
                  )}
                  {log.fromStatus || log.toStatus ? (
                    <p className="mt-3 text-xs text-slate-500">{copy.status}: {log.fromStatus || "—"} → {log.toStatus || "—"}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DisabledWorkspace({ isRtl, previewOpen, onPreview }: { isRtl: boolean; previewOpen: boolean; onPreview: () => void }) {
  const copy = getCopy(isRtl);
  return (
    <DashboardLayout>
      <main className="space-y-5 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <div className="h-1.5 bg-gradient-to-r from-slate-400 via-sky-400 to-emerald-500" />
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-3xl">
                <Badge variant="outline" className="mb-3 bg-slate-50 text-slate-600"><FileLock2 className="me-1 h-3.5 w-3.5" />{copy.notLive}</Badge>
                <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">{copy.title}</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy.disabledBody}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onPreview}><Eye />{copy.previewAsStudent}</Button>
                <Button asChild><Link href="/admin/features"><Settings2 />{copy.reviewActivation}</Link></Button>
              </div>
            </div>
            <div className="mt-7 grid gap-3 md:grid-cols-3">
              <SetupStep number="1" title={copy.prepare} body={copy.prepareBody} />
              <SetupStep number="2" title={copy.preview} body={copy.previewSetupBody} />
              <SetupStep number="3" title={copy.pilot} body={copy.pilotBody} />
            </div>
          </CardContent>
        </Card>
        {previewOpen ? (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Eye className="h-5 w-5 text-emerald-700" />{copy.sampleStudentPreview}</CardTitle>
              <p className="text-sm text-slate-500">{copy.disabledPreviewHelp}</p>
            </CardHeader>
            <CardContent><SurveyStudentPreview isRtl={isRtl} /></CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-slate-300 bg-slate-50/70">
            <CardContent className="flex flex-col items-center p-10 text-center">
              <Eye className="h-9 w-9 text-slate-400" />
              <h2 className="mt-3 font-semibold text-slate-900">{copy.previewWithoutActivation}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">{copy.previewWithoutActivationBody}</p>
              <Button className="mt-4" variant="outline" onClick={onPreview}>{copy.openSafePreview}</Button>
            </CardContent>
          </Card>
        )}
      </main>
    </DashboardLayout>
  );
}

function SurveyDialog({ open, onOpenChange, form, onForm, onSave, pending, editing, copy, isRtl }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{editing ? copy.editSurvey : copy.newSurvey}</DialogTitle>
          <DialogDescription>{editing ? copy.editSurveyHelp : copy.createSurveyHelp}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label={copy.surveyTitle} required><Input value={form.title} maxLength={300} onChange={(event) => onForm({ ...form, title: event.target.value })} /></Field>
          <Field label={copy.description}><Textarea rows={4} value={form.description} maxLength={5000} onChange={(event) => onForm({ ...form, description: event.target.value })} /></Field>
          <Field label={editing ? copy.reference : copy.automaticReference} required>
            <Input
              value={form.code}
              readOnly
              aria-readonly="true"
              className="bg-slate-50 font-mono text-xs text-slate-600"
            />
            <span className="text-xs font-normal text-slate-500">
              {editing ? copy.referenceHelp : copy.automaticReferenceHelp}
            </span>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={copy.postponements}><Input type="number" min={0} max={30} value={form.maxPostponements} onChange={(event) => onForm({ ...form, maxPostponements: event.target.value })} /></Field>
            <Field label={copy.postponeWindow}><Input type="number" min={1} max={720} value={form.postponeHours} onChange={(event) => onForm({ ...form, postponeHours: event.target.value })} /></Field>
            <Field label={copy.finalDeadlineWindow}><Input type="number" min={1} max={2160} value={form.blockAfterHours} onChange={(event) => onForm({ ...form, blockAfterHours: event.target.value })} /></Field>
          </div>
          <div className="grid gap-3">
            <CheckOption checked={form.isRequired} onChange={(checked) => onForm({ ...form, isRequired: checked })} label={copy.requiredSurvey} help={copy.requiredSurveyHelp} />
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">{editing ? copy.editSafetyNote : copy.createSafetyNote}</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{copy.cancel}</Button>
          <Button onClick={onSave} disabled={pending || !form.code.trim() || !form.title.trim()}>{pending && <Loader2 className="animate-spin" />}{editing ? copy.saveChanges : copy.createSurvey}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuestionDialog({ open, onOpenChange, form, onForm, onSave, pending, surveyTitle, copy, isRtl }: any) {
  const choiceCopy = getChoiceQuestionCopy(isRtl);
  const optionFields = normalizeQuestionOptionFields(form.options);
  const isChoiceQuestion = isStudentSurveyChoiceQuestionType(form.questionType);
  const choiceValidation = validateStudentSurveyChoiceOptions(optionFields);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader><DialogTitle>{copy.addQuestion}</DialogTitle><DialogDescription>{surveyTitle ?? copy.questions}</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-2">
          <Field label={copy.questionText} required><Input value={form.questionText} maxLength={300} onChange={(event) => onForm({ ...form, questionText: event.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={copy.questionType}>
              <select value={form.questionType} onChange={(event) => onForm({ ...form, questionType: event.target.value })} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500">
                {Object.keys(questionTypeLabels).map((type) => <option key={type} value={type}>{questionTypeLabel(type, isRtl)}</option>)}
              </select>
            </Field>
            <Field label={copy.sortOrder}><Input type="number" min={0} max={1000} value={form.sortOrder} onChange={(event) => onForm({ ...form, sortOrder: event.target.value })} /></Field>
          </div>
          {isChoiceQuestion && (
            <section className="grid gap-2" aria-describedby="survey-choice-options-help survey-choice-options-status">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">
                  {copy.options}<span className="text-red-500"> *</span>
                </span>
                <span className="text-xs text-slate-500">
                  {optionFields.length}/{MAX_STUDENT_SURVEY_CHOICE_OPTIONS}
                </span>
              </div>
              <p id="survey-choice-options-help" className="text-xs leading-5 text-slate-500">
                {choiceCopy.guidance}
              </p>
              <div className="grid gap-2">
                {optionFields.map((option: string, index: number) => (
                  <div key={index} className="flex items-center gap-2">
                    <label htmlFor={`survey-choice-option-${index}`} className="sr-only">
                      {choiceCopy.optionLabel(index + 1)}
                    </label>
                    <Input
                      id={`survey-choice-option-${index}`}
                      value={option}
                      maxLength={200}
                      placeholder={choiceCopy.optionLabel(index + 1)}
                      aria-invalid={!choiceValidation.valid}
                      onChange={(event) => {
                        const nextOptions = [...optionFields];
                        nextOptions[index] = event.target.value;
                        onForm({ ...form, options: nextOptions });
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      disabled={optionFields.length <= 2}
                      aria-label={choiceCopy.removeOption(index + 1)}
                      title={choiceCopy.removeOption(index + 1)}
                      onClick={() => onForm({
                        ...form,
                        options: optionFields.filter((_: string, optionIndex: number) => optionIndex !== index),
                      })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={optionFields.length >= MAX_STUDENT_SURVEY_CHOICE_OPTIONS}
                  onClick={() => onForm({ ...form, options: [...optionFields, ""] })}
                >
                  <Plus className="h-4 w-4" />
                  {choiceCopy.addOption}
                </Button>
                <span
                  id="survey-choice-options-status"
                  role="status"
                  className={`inline-flex items-center gap-1.5 text-xs font-medium ${choiceValidation.valid ? "text-emerald-700" : "text-amber-700"}`}
                >
                  {choiceValidation.valid
                    ? <CheckCircle2 className="h-4 w-4" />
                    : <AlertCircle className="h-4 w-4" />}
                  {choiceValidation.valid
                    ? choiceCopy.ready(choiceValidation.options.length)
                    : choiceCopy.errors[choiceValidation.error]}
                </span>
              </div>
            </section>
          )}
          <CheckOption checked={form.isRequired} onChange={(checked) => onForm({ ...form, isRequired: checked })} label={copy.requiredQuestion} help={copy.requiredQuestionHelp} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{copy.cancel}</Button>
          <Button onClick={onSave} disabled={pending || !form.questionText.trim() || (isChoiceQuestion && !choiceValidation.valid)}>{pending && <Loader2 className="animate-spin" />}{copy.addQuestion}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SurveySelector({ surveys, selectedSurveyId, onChange, isRtl, label }: any) {
  return (
    <Card className="border-slate-200 bg-slate-50/70 shadow-sm">
      <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
        <label htmlFor="survey-workspace-selector" className="shrink-0 text-sm font-semibold text-slate-700">{label}</label>
        <select id="survey-workspace-selector" value={selectedSurveyId ?? ""} onChange={(event) => onChange(Number(event.target.value))} className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500" dir={isRtl ? "rtl" : "ltr"}>
          {surveys.map((survey: any) => <option key={survey.id} value={survey.id}>{survey.title}</option>)}
        </select>
      </CardContent>
    </Card>
  );
}

function PageState({ icon, title, body, action, onAction }: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <DashboardLayout>
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg border-slate-200 text-center shadow-sm">
          <CardContent className="flex flex-col items-center p-8">
            <div className="mb-4 rounded-2xl bg-slate-100 p-3 text-slate-600">{icon}</div>
            <h1 className="text-xl font-bold text-slate-950">{title}</h1>
            {body && <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>}
            {action && onAction && <Button className="mt-5" variant="outline" onClick={onAction}>{action}</Button>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ label, value, hint, tone = "slate" }: { label: string; value: string; hint?: string; tone?: "slate" | "blue" | "amber" | "emerald" }) {
  const tones = {
    slate: "border-slate-200 bg-slate-50",
    blue: "border-blue-200 bg-blue-50/70",
    amber: "border-amber-200 bg-amber-50/70",
    emerald: "border-emerald-200 bg-emerald-50/70",
  };
  return <div className={`rounded-2xl border p-4 ${tones[tone]}`}><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</div>;
}

function MiniMetric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return <div className={`rounded-xl border p-3 text-center ${accent ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}><p className="text-xl font-bold text-slate-950">{value}</p><p className="mt-1 text-[11px] text-slate-500">{label}</p></div>;
}

function QuickAction({ icon, title, body, onClick }: { icon: ReactNode; title: string; body: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-2xl border border-slate-200 p-4 text-start transition hover:border-emerald-300 hover:bg-emerald-50/50"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 [&_svg]:h-5 [&_svg]:w-5">{icon}</span><span className="mt-3 block font-semibold text-slate-900">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{body}</span></button>;
}

function EmptyState({ icon, title, body, action, onAction, compact }: { icon: ReactNode; title: string; body: string; action?: string; onAction?: () => void; compact?: boolean }) {
  return <Card className="border-dashed border-slate-300 bg-slate-50/60"><CardContent className={`flex flex-col items-center text-center ${compact ? "p-7" : "p-10"}`}><span className="rounded-2xl bg-white p-3 text-slate-400 shadow-sm [&_svg]:h-7 [&_svg]:w-7">{icon}</span><h3 className="mt-3 font-semibold text-slate-900">{title}</h3><p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">{body}</p>{action && onAction && <Button className="mt-4" onClick={onAction}>{action}</Button>}</CardContent></Card>;
}

function EmptyMini({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm leading-6 text-slate-500">{text}</p>;
}

function CenteredLoader() {
  return <div className="flex min-h-28 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>;
}

function SetupStep({ number, title, body }: { number: string; title: string; body: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">{number}</span><h3 className="mt-3 font-semibold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{body}</p></div>;
}

function CheckOption({ checked, onChange, label, help }: { checked: boolean; onChange: (checked: boolean) => void; label: string; help: string }) {
  return <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${checked ? "border-emerald-300 bg-emerald-50" : "border-slate-200"}`}><input className="mt-1" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span><span className="block text-sm font-semibold text-slate-800">{label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{help}</span></span></label>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium text-slate-700"><span>{label}{required && <span className="text-red-500"> *</span>}</span>{children}</label>;
}

function normalizeQuestionOptionFields(options: string[] | string | undefined): string[] {
  if (Array.isArray(options)) return options;
  const migratedOptions = String(options ?? "")
    .split(/\r?\n/)
    .map((option) => option.trim())
    .filter(Boolean);
  return migratedOptions.length >= 2 ? migratedOptions : [migratedOptions[0] ?? "", ""];
}

function getChoiceQuestionCopy(isRtl: boolean) {
  return isRtl ? {
    guidance: "أدخل كل خيار في حقل مستقل. يلزم خياران مختلفان على الأقل.",
    optionLabel: (number: number) => `الخيار ${number}`,
    addOption: "إضافة خيار آخر",
    removeOption: (number: number) => `حذف الخيار ${number}`,
    ready: (count: number) => `${count} خيارات جاهزة`,
    errors: {
      minimum: "أدخل خيارين مختلفين على الأقل قبل إضافة السؤال.",
      empty: "أكمل الخيار الفارغ أو احذفه قبل إضافة السؤال.",
      duplicate: "يجب أن يكون كل خيار مختلفاً عن الخيارات الأخرى.",
      too_many: `يمكن إضافة ${MAX_STUDENT_SURVEY_CHOICE_OPTIONS} خياراً كحد أقصى.`,
    },
  } : {
    guidance: "Enter each option in its own field. At least two different options are required.",
    optionLabel: (number: number) => `Option ${number}`,
    addOption: "Add another option",
    removeOption: (number: number) => `Remove option ${number}`,
    ready: (count: number) => `${count} options ready`,
    errors: {
      minimum: "Enter at least two different options before adding the question.",
      empty: "Complete or remove the empty option before adding the question.",
      duplicate: "Each option must be different from the others.",
      too_many: `You can add up to ${MAX_STUDENT_SURVEY_CHOICE_OPTIONS} options.`,
    },
  };
}

function getInitialTab(): WorkspaceTab {
  if (typeof window === "undefined") return "overview";
  const params = new URLSearchParams(window.location.search);
  if (params.get("preview") === "student") return "preview";
  const requestedTab = params.get("tab");
  return ["overview", "builder", "distribution", "responses", "preview", "audit"].includes(
    requestedTab ?? "",
  ) ? requestedTab as WorkspaceTab : "overview";
}

function hasAudienceChoice(mode: AudienceMode, userIds: number[]) {
  if (mode === "single") return userIds.length === 1;
  if (mode === "selected") return userIds.length > 0;
  return true;
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

function parseAuditDetails(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function surveyAuditActionLabel(action: string, isRtl: boolean) {
  const labels: Record<string, [string, string]> = {
    created: ["Survey draft created", "تم إنشاء مسودة الاستبيان"],
    activated: ["Survey activated", "تم تفعيل الاستبيان"],
    deactivated: ["Survey returned to draft", "تمت إعادة الاستبيان إلى مسودة"],
    audience_assignment_confirmed: ["Audience assignment confirmed", "تم تأكيد تعيين الجمهور"],
    updated: ["Survey settings updated", "تم تحديث إعدادات الاستبيان"],
  };
  return labels[action]?.[isRtl ? 1 : 0]
    ?? action.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function statusLabel(status: string, isRtl: boolean, protectionApplies = true) {
  const labels: Record<string, [string, string]> = {
    pending: ["Awaiting response", "بانتظار الإجابة"],
    postponed: ["Postponed", "مؤجل"],
    submitted: ["Submitted", "مرسل"],
    blocked: protectionApplies
      ? ["Restricted", "مقيّد"]
      : ["Final deadline passed", "تجاوز الموعد النهائي"],
  };
  return labels[status]?.[isRtl ? 1 : 0] ?? status;
}

function deadlineStateLabel(state: string, isRtl: boolean, blockingEnabled: boolean) {
  if (state === "clear") return isRtl ? "ضمن الموعد" : "On schedule";
  if (state === "survey_due") return isRtl ? "تجاوز موعد الإجابة" : "Response overdue";
  if (blockingEnabled) return isRtl ? "الوصول مقيّد" : "Access restricted";
  return isRtl ? "تجاوز الموعد النهائي — دون حجب" : "Final deadline passed — access unchanged";
}

function statusBadgeClass(status: string) {
  if (status === "submitted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  if (status === "postponed") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
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
  return date.toLocaleString(isRtl ? "ar-JO" : "en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function toDatetimeLocalValue(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function datetimeLocalToIso(value: string) {
  return new Date(value).toISOString();
}

function downloadCsvRows(filename: string, rows: Array<Record<string, string | number | boolean | null | undefined>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.map(csvEscapeCell).join(","), ...rows.map((row) => headers.map((header) => csvEscapeCell(row[header])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
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
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function getCopy(isRtl: boolean): Record<string, string> {
  return isRtl ? {
    workspaceUnavailable: "تعذر فتح مساحة الاستبيانات",
    workspaceUnavailableBody: "لم نتمكن من التحقق من حالة الميزة أو صلاحياتك. أعد المحاولة قبل إجراء أي تغيير.",
    retry: "إعادة المحاولة",
    setupMode: "وضع الإعداد — الاستبيانات غير متاحة للطلاب",
    setupModeBody: "يمكنك إعداد المسودات والأسئلة والجمهور ومراجعة الردود وسجل التدقيق. لن يتمكن الطلاب من فتح الاستبيانات، كما أن التذكيرات متوقفة حتى تفعيل الميزة.",
    setupModeShort: "وضع الإعداد",
    protectionDormant: "الحماية مضبوطة وستعمل عند التفعيل",
    workspaceDataError: "تعذر تحميل بعض بيانات الاستبيانات",
    auditTrail: "سجل التدقيق",
    auditTrailHelp: "راجع إنشاء المسودة وتأكيدات توزيع الجمهور للاستبيان المحدد من حساب الإدارة.",
    noAuditEvents: "لا توجد أحداث إدارية مسجلة لهذا الاستبيان بعد.",
    adminActor: "مدير",
    staffOrStudentActor: "مستخدم/موظف",
    reviewedRecipients: "المستلمون الذين تمت مراجعتهم",
    remindersDisabled: "التذكيرات متوقفة لأن استبيانات الطلاب غير مفعّلة. فعّل الميزة من مركز الميزات قبل إرسال أي تذكير.",
    surveyUpdated: "تم حفظ إعدادات الاستبيان",
    surveyActivated: "تم تفعيل الاستبيان وأصبح جاهزاً للتوزيع",
    surveyDeactivated: "تم إيقاف الاستبيان وإخفاؤه عن الطلاب",
    editSettings: "تعديل الإعدادات",
    editSurvey: "تعديل الاستبيان",
    editSurveyHelp: "حدّث الإعدادات دون تغيير المرجع الداخلي أو حالة التفعيل.",
    saveChanges: "حفظ التغييرات",
    editSafetyNote: "حفظ الإعدادات لا يرسل إشعارات جديدة للطلاب.",
    activateSurvey: "تفعيل الاستبيان",
    deactivateSurvey: "إيقاف الاستبيان",
    deactivateConfirm: "سيختفي هذا الاستبيان من حسابات الطلاب ولن يمكن توزيعه حتى تعيد تفعيله. هل تريد المتابعة؟",
    nextStep: "الخطوة التالية",
    nextAddQuestion: "أضف سؤالاً واحداً على الأقل، ثم عاين تجربة الطالب.",
    nextActivate: "الأسئلة جاهزة. فعّل الاستبيان للسماح بالتوزيع.",
    nextDistribute: "الاستبيان فعّال وجاهز لمعاينة الجمهور والتوزيع.",
    activationRequired: "فعّل الاستبيان قبل التوزيع",
    activationRequiredBody: "الأسئلة جاهزة، لكن المسودة لا يمكن تعيينها لأي طالب. اضغط التفعيل للانتقال بأمان إلى خطوة التوزيع.",
    loading: "جار التحميل...", title: "استبيانات الطلاب", subtitle: "أنشئ الاستبيان، اختر جمهوره بدقة، راقب الردود، واعرض تجربة الطالب كاملة من حساب المدير دون تسجيل دخول آخر.", available: "متاح للإدارة", protectionOn: "حماية الوصول مفعّلة", protectionOff: "حماية الوصول متوقفة", previewAsStudent: "معاينة كطالب", newSurvey: "استبيان جديد", workspaceSections: "أقسام إدارة الاستبيانات", overview: "نظرة عامة", builder: "تصميم الاستبيان", distribution: "التوزيع", responses: "الردود", studentPreview: "معاينة الطالب", workingSurvey: "الاستبيان الحالي", noAccess: "صلاحية إدارة الاستبيانات مطلوبة", noAccessBody: "اطلب دور مدير استبيانات الطلاب من المسؤول الرئيسي.", surveyCreated: "تم إنشاء الاستبيان كمسودة آمنة", questionAdded: "تمت إضافة السؤال", reminderSent: "تم إرسال تذكير واحد داخل المنصة", nothingToExport: "لا توجد بيانات للتصدير", surveys: "الاستبيانات", configured: "تم إعدادها", totalAssignments: "إجمالي التعيينات", studentsReached: "طالباً مستهدفاً", awaiting: "بانتظار الرد", needResponse: "تحتاج إجابة", overdue: "متأخرة", pastDue: "تجاوزت موعد الرد", submitted: "مرسلة", readyToReview: "جاهزة للمراجعة", quickDemo: "جولة العرض السريعة", quickDemoHelp: "استخدم هذه الخطوات لإظهار الميزة لصاحبة العمل من حساب المدير.", builderAction: "اعرض الأسئلة وإعدادات كل استبيان.", distributionAction: "اختر طالباً أو مجموعة وشاهد العدد قبل التأكيد.", previewAction: "اعرض واجهة الطالب بأمان دون حفظ أي بيانات.", pilotReadiness: "جاهزية التجربة", readinessSurvey: "تم إنشاء استبيان واحد على الأقل", readinessQuestions: "الاستبيان المحدد يحتوي على أسئلة", readinessActive: "الاستبيان متاح للتعيين", readinessPilot: "تم تعيين مجموعة تجريبية", readinessSafeBlocking: "حماية الوصول متوقفة أثناء التجربة", noSurveysTitle: "ابدأ باستبيان واضح وبسيط", noSurveysBody: "لا توجد استبيانات بعد. أنشئ مسودة، أضف الأسئلة، ثم عاينها قبل اختيار أي طالب.", createFirstSurvey: "إنشاء أول استبيان", new: "جديد", active: "متاح", draft: "مسودة", reference: "مرجع داخلي", automaticReference: "مرجع داخلي تلقائي", automaticReferenceHelp: "ينشئ النظام هذا المرجع تلقائياً؛ يمكنك كتابة العنوان والوصف والأسئلة بالعربية.", noSurveySelected: "اختر استبياناً", chooseOrCreate: "اختر استبياناً من القائمة أو أنشئ مسودة جديدة.", required: "مطلوب", optional: "اختياري", availableForAssignment: "متاح للتعيين", preview: "معاينة", postponements: "مرات التأجيل", postponeWindow: "مدة التأجيل (ساعة)", finalDeadlineWindow: "المهلة النهائية (ساعة)", questions: "الأسئلة", questionsHelp: "رتّب ما سيراه الطالب. لن يحدث أي توزيع من هذه الصفحة.", addQuestion: "إضافة سؤال", noQuestionsTitle: "الاستبيان بحاجة إلى أسئلة", noQuestionsBody: "أضف سؤالاً واحداً على الأقل قبل المعاينة أو التوزيع.", addFirstQuestion: "إضافة أول سؤال", audience: "الجمهور", chooseAudience: "من سيستلم هذا الاستبيان؟", oneStudent: "طالب واحد", oneStudentHelp: "الأفضل لأول تجربة آمنة.", selectedStudents: "طلاب محددون", selectedStudentsHelp: "اختر الأسماء واحداً تلو الآخر.", activeStudents: "طلاب باقة نشطة", activeStudentsHelp: "كل الطلاب ذوي الباقة النشطة حالياً.", inactiveStudents: "طلاب دون باقة نشطة", inactiveStudentsHelp: "كل الطلاب الذين لا يملكون باقة نشطة.", allStudents: "جميع الطلاب", allStudentsHelp: "استخدمه فقط بعد مراجعة العدد الكامل.", searchStudents: "ابحث بالاسم أو البريد", showing: "عرض", of: "من", selected: "محدد", noStudentsMatch: "لا يوجد طلاب مطابقون للبحث.", activePackage: "باقة نشطة", noActivePackage: "دون باقة نشطة", alreadyAssigned: "معيّن مسبقاً", schedule: "الجدولة", setDeadlines: "حدد موعد الرد والمهلة النهائية", responseDue: "موعد الرد", finalDeadline: "المهلة النهائية", deadlineError: "يجب أن تكون المهلة النهائية بعد موعد الرد.", blockingWarningTitle: "تنبيه مهم: حماية الوصول مفعّلة", blockingWarningBody: "قد يفقد الطالب الوصول إلى أجزاء من المنصة إذا لم يرسل الاستبيان قبل المهلة النهائية. راجع الجمهور والموعد بعناية قبل التأكيد.", safePilotTitle: "تجربة آمنة: وصول الطالب لن يتغير", safePilotBody: "يتم تسجيل المهلة النهائية للمتابعة فقط. لا يتم حجب أي طالب ما دامت حماية الوصول متوقفة.", reviewConfirm: "المراجعة والتأكيد", recipientPreview: "معاينة المستلمين", chooseRecipientsPrompt: "اختر طالباً أو جمهوراً لعرض العدد الدقيق.", previewUnavailable: "تعذرت معاينة الجمهور. حدّث الصفحة وحاول مرة أخرى.", matching: "مطابق", newAssignments: "جديد", audienceTooLarge: "هذا الجمهور أكبر من حد الأمان (500). اختر مجموعة أصغر.", studentsUnavailable: "بعض الطلاب المحددين لم يعودوا متاحين. راجع اختيارك.", assigned: "معيّن", more: "إضافي", noAutomaticMessages: "التعيين لا يرسل بريداً أو تذكيراً تلقائياً. يمكن إرسال تذكير فردي لاحقاً من صفحة الردود.", assignTo: "تعيين إلى", students: "طالب", chooseSurveyFirst: "اختر استبياناً أولاً", chooseSurveyFirstBody: "اختر الاستبيان الذي تريد توزيعه من أداة الاختيار أعلاه.", openBuilder: "فتح التصميم", questionsRequired: "أضف الأسئلة قبل التوزيع", questionsRequiredBody: "لا يمكن توزيع استبيان فارغ. أضف سؤالاً ثم ارجع إلى هذه الصفحة.", addQuestions: "إضافة الأسئلة", all: "الكل", accessRestricted: "الوصول مقيّد", finalDeadlinePassed: "تجاوز المهلة", responsesAssignments: "التعيينات وردود الطلاب", responsesHelp: "تابع كل طالب، راجع الإجابات، وأرسل تذكيراً فردياً عند الحاجة.", exportAssignments: "تصدير التعيينات", distributeSurvey: "توزيع الاستبيان", noAssignmentsTitle: "لا توجد تعيينات بعد", noAssignmentsBody: "ابدأ بطالب واحد أو مجموعة تجريبية صغيرة، وراجع العدد قبل التأكيد.", noResultsForFilter: "لا توجد نتائج ضمن هذا الفلتر.", submittedAt: "أرسل في", selectAssignment: "اختر تعييناً لعرض التفاصيل.", studentResponse: "إجابة الطالب", exportAnswers: "تصدير الإجابات", sendOneReminder: "تذكير واحد", reminderHelp: "يرسل تذكيراً واحداً داخل المنصة لهذا الطالب فقط؛ لا يتم إرسال بريد جماعي.", status: "الحالة", deadlineState: "حالة الموعد", noAnswers: "لم يرسل الطالب إجابات بعد.", previewHelp: "هذه معاينة تفاعلية محلية فقط. لا تحفظ الردود، ولا ترسل إشعارات، ولا تغيّر وصول الطالب.", notLive: "غير متاح للطلاب حالياً", disabledBody: "مساحة الاستبيانات غير مفعّلة حالياً. يمكنك مع ذلك عرض تجربة الطالب النموذجية بأمان ومراجعة خطوات الإعداد قبل إطلاق تجربة صغيرة.", reviewActivation: "مراجعة التفعيل", prepare: "الإعداد", prepareBody: "جهّز العنوان والأسئلة والجمهور التجريبي.", previewSetupBody: "اعرض التجربة من حساب المدير دون تغيير أي بيانات.", pilot: "تجربة صغيرة", pilotBody: "ابدأ بطالب واحد وراجع الرد قبل التوسع.", sampleStudentPreview: "معاينة نموذجية للطالب", disabledPreviewHelp: "بيانات توضيحية فقط؛ لا اتصال بأي حساب طالب.", previewWithoutActivation: "يمكنك العرض دون تفعيل الميزة", previewWithoutActivationBody: "افتح معاينة نموذجية كاملة الآن لتشرح الشكل والتدفق لصاحبة العمل بأمان.", openSafePreview: "فتح المعاينة الآمنة", createSurveyHelp: "يبدأ الاستبيان كمسودة. إنشاء الاستبيان وحده لا يعيّنه لأي طالب.", surveyTitle: "عنوان الاستبيان", description: "الوصف", referenceHelp: "مرجع تقني ثابت يُنشأ تلقائياً ولا يظهر للطالب.", requiredSurvey: "استبيان مطلوب", requiredSurveyHelp: "يظهر للطالب كاستبيان مطلوب، لكن الوصول لا يتغير إلا عند تفعيل الحماية بشكل منفصل.", activeHelp: "يسمح باختياره للتوزيع بعد إضافة الأسئلة.", createSafetyNote: "إنشاء هذه المسودة لا يرسل إشعاراً ولا يغيّر حساب أي طالب.", cancel: "إلغاء", createSurvey: "إنشاء المسودة", questionText: "نص السؤال", questionType: "نوع السؤال", sortOrder: "الترتيب", options: "الخيارات", optionsHelp: "اكتب كل خيار في سطر مستقل.", requiredQuestion: "إجابة مطلوبة", requiredQuestionHelp: "يجب على الطالب الإجابة قبل الإرسال.",
  } : {
    workspaceUnavailable: "Survey workspace unavailable",
    workspaceUnavailableBody: "The feature status or your access could not be verified. Retry before making any change.",
    retry: "Retry",
    setupMode: "Setup mode — surveys are unavailable to students",
    setupModeBody: "You can prepare drafts, questions and audiences, review responses, and inspect the audit trail. Students cannot open surveys and reminders stay disabled until the feature is activated.",
    setupModeShort: "Setup mode",
    protectionDormant: "Protection configured; applies after activation",
    workspaceDataError: "Some survey data could not be loaded",
    auditTrail: "Audit trail",
    auditTrailHelp: "Review draft creation and confirmed audience-distribution events for the selected survey from the admin account.",
    noAuditEvents: "No administrative events have been recorded for this survey yet.",
    adminActor: "Admin",
    staffOrStudentActor: "User/staff",
    reviewedRecipients: "Reviewed recipients",
    remindersDisabled: "Reminders are disabled while Student Surveys is off. Activate the feature in Feature Center before sending any reminder.",
    surveyUpdated: "Survey settings saved",
    surveyActivated: "Survey activated and ready for distribution",
    surveyDeactivated: "Survey deactivated and hidden from students",
    editSettings: "Edit settings",
    editSurvey: "Edit survey",
    editSurveyHelp: "Update settings without changing the internal reference or activation state.",
    saveChanges: "Save changes",
    editSafetyNote: "Saving settings does not send new student notifications.",
    activateSurvey: "Activate survey",
    deactivateSurvey: "Deactivate survey",
    deactivateConfirm: "This survey will disappear from student accounts and cannot be distributed until you reactivate it. Continue?",
    nextStep: "Next step",
    nextAddQuestion: "Add at least one question, then preview the student experience.",
    nextActivate: "Questions are ready. Activate the survey to allow distribution.",
    nextDistribute: "The survey is active and ready for audience preview and distribution.",
    activationRequired: "Activate the survey before distribution",
    activationRequiredBody: "The questions are ready, but a draft cannot be assigned to students. Activate it to continue safely to distribution.",
    loading: "Loading…", title: "Student Surveys", subtitle: "Build a survey, choose its audience precisely, monitor responses, and demonstrate the complete student experience from the admin account—no second login needed.", available: "Available to manage", protectionOn: "Access protection is on", protectionOff: "Access protection is off", previewAsStudent: "Preview as student", newSurvey: "New survey", workspaceSections: "Survey workspace sections", overview: "Overview", builder: "Survey builder", distribution: "Distribution", responses: "Responses", studentPreview: "Student preview", workingSurvey: "Working survey", noAccess: "Survey management access required", noAccessBody: "Ask the main administrator to grant the Student Surveys Manager role.", surveyCreated: "Survey created as a safe draft", questionAdded: "Question added", reminderSent: "One in-app reminder was sent", nothingToExport: "There is nothing to export", surveys: "Surveys", configured: "configured", totalAssignments: "Total assignments", studentsReached: "students reached", awaiting: "Awaiting response", needResponse: "need a response", overdue: "Overdue", pastDue: "past response due date", submitted: "Submitted", readyToReview: "ready to review", quickDemo: "Quick demo journey", quickDemoHelp: "Use these steps to demonstrate the feature to the business owner entirely from the admin account.", builderAction: "Show the questions and settings for each survey.", distributionAction: "Choose one student or an audience and preview the exact count.", previewAction: "Show the student interface safely without saving data.", pilotReadiness: "Pilot readiness", readinessSurvey: "At least one survey has been created", readinessQuestions: "The selected survey has questions", readinessActive: "The survey is available for assignment", readinessPilot: "A pilot audience has been assigned", readinessSafeBlocking: "Access protection is off during the pilot", noSurveysTitle: "Start with one clear, simple survey", noSurveysBody: "No surveys exist yet. Create a draft, add questions, then preview it before selecting any student.", createFirstSurvey: "Create first survey", new: "New", active: "Available", draft: "Draft", reference: "Internal reference", automaticReference: "Automatic internal reference", automaticReferenceHelp: "The system creates this automatically; the title, description, and questions can be written in Arabic.", noSurveySelected: "Choose a survey", chooseOrCreate: "Select a survey from the list or create a new draft.", required: "Required", optional: "Optional", availableForAssignment: "Available for assignment", preview: "Preview", postponements: "Postponements", postponeWindow: "Postpone window (hours)", finalDeadlineWindow: "Final deadline window (hours)", questions: "Questions", questionsHelp: "Arrange what the student will see. Nothing is distributed from this section.", addQuestion: "Add question", noQuestionsTitle: "This survey needs questions", noQuestionsBody: "Add at least one question before previewing or distributing.", addFirstQuestion: "Add first question", audience: "Audience", chooseAudience: "Who should receive this survey?", oneStudent: "One student", oneStudentHelp: "Best for the first safe pilot.", selectedStudents: "Selected students", selectedStudentsHelp: "Choose individual students by name.", activeStudents: "Active-package students", activeStudentsHelp: "Every student with an active package now.", inactiveStudents: "No active package", inactiveStudentsHelp: "Every student without an active package.", allStudents: "All students", allStudentsHelp: "Use only after reviewing the complete count.", searchStudents: "Search by name or email", showing: "Showing", of: "of", selected: "selected", noStudentsMatch: "No students match this search.", activePackage: "Active package", noActivePackage: "No active package", alreadyAssigned: "Already assigned", schedule: "Schedule", setDeadlines: "Set the response and final deadlines", responseDue: "Response due", finalDeadline: "Final deadline", deadlineError: "The final deadline must be after the response due date.", blockingWarningTitle: "Important: access protection is enabled", blockingWarningBody: "A student may lose access to parts of the platform if they do not submit before the final deadline. Review the audience and dates carefully before confirming.", safePilotTitle: "Safe pilot: student access will not change", safePilotBody: "The final deadline is recorded for follow-up only. No student is blocked while access protection remains off.", reviewConfirm: "Review & confirm", recipientPreview: "Recipient preview", chooseRecipientsPrompt: "Choose a student or audience to see the exact count.", previewUnavailable: "The audience preview is unavailable. Refresh and try again.", matching: "Matching", newAssignments: "New", audienceTooLarge: "This audience exceeds the 500-student safety limit. Choose a narrower group.", studentsUnavailable: "Some selected students are no longer available. Review your selection.", assigned: "Assigned", more: "more", noAutomaticMessages: "Assignment sends no email or automatic reminder. A single in-app reminder can be sent later from Responses.", assignTo: "Assign to", students: "students", chooseSurveyFirst: "Choose a survey first", chooseSurveyFirstBody: "Select the survey you want to distribute using the selector above.", openBuilder: "Open builder", questionsRequired: "Add questions before distribution", questionsRequiredBody: "An empty survey cannot be distributed. Add a question, then return here.", addQuestions: "Add questions", all: "All", accessRestricted: "Access restricted", finalDeadlinePassed: "Final deadline passed", responsesAssignments: "Assignments & student responses", responsesHelp: "Track each student, review answers, and send a single reminder only when needed.", exportAssignments: "Export assignments", distributeSurvey: "Distribute survey", noAssignmentsTitle: "No assignments yet", noAssignmentsBody: "Start with one student or a small pilot group, and review the count before confirming.", noResultsForFilter: "No results match this filter.", submittedAt: "Submitted", selectAssignment: "Select an assignment to view its details.", studentResponse: "Student response", exportAnswers: "Export answers", sendOneReminder: "One reminder", reminderHelp: "Sends one in-app reminder to this student only; no bulk email is sent.", status: "Status", deadlineState: "Deadline state", noAnswers: "The student has not submitted answers yet.", previewHelp: "This is a local interactive preview only. It does not save responses, send notifications, or change student access.", notLive: "Not currently available to students", disabledBody: "The survey workspace is not currently active. You can still safely demonstrate a sample student experience and review the setup journey before launching a small pilot.", reviewActivation: "Review activation", prepare: "Prepare", prepareBody: "Plan the title, questions, and pilot audience.", previewSetupBody: "Demonstrate the experience from admin without changing data.", pilot: "Small pilot", pilotBody: "Start with one student and review the result before expanding.", sampleStudentPreview: "Sample student preview", disabledPreviewHelp: "Illustrative data only; no student account is connected.", previewWithoutActivation: "You can demonstrate without activation", previewWithoutActivationBody: "Open a complete sample now to explain the appearance and flow to the business owner safely.", openSafePreview: "Open safe preview", createSurveyHelp: "The survey starts as a draft. Creating it does not assign it to any student.", surveyTitle: "Survey title", description: "Description", referenceHelp: "A fixed technical reference generated automatically and hidden from students.", requiredSurvey: "Required survey", requiredSurveyHelp: "Shown as required to the student; access changes only if protection is enabled separately.", activeHelp: "Makes it available for selection after questions are added.", createSafetyNote: "Creating this draft sends no notification and changes no student account.", cancel: "Cancel", createSurvey: "Create draft", questionText: "Question text", questionType: "Question type", sortOrder: "Sort order", options: "Options", optionsHelp: "Put each option on its own line.", requiredQuestion: "Answer required", requiredQuestionHelp: "The student must answer before submitting.",
  };
}
