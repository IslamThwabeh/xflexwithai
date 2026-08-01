import DashboardLayout from "@/components/DashboardLayout";
import { AdminFeatureSetupCard, SafeAdminPreview } from "@/components/admin/SafeAdminPreview";
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
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { rowsToCsv, staffPerformanceCsvFilename, type StaffPerformanceCsvRow } from "@shared/staffPerformanceCsv";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileLock2,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type PlanForm = {
  month: string;
  title: string;
  summary: string;
  expectedOutcomes: string;
};

type GoalForm = {
  id?: number;
  title: string;
  description: string;
  expectedResult: string;
  weight: string;
  sortOrder: string;
};

type ReviewDialogState = {
  kind: "daily" | "weekly";
  action: "returned" | "approved" | "locked";
  id: number;
  version: number;
} | null;

type PlanTransitionDialogState = {
  toStatus: "submitted" | "returned" | "approved" | "locked";
} | null;

type GoalDeleteTarget = {
  id: number;
  title: string;
  weight: number;
} | null;

function getInitialEmployeePreview() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "employee";
}

const emptyPlanForm = (): PlanForm => ({
  month: new Date().toISOString().slice(0, 7),
  title: "",
  summary: "",
  expectedOutcomes: "",
});

const emptyGoalForm = (): GoalForm => ({
  title: "",
  description: "",
  expectedResult: "",
  weight: "",
  sortOrder: "0",
});

const statusStyles: Record<string, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700",
  submitted: "border-blue-200 bg-blue-50 text-blue-700",
  returned: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  locked: "border-violet-200 bg-violet-50 text-violet-700",
};

export default function AdminStaffPerformance() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const utils = trpc.useUtils();
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [planDialogMode, setPlanDialogMode] = useState<"create" | "edit" | null>(null);
  const [planForm, setPlanForm] = useState<PlanForm>(emptyPlanForm);
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [goalForm, setGoalForm] = useState<GoalForm>(emptyGoalForm);
  const [selectedDailyLogId, setSelectedDailyLogId] = useState<number | null>(null);
  const [selectedWeeklyReportId, setSelectedWeeklyReportId] = useState<number | null>(null);
  const [reviewDialog, setReviewDialog] = useState<ReviewDialogState>(null);
  const [planTransitionDialog, setPlanTransitionDialog] = useState<PlanTransitionDialogState>(null);
  const [goalDeleteTarget, setGoalDeleteTarget] = useState<GoalDeleteTarget>(null);
  const [managerFeedback, setManagerFeedback] = useState("");
  const [directEmployeePreview] = useState(getInitialEmployeePreview);
  const [showEmployeePreview, setShowEmployeePreview] = useState(directEmployeePreview);

  const availabilityQuery = trpc.staffPerformance.availability.useQuery(undefined, { retry: false });
  const featureEnabled = availabilityQuery.data?.enabled === true;
  const canManage = availabilityQuery.data?.access === "manager";
  const staffQuery = trpc.staffPerformance.listStaffOptions.useQuery(undefined, {
    enabled: Boolean(canManage),
    retry: false,
  });
  const plansQuery = trpc.staffPerformance.listMonthlyPlans.useQuery(
    { staffUserId: selectedStaffId ?? undefined, limit: 36 },
    { enabled: Boolean(canManage && selectedStaffId), retry: false },
  );
  const planQuery = trpc.staffPerformance.getMonthlyPlan.useQuery(
    { id: selectedPlanId ?? 0 },
    { enabled: Boolean(canManage && selectedPlanId), retry: false },
  );
  const dailyLogsQuery = trpc.staffPerformance.listDailyLogs.useQuery(
    { staffUserId: selectedStaffId ?? undefined, limit: 45 },
    { enabled: Boolean(canManage && selectedStaffId), retry: false },
  );
  const dailyLogQuery = trpc.staffPerformance.getDailyLog.useQuery(
    { id: selectedDailyLogId ?? 0 },
    { enabled: Boolean(canManage && selectedDailyLogId), retry: false },
  );
  const weeklyReportsQuery = trpc.staffPerformance.listWeeklyReports.useQuery(
    { staffUserId: selectedStaffId ?? undefined, limit: 52 },
    { enabled: Boolean(canManage && selectedStaffId), retry: false },
  );
  const weeklyReportQuery = trpc.staffPerformance.getWeeklyReport.useQuery(
    { id: selectedWeeklyReportId ?? 0 },
    { enabled: Boolean(canManage && selectedWeeklyReportId), retry: false },
  );

  useEffect(() => {
    if (!selectedStaffId && staffQuery.data?.length) {
      setSelectedStaffId(staffQuery.data[0].id);
    }
  }, [selectedStaffId, staffQuery.data]);

  useEffect(() => {
    const plans = plansQuery.data ?? [];
    if (plans.length === 0) {
      setSelectedPlanId(null);
      return;
    }
    if (!plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plansQuery.data, selectedPlanId]);

  useEffect(() => {
    const dailyLogs = dailyLogsQuery.data ?? [];
    if (dailyLogs.length === 0) {
      setSelectedDailyLogId(null);
      return;
    }
    if (!dailyLogs.some((log) => log.id === selectedDailyLogId)) {
      setSelectedDailyLogId(dailyLogs[0].id);
    }
  }, [dailyLogsQuery.data, selectedDailyLogId]);

  useEffect(() => {
    const weeklyReports = weeklyReportsQuery.data ?? [];
    if (weeklyReports.length === 0) {
      setSelectedWeeklyReportId(null);
      return;
    }
    if (!weeklyReports.some((report) => report.id === selectedWeeklyReportId)) {
      setSelectedWeeklyReportId(weeklyReports[0].id);
    }
  }, [weeklyReportsQuery.data, selectedWeeklyReportId]);

  const refreshPlans = async (planId?: number) => {
    await utils.staffPerformance.listMonthlyPlans.invalidate();
    if (planId) await utils.staffPerformance.getMonthlyPlan.invalidate({ id: planId });
  };

  const refreshReviews = async () => {
    await utils.staffPerformance.listDailyLogs.invalidate();
    await utils.staffPerformance.listWeeklyReports.invalidate();
    if (selectedDailyLogId) await utils.staffPerformance.getDailyLog.invalidate({ id: selectedDailyLogId });
    if (selectedWeeklyReportId) await utils.staffPerformance.getWeeklyReport.invalidate({ id: selectedWeeklyReportId });
  };

  const createPlan = trpc.staffPerformance.createMonthlyPlan.useMutation({
    onSuccess: async (plan) => {
      setPlanDialogMode(null);
      setSelectedPlanId(plan.id);
      await refreshPlans(plan.id);
      toast.success(isRtl ? "تم إنشاء الخطة الشهرية" : "Monthly plan created");
    },
    onError: (error) => toast.error(error.message),
  });
  const updatePlan = trpc.staffPerformance.updateMonthlyPlan.useMutation({
    onSuccess: async (plan) => {
      setPlanDialogMode(null);
      await refreshPlans(plan.id);
      toast.success(isRtl ? "تم تحديث الخطة" : "Plan updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const transitionPlan = trpc.staffPerformance.transitionMonthlyPlan.useMutation({
    onSuccess: async (plan) => {
      setPlanTransitionDialog(null);
      await refreshPlans(plan.id);
      toast.success(isRtl ? "تم تحديث حالة الخطة" : "Plan status updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const createGoal = trpc.staffPerformance.createGoal.useMutation({
    onSuccess: async () => {
      setGoalDialogOpen(false);
      if (selectedPlanId) await refreshPlans(selectedPlanId);
      toast.success(isRtl ? "تمت إضافة الهدف" : "Goal added");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateGoal = trpc.staffPerformance.updateGoal.useMutation({
    onSuccess: async () => {
      setGoalDialogOpen(false);
      if (selectedPlanId) await refreshPlans(selectedPlanId);
      toast.success(isRtl ? "تم تحديث الهدف" : "Goal updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const deleteGoal = trpc.staffPerformance.deleteGoal.useMutation({
    onSuccess: async () => {
      setGoalDeleteTarget(null);
      if (selectedPlanId) await refreshPlans(selectedPlanId);
      toast.success(isRtl ? "تم حذف الهدف" : "Goal deleted");
    },
    onError: (error) => toast.error(error.message),
  });
  const transitionDailyLog = trpc.staffPerformance.transitionDailyLog.useMutation({
    onSuccess: async () => {
      setReviewDialog(null);
      setManagerFeedback("");
      await refreshReviews();
      toast.success(isRtl ? "تم تحديث مراجعة سجل اليوم" : "Daily log review updated");
    },
    onError: (error) => toast.error(error.message),
  });
  const transitionWeeklyReport = trpc.staffPerformance.transitionWeeklyReport.useMutation({
    onSuccess: async () => {
      setReviewDialog(null);
      setManagerFeedback("");
      await refreshReviews();
      toast.success(isRtl ? "تم تحديث مراجعة التقرير الأسبوعي" : "Weekly report review updated");
    },
    onError: (error) => toast.error(error.message),
  });

  const selectedStaff = staffQuery.data?.find((staff) => staff.id === selectedStaffId);
  const staffOptions = staffQuery.data ?? [];
  const plan = planQuery.data;
  const dailyLog = dailyLogQuery.data;
  const weeklyReport = weeklyReportQuery.data;
  const monthlyDailyLogs = useMemo(
    () => (dailyLogsQuery.data ?? []).filter((item) => !plan?.month || item.localDate.startsWith(plan.month)),
    [dailyLogsQuery.data, plan?.month],
  );
  const monthlyWeeklyReports = useMemo(
    () => (weeklyReportsQuery.data ?? []).filter((item) => !plan?.month || item.weekStart.startsWith(plan.month) || item.weekEnd.startsWith(plan.month)),
    [weeklyReportsQuery.data, plan?.month],
  );
  const pendingDailyReviews = useMemo(
    () => (dailyLogsQuery.data ?? []).filter((item) => item.status === "submitted"),
    [dailyLogsQuery.data],
  );
  const pendingWeeklyReviews = useMemo(
    () => (weeklyReportsQuery.data ?? []).filter((item) => item.status === "submitted"),
    [weeklyReportsQuery.data],
  );
  useEffect(() => {
    if (!plan?.month) return;
    if (monthlyDailyLogs.length === 0) {
      setSelectedDailyLogId(null);
    } else if (!monthlyDailyLogs.some((item) => item.id === selectedDailyLogId)) {
      setSelectedDailyLogId(monthlyDailyLogs[0].id);
    }
  }, [monthlyDailyLogs, plan?.month, selectedDailyLogId]);
  useEffect(() => {
    if (!plan?.month) return;
    if (monthlyWeeklyReports.length === 0) {
      setSelectedWeeklyReportId(null);
    } else if (!monthlyWeeklyReports.some((item) => item.id === selectedWeeklyReportId)) {
      setSelectedWeeklyReportId(monthlyWeeklyReports[0].id);
    }
  }, [monthlyWeeklyReports, plan?.month, selectedWeeklyReportId]);
  const monthlyAverageAchievement = useMemo(() => {
    const values = monthlyWeeklyReports
      .map((report) => report.achievementPercent)
      .filter((value): value is number => typeof value === "number");
    if (values.length === 0) return null;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [monthlyWeeklyReports]);
  const submittedDailyCount = pendingDailyReviews.length;
  const submittedWeeklyCount = pendingWeeklyReviews.length;
  const returnedDailyCount = (dailyLogsQuery.data ?? []).filter((item) => item.status === "returned").length;
  const returnedWeeklyCount = (weeklyReportsQuery.data ?? []).filter((item) => item.status === "returned").length;
  const performanceEmployeeCount = staffOptions.filter((staff) => staff.roles?.includes("staff_performance_employee")).length;
  const performanceManagerCount = staffOptions.filter((staff) => staff.roles?.includes("staff_performance_manager")).length;
  const totalWeight = useMemo(
    () => plan?.goals.reduce((sum, goal) => sum + goal.weight, 0) ?? 0,
    [plan?.goals],
  );
  const isEditable = plan?.status === "draft" || plan?.status === "returned";
  const isBusy = createPlan.isPending
    || updatePlan.isPending
    || transitionPlan.isPending
    || createGoal.isPending
    || updateGoal.isPending
    || deleteGoal.isPending
    || transitionDailyLog.isPending
    || transitionWeeklyReport.isPending;
  const workspaceError = [staffQuery, plansQuery, planQuery, dailyLogsQuery, dailyLogQuery, weeklyReportsQuery, weeklyReportQuery]
    .find((query) => query.isError)?.error;

  const retryWorkspace = () => {
    const retries: Array<Promise<unknown>> = [staffQuery.refetch()];
    if (selectedStaffId) {
      retries.push(plansQuery.refetch(), dailyLogsQuery.refetch(), weeklyReportsQuery.refetch());
    }
    if (selectedPlanId) retries.push(planQuery.refetch());
    if (selectedDailyLogId) retries.push(dailyLogQuery.refetch());
    if (selectedWeeklyReportId) retries.push(weeklyReportQuery.refetch());
    return Promise.all(retries);
  };

  const labels = isRtl ? {
    title: "إدارة أداء الموظفين",
    subtitle: "تحديد الأهداف الشهرية والنتائج المتوقعة بصورة واضحة وقابلة للقياس.",
    disabledTitle: "مساحة الأداء غير متاحة للموظفين بعد",
    disabledBody: "الميزة مخفية عن الموظفين حالياً. يمكنك مراجعة تجربة الموظف الآمنة أدناه وتجهيز الصلاحيات والخطة التجريبية قبل إطلاقها.",
    forbiddenTitle: "لا توجد صلاحية إدارة",
    forbiddenBody: "هذه الصفحة متاحة لمدير النظام أو لدور مدير أداء الموظفين فقط.",
    employee: "الموظف",
    plans: "الخطط الشهرية",
    noPlans: "لا توجد خطة لهذا الموظف بعد.",
    newPlan: "خطة جديدة",
    editPlan: "تعديل الخطة",
    goals: "الأهداف الشهرية",
    addGoal: "إضافة هدف",
    noGoals: "أضف أهدافاً واضحة، ثم اجعل مجموع الأوزان 100٪ قبل الإرسال.",
    expected: "النتيجة المتوقعة",
    weight: "الوزن",
    totalWeight: "إجمالي أوزان الأهداف",
    submit: "إرسال الخطة",
    return: "إعادة للتعديل",
    approve: "اعتماد",
    lock: "إغلاق نهائي",
    review: "مراجعة المدير",
    dailyLogs: "السجلات اليومية",
    weeklyReports: "التقارير الأسبوعية",
    monthlyContext: "ملخص الشهر",
    noDailyLogs: "لا توجد سجلات يومية لهذا الموظف بعد.",
    noWeeklyReports: "لا توجد تقارير أسبوعية لهذا الموظف بعد.",
    returnWithFeedback: "إعادة بملاحظات",
    approveReview: "اعتماد",
    lockReview: "إغلاق",
    managerFeedback: "ملاحظات المدير",
    completedTasks: "المهام المكتملة",
    achievement: "نسبة الإنجاز",
    phase: "مساحة إدارة الأداء",
    indicators: "المؤشرات",
    reminders: "التذكيرات",
    exports: "تصدير CSV",
    pilotReadiness: "جاهزية الإطلاق التجريبي",
    featureFlagStatus: "توفر مساحة الأداء",
    flagEnabled: "متاحة لفريق الإدارة",
    flagDisabled: "مخفية عن الموظفين",
    reviewInbox: "صندوق مراجعات الموظف",
    reviewInboxBody: "يعرض كل العناصر المرسلة لهذا الموظف، حتى إن لم توجد خطة شهرية أو كانت الخطة المختارة لشهر آخر.",
    inboxClear: "لا توجد عناصر مرسلة تنتظر قرارك.",
    openFeatureCenter: "فتح مركز الميزات",
    workspaceLoadFailed: "تعذر تحميل جزء من مساحة الأداء. لا تُعامل البيانات الناقصة كأنها فارغة.",
    retry: "إعادة المحاولة",
    localPilotOnly: "المساحة جاهزة لتجربة محدودة بعد تعيين الموظفين والمدير المسؤول.",
    noReminders: "لا توجد تذكيرات عاجلة لهذا الموظف.",
    pendingDailyReviews: "سجلات يومية تنتظر المراجعة",
    pendingWeeklyReviews: "تقارير أسبوعية تنتظر المراجعة",
    returnedWork: "عناصر معادة للموظف",
    staffWithRoles: "موظفون بصلاحية الأداء",
    managersWithRoles: "مديرو أداء",
    exportDaily: "تصدير السجلات اليومية",
    exportWeekly: "تصدير التقارير الأسبوعية",
    exportPlan: "تصدير الخطة الحالية",
    exportEmpty: "لا توجد بيانات للتصدير بعد.",
    exportReady: "تم تجهيز ملف CSV.",
    missingPlanReminder: "لا توجد خطة شهرية مختارة لهذا الموظف؛ ابدأ بإنشاء خطة قبل التجربة.",
    pendingDailyReminder: "توجد سجلات يومية مرسلة وتنتظر قرار المدير.",
    pendingWeeklyReminder: "توجد تقارير أسبوعية مرسلة وتنتظر قرار المدير.",
    lowAchievementReminder: "متوسط الإنجاز أقل من 70٪؛ راجع العوائق مع الموظف.",
    productionGuardrail: "لا يتم إرسال تنبيهات تلقائية ولا يتم تغيير إعداد الإنتاج من هذه الصفحة.",
    previewEmployee: "معاينة تجربة الموظف",
    hidePreview: "إغلاق المعاينة",
    missingRolesTitle: "عيّن المشاركين قبل بدء التجربة",
    missingRolesBody: "لا يوجد موظفون ظاهرون في مساحة الأداء بعد. امنح دور الموظف لمن سيملأ السجلات، ودور المدير لمن سيعتمدها.",
  } : {
    title: "Staff Performance",
    subtitle: "Set clear, measurable monthly goals and expected outcomes for each staff member.",
    disabledTitle: "Performance is not live for staff yet",
    disabledBody: "The feature is currently hidden from staff. You can still review the safe employee experience below and prepare roles and a pilot plan before launch.",
    forbiddenTitle: "Manager access required",
    forbiddenBody: "This page is available only to administrators or the Staff Performance Manager role.",
    employee: "Staff member",
    plans: "Monthly plans",
    noPlans: "No plan has been created for this staff member yet.",
    newPlan: "New plan",
    editPlan: "Edit plan",
    goals: "Monthly goals",
    addGoal: "Add goal",
    noGoals: "Add clear goals, then make their weights total 100% before submission.",
    expected: "Expected result",
    weight: "Weight",
    totalWeight: "Total goal weight",
    submit: "Submit plan",
    return: "Return for changes",
    approve: "Approve",
    lock: "Lock",
    review: "Manager review",
    dailyLogs: "Daily logs",
    weeklyReports: "Weekly reports",
    monthlyContext: "Monthly context",
    noDailyLogs: "No daily logs have been submitted by this staff member yet.",
    noWeeklyReports: "No weekly reports have been submitted by this staff member yet.",
    returnWithFeedback: "Return with feedback",
    approveReview: "Approve",
    lockReview: "Lock",
    managerFeedback: "Manager feedback",
    completedTasks: "Completed tasks",
    achievement: "Achievement",
    phase: "Performance workspace",
    indicators: "Indicators",
    reminders: "Reminders",
    exports: "CSV export",
    pilotReadiness: "Pilot readiness",
    featureFlagStatus: "Performance workspace",
    flagEnabled: "Available to administrators",
    flagDisabled: "Hidden from employees",
    reviewInbox: "Staff review inbox",
    reviewInboxBody: "Shows every submitted item for this staff member, even when no monthly plan exists or another month is selected.",
    inboxClear: "No submitted items are waiting for your decision.",
    openFeatureCenter: "Open Feature Center",
    workspaceLoadFailed: "Part of the performance workspace could not be loaded. Missing data is not being treated as an empty list.",
    retry: "Retry",
    localPilotOnly: "The workspace is ready for a limited pilot after assigning participating staff and a responsible manager.",
    noReminders: "No urgent reminders for this staff member.",
    pendingDailyReviews: "Daily logs awaiting review",
    pendingWeeklyReviews: "Weekly reports awaiting review",
    returnedWork: "Items returned to staff",
    staffWithRoles: "Performance-enabled staff",
    managersWithRoles: "Performance managers",
    exportDaily: "Export daily logs",
    exportWeekly: "Export weekly reports",
    exportPlan: "Export current plan",
    exportEmpty: "No data to export yet.",
    exportReady: "CSV file prepared.",
    missingPlanReminder: "No monthly plan is selected for this staff member; create a plan before the pilot.",
    pendingDailyReminder: "Daily logs have been submitted and are waiting for manager action.",
    pendingWeeklyReminder: "Weekly reports have been submitted and are waiting for manager action.",
    lowAchievementReminder: "Average achievement is below 70%; review blockers with the staff member.",
    productionGuardrail: "No automatic notifications are sent and no production setting is changed from this page.",
    previewEmployee: "Preview employee experience",
    hidePreview: "Close preview",
    missingRolesTitle: "Assign pilot participants before starting",
    missingRolesBody: "No staff members are visible in the performance workspace yet. Give the employee role to participants who submit logs and the manager role to reviewers.",
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

  const managerReminders = useMemo(() => {
    const reminders: string[] = [];

    if (selectedStaffId && !plan && !plansQuery.isLoading) {
      reminders.push(labels.missingPlanReminder);
    }
    if (submittedDailyCount > 0) {
      reminders.push(labels.pendingDailyReminder);
    }
    if (submittedWeeklyCount > 0) {
      reminders.push(labels.pendingWeeklyReminder);
    }
    if (monthlyAverageAchievement !== null && monthlyAverageAchievement < 70) {
      reminders.push(labels.lowAchievementReminder);
    }

    return reminders;
  }, [
    labels.lowAchievementReminder,
    labels.missingPlanReminder,
    labels.pendingDailyReminder,
    labels.pendingWeeklyReminder,
    monthlyAverageAchievement,
    plan,
    plansQuery.isLoading,
    selectedStaffId,
    submittedDailyCount,
    submittedWeeklyCount,
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
    exportRows("manager-daily-logs", monthlyDailyLogs.map((item) => ({
      staff: selectedStaff?.name || selectedStaff?.email || selectedStaffId,
      local_date: item.localDate,
      status: statusLabel(item.status),
      end_summary: item.endSummary,
      submitted_at: item.submittedAt,
      reviewed_at: item.reviewedAt,
    })));
  };

  const exportWeeklyReports = () => {
    exportRows("manager-weekly-reports", monthlyWeeklyReports.map((item) => ({
      staff: selectedStaff?.name || selectedStaff?.email || selectedStaffId,
      week_start: item.weekStart,
      week_end: item.weekEnd,
      status: statusLabel(item.status),
      achievement_percent: item.achievementPercent,
      outputs: item.outputs,
      submitted_at: item.submittedAt,
      reviewed_at: item.reviewedAt,
    })));
  };

  const exportCurrentPlan = () => {
    if (!plan) {
      exportRows("manager-monthly-plan", []);
      return;
    }

    const rows = plan.goals.length > 0
      ? plan.goals.map((goal) => ({
        staff: selectedStaff?.name || selectedStaff?.email || selectedStaffId,
        month: plan.month,
        plan_title: plan.title,
        plan_status: statusLabel(plan.status),
        goal_title: goal.title,
        goal_weight: goal.weight,
        expected_result: goal.expectedResult,
      }))
      : [{
        staff: selectedStaff?.name || selectedStaff?.email || selectedStaffId,
        month: plan.month,
        plan_title: plan.title,
        plan_status: statusLabel(plan.status),
        goal_title: "",
        goal_weight: "",
        expected_result: "",
      }];

    exportRows("manager-monthly-plan", rows);
  };

  const openCreatePlan = () => {
    setPlanForm(emptyPlanForm());
    setPlanDialogMode("create");
  };

  const openEditPlan = () => {
    if (!plan) return;
    setPlanForm({
      month: plan.month,
      title: plan.title,
      summary: plan.summary ?? "",
      expectedOutcomes: plan.expectedOutcomes ?? "",
    });
    setPlanDialogMode("edit");
  };

  const savePlan = () => {
    if (!selectedStaffId || !planForm.title.trim()) return;
    if (planDialogMode === "create") {
      createPlan.mutate({
        staffUserId: selectedStaffId,
        month: planForm.month,
        title: planForm.title.trim(),
        summary: planForm.summary.trim() || null,
        expectedOutcomes: planForm.expectedOutcomes.trim() || null,
      });
    } else if (plan) {
      updatePlan.mutate({
        id: plan.id,
        version: plan.version,
        title: planForm.title.trim(),
        summary: planForm.summary.trim() || null,
        expectedOutcomes: planForm.expectedOutcomes.trim() || null,
      });
    }
  };

  const openNewGoal = () => {
    setGoalForm({
      ...emptyGoalForm(),
      sortOrder: String(plan?.goals.length ?? 0),
    });
    setGoalDialogOpen(true);
  };

  const openEditGoal = (goal: NonNullable<typeof plan>["goals"][number]) => {
    setGoalForm({
      id: goal.id,
      title: goal.title,
      description: goal.description ?? "",
      expectedResult: goal.expectedResult,
      weight: String(goal.weight),
      sortOrder: String(goal.sortOrder),
    });
    setGoalDialogOpen(true);
  };

  const saveGoal = () => {
    if (!plan || !goalForm.title.trim() || !goalForm.expectedResult.trim()) return;
    const values = {
      title: goalForm.title.trim(),
      description: goalForm.description.trim() || null,
      expectedResult: goalForm.expectedResult.trim(),
      weight: Number(goalForm.weight),
      sortOrder: Number(goalForm.sortOrder) || 0,
    };
    if (goalForm.id) {
      updateGoal.mutate({ id: goalForm.id, ...values });
    } else {
      createGoal.mutate({ planId: plan.id, ...values });
    }
  };

  const openReviewDialog = (state: NonNullable<ReviewDialogState>) => {
    setReviewDialog(state);
    setManagerFeedback("");
  };

  const submitReviewAction = () => {
    if (!reviewDialog) return;
    if (reviewDialog.action === "returned" && !managerFeedback.trim()) return;
    const payload = {
      id: reviewDialog.id,
      version: reviewDialog.version,
      toStatus: reviewDialog.action,
      managerFeedback: reviewDialog.action === "returned" ? managerFeedback.trim() || null : undefined,
    };
    if (reviewDialog.kind === "daily") {
      transitionDailyLog.mutate(payload);
    } else {
      transitionWeeklyReport.mutate(payload);
    }
  };

  const confirmPlanTransition = () => {
    if (!plan || !planTransitionDialog) return;
    transitionPlan.mutate({
      id: plan.id,
      version: plan.version,
      toStatus: planTransitionDialog.toStatus,
    });
  };

  const reviewTarget: any = reviewDialog
    ? reviewDialog.kind === "daily"
      ? (dailyLogsQuery.data ?? []).find((item) => item.id === reviewDialog.id)
      : (weeklyReportsQuery.data ?? []).find((item) => item.id === reviewDialog.id)
    : null;

  if (availabilityQuery.isLoading) {
    return <PageState icon={<Loader2 className="h-6 w-6 animate-spin" />} title={isRtl ? "جار التحميل..." : "Loading…"} />;
  }

  if (availabilityQuery.isError) {
    return <PageState icon={<AlertCircle className="h-7 w-7" />} title={labels.workspaceLoadFailed} body={availabilityQuery.error.message} />;
  }

  if (!featureEnabled && !canManage) {
    return <StaffPerformanceSetupShell isRtl={isRtl} title={labels.title} subtitle={labels.subtitle} disabledTitle={labels.disabledTitle} disabledBody={labels.disabledBody} directPreview={directEmployeePreview} />;
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
              <ClipboardCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">{labels.phase}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{labels.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{labels.subtitle}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <Button
              type="button"
              variant={showEmployeePreview ? "default" : "outline"}
              onClick={() => setShowEmployeePreview((current) => !current)}
              className={showEmployeePreview ? "self-end bg-indigo-600 hover:bg-indigo-700" : "self-end"}
            >
              <Eye className="h-4 w-4" />
              {showEmployeePreview ? labels.hidePreview : labels.previewEmployee}
            </Button>
            <label className="min-w-64 text-xs font-medium text-slate-600">
              <span className="mb-1 block">{labels.employee}</span>
              <select
                value={selectedStaffId ?? ""}
                onChange={(event) => {
                  setSelectedStaffId(Number(event.target.value));
                  setSelectedPlanId(null);
                  setSelectedDailyLogId(null);
                  setSelectedWeeklyReportId(null);
                  setReviewDialog(null);
                }}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
              >
                {(staffQuery.data ?? []).map((staff) => (
                  <option key={staff.id} value={staff.id}>{staff.name || staff.email}</option>
                ))}
              </select>
            </label>
            <Button onClick={openCreatePlan} disabled={!selectedStaffId} className="self-end bg-emerald-700 hover:bg-emerald-800">
              <Plus className="h-4 w-4" />
              {labels.newPlan}
            </Button>
          </div>
        </header>

        {showEmployeePreview && <StaffEmployeePreview isRtl={isRtl} focusOnMount={directEmployeePreview} />}

        {!featureEnabled && (
          <AdminFeatureSetupCard
            isRtl={isRtl}
            title={labels.disabledTitle}
            description={labels.disabledBody}
            items={[
              { label: isRtl ? "تجهيز أدوار الموظف والمدير" : "Prepare employee and manager roles", complete: performanceEmployeeCount > 0 && performanceManagerCount > 0 },
              { label: isRtl ? "إنشاء خطة تجريبية وأهدافها أدناه" : "Create a pilot plan and goals below", complete: Boolean(plansQuery.data?.length) },
              { label: isRtl ? "مراجعة تجربة الموظف الآمنة" : "Review the safe employee preview", complete: showEmployeePreview },
            ]}
            action={(
              <Button asChild variant="outline" className="border-amber-300 bg-white text-amber-950 hover:bg-amber-100">
                <Link href="/admin/features">{labels.openFeatureCenter}</Link>
              </Button>
            )}
          />
        )}

        {workspaceError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2 text-red-900">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold">{labels.workspaceLoadFailed}</p>
                  <p className="mt-1 text-xs">{workspaceError.message}</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={retryWorkspace}>{labels.retry}</Button>
            </div>
          </div>
        )}

        {!staffQuery.isLoading && staffOptions.length === 0 && (
          <AdminFeatureSetupCard
            isRtl={isRtl}
            title={labels.missingRolesTitle}
            description={labels.missingRolesBody}
            items={[
              { label: isRtl ? "تعيين موظف واحد على الأقل للتجربة" : "Assign at least one pilot employee" },
              { label: isRtl ? "تعيين مدير مسؤول عن الاعتماد" : "Assign a responsible performance manager" },
              { label: isRtl ? "مراجعة تجربة الموظف التجريبية" : "Review the synthetic employee preview", complete: showEmployeePreview },
            ]}
          />
        )}

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4 text-emerald-700" />
                {labels.indicators}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <MetricCard label={labels.pendingDailyReviews} value={String(submittedDailyCount)} />
              <MetricCard label={labels.pendingWeeklyReviews} value={String(submittedWeeklyCount)} />
              <MetricCard label={labels.returnedWork} value={String(returnedDailyCount + returnedWeeklyCount)} />
              <MetricCard label={labels.achievement} value={monthlyAverageAchievement === null ? "—" : `${monthlyAverageAchievement}%`} />
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
              {managerReminders.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm leading-6 text-slate-500">{labels.noReminders}</p>
              ) : (
                <ul className="space-y-2">
                  {managerReminders.map((reminder) => (
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
                <ShieldCheck className="h-4 w-4 text-emerald-700" />
                {labels.pilotReadiness}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label={labels.featureFlagStatus} value={featureEnabled ? labels.flagEnabled : labels.flagDisabled} />
                <MetricCard label={labels.staffWithRoles} value={String(performanceEmployeeCount)} />
                <MetricCard label={labels.managersWithRoles} value={String(performanceManagerCount)} />
                <MetricCard label={labels.exports} value="CSV" />
              </div>
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-6 text-emerald-900">{labels.localPilotOnly}</p>
              <p className="text-xs leading-5 text-slate-500">{labels.productionGuardrail}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={exportDailyLogs} disabled={!selectedStaffId}>
                  <Download className="h-3.5 w-3.5" /> {labels.exportDaily}
                </Button>
                <Button variant="outline" size="sm" onClick={exportWeeklyReports} disabled={!selectedStaffId}>
                  <Download className="h-3.5 w-3.5" /> {labels.exportWeekly}
                </Button>
                <Button variant="outline" size="sm" onClick={exportCurrentPlan} disabled={!selectedStaffId}>
                  <Download className="h-3.5 w-3.5" /> {labels.exportPlan}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-5 w-5 text-blue-700" />
                {labels.reviewInbox}
              </CardTitle>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">{labels.reviewInboxBody}</p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="border-blue-200 bg-white text-blue-800">{labels.dailyLogs}: {pendingDailyReviews.length}</Badge>
              <Badge variant="outline" className="border-blue-200 bg-white text-blue-800">{labels.weeklyReports}: {pendingWeeklyReviews.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {dailyLogsQuery.isLoading || weeklyReportsQuery.isLoading ? (
              <Loader2 className="mx-auto my-6 h-5 w-5 animate-spin text-blue-700" />
            ) : pendingDailyReviews.length === 0 && pendingWeeklyReviews.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white p-4 text-sm font-medium text-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                {labels.inboxClear}
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarDays className="h-4 w-4 text-blue-700" />{labels.dailyLogs}</h3>
                  {pendingDailyReviews.length === 0 ? (
                    <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-slate-500">{labels.inboxClear}</p>
                  ) : pendingDailyReviews.map((item) => (
                    <article key={item.id} className="rounded-xl border border-blue-100 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-950">{formatDate(item.localDate, isRtl)}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.endSummary || "—"}</p>
                        </div>
                        <StatusBadge status={item.status} label={statusLabel(item.status)} />
                      </div>
                      <ReviewActions
                        status={item.status}
                        labels={labels}
                        isBusy={isBusy}
                        onReturn={() => openReviewDialog({ kind: "daily", action: "returned", id: item.id, version: item.version })}
                        onApprove={() => openReviewDialog({ kind: "daily", action: "approved", id: item.id, version: item.version })}
                        onLock={() => openReviewDialog({ kind: "daily", action: "locked", id: item.id, version: item.version })}
                      />
                    </article>
                  ))}
                </section>
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><CalendarRange className="h-4 w-4 text-blue-700" />{labels.weeklyReports}</h3>
                  {pendingWeeklyReviews.length === 0 ? (
                    <p className="rounded-xl border border-dashed bg-white p-4 text-sm text-slate-500">{labels.inboxClear}</p>
                  ) : pendingWeeklyReviews.map((item) => (
                    <article key={item.id} className="rounded-xl border border-blue-100 bg-white p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-slate-950">{formatWeekRange(item.weekStart, item.weekEnd, isRtl)}</p>
                          <p className="mt-1 text-xs text-slate-500">{labels.achievement}: {item.achievementPercent ?? "—"}%</p>
                        </div>
                        <StatusBadge status={item.status} label={statusLabel(item.status)} />
                      </div>
                      <ReviewActions
                        status={item.status}
                        labels={labels}
                        isBusy={isBusy}
                        onReturn={() => openReviewDialog({ kind: "weekly", action: "returned", id: item.id, version: item.version })}
                        onApprove={() => openReviewDialog({ kind: "weekly", action: "approved", id: item.id, version: item.version })}
                        onLock={() => openReviewDialog({ kind: "weekly", action: "locked", id: item.id, version: item.version })}
                      />
                    </article>
                  ))}
                </section>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Card className="h-fit border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarRange className="h-4 w-4 text-emerald-700" />
                {labels.plans}
              </CardTitle>
              {selectedStaff && <p className="truncate text-xs text-slate-500">{selectedStaff.name || selectedStaff.email}</p>}
            </CardHeader>
            <CardContent className="space-y-2">
              {plansQuery.isLoading ? (
                <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
              ) : !(plansQuery.data?.length) ? (
                <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">{labels.noPlans}</p>
              ) : plansQuery.data.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedPlanId(item.id)}
                  className={`w-full rounded-xl border p-3 text-start transition ${
                    selectedPlanId === item.id
                      ? "border-emerald-300 bg-emerald-50 shadow-sm"
                      : "border-slate-200 bg-white hover:border-emerald-200"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">{formatMonth(item.month, isRtl)}</span>
                    <StatusBadge status={item.status} label={statusLabel(item.status)} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.title}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <section className="min-w-0">
            {!selectedPlanId ? (
              <Card className="border-dashed border-slate-300 bg-slate-50/60">
                <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
                  <Target className="mb-3 h-9 w-9 text-slate-400" />
                  <p className="max-w-sm text-sm leading-6 text-slate-500">{labels.noPlans}</p>
                  <Button className="mt-4" variant="outline" onClick={openCreatePlan} disabled={!selectedStaffId}>
                    <Plus className="h-4 w-4" /> {labels.newPlan}
                  </Button>
                </CardContent>
              </Card>
            ) : planQuery.isLoading || !plan ? (
              <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>
            ) : (
              <div className="space-y-5">
                <Card className="overflow-hidden border-slate-200 shadow-sm">
                  <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-500" />
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-xl font-bold text-slate-950">{plan.title}</h2>
                          <StatusBadge status={plan.status} label={statusLabel(plan.status)} />
                        </div>
                        <p className="mt-1 text-sm font-medium text-emerald-700">{formatMonth(plan.month, isRtl)}</p>
                      </div>
                      {isEditable && (
                        <Button variant="outline" size="sm" onClick={openEditPlan}>
                          <Edit3 className="h-4 w-4" /> {labels.editPlan}
                        </Button>
                      )}
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <InfoPanel title={isRtl ? "ملخص الخطة" : "Plan summary"} value={plan.summary} />
                      <InfoPanel title={isRtl ? "المخرجات المتوقعة" : "Expected outcomes"} value={plan.expectedOutcomes} />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      {(plan.status === "draft" || plan.status === "returned") && (
                        <Button
                          onClick={() => setPlanTransitionDialog({ toStatus: "submitted" })}
                          disabled={isBusy || totalWeight !== 100 || plan.goals.length === 0}
                        >
                          <Send className="h-4 w-4" /> {labels.submit}
                        </Button>
                      )}
                      {plan.status === "submitted" && (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setPlanTransitionDialog({ toStatus: "returned" })}
                            disabled={isBusy}
                          >
                            <RotateCcw className="h-4 w-4" /> {labels.return}
                          </Button>
                          <Button
                            className="bg-emerald-700 hover:bg-emerald-800"
                            onClick={() => setPlanTransitionDialog({ toStatus: "approved" })}
                            disabled={isBusy}
                          >
                            <CheckCircle2 className="h-4 w-4" /> {labels.approve}
                          </Button>
                        </>
                      )}
                      {plan.status === "approved" && (
                        <Button
                          className="bg-violet-700 hover:bg-violet-800"
                          onClick={() => setPlanTransitionDialog({ toStatus: "locked" })}
                          disabled={isBusy}
                        >
                          <FileLock2 className="h-4 w-4" /> {labels.lock}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 shadow-sm">
                  <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Target className="h-5 w-5 text-emerald-700" /> {labels.goals}
                      </CardTitle>
                      <p className="mt-1 text-xs text-slate-500">{labels.noGoals}</p>
                    </div>
                    {isEditable && (
                      <Button variant="outline" size="sm" onClick={openNewGoal}>
                        <Plus className="h-4 w-4" /> {labels.addGoal}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{labels.totalWeight}</span>
                        <span className={`font-bold ${totalWeight === 100 ? "text-emerald-700" : totalWeight > 100 ? "text-red-600" : "text-amber-700"}`}>
                          {totalWeight}%
                        </span>
                      </div>
                      <Progress value={Math.min(totalWeight, 100)} className="h-2" />
                    </div>

                    {plan.goals.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
                        <Target className="mx-auto mb-2 h-7 w-7 text-slate-400" />
                        <p className="text-sm text-slate-500">{labels.noGoals}</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {plan.goals.map((goal, index) => (
                          <article key={goal.id} className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="flex items-start gap-3">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700">
                                {index + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <h3 className="font-semibold text-slate-950">{goal.title}</h3>
                                    {goal.description && <p className="mt-1 text-sm leading-6 text-slate-500">{goal.description}</p>}
                                  </div>
                                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                                    {labels.weight}: {goal.weight}%
                                  </Badge>
                                </div>
                                <div className="mt-3 rounded-lg bg-slate-50 p-3">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.expected}</p>
                                  <p className="mt-1 text-sm leading-6 text-slate-700">{goal.expectedResult}</p>
                                </div>
                                {isEditable && (
                                  <div className="mt-3 flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => openEditGoal(goal)}>
                                      <Edit3 className="h-3.5 w-3.5" /> {isRtl ? "تعديل" : "Edit"}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                      disabled={deleteGoal.isPending}
                                      onClick={() => setGoalDeleteTarget({ id: goal.id, title: goal.title, weight: goal.weight })}
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
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ClipboardList className="h-5 w-5 text-emerald-700" />
                      {labels.review}
                    </CardTitle>
                    <p className="mt-1 text-xs text-slate-500">
                      {isRtl ? "مراجعة السجلات اليومية والتقارير الأسبوعية ضمن سياق الخطة الشهرية." : "Review daily logs and weekly reports in the context of the monthly plan."}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-3 md:grid-cols-4">
                      <MetricCard label={labels.monthlyContext} value={formatMonth(plan.month, isRtl)} />
                      <MetricCard label={labels.dailyLogs} value={String(monthlyDailyLogs.length)} />
                      <MetricCard label={labels.weeklyReports} value={String(monthlyWeeklyReports.length)} />
                      <MetricCard label={labels.achievement} value={monthlyAverageAchievement === null ? "—" : `${monthlyAverageAchievement}%`} />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-emerald-700" />
                          <h3 className="font-semibold text-slate-950">{labels.dailyLogs}</h3>
                        </div>
                        {dailyLogsQuery.isLoading ? (
                          <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
                        ) : monthlyDailyLogs.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">{labels.noDailyLogs}</p>
                        ) : (
                          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                            <div className="space-y-2">
                              {monthlyDailyLogs.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setSelectedDailyLogId(item.id)}
                                  className={`w-full rounded-xl border p-3 text-start transition ${
                                    selectedDailyLogId === item.id
                                      ? "border-emerald-300 bg-emerald-50 shadow-sm"
                                      : "border-slate-200 bg-white hover:border-emerald-200"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-slate-900">{formatDate(item.localDate, isRtl)}</span>
                                    <StatusBadge status={item.status} label={statusLabel(item.status)} />
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.endSummary || "—"}</p>
                                </button>
                              ))}
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                              {dailyLogQuery.isLoading ? (
                                <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-emerald-700" /></div>
                              ) : !dailyLog ? (
                                <p className="py-10 text-center text-sm text-slate-500">{labels.noDailyLogs}</p>
                              ) : (
                                <div className="space-y-4">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <h4 className="font-semibold text-slate-950">{formatDate(dailyLog.localDate, isRtl)}</h4>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {labels.completedTasks}: {dailyLog.tasks.filter((task) => task.completed).length}/{dailyLog.tasks.length}
                                      </p>
                                    </div>
                                    <StatusBadge status={dailyLog.status} label={statusLabel(dailyLog.status)} />
                                  </div>
                                  <InfoPanel title={isRtl ? "ملخص نهاية الدوام" : "End-of-day summary"} value={dailyLog.endSummary} />
                                  {dailyLog.employeeNotes && <InfoPanel title={isRtl ? "ملاحظات الموظف" : "Employee notes"} value={dailyLog.employeeNotes} />}
                                  {dailyLog.managerFeedback && <InfoPanel title={labels.managerFeedback} value={dailyLog.managerFeedback} />}
                                  <div className="space-y-2">
                                    {dailyLog.tasks.map((task) => (
                                      <div key={task.id} className="rounded-lg bg-slate-50 p-3">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                                          <Badge variant="outline" className={task.completed ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}>
                                            {task.completed ? (isRtl ? "مكتملة" : "Completed") : (isRtl ? "مفتوحة" : "Open")}
                                          </Badge>
                                        </div>
                                        <p className="mt-1 text-xs leading-5 text-slate-500">{task.actualOutput || task.expectedOutput}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <ReviewActions
                                    status={dailyLog.status}
                                    labels={labels}
                                    isBusy={isBusy}
                                    onReturn={() => openReviewDialog({ kind: "daily", action: "returned", id: dailyLog.id, version: dailyLog.version })}
                                    onApprove={() => openReviewDialog({ kind: "daily", action: "approved", id: dailyLog.id, version: dailyLog.version })}
                                    onLock={() => openReviewDialog({ kind: "daily", action: "locked", id: dailyLog.id, version: dailyLog.version })}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </section>

                      <section className="space-y-3">
                        <div className="flex items-center gap-2">
                          <CalendarRange className="h-4 w-4 text-emerald-700" />
                          <h3 className="font-semibold text-slate-950">{labels.weeklyReports}</h3>
                        </div>
                        {weeklyReportsQuery.isLoading ? (
                          <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
                        ) : monthlyWeeklyReports.length === 0 ? (
                          <p className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">{labels.noWeeklyReports}</p>
                        ) : (
                          <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                            <div className="space-y-2">
                              {monthlyWeeklyReports.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setSelectedWeeklyReportId(item.id)}
                                  className={`w-full rounded-xl border p-3 text-start transition ${
                                    selectedWeeklyReportId === item.id
                                      ? "border-emerald-300 bg-emerald-50 shadow-sm"
                                      : "border-slate-200 bg-white hover:border-emerald-200"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold text-slate-900">{formatWeekRange(item.weekStart, item.weekEnd, isRtl)}</span>
                                    <StatusBadge status={item.status} label={statusLabel(item.status)} />
                                  </div>
                                  <p className="mt-1 text-xs text-slate-500">{labels.achievement}: {item.achievementPercent ?? "—"}%</p>
                                </button>
                              ))}
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                              {weeklyReportQuery.isLoading ? (
                                <div className="flex min-h-52 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-emerald-700" /></div>
                              ) : !weeklyReport ? (
                                <p className="py-10 text-center text-sm text-slate-500">{labels.noWeeklyReports}</p>
                              ) : (
                                <div className="space-y-4">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <h4 className="font-semibold text-slate-950">{formatWeekRange(weeklyReport.weekStart, weeklyReport.weekEnd, isRtl)}</h4>
                                      <p className="mt-1 text-xs text-slate-500">{labels.achievement}: {weeklyReport.achievementPercent ?? "—"}%</p>
                                    </div>
                                    <StatusBadge status={weeklyReport.status} label={statusLabel(weeklyReport.status)} />
                                  </div>
                                  <InfoPanel title={isRtl ? "المخرجات الأسبوعية" : "Weekly outputs"} value={weeklyReport.outputs} />
                                  <div className="grid gap-3 md:grid-cols-2">
                                    <InfoPanel title={isRtl ? "الشكاوى" : "Complaints"} value={weeklyReport.complaints} />
                                    <InfoPanel title={isRtl ? "المقترحات" : "Suggestions"} value={weeklyReport.suggestions} />
                                    <InfoPanel title={isRtl ? "العوائق" : "Blockers"} value={weeklyReport.blockers} />
                                    <InfoPanel title={isRtl ? "احتياج التدريب" : "Training needs"} value={weeklyReport.trainingNeeds} />
                                    <InfoPanel title={isRtl ? "احتياج الأدوات" : "Tool needs"} value={weeklyReport.toolNeeds} />
                                    {weeklyReport.managerFeedback && <InfoPanel title={labels.managerFeedback} value={weeklyReport.managerFeedback} />}
                                  </div>
                                  <ReviewActions
                                    status={weeklyReport.status}
                                    labels={labels}
                                    isBusy={isBusy}
                                    onReturn={() => openReviewDialog({ kind: "weekly", action: "returned", id: weeklyReport.id, version: weeklyReport.version })}
                                    onApprove={() => openReviewDialog({ kind: "weekly", action: "approved", id: weeklyReport.id, version: weeklyReport.version })}
                                    onLock={() => openReviewDialog({ kind: "weekly", action: "locked", id: weeklyReport.id, version: weeklyReport.version })}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </section>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog open={planDialogMode !== null} onOpenChange={(open) => !open && setPlanDialogMode(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{planDialogMode === "create" ? labels.newPlan : labels.editPlan}</DialogTitle>
            <DialogDescription>
              {isRtl ? "حدد الشهر، عنوان الخطة، والنتائج التي يُتوقع من الموظف تحقيقها." : "Define the month, plan purpose, and the outcomes this employee is expected to achieve."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label={isRtl ? "الشهر" : "Month"} required>
              <Input type="month" value={planForm.month} disabled={planDialogMode === "edit"} onChange={(event) => setPlanForm({ ...planForm, month: event.target.value })} />
            </Field>
            <Field label={isRtl ? "عنوان الخطة" : "Plan title"} required>
              <Input value={planForm.title} maxLength={300} onChange={(event) => setPlanForm({ ...planForm, title: event.target.value })} />
            </Field>
            <Field label={isRtl ? "ملخص الخطة" : "Plan summary"}>
              <Textarea rows={4} value={planForm.summary} maxLength={5000} onChange={(event) => setPlanForm({ ...planForm, summary: event.target.value })} />
            </Field>
            <Field label={isRtl ? "المخرجات المتوقعة" : "Expected outcomes"}>
              <Textarea rows={4} value={planForm.expectedOutcomes} maxLength={5000} onChange={(event) => setPlanForm({ ...planForm, expectedOutcomes: event.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialogMode(null)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={savePlan} disabled={isBusy || !planForm.month || !planForm.title.trim()}>
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRtl ? "حفظ" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{goalForm.id ? (isRtl ? "تعديل الهدف" : "Edit goal") : labels.addGoal}</DialogTitle>
            <DialogDescription>
              {isRtl ? "اكتب هدفاً قابلاً للقياس وحدد النتيجة المتوقعة ووزنه من الخطة." : "Use a measurable goal, a clear expected result, and its share of the monthly plan."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Field label={isRtl ? "عنوان الهدف" : "Goal title"} required>
              <Input value={goalForm.title} maxLength={300} onChange={(event) => setGoalForm({ ...goalForm, title: event.target.value })} />
            </Field>
            <Field label={isRtl ? "وصف الهدف" : "Description"}>
              <Textarea rows={3} value={goalForm.description} maxLength={5000} onChange={(event) => setGoalForm({ ...goalForm, description: event.target.value })} />
            </Field>
            <Field label={labels.expected} required>
              <Textarea rows={4} value={goalForm.expectedResult} maxLength={2000} onChange={(event) => setGoalForm({ ...goalForm, expectedResult: event.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`${labels.weight} (%)`} required>
                <Input type="number" min={0} max={100} value={goalForm.weight} onChange={(event) => setGoalForm({ ...goalForm, weight: event.target.value })} />
              </Field>
              <Field label={isRtl ? "الترتيب" : "Display order"}>
                <Input type="number" min={0} max={1000} value={goalForm.sortOrder} onChange={(event) => setGoalForm({ ...goalForm, sortOrder: event.target.value })} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button
              onClick={saveGoal}
              disabled={isBusy || !goalForm.title.trim() || !goalForm.expectedResult.trim() || goalForm.weight === ""}
            >
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRtl ? "حفظ الهدف" : "Save goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={planTransitionDialog !== null} onOpenChange={(open) => !open && !transitionPlan.isPending && setPlanTransitionDialog(null)}>
        <DialogContent className="sm:max-w-lg" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRtl ? "تأكيد تغيير حالة الخطة" : "Confirm plan status change"}</DialogTitle>
            <DialogDescription>
              {isRtl ? "راجع الخطة والموظف والحالة الجديدة قبل الحفظ. سيُسجل الإجراء في سجل التدقيق." : "Review the plan, staff member, and new status before saving. The action will be recorded in the audit log."}
            </DialogDescription>
          </DialogHeader>
          {plan && planTransitionDialog && (
            <div className="space-y-3">
              <div className="rounded-xl border bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.employee}</p>
                <p className="mt-1 font-semibold text-slate-950">{selectedStaff?.name || selectedStaff?.email || "—"}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{isRtl ? "الخطة" : "Plan"}</p>
                <p className="mt-1 font-semibold text-slate-950">{plan.title} · {formatMonth(plan.month, isRtl)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <StatusBadge status={plan.status} label={statusLabel(plan.status)} />
                  <ArrowRight className={`h-4 w-4 text-slate-400 ${isRtl ? "rotate-180" : ""}`} />
                  <StatusBadge status={planTransitionDialog.toStatus} label={statusLabel(planTransitionDialog.toStatus)} />
                </div>
              </div>
              {planTransitionDialog.toStatus === "locked" && (
                <p className="rounded-lg border border-violet-200 bg-violet-50 p-3 text-sm font-medium leading-6 text-violet-900">
                  {isRtl ? "الإغلاق نهائي: لن يمكن تعديل الخطة أو أهدافها بعد ذلك." : "Locking is final: the plan and its goals cannot be edited afterward."}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPlanTransitionDialog(null)} disabled={transitionPlan.isPending}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button type="button" onClick={confirmPlanTransition} disabled={transitionPlan.isPending} className={planTransitionDialog?.toStatus === "locked" ? "bg-violet-700 text-white hover:bg-violet-800" : "bg-emerald-700 text-white hover:bg-emerald-800"}>
              {transitionPlan.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRtl ? "تأكيد التغيير" : "Confirm change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goalDeleteTarget !== null} onOpenChange={(open) => !open && !deleteGoal.isPending && setGoalDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRtl ? "حذف الهدف؟" : "Delete goal?"}</DialogTitle>
            <DialogDescription>
              {isRtl ? "سيُحذف الهدف من الخطة الحالية ويُسجل الإجراء في سجل التدقيق." : "The goal will be removed from the current plan and the action will be recorded in the audit log."}
            </DialogDescription>
          </DialogHeader>
          {goalDeleteTarget && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-950">{goalDeleteTarget.title}</p>
              <p className="mt-1 text-sm text-red-800">{labels.weight}: {goalDeleteTarget.weight}%</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setGoalDeleteTarget(null)} disabled={deleteGoal.isPending}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button type="button" variant="destructive" disabled={!goalDeleteTarget || deleteGoal.isPending} onClick={() => goalDeleteTarget && deleteGoal.mutate({ id: goalDeleteTarget.id })}>
              {deleteGoal.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRtl ? "حذف الهدف" : "Delete goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewDialog !== null} onOpenChange={(open) => !open && setReviewDialog(null)}>
        <DialogContent className="sm:max-w-lg" dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.action === "returned"
                ? labels.returnWithFeedback
                : reviewDialog?.action === "locked"
                  ? labels.lockReview
                  : labels.approveReview}
            </DialogTitle>
            <DialogDescription>
              {isRtl ? "سيتم تسجيل القرار في سجل التدقيق الخاص بإدارة الأداء." : "This decision will be recorded in the staff performance audit log."}
            </DialogDescription>
          </DialogHeader>
          {reviewDialog && (
            <div className="rounded-xl border bg-slate-50 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.employee}</p>
              <p className="mt-1 font-semibold text-slate-950">{selectedStaff?.name || selectedStaff?.email || "—"}</p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{reviewDialog.kind === "daily" ? labels.dailyLogs : labels.weeklyReports}</p>
              <p className="mt-1 font-semibold text-slate-950">
                {reviewDialog.kind === "daily"
                  ? reviewTarget?.localDate ? formatDate(reviewTarget.localDate, isRtl) : `#${reviewDialog.id}`
                  : reviewTarget?.weekStart && reviewTarget?.weekEnd ? formatWeekRange(reviewTarget.weekStart, reviewTarget.weekEnd, isRtl) : `#${reviewDialog.id}`}
              </p>
              <p className="mt-2 text-xs text-slate-600">{isRtl ? "القرار" : "Decision"}: <span className="font-semibold">{statusLabel(reviewDialog.action)}</span></p>
            </div>
          )}
          {reviewDialog?.action === "returned" && (
            <Field label={labels.managerFeedback} required>
              <Textarea rows={5} value={managerFeedback} maxLength={5000} onChange={(event) => setManagerFeedback(event.target.value)} />
            </Field>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)} disabled={isBusy}>{isRtl ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={submitReviewAction} disabled={isBusy || (reviewDialog?.action === "returned" && !managerFeedback.trim())} className={reviewDialog?.action === "returned" ? "" : "bg-emerald-700 hover:bg-emerald-800"}>
              {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isRtl ? "تأكيد" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function StaffPerformanceSetupShell({
  isRtl,
  title,
  subtitle,
  disabledTitle,
  disabledBody,
  directPreview,
}: {
  isRtl: boolean;
  title: string;
  subtitle: string;
  disabledTitle: string;
  disabledBody: string;
  directPreview: boolean;
}) {
  return (
    <DashboardLayout>
      <main className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-emerald-700">
              <ClipboardCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                {isRtl ? "مساحة إدارة الأداء" : "Performance workspace"}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 md:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>
          <Button variant="outline" onClick={() => document.getElementById("staff-employee-preview")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            <Eye className="h-4 w-4" />{isRtl ? "معاينة تجربة الموظف" : "Preview employee experience"}
          </Button>
        </header>

        {directPreview && <StaffEmployeePreview isRtl={isRtl} focusOnMount />}

        <AdminFeatureSetupCard
          isRtl={isRtl}
          title={disabledTitle}
          description={disabledBody}
          items={[
            {
              label: isRtl ? "راجع مسار الموظف أدناه" : "Review the employee journey below",
              complete: true,
              detail: isRtl ? "بيانات تجريبية آمنة من حساب الإدارة" : "Safe synthetic data from the admin account",
            },
            {
              label: isRtl ? "عيّن الموظفين ومدير الأداء" : "Assign employees and a performance manager",
              detail: isRtl ? "لا تبدأ التجربة قبل وضوح المسؤوليات" : "Make ownership clear before the pilot starts",
            },
            {
              label: isRtl ? "أنشئ خطة شهرية تجريبية" : "Create one pilot monthly plan",
              detail: isRtl ? "ابدأ بفريق صغير ثم راجع الدورة كاملة" : "Start with a small team and review the full cycle",
            },
          ]}
        />

        {!directPreview && <StaffEmployeePreview isRtl={isRtl} />}
      </main>
    </DashboardLayout>
  );
}

function StaffEmployeePreview({ isRtl, focusOnMount = false }: { isRtl: boolean; focusOnMount?: boolean }) {
  const copy = isRtl
    ? {
        audience: "موظفة تجريبية — ليان خالد",
        title: "تجربة الموظف: الخطة والسجل اليومي والتقرير الأسبوعي",
        description: "اعرض لصاحبة العمل ما يراه الموظف منذ استلام الخطة وحتى إرسال التقارير، دون تسجيل الدخول بحساب آخر.",
        month: "يوليو 2026",
        plan: "تحسين جودة متابعة الطلاب",
        approved: "الخطة معتمدة",
        manager: "المدير: حساب الإدارة التجريبي",
        goalProgress: "تقدم الأهداف الشهرية",
        responseGoal: "خفض متوسط زمن الرد",
        satisfactionGoal: "رفع رضا الطلاب",
        documentationGoal: "توثيق الحالات المتكررة",
        daily: "سجل اليوم",
        today: "الخميس، 30 يوليو",
        taskOne: "متابعة رسائل الطلاب ذات الأولوية",
        taskTwo: "تحديث الأسئلة الشائعة للفريق",
        taskThree: "مراجعة حالات التأخر في الرد",
        summary: "ملخص نهاية الدوام",
        summaryValue: "تم إغلاق 18 حالة، وتصعيد حالتين تحتاجان قراراً من الإدارة.",
        saveDraft: "حفظ مسودة",
        submit: "إرسال للمدير",
        weekly: "التقرير الأسبوعي",
        achievement: "نسبة الإنجاز",
        outputs: "أبرز المخرجات",
        outputValue: "تحسين قالب الرد الأولي وإغلاق 92٪ من الحالات ضمن الوقت المستهدف.",
        blockers: "العوائق",
        blockerValue: "تأخر وصول تفاصيل الدفع في ثلاث حالات.",
        feedback: "ملاحظات المدير",
        feedbackValue: "عمل ممتاز. في الأسبوع القادم ركّزي على توحيد توثيق حالات التصعيد.",
        workflow: "دورة الاعتماد",
        draft: "مسودة",
        submitted: "مرسلة",
        returned: "معادة للتعديل",
        approvedStatus: "معتمدة",
        locked: "مغلقة",
      }
    : {
        audience: "Sample employee — Layan Khaled",
        title: "Employee experience: plan, daily log, and weekly report",
        description: "Show the owner exactly what a staff member sees from receiving a plan through submitting work reports, without signing into another account.",
        month: "July 2026",
        plan: "Improve student follow-up quality",
        approved: "Plan approved",
        manager: "Manager: sample administrator",
        goalProgress: "Monthly goal progress",
        responseGoal: "Reduce average response time",
        satisfactionGoal: "Increase student satisfaction",
        documentationGoal: "Document recurring cases",
        daily: "Today’s log",
        today: "Thursday, July 30",
        taskOne: "Follow up priority student messages",
        taskTwo: "Update the team FAQ",
        taskThree: "Review delayed-response cases",
        summary: "End-of-day summary",
        summaryValue: "Closed 18 cases and escalated two that need an administrative decision.",
        saveDraft: "Save draft",
        submit: "Submit to manager",
        weekly: "Weekly report",
        achievement: "Achievement",
        outputs: "Key outputs",
        outputValue: "Improved the first-response template and closed 92% of cases within the target time.",
        blockers: "Blockers",
        blockerValue: "Payment details arrived late for three cases.",
        feedback: "Manager feedback",
        feedbackValue: "Excellent work. Next week, focus on consistent documentation for escalated cases.",
        workflow: "Approval cycle",
        draft: "Draft",
        submitted: "Submitted",
        returned: "Returned",
        approvedStatus: "Approved",
        locked: "Locked",
      };

  const goals = [
    { label: copy.responseGoal, value: 82, weight: 40 },
    { label: copy.satisfactionGoal, value: 74, weight: 35 },
    { label: copy.documentationGoal, value: 68, weight: 25 },
  ];
  const workflow = [copy.draft, copy.submitted, copy.returned, copy.approvedStatus, copy.locked];

  return (
    <SafeAdminPreview
      isRtl={isRtl}
      audience={copy.audience}
      title={copy.title}
      description={copy.description}
      anchorId="staff-employee-preview"
      focusOnMount={focusOnMount}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.workflow}</p>
          <div className="flex flex-wrap items-center gap-2">
            {workflow.map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${index === 3 ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-slate-200 bg-white text-slate-600"}`}>
                  {step}
                </span>
                {index < workflow.length - 1 && <span className="text-slate-300">→</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr]">
          <div className="space-y-4">
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-none">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">{copy.month}</p>
                    <h3 className="mt-1 text-xl font-bold text-slate-950">{copy.plan}</h3>
                    <p className="mt-1 text-xs text-slate-500">{copy.manager}</p>
                  </div>
                  <Badge className="border border-emerald-200 bg-white text-emerald-700"><CheckCircle2 className="me-1 h-3 w-3" />{copy.approved}</Badge>
                </div>
                <div className="mt-5 space-y-4">
                  <p className="text-sm font-semibold text-slate-900">{copy.goalProgress}</p>
                  {goals.map((goal) => (
                    <div key={goal.label}>
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                        <span className="font-medium text-slate-700">{goal.label} · {goal.weight}%</span>
                        <span className="font-bold text-emerald-700">{goal.value}%</span>
                      </div>
                      <Progress value={goal.value} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">{copy.weekly}</h3>
                    <p className="mt-1 text-xs text-slate-500">{copy.achievement}: 78%</p>
                  </div>
                  <Sparkles className="h-5 w-5 text-violet-500" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoPanel title={copy.outputs} value={copy.outputValue} />
                  <InfoPanel title={copy.blockers} value={copy.blockerValue} />
                </div>
                <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
                  <p className="text-xs font-semibold text-violet-800">{copy.feedback}</p>
                  <p className="mt-1 text-sm leading-6 text-violet-950">{copy.feedbackValue}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-none">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">{copy.daily}</h3>
                  <p className="mt-1 text-sm text-slate-500">{copy.today}</p>
                </div>
                <StatusBadge status="draft" label={copy.draft} />
              </div>
              <div className="mt-5 space-y-3">
                {[copy.taskOne, copy.taskTwo, copy.taskThree].map((task, index) => (
                  <div key={task} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${index < 2 ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"}`}>
                      {index < 2 && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </span>
                    <p className={`text-sm ${index < 2 ? "text-slate-500 line-through" : "font-medium text-slate-800"}`}>{task}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.summary}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{copy.summaryValue}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" disabled>{copy.saveDraft}</Button>
                <Button disabled><Send className="h-4 w-4" />{copy.submit}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SafeAdminPreview>
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

function ReviewActions({
  status,
  labels,
  isBusy,
  onReturn,
  onApprove,
  onLock,
}: {
  status: string;
  labels: {
    returnWithFeedback: string;
    approveReview: string;
    lockReview: string;
  };
  isBusy: boolean;
  onReturn: () => void;
  onApprove: () => void;
  onLock: () => void;
}) {
  if (status === "submitted") {
    return (
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Button variant="outline" size="sm" onClick={onReturn} disabled={isBusy}>
          <RotateCcw className="h-3.5 w-3.5" /> {labels.returnWithFeedback}
        </Button>
        <Button size="sm" onClick={onApprove} disabled={isBusy} className="bg-emerald-700 hover:bg-emerald-800">
          <CheckCircle2 className="h-3.5 w-3.5" /> {labels.approveReview}
        </Button>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Button size="sm" onClick={onLock} disabled={isBusy} className="bg-violet-700 hover:bg-violet-800">
          <FileLock2 className="h-3.5 w-3.5" /> {labels.lockReview}
        </Button>
      </div>
    );
  }

  return null;
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
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value?.trim() || "—"}</p>
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

function formatMonth(month: string, isRtl: boolean) {
  const [year, value] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(isRtl ? "ar-JO" : "en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, value - 1, 1)));
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
