import DashboardLayout from "@/components/DashboardLayout";
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
import { trpc } from "@/lib/trpc";
import { rowsToCsv, staffPerformanceCsvFilename, type StaffPerformanceCsvRow } from "@shared/staffPerformanceCsv";
import {
  AlertCircle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Download,
  Edit3,
  FileLock2,
  Loader2,
  Plus,
  Send,
  Target,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type TaskForm = {
  id?: number;
  monthlyGoalId: string;
  title: string;
  expectedOutput: string;
  actualOutput: string;
  completed: boolean;
  notes: string;
  sortOrder: string;
};

type WeeklyForm = {
  weekStart: string;
  weekEnd: string;
  outputs: string;
  achievementPercent: string;
  complaints: string;
  suggestions: string;
  blockers: string;
  trainingNeeds: string;
  toolNeeds: string;
};

const emptyTaskForm = (): TaskForm => ({
  monthlyGoalId: "",
  title: "",
  expectedOutput: "",
  actualOutput: "",
  completed: false,
  notes: "",
  sortOrder: "0",
});

const emptyWeeklyForm = (): WeeklyForm => {
  const week = getCurrentWeekRange();
  return {
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    outputs: "",
    achievementPercent: "",
    complaints: "",
    suggestions: "",
    blockers: "",
    trainingNeeds: "",
    toolNeeds: "",
  };
};

const statusStyles: Record<string, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  submitted: "border-blue-200 bg-blue-50 text-blue-700",
  returned: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  locked: "border-violet-200 bg-violet-50 text-violet-700",
};

export default function AdminMyPerformance() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const utils = trpc.useUtils();
  const [dateInput, setDateInput] = useState(() => toLocalIsoDate());
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);
  const [selectedWeeklyId, setSelectedWeeklyId] = useState<number | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyTaskForm);
  const [logForm, setLogForm] = useState({ endSummary: "", employeeNotes: "" });
  const [weeklyForm, setWeeklyForm] = useState<WeeklyForm>(emptyWeeklyForm);

  const availabilityQuery = trpc.staffPerformance.availability.useQuery(undefined, { retry: false });
  const canUse = availabilityQuery.data?.enabled && availabilityQuery.data.access === "employee";

  const logsQuery = trpc.staffPerformance.listDailyLogs.useQuery(
    { limit: 45 },
    { enabled: Boolean(canUse), retry: false },
  );
  const logQuery = trpc.staffPerformance.getDailyLog.useQuery(
    { id: selectedLogId ?? 0 },
    { enabled: Boolean(canUse && selectedLogId), retry: false },
  );
  const monthlyPlansQuery = trpc.staffPerformance.listMonthlyPlans.useQuery(
    { limit: 12 },
    { enabled: Boolean(canUse), retry: false },
  );
  const weeklyReportsQuery = trpc.staffPerformance.listWeeklyReports.useQuery(
    { limit: 26 },
    { enabled: Boolean(canUse), retry: false },
  );
  const weeklyReportQuery = trpc.staffPerformance.getWeeklyReport.useQuery(
    { id: selectedWeeklyId ?? 0 },
    { enabled: Boolean(canUse && selectedWeeklyId), retry: false },
  );

  const selectedMonth = (logQuery.data?.localDate ?? dateInput).slice(0, 7);
  const currentMonthPlan = monthlyPlansQuery.data?.find((plan) => plan.month === selectedMonth);
  const monthlyPlanQuery = trpc.staffPerformance.getMonthlyPlan.useQuery(
    { id: currentMonthPlan?.id ?? 0 },
    { enabled: Boolean(canUse && currentMonthPlan?.id), retry: false },
  );

  useEffect(() => {
    if (!logsQuery.data || selectedLogId) return;
    const matchingDate = logsQuery.data.find((log) => log.localDate === dateInput);
    if (matchingDate) {
      setSelectedLogId(matchingDate.id);
    } else if (logsQuery.data.length > 0) {
      setSelectedLogId(logsQuery.data[0].id);
      setDateInput(logsQuery.data[0].localDate);
    }
  }, [dateInput, logsQuery.data, selectedLogId]);

  useEffect(() => {
    const log = logQuery.data;
    if (!log) return;
    setDateInput(log.localDate);
    setLogForm({
      endSummary: log.endSummary ?? "",
      employeeNotes: log.employeeNotes ?? "",
    });
  }, [logQuery.data?.id, logQuery.data?.version]);

  useEffect(() => {
    if (!weeklyReportsQuery.data || selectedWeeklyId) return;
    const currentWeek = getCurrentWeekRange();
    const matchingWeek = weeklyReportsQuery.data.find((report) => report.weekStart === currentWeek.weekStart);
    if (matchingWeek) {
      setSelectedWeeklyId(matchingWeek.id);
    } else if (weeklyReportsQuery.data.length > 0) {
      setSelectedWeeklyId(weeklyReportsQuery.data[0].id);
    }
  }, [selectedWeeklyId, weeklyReportsQuery.data]);

  useEffect(() => {
    const report = weeklyReportQuery.data;
    if (!report) return;
    setWeeklyForm({
      weekStart: report.weekStart,
      weekEnd: report.weekEnd,
      outputs: report.outputs ?? "",
      achievementPercent: report.achievementPercent === null || report.achievementPercent === undefined ? "" : String(report.achievementPercent),
      complaints: report.complaints ?? "",
      suggestions: report.suggestions ?? "",
      blockers: report.blockers ?? "",
      trainingNeeds: report.trainingNeeds ?? "",
      toolNeeds: report.toolNeeds ?? "",
    });
  }, [weeklyReportQuery.data?.id, weeklyReportQuery.data?.version]);

  const refreshDailyWork = async (logId?: number) => {
    await utils.staffPerformance.listDailyLogs.invalidate();
    if (logId) await utils.staffPerformance.getDailyLog.invalidate({ id: logId });
  };

  const refreshWeeklyReports = async (reportId?: number) => {
    await utils.staffPerformance.listWeeklyReports.invalidate();
    if (reportId) await utils.staffPerformance.getWeeklyReport.invalidate({ id: reportId });
  };

  const createDailyLog = trpc.staffPerformance.createDailyLog.useMutation({
    onSuccess: async (log) => {
      setSelectedLogId(log.id);
      await refreshDailyWork(log.id);
      toast.success(isRtl ? "تم إنشاء سجل اليوم" : "Daily log created");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateDailyLog = trpc.staffPerformance.updateDailyLog.useMutation({
    onSuccess: async (log) => {
      await refreshDailyWork(log.id);
      toast.success(isRtl ? "تم حفظ ملخص نهاية الدوام" : "End-of-day notes saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const transitionDailyLog = trpc.staffPerformance.transitionDailyLog.useMutation({
    onSuccess: async (log) => {
      await refreshDailyWork(log.id);
      toast.success(isRtl ? "تم إرسال سجل اليوم للمراجعة" : "Daily log submitted for review");
    },
    onError: (error) => toast.error(error.message),
  });

  const createDailyTask = trpc.staffPerformance.createDailyTask.useMutation({
    onSuccess: async () => {
      setTaskDialogOpen(false);
      if (selectedLogId) await refreshDailyWork(selectedLogId);
      toast.success(isRtl ? "تمت إضافة المهمة" : "Task added");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateDailyTask = trpc.staffPerformance.updateDailyTask.useMutation({
    onSuccess: async () => {
      setTaskDialogOpen(false);
      if (selectedLogId) await refreshDailyWork(selectedLogId);
      toast.success(isRtl ? "تم تحديث المهمة" : "Task updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteDailyTask = trpc.staffPerformance.deleteDailyTask.useMutation({
    onSuccess: async () => {
      if (selectedLogId) await refreshDailyWork(selectedLogId);
      toast.success(isRtl ? "تم حذف المهمة" : "Task deleted");
    },
    onError: (error) => toast.error(error.message),
  });

  const createWeeklyReport = trpc.staffPerformance.createWeeklyReport.useMutation({
    onSuccess: async (report) => {
      setSelectedWeeklyId(report.id);
      await refreshWeeklyReports(report.id);
      toast.success(isRtl ? "تم إنشاء التقرير الأسبوعي" : "Weekly report created");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateWeeklyReport = trpc.staffPerformance.updateWeeklyReport.useMutation({
    onSuccess: async (report) => {
      await refreshWeeklyReports(report.id);
      toast.success(isRtl ? "تم حفظ التقرير الأسبوعي" : "Weekly report saved");
    },
    onError: (error) => toast.error(error.message),
  });

  const transitionWeeklyReport = trpc.staffPerformance.transitionWeeklyReport.useMutation({
    onSuccess: async (report) => {
      await refreshWeeklyReports(report.id);
      toast.success(isRtl ? "تم إرسال التقرير الأسبوعي للمراجعة" : "Weekly report submitted for review");
    },
    onError: (error) => toast.error(error.message),
  });

  const log = logQuery.data;
  const weeklyReport = weeklyReportQuery.data;
  const allLogs = logsQuery.data ?? [];
  const allWeeklyReports = weeklyReportsQuery.data ?? [];
  const selectedDateLog = allLogs.find((item) => item.localDate === dateInput);
  const currentWeek = getCurrentWeekRange();
  const currentWeekReport = allWeeklyReports.find((item) => item.weekStart === currentWeek.weekStart);
  const tasks = log?.tasks ?? [];
  const monthlyGoals = monthlyPlanQuery.data?.goals ?? [];
  const completedCount = tasks.filter((task) => task.completed).length;
  const submittedCount = allLogs.filter((item) => item.status === "submitted").length
    + allWeeklyReports.filter((item) => item.status === "submitted").length;
  const returnedCount = allLogs.filter((item) => item.status === "returned").length
    + allWeeklyReports.filter((item) => item.status === "returned").length;
  const weeklyAchievementValues = allWeeklyReports
    .map((item) => item.achievementPercent)
    .filter((value): value is number => typeof value === "number");
  const averageAchievement = weeklyAchievementValues.length
    ? Math.round(weeklyAchievementValues.reduce((sum, value) => sum + value, 0) / weeklyAchievementValues.length)
    : null;
  const isEditable = log?.status === "draft" || log?.status === "returned";
  const isWeeklyEditable = weeklyReport?.status === "draft" || weeklyReport?.status === "returned";
  const isSelectedLogLoading = Boolean(selectedLogId && logQuery.isLoading && !log);
  const isSelectedWeeklyLoading = Boolean(selectedWeeklyId && weeklyReportQuery.isLoading && !weeklyReport);
  const isBusy = createDailyLog.isPending
    || updateDailyLog.isPending
    || transitionDailyLog.isPending
    || createDailyTask.isPending
    || updateDailyTask.isPending
    || deleteDailyTask.isPending
    || createWeeklyReport.isPending
    || updateWeeklyReport.isPending
    || transitionWeeklyReport.isPending;

  const labels = isRtl ? {
    title: "عملي اليومي",
    phase: "Phase 1E",
    subtitle: "سجّل مهام اليوم والتقرير الأسبوعي، واربط العمل بأهداف الشهر للمراجعة.",
    disabledTitle: "الميزة غير مفعّلة",
    disabledBody: "واجهة الموظف جاهزة لكنها تبقى مخفية حتى تطبيق migration وتفعيل الخاصية بموافقة منفصلة.",
    forbiddenTitle: "صلاحية الموظف مطلوبة",
    forbiddenBody: "هذه الصفحة متاحة فقط لدور موظف إدارة الأداء.",
    workDate: "تاريخ العمل",
    createLog: "إنشاء سجل لهذا اليوم",
    recentLogs: "السجلات الأخيرة",
    noLogs: "لا توجد سجلات يومية بعد.",
    monthlyGoals: "أهداف هذا الشهر",
    noGoals: "لا توجد خطة شهرية مرتبطة بهذا الشهر بعد. يمكنك إضافة مهام غير مرتبطة بهدف.",
    tasks: "مهام اليوم",
    addTask: "إضافة مهمة",
    editTask: "تعديل المهمة",
    noTasks: "أضف مهام اليوم قبل إرسال سجل نهاية الدوام.",
    expectedOutput: "المخرج المتوقع",
    actualOutput: "المخرج الفعلي",
    endSummary: "ملخص نهاية الدوام",
    employeeNotes: "ملاحظات إضافية",
    saveSummary: "حفظ الملخص",
    submit: "إرسال للمراجعة",
    managerFeedback: "ملاحظات المدير",
    completed: "مكتملة",
    linkedGoal: "الهدف المرتبط",
    weeklyReports: "التقارير الأسبوعية",
    createWeekly: "إنشاء تقرير أسبوعي",
    noWeeklyReports: "لا توجد تقارير أسبوعية بعد.",
    week: "الأسبوع",
    outputs: "المخرجات الأسبوعية",
    achievementPercent: "نسبة الإنجاز",
    complaints: "الشكاوى",
    suggestions: "المقترحات",
    blockers: "العوائق",
    trainingNeeds: "احتياج التدريب",
    toolNeeds: "احتياج الأدوات",
    saveWeekly: "حفظ التقرير",
    indicators: "المؤشرات",
    reminders: "التذكيرات",
    exports: "تصدير CSV",
    selectedDateStatus: "حالة اليوم المحدد",
    currentWeekStatus: "حالة الأسبوع الحالي",
    awaitingReview: "بانتظار مراجعة المدير",
    returnedWork: "عناصر معادة للتعديل",
    averageAchievement: "متوسط الإنجاز",
    exportDaily: "تصدير سجلاتي اليومية",
    exportWeekly: "تصدير تقاريري الأسبوعية",
    exportEmpty: "لا توجد بيانات للتصدير بعد.",
    exportReady: "تم تجهيز ملف CSV.",
    noReminders: "لا توجد تذكيرات عاجلة الآن.",
    createTodayReminder: "لا يوجد سجل لهذا التاريخ؛ أنشئ السجل قبل إضافة المهام.",
    submitDailyReminder: "سجل اليوم ما زال مسودة؛ أضف الملخص والمهام ثم أرسله للمراجعة.",
    returnedReminder: "لديك عناصر معادة من المدير وتحتاج تعديل ثم إعادة إرسال.",
    weeklyReminder: "لا يوجد تقرير للأسبوع الحالي؛ أنشئ التقرير الأسبوعي قبل نهاية الأسبوع.",
  } : {
    title: "My Daily Work",
    phase: "Phase 1E",
    subtitle: "Track daily work and weekly reports, linking execution back to monthly goals for review.",
    disabledTitle: "Feature not enabled",
    disabledBody: "The employee daily-work interface is ready but remains hidden until the migration is applied and the feature is enabled with separate approval.",
    forbiddenTitle: "Employee access required",
    forbiddenBody: "This page is available only to the Staff Performance Employee role.",
    workDate: "Work date",
    createLog: "Create log for this date",
    recentLogs: "Recent logs",
    noLogs: "No daily logs have been created yet.",
    monthlyGoals: "This month’s goals",
    noGoals: "No monthly plan is linked to this month yet. You can still add unlinked tasks.",
    tasks: "Today’s tasks",
    addTask: "Add task",
    editTask: "Edit task",
    noTasks: "Add today’s tasks before submitting the end-of-day log.",
    expectedOutput: "Expected output",
    actualOutput: "Actual output",
    endSummary: "End-of-day summary",
    employeeNotes: "Additional notes",
    saveSummary: "Save summary",
    submit: "Submit for review",
    managerFeedback: "Manager feedback",
    completed: "Completed",
    linkedGoal: "Linked goal",
    weeklyReports: "Weekly reports",
    createWeekly: "Create weekly report",
    noWeeklyReports: "No weekly reports have been created yet.",
    week: "Week",
    outputs: "Weekly outputs",
    achievementPercent: "Achievement percent",
    complaints: "Complaints",
    suggestions: "Suggestions",
    blockers: "Blockers",
    trainingNeeds: "Training needs",
    toolNeeds: "Tool needs",
    saveWeekly: "Save report",
    indicators: "Indicators",
    reminders: "Reminders",
    exports: "CSV export",
    selectedDateStatus: "Selected date status",
    currentWeekStatus: "Current week status",
    awaitingReview: "Awaiting manager review",
    returnedWork: "Returned for changes",
    averageAchievement: "Average achievement",
    exportDaily: "Export my daily logs",
    exportWeekly: "Export my weekly reports",
    exportEmpty: "No data to export yet.",
    exportReady: "CSV file prepared.",
    noReminders: "No urgent reminders right now.",
    createTodayReminder: "No log exists for this date; create it before adding tasks.",
    submitDailyReminder: "This daily log is still a draft; add summary/tasks and submit it for review.",
    returnedReminder: "You have items returned by your manager that need edits and resubmission.",
    weeklyReminder: "No report exists for the current week; create the weekly report before week-end.",
  };

  const statusLabel = (status: string) => {
    const values: Record<string, [string, string]> = {
      draft: ["Draft", "مسودة"],
      submitted: ["Submitted", "مرسلة"],
      returned: ["Returned", "معادة للتعديل"],
      approved: ["Approved", "معتمدة"],
      locked: ["Locked", "مغلقة"],
    };
    return values[status]?.[isRtl ? 1 : 0] ?? status;
  };

  const employeeReminders = useMemo(() => {
    const reminders: string[] = [];

    if (!selectedDateLog && !logsQuery.isLoading) {
      reminders.push(labels.createTodayReminder);
    }
    if (selectedDateLog?.status === "draft" || selectedDateLog?.status === "returned") {
      reminders.push(labels.submitDailyReminder);
    }
    if (returnedCount > 0) {
      reminders.push(labels.returnedReminder);
    }
    if (!currentWeekReport && !weeklyReportsQuery.isLoading) {
      reminders.push(labels.weeklyReminder);
    }

    return reminders;
  }, [
    currentWeekReport,
    labels.createTodayReminder,
    labels.returnedReminder,
    labels.submitDailyReminder,
    labels.weeklyReminder,
    logsQuery.isLoading,
    returnedCount,
    selectedDateLog,
    weeklyReportsQuery.isLoading,
  ]);

  const exportRows = (scope: string, rows: StaffPerformanceCsvRow[]) => {
    const exported = downloadCsvRows(staffPerformanceCsvFilename(scope), rows);
    if (exported) {
      toast.success(labels.exportReady);
    } else {
      toast.info(labels.exportEmpty);
    }
  };

  const exportDailyLogs = () => {
    exportRows("employee-daily-logs", allLogs.map((item) => ({
      local_date: item.localDate,
      status: statusLabel(item.status),
      end_summary: item.endSummary,
      submitted_at: item.submittedAt,
      reviewed_at: item.reviewedAt,
    })));
  };

  const exportWeeklyReports = () => {
    exportRows("employee-weekly-reports", allWeeklyReports.map((item) => ({
      week_start: item.weekStart,
      week_end: item.weekEnd,
      status: statusLabel(item.status),
      achievement_percent: item.achievementPercent,
      outputs: item.outputs,
      submitted_at: item.submittedAt,
      reviewed_at: item.reviewedAt,
    })));
  };

  const openNewTask = () => {
    setTaskForm({
      ...emptyTaskForm(),
      sortOrder: String(tasks.length),
    });
    setTaskDialogOpen(true);
  };

  const openEditTask = (task: typeof tasks[number]) => {
    setTaskForm({
      id: task.id,
      monthlyGoalId: task.monthlyGoalId ? String(task.monthlyGoalId) : "",
      title: task.title,
      expectedOutput: task.expectedOutput,
      actualOutput: task.actualOutput ?? "",
      completed: Boolean(task.completed),
      notes: task.notes ?? "",
      sortOrder: String(task.sortOrder),
    });
    setTaskDialogOpen(true);
  };

  const saveTask = () => {
    if (!log || !taskForm.title.trim() || !taskForm.expectedOutput.trim()) return;
    const payload = {
      monthlyGoalId: taskForm.monthlyGoalId ? Number(taskForm.monthlyGoalId) : null,
      title: taskForm.title.trim(),
      expectedOutput: taskForm.expectedOutput.trim(),
      actualOutput: taskForm.actualOutput.trim() || null,
      completed: taskForm.completed,
      notes: taskForm.notes.trim() || null,
      sortOrder: Number(taskForm.sortOrder) || 0,
    };
    if (taskForm.id) {
      updateDailyTask.mutate({ id: taskForm.id, ...payload });
    } else {
      createDailyTask.mutate({ dailyLogId: log.id, ...payload });
    }
  };

  const saveLogSummary = () => {
    if (!log || !isEditable) return;
    updateDailyLog.mutate({
      id: log.id,
      version: log.version,
      endSummary: logForm.endSummary.trim() || null,
      employeeNotes: logForm.employeeNotes.trim() || null,
    });
  };

  const submitDailyLog = async () => {
    if (!log || !isEditable || tasks.length === 0 || !logForm.endSummary.trim()) return;
    try {
      let version = log.version;
      const nextEndSummary = logForm.endSummary.trim();
      const nextEmployeeNotes = logForm.employeeNotes.trim();
      const summaryChanged = (log.endSummary ?? "") !== nextEndSummary
        || (log.employeeNotes ?? "") !== nextEmployeeNotes;

      if (summaryChanged) {
        const updated = await updateDailyLog.mutateAsync({
          id: log.id,
          version,
          endSummary: nextEndSummary,
          employeeNotes: nextEmployeeNotes || null,
        });
        version = updated.version;
      }

      await transitionDailyLog.mutateAsync({ id: log.id, version, toStatus: "submitted" });
    } catch {
      // Mutation onError handlers already surface the actionable message.
    }
  };

  const createLogForDate = () => {
    createDailyLog.mutate({
      localDate: dateInput,
      timezone: getBrowserTimezone(),
    });
  };

  const createWeeklyForForm = () => {
    createWeeklyReport.mutate({
      weekStart: weeklyForm.weekStart,
      weekEnd: weeklyForm.weekEnd,
      timezone: getBrowserTimezone(),
    });
  };

  const weeklyPayload = () => ({
    outputs: weeklyForm.outputs.trim() || null,
    achievementPercent: weeklyForm.achievementPercent === "" ? null : Number(weeklyForm.achievementPercent),
    complaints: weeklyForm.complaints.trim() || null,
    suggestions: weeklyForm.suggestions.trim() || null,
    blockers: weeklyForm.blockers.trim() || null,
    trainingNeeds: weeklyForm.trainingNeeds.trim() || null,
    toolNeeds: weeklyForm.toolNeeds.trim() || null,
  });

  const saveWeeklyReport = () => {
    if (!weeklyReport || !isWeeklyEditable) return;
    updateWeeklyReport.mutate({
      id: weeklyReport.id,
      version: weeklyReport.version,
      ...weeklyPayload(),
    });
  };

  const submitWeeklyReport = async () => {
    if (!weeklyReport || !isWeeklyEditable || !weeklyForm.outputs.trim() || weeklyForm.achievementPercent === "") return;
    try {
      let version = weeklyReport.version;
      const nextValues = weeklyPayload();
      const changed = (weeklyReport.outputs ?? "") !== (nextValues.outputs ?? "")
        || weeklyReport.achievementPercent !== nextValues.achievementPercent
        || (weeklyReport.complaints ?? "") !== (nextValues.complaints ?? "")
        || (weeklyReport.suggestions ?? "") !== (nextValues.suggestions ?? "")
        || (weeklyReport.blockers ?? "") !== (nextValues.blockers ?? "")
        || (weeklyReport.trainingNeeds ?? "") !== (nextValues.trainingNeeds ?? "")
        || (weeklyReport.toolNeeds ?? "") !== (nextValues.toolNeeds ?? "");

      if (changed) {
        const updated = await updateWeeklyReport.mutateAsync({
          id: weeklyReport.id,
          version,
          ...nextValues,
        });
        version = updated.version;
      }

      await transitionWeeklyReport.mutateAsync({ id: weeklyReport.id, version, toStatus: "submitted" });
    } catch {
      // Mutation onError handlers already surface the actionable message.
    }
  };

  const linkedGoalTitle = (goalId?: number | null) => {
    if (!goalId) return isRtl ? "غير مرتبط" : "Unlinked";
    return monthlyGoals.find((goal) => goal.id === goalId)?.title ?? (isRtl ? "هدف غير ظاهر" : "Goal unavailable");
  };

  if (availabilityQuery.isLoading) {
    return <PageState icon={<Loader2 className="h-6 w-6 animate-spin" />} title={isRtl ? "جار التحميل..." : "Loading…"} />;
  }

  if (!availabilityQuery.data?.enabled) {
    return <PageState icon={<FileLock2 className="h-7 w-7" />} title={labels.disabledTitle} body={labels.disabledBody} />;
  }

  if (!canUse) {
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
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{labels.subtitle}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <label className="min-w-56 text-xs font-medium text-slate-600">
              <span className="mb-1 block">{labels.workDate}</span>
              <Input
                type="date"
                value={dateInput}
                onChange={(event) => {
                  const nextDate = event.target.value;
                  setDateInput(nextDate);
                  const existing = logsQuery.data?.find((item) => item.localDate === nextDate);
                  setSelectedLogId(existing?.id ?? null);
                }}
              />
            </label>
            {!selectedLogId && !log && (
              <Button onClick={createLogForDate} disabled={!dateInput || createDailyLog.isPending} className="self-end bg-emerald-700 hover:bg-emerald-800">
                {createDailyLog.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {labels.createLog}
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-emerald-700" />
                {labels.indicators}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <MetricCard label={labels.selectedDateStatus} value={selectedDateLog ? statusLabel(selectedDateLog.status) : "—"} />
              <MetricCard label={labels.currentWeekStatus} value={currentWeekReport ? statusLabel(currentWeekReport.status) : "—"} />
              <MetricCard label={labels.awaitingReview} value={String(submittedCount)} />
              <MetricCard label={labels.averageAchievement} value={averageAchievement === null ? "—" : `${averageAchievement}%`} />
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-4 w-4 text-emerald-700" />
                {labels.reminders}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employeeReminders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-500">{labels.noReminders}</p>
              ) : (
                <ul className="space-y-2">
                  {employeeReminders.map((reminder) => (
                    <li key={reminder} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                      {reminder}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-4 w-4 text-emerald-700" />
                {labels.exports}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetricCard label={labels.returnedWork} value={String(returnedCount)} />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={exportDailyLogs}>
                  <Download className="h-3.5 w-3.5" /> {labels.exportDaily}
                </Button>
                <Button variant="outline" size="sm" onClick={exportWeeklyReports}>
                  <Download className="h-3.5 w-3.5" /> {labels.exportWeekly}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-5">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-emerald-700" />
                  {labels.recentLogs}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {logsQuery.isLoading ? (
                  <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
                ) : !(logsQuery.data?.length) ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">{labels.noLogs}</p>
                ) : logsQuery.data.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedLogId(item.id);
                      setDateInput(item.localDate);
                    }}
                    className={`w-full rounded-xl border p-3 text-start transition ${
                      selectedLogId === item.id
                        ? "border-emerald-300 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-emerald-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{formatDate(item.localDate, isRtl)}</span>
                      <StatusBadge status={item.status} label={statusLabel(item.status)} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.endSummary || labels.noTasks}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="h-4 w-4 text-emerald-700" />
                  {labels.monthlyGoals}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {monthlyPlanQuery.isLoading ? (
                  <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-emerald-700" />
                ) : monthlyGoals.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-500">{labels.noGoals}</p>
                ) : (
                  <div className="space-y-2">
                    {monthlyGoals.map((goal) => (
                      <div key={goal.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{goal.title}</p>
                          <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">{goal.weight}%</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{goal.expectedResult}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

          <section className="min-w-0">
            {isSelectedLogLoading ? (
              <div className="flex min-h-80 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>
            ) : !log ? (
              <Card className="border-dashed border-slate-300 bg-slate-50/60">
                <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
                  <ClipboardList className="mb-3 h-10 w-10 text-slate-400" />
                  <p className="max-w-sm text-sm leading-6 text-slate-500">
                    {isRtl ? "اختر تاريخاً ثم أنشئ سجل العمل اليومي للبدء بإضافة المهام." : "Choose a date and create the daily work log to start adding tasks."}
                  </p>
                  <Button className="mt-4" onClick={createLogForDate} disabled={!dateInput || createDailyLog.isPending}>
                    <Plus className="h-4 w-4" /> {labels.createLog}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-5">
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                  <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500" />
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold text-slate-950">{formatDate(log.localDate, isRtl)}</h2>
                          <StatusBadge status={log.status} label={statusLabel(log.status)} />
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {completedCount}/{tasks.length} {isRtl ? "مهام مكتملة" : "tasks completed"}
                        </p>
                      </div>
                      {isEditable && (
                        <Button onClick={openNewTask} variant="outline">
                          <Plus className="h-4 w-4" /> {labels.addTask}
                        </Button>
                      )}
                    </div>

                    {log.managerFeedback && (
                      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <h3 className="text-sm font-semibold text-amber-900">{labels.managerFeedback}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-800">{log.managerFeedback}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <ClipboardList className="h-5 w-5 text-emerald-700" />
                        {labels.tasks}
                      </CardTitle>
                      <p className="mt-1 text-xs text-slate-500">{labels.noTasks}</p>
                    </div>
                    {isEditable && (
                      <Button size="sm" onClick={openNewTask} className="bg-emerald-700 hover:bg-emerald-800">
                        <Plus className="h-4 w-4" /> {labels.addTask}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {tasks.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                        <ClipboardList className="mx-auto mb-2 h-7 w-7 text-slate-400" />
                        <p className="text-sm text-slate-500">{labels.noTasks}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {tasks.map((task, index) => (
                          <article key={task.id} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start gap-3">
                              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                                task.completed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                              }`}>
                                {task.completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <h3 className="font-semibold text-slate-950">{task.title}</h3>
                                    <p className="mt-1 text-xs text-emerald-700">{labels.linkedGoal}: {linkedGoalTitle(task.monthlyGoalId)}</p>
                                  </div>
                                  <Badge variant="outline" className={task.completed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
                                    {task.completed ? labels.completed : statusLabel("draft")}
                                  </Badge>
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  <InfoPanel title={labels.expectedOutput} value={task.expectedOutput} />
                                  <InfoPanel title={labels.actualOutput} value={task.actualOutput} />
                                </div>
                                {task.notes && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{task.notes}</p>}
                                {isEditable && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => openEditTask(task)}>
                                      <Edit3 className="h-3.5 w-3.5" /> {isRtl ? "تعديل" : "Edit"}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                      disabled={deleteDailyTask.isPending}
                                      onClick={() => {
                                        if (window.confirm(isRtl ? "حذف هذه المهمة؟" : "Delete this task?")) {
                                          deleteDailyTask.mutate({ id: task.id });
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" /> {isRtl ? "حذف" : "Delete"}
                                    </Button>
                                  </div>
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
                    <CardTitle className="text-lg">{labels.endSummary}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label={labels.endSummary} required>
                      <Textarea
                        rows={5}
                        value={logForm.endSummary}
                        maxLength={5000}
                        disabled={!isEditable}
                        onChange={(event) => setLogForm({ ...logForm, endSummary: event.target.value })}
                      />
                    </Field>
                    <Field label={labels.employeeNotes}>
                      <Textarea
                        rows={3}
                        value={logForm.employeeNotes}
                        maxLength={5000}
                        disabled={!isEditable}
                        onChange={(event) => setLogForm({ ...logForm, employeeNotes: event.target.value })}
                      />
                    </Field>
                    {isEditable && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={saveLogSummary} disabled={isBusy}>
                          {updateDailyLog.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                          {labels.saveSummary}
                        </Button>
                        <Button
                          onClick={submitDailyLog}
                          disabled={isBusy || tasks.length === 0 || !logForm.endSummary.trim()}
                          className="bg-emerald-700 hover:bg-emerald-800"
                        >
                          {transitionDailyLog.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          {labels.submit}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-emerald-700" />
                {labels.weeklyReports}
              </CardTitle>
              <p className="mt-1 text-xs text-slate-500">
                {isRtl ? "ملخص أسبوعي للمخرجات، العوائق، والاحتياجات قبل مراجعة المدير." : "Weekly summary of outputs, blockers, and needs before manager review."}
              </p>
            </div>
            <Button
              onClick={() => {
                if (weeklyReport) {
                  setSelectedWeeklyId(null);
                  setWeeklyForm(emptyWeeklyForm());
                } else {
                  createWeeklyForForm();
                }
              }}
              disabled={isBusy || (!weeklyReport && (!weeklyForm.weekStart || !weeklyForm.weekEnd))}
              className="bg-emerald-700 hover:bg-emerald-800"
            >
              {createWeeklyReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {labels.createWeekly}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
              <aside className="space-y-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-2 text-xs font-semibold text-slate-600">{labels.week}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="date"
                      value={weeklyForm.weekStart}
                      disabled={Boolean(weeklyReport)}
                      onChange={(event) => setWeeklyForm({ ...weeklyForm, ...weekRangeFromStart(event.target.value) })}
                    />
                    <Input type="date" value={weeklyForm.weekEnd} disabled readOnly />
                  </div>
                </div>

                {weeklyReportsQuery.isLoading ? (
                  <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
                ) : !(weeklyReportsQuery.data?.length) ? (
                  <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">{labels.noWeeklyReports}</p>
                ) : weeklyReportsQuery.data.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedWeeklyId(item.id)}
                    className={`w-full rounded-xl border p-3 text-start transition ${
                      selectedWeeklyId === item.id
                        ? "border-emerald-300 bg-emerald-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-emerald-200"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900">{formatWeekRange(item.weekStart, item.weekEnd, isRtl)}</span>
                      <StatusBadge status={item.status} label={statusLabel(item.status)} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.achievementPercent === null ? "—" : `${item.achievementPercent}%`}
                    </p>
                  </button>
                ))}
              </aside>

              <section>
                {isSelectedWeeklyLoading ? (
                  <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>
                ) : !weeklyReport ? (
                  <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                    <CalendarDays className="mb-3 h-9 w-9 text-slate-400" />
                    <p className="max-w-sm text-sm leading-6 text-slate-500">{labels.noWeeklyReports}</p>
                    <Button className="mt-4" onClick={createWeeklyForForm} disabled={isBusy || !weeklyForm.weekStart || !weeklyForm.weekEnd}>
                      <Plus className="h-4 w-4" /> {labels.createWeekly}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{formatWeekRange(weeklyReport.weekStart, weeklyReport.weekEnd, isRtl)}</p>
                        <p className="mt-1 text-xs text-slate-500">{labels.achievementPercent}: {weeklyReport.achievementPercent ?? "—"}%</p>
                      </div>
                      <StatusBadge status={weeklyReport.status} label={statusLabel(weeklyReport.status)} />
                    </div>

                    {weeklyReport.managerFeedback && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <h3 className="text-sm font-semibold text-amber-900">{labels.managerFeedback}</h3>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-800">{weeklyReport.managerFeedback}</p>
                      </div>
                    )}

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label={labels.outputs} required>
                        <Textarea rows={5} value={weeklyForm.outputs} maxLength={5000} disabled={!isWeeklyEditable} onChange={(event) => setWeeklyForm({ ...weeklyForm, outputs: event.target.value })} />
                      </Field>
                      <Field label={`${labels.achievementPercent} (%)`} required>
                        <Input type="number" min={0} max={100} value={weeklyForm.achievementPercent} disabled={!isWeeklyEditable} onChange={(event) => setWeeklyForm({ ...weeklyForm, achievementPercent: event.target.value })} />
                      </Field>
                      <Field label={labels.complaints}>
                        <Textarea rows={3} value={weeklyForm.complaints} maxLength={5000} disabled={!isWeeklyEditable} onChange={(event) => setWeeklyForm({ ...weeklyForm, complaints: event.target.value })} />
                      </Field>
                      <Field label={labels.suggestions}>
                        <Textarea rows={3} value={weeklyForm.suggestions} maxLength={5000} disabled={!isWeeklyEditable} onChange={(event) => setWeeklyForm({ ...weeklyForm, suggestions: event.target.value })} />
                      </Field>
                      <Field label={labels.blockers}>
                        <Textarea rows={3} value={weeklyForm.blockers} maxLength={5000} disabled={!isWeeklyEditable} onChange={(event) => setWeeklyForm({ ...weeklyForm, blockers: event.target.value })} />
                      </Field>
                      <Field label={labels.trainingNeeds}>
                        <Textarea rows={3} value={weeklyForm.trainingNeeds} maxLength={5000} disabled={!isWeeklyEditable} onChange={(event) => setWeeklyForm({ ...weeklyForm, trainingNeeds: event.target.value })} />
                      </Field>
                      <Field label={labels.toolNeeds}>
                        <Textarea rows={3} value={weeklyForm.toolNeeds} maxLength={5000} disabled={!isWeeklyEditable} onChange={(event) => setWeeklyForm({ ...weeklyForm, toolNeeds: event.target.value })} />
                      </Field>
                    </div>

                    {isWeeklyEditable && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={saveWeeklyReport} disabled={isBusy}>
                          {updateWeeklyReport.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                          {labels.saveWeekly}
                        </Button>
                        <Button onClick={submitWeeklyReport} disabled={isBusy || !weeklyForm.outputs.trim() || weeklyForm.achievementPercent === ""} className="bg-emerald-700 hover:bg-emerald-800">
                          {transitionWeeklyReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          {labels.submit}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            </div>
          </CardContent>
        </Card>
      </main>

      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{taskForm.id ? labels.editTask : labels.addTask}</DialogTitle>
            <DialogDescription>
              {isRtl ? "حدّد المهمة ومخرجها المتوقع، ثم أضف المخرج الفعلي عند نهاية الدوام." : "Define the task and expected output, then add the actual output by end of day."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label={labels.linkedGoal}>
              <select
                value={taskForm.monthlyGoalId}
                onChange={(event) => setTaskForm({ ...taskForm, monthlyGoalId: event.target.value })}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
              >
                <option value="">{isRtl ? "بدون ربط بهدف" : "No linked goal"}</option>
                {monthlyGoals.map((goal) => (
                  <option key={goal.id} value={goal.id}>{goal.title}</option>
                ))}
              </select>
            </Field>
            <Field label={isRtl ? "عنوان المهمة" : "Task title"} required>
              <Input value={taskForm.title} maxLength={300} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} />
            </Field>
            <Field label={labels.expectedOutput} required>
              <Textarea rows={3} value={taskForm.expectedOutput} maxLength={2000} onChange={(event) => setTaskForm({ ...taskForm, expectedOutput: event.target.value })} />
            </Field>
            <Field label={labels.actualOutput}>
              <Textarea rows={3} value={taskForm.actualOutput} maxLength={5000} onChange={(event) => setTaskForm({ ...taskForm, actualOutput: event.target.value })} />
            </Field>
            <Field label={labels.employeeNotes}>
              <Textarea rows={3} value={taskForm.notes} maxLength={5000} onChange={(event) => setTaskForm({ ...taskForm, notes: event.target.value })} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={isRtl ? "الترتيب" : "Display order"}>
                <Input type="number" min={0} max={1000} value={taskForm.sortOrder} onChange={(event) => setTaskForm({ ...taskForm, sortOrder: event.target.value })} />
              </Field>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={taskForm.completed}
                  onChange={(event) => setTaskForm({ ...taskForm, completed: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                {labels.completed}
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={saveTask} disabled={isBusy || !taskForm.title.trim() || !taskForm.expectedOutput.trim()}>
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRtl ? "حفظ المهمة" : "Save task"}
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

function StatusBadge({ status, label }: { status: string; label: string }) {
  return <Badge variant="outline" className={statusStyles[status] ?? ""}>{label}</Badge>;
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

function InfoPanel({ title, value }: { title: string; value?: string | null }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value?.trim() || "—"}</p>
    </div>
  );
}

function downloadCsvRows(filename: string, rows: StaffPerformanceCsvRow[]) {
  const csv = rowsToCsv(rows);
  if (!csv) return false;

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

function toLocalIsoDate(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 10);
}

function getCurrentWeekRange(date = new Date()) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = local.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  local.setDate(local.getDate() + mondayOffset);
  return weekRangeFromStart(toLocalIsoDate(local));
}

function weekRangeFromStart(weekStart: string) {
  const [year, month, day] = weekStart.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return {
    weekStart,
    weekEnd: end.toISOString().slice(0, 10),
  };
}

function getBrowserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Amman";
}

function formatDate(value: string, isRtl: boolean) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat(isRtl ? "ar-JO" : "en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatWeekRange(weekStart: string, weekEnd: string, isRtl: boolean) {
  return `${formatDate(weekStart, isRtl)} – ${formatDate(weekEnd, isRtl)}`;
}
