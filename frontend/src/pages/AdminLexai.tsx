import AdminClientProfileSheet from "@/components/admin/AdminClientProfileSheet";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { LEXAI_SUPPORT_CASE_PRIORITIES, LEXAI_SUPPORT_CASE_STATUSES } from "@shared/const";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  MessageSquare,
  PauseCircle,
  Pin,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type SubscriptionShape = {
  isActive?: boolean | null;
  isPaused?: boolean | null;
  isPendingActivation?: boolean | null;
  endDate?: string | null;
  pausedRemainingDays?: number | null;
};

function formatDate(value: string | null | undefined, locale: string, includeTime = true) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(locale, includeTime
    ? {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
    : {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

function getRemainingDays(subscription?: SubscriptionShape | null) {
  if (!subscription) return 0;
  if (subscription.isPaused) return Number(subscription.pausedRemainingDays ?? 0);
  if (!subscription.endDate) return 0;
  const endDate = new Date(subscription.endDate);
  if (Number.isNaN(endDate.getTime())) return 0;
  return Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function getSubscriptionState(subscription?: SubscriptionShape | null) {
  if (!subscription) return "no_subscription";
  if (subscription.isPendingActivation) return "pending_activation";
  if (subscription.isPaused) return "paused";
  if (!subscription.isActive) return "inactive";
  if (subscription.endDate) {
    const endDate = new Date(subscription.endDate);
    if (!Number.isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
      return "expired";
    }
  }
  return "active";
}

function pickLabel(
  map: Record<string, { en: string; ar: string }>,
  key: string | null | undefined,
  isRtl: boolean,
  fallback = "-",
) {
  if (!key) return fallback;
  const entry = map[key];
  return entry ? (isRtl ? entry.ar : entry.en) : key;
}

type CaseIdentity = {
  userId?: number | null;
  userName?: string | null;
  userEmail?: string | null;
};

function getCaseDisplayName(caseIdentity: CaseIdentity | null | undefined, isRtl: boolean) {
  if (caseIdentity?.userName) return caseIdentity.userName;
  if (caseIdentity?.userEmail) return caseIdentity.userEmail;
  if (caseIdentity?.userId == null) {
    return isRtl ? "مستخدم محذوف" : "Deleted User";
  }
  return isRtl ? `مستخدم محذوف #${caseIdentity.userId}` : `Deleted User #${caseIdentity.userId}`;
}

function getCaseSecondaryLabel(caseIdentity: CaseIdentity | null | undefined, isRtl: boolean) {
  if (caseIdentity?.userEmail) return caseIdentity.userEmail;
  return isRtl ? "السجل الأصلي للمستخدم لم يعد موجوداً" : "Original user record no longer exists";
}

function isDeletedUserRecord(caseIdentity: CaseIdentity | null | undefined) {
  return !!caseIdentity?.userId && !caseIdentity.userEmail;
}

const statusStyles: Record<string, string> = {
  open: "bg-emerald-100 text-emerald-800",
  waiting_student: "bg-amber-100 text-amber-800",
  escalated: "bg-orange-100 text-orange-800",
  resolved: "bg-slate-100 text-slate-700",
};

const statusLabels: Record<string, { en: string; ar: string }> = {
  open: { en: "Open", ar: "مفتوح" },
  waiting_student: { en: "Waiting Student", ar: "بانتظار الطالب" },
  escalated: { en: "Escalated", ar: "مصعد" },
  resolved: { en: "Resolved", ar: "محلول" },
};

const priorityStyles: Record<string, string> = {
  normal: "border-slate-200 text-slate-700",
  high: "border-amber-300 text-amber-700 bg-amber-50",
  urgent: "border-rose-300 text-rose-700 bg-rose-50",
};

const priorityLabels: Record<string, { en: string; ar: string }> = {
  normal: { en: "Normal", ar: "عادي" },
  high: { en: "High", ar: "عالٍ" },
  urgent: { en: "Urgent", ar: "عاجل" },
};

const subscriptionStyles: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  paused: "bg-amber-100 text-amber-800",
  pending_activation: "bg-teal-100 text-teal-800",
  expired: "bg-rose-100 text-rose-800",
  inactive: "bg-slate-100 text-slate-700",
  no_subscription: "bg-slate-100 text-slate-700",
};

const subscriptionLabels: Record<string, { en: string; ar: string }> = {
  active: { en: "Active", ar: "نشط" },
  paused: { en: "Frozen", ar: "مجمّد" },
  pending_activation: { en: "Pending Activation", ar: "بانتظار التفعيل" },
  expired: { en: "Expired", ar: "منتهي" },
  inactive: { en: "Inactive", ar: "غير نشط" },
  no_subscription: { en: "No Subscription", ar: "لا يوجد اشتراك" },
};

const noteTypeLabels: Record<string, { en: string; ar: string }> = {
  note: { en: "Note", ar: "ملاحظة" },
  assignment: { en: "Assignment", ar: "تعيين" },
  status_change: { en: "Status Change", ar: "تغيير حالة" },
  admin_request: { en: "Admin Request", ar: "طلب إداري" },
};

const noteTypeStyles: Record<string, string> = {
  note: "bg-slate-100 text-slate-700",
  assignment: "bg-amber-100 text-amber-800",
  status_change: "bg-teal-100 text-teal-800",
  admin_request: "bg-orange-100 text-orange-800",
};

export default function AdminLexai() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const isRtl = language === "ar";
  const locale = isRtl ? "ar-EG" : "en-US";

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | (typeof LEXAI_SUPPORT_CASE_STATUSES)[number]>("all");
  const [assignedToMe, setAssignedToMe] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [showOps, setShowOps] = useState(false);
  const didSyncQueryRef = useRef(false);
  const [statusDraft, setStatusDraft] = useState<(typeof LEXAI_SUPPORT_CASE_STATUSES)[number]>("open");
  const [priorityDraft, setPriorityDraft] = useState<(typeof LEXAI_SUPPORT_CASE_PRIORITIES)[number]>("normal");
  const [adminAssignee, setAdminAssignee] = useState("unassigned");
  const [statusNote, setStatusNote] = useState("");
  const [noteText, setNoteText] = useState("");
  const [pauseReason, setPauseReason] = useState("");

  const { data: adminCheck } = trpc.auth.isAdmin.useQuery();
  const isAdmin = !!adminCheck?.isAdmin;

  const replaceLexaiUrl = (caseId: number | null) => {
    if (typeof window === "undefined") return;
    const nextUrl = caseId ? `/admin/lexai?caseId=${caseId}` : "/admin/lexai";
    window.history.replaceState(window.history.state, "", nextUrl);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data: supportCasesData,
    isLoading: loadingCases,
    isFetching: fetchingCases,
    refetch: refetchCases,
  } = trpc.lexaiSupport.listCases.useQuery(
    {
      search: debouncedSearch.trim() || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      assignedToMe: !isAdmin && assignedToMe ? true : undefined,
    },
    { refetchInterval: 15_000 },
  );

  const supportCases = supportCasesData ?? [];

  const {
    data: selectedCase,
    isLoading: loadingCase,
    isFetching: fetchingCase,
    refetch: refetchCase,
  } = trpc.lexaiSupport.getCase.useQuery(
    { caseId: selectedCaseId! },
    { enabled: !!selectedCaseId, refetchInterval: 15_000 },
  );

  const { data: staffMembers } = trpc.roles.listStaff.useQuery(undefined, { enabled: isAdmin });

  const assignmentOptions = useMemo(() => {
    const baseMembers = (staffMembers ?? []).filter((member) => member.roles?.includes("lexai_support"));
    if (selectedCase?.assignedToUserId && !baseMembers.some((member) => member.id === selectedCase.assignedToUserId)) {
      return [{
        id: selectedCase.assignedToUserId,
        name: selectedCase.assignedToName ?? `User #${selectedCase.assignedToUserId}`,
        email: "",
        roles: ["lexai_support"],
      }, ...baseMembers];
    }
    return baseMembers;
  }, [selectedCase?.assignedToName, selectedCase?.assignedToUserId, staffMembers]);

  const invalidateLexaiWorkspace = async (caseId?: number) => {
    await utils.lexaiSupport.listCases.invalidate();
    if (caseId) {
      await utils.lexaiSupport.getCase.invalidate({ caseId });
    }
  };

  const assignCaseMutation = trpc.lexaiSupport.assignCase.useMutation({
    onSuccess: async () => {
      toast.success(isRtl ? "تم تحديث التعيين" : "Assignment updated");
      await invalidateLexaiWorkspace(selectedCaseId ?? undefined);
    },
    onError: (error) => toast.error(error.message),
  });

  const updateStatusMutation = trpc.lexaiSupport.updateStatus.useMutation({
    onSuccess: async () => {
      toast.success(isRtl ? "تم تحديث الحالة" : "Status updated");
      setStatusNote("");
      await invalidateLexaiWorkspace(selectedCaseId ?? undefined);
    },
    onError: (error) => toast.error(error.message),
  });

  const updatePriorityMutation = trpc.lexaiSupport.updatePriority.useMutation({
    onSuccess: async () => {
      toast.success(isRtl ? "تم تحديث الأولوية" : "Priority updated");
      await invalidateLexaiWorkspace(selectedCaseId ?? undefined);
    },
    onError: (error) => toast.error(error.message),
  });

  const addNoteMutation = trpc.lexaiSupport.addNote.useMutation({
    onSuccess: async () => {
      toast.success(isRtl ? "تمت إضافة الملاحظة" : "Note added");
      setNoteText("");
      await invalidateLexaiWorkspace(selectedCaseId ?? undefined);
    },
    onError: (error) => toast.error(error.message),
  });

  const requestFollowupMutation = trpc.lexaiSupport.requestFollowup.useMutation({
    onSuccess: async () => {
      toast.success(isRtl ? "تم طلب المتابعة" : "Follow-up requested");
      setNoteText("");
      await invalidateLexaiWorkspace(selectedCaseId ?? undefined);
    },
    onError: (error) => toast.error(error.message),
  });

  const pauseSubscriptionMutation = trpc.lexaiSupport.pauseSubscription.useMutation({
    onSuccess: async () => {
      toast.success(isRtl ? "تم تجميد اشتراك LexAI" : "LexAI frozen");
      await invalidateLexaiWorkspace(selectedCaseId ?? undefined);
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeSubscriptionMutation = trpc.lexaiSupport.resumeSubscription.useMutation({
    onSuccess: async () => {
      toast.success(isRtl ? "تم فك تجميد اشتراك LexAI" : "LexAI unfrozen");
      await invalidateLexaiWorkspace(selectedCaseId ?? undefined);
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteHistoryMutation = trpc.lexaiSupport.deleteHistory.useMutation({
    onSuccess: async () => {
      toast.success(isRtl ? "تم حذف سجل المحادثة" : "Chat history deleted");
      await invalidateLexaiWorkspace(selectedCaseId ?? undefined);
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!supportCases.length) {
      if (selectedCaseId !== null) setSelectedCaseId(null);
      return;
    }

    if (typeof window !== "undefined") {
      const rawCaseId = new URLSearchParams(window.location.search).get("caseId");
      if (rawCaseId) {
        const requestedCaseId = Number(rawCaseId);
        if (!Number.isFinite(requestedCaseId) || requestedCaseId <= 0) {
          replaceLexaiUrl(null);
        } else if (supportCases.some((item) => item.id === requestedCaseId)) {
          if (selectedCaseId !== requestedCaseId) {
            setSelectedCaseId(requestedCaseId);
          }
          return;
        } else if (selectedCaseId == null) {
          replaceLexaiUrl(null);
        }
      }
    }

    const shouldAutoSelectFirstCase = typeof window !== "undefined"
      && window.matchMedia("(min-width: 1280px)").matches;
    if (shouldAutoSelectFirstCase && (!selectedCaseId || !supportCases.some((item) => item.id === selectedCaseId))) {
      setSelectedCaseId(supportCases[0].id);
    }
  }, [supportCases, selectedCaseId]);

  useEffect(() => {
    if (!didSyncQueryRef.current) {
      didSyncQueryRef.current = true;
      return;
    }
    replaceLexaiUrl(selectedCaseId);
  }, [selectedCaseId]);

  useEffect(() => {
    setStatusNote("");
    setNoteText("");
    setShowOps(false);
  }, [selectedCaseId]);

  useEffect(() => {
    if (!selectedCase) return;
    setStatusDraft(selectedCase.status as (typeof LEXAI_SUPPORT_CASE_STATUSES)[number]);
    setPriorityDraft(selectedCase.priority as (typeof LEXAI_SUPPORT_CASE_PRIORITIES)[number]);
    setAdminAssignee(selectedCase.assignedToUserId ? String(selectedCase.assignedToUserId) : "unassigned");
    setPauseReason(selectedCase.lexaiSubscription?.pausedReason ?? "");
  }, [selectedCase]);

  const selectedCaseSummary = useMemo(
    () => supportCases.find((item) => item.id === selectedCaseId) ?? null,
    [selectedCaseId, supportCases],
  );
  const selectedCaseIdentity = selectedCase ?? selectedCaseSummary;

  const sortedMessages = useMemo(
    () => [...(selectedCase?.messages ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [selectedCase?.messages],
  );

  const summary = useMemo(() => ({
    total: supportCases.length,
    open: supportCases.filter((item) => item.status === "open").length,
    active: supportCases.filter((item) => item.lexaiSubscriptionState === "active").length,
  }), [supportCases]);

  const recommendationState = getSubscriptionState(selectedCase?.recommendationSubscription);
  const recommendationRemainingDays = getRemainingDays(selectedCase?.recommendationSubscription);
  const hasMessages = (selectedCase?.messages?.length ?? 0) > 0;
  const assignmentChanged = selectedCase
    ? (adminAssignee === "unassigned" ? null : Number(adminAssignee)) !== (selectedCase.assignedToUserId ?? null)
    : false;
  const statusChanged = selectedCase ? statusDraft !== selectedCase.status || !!statusNote.trim() : false;
  const priorityChanged = selectedCase ? priorityDraft !== selectedCase.priority : false;
  const busy =
    assignCaseMutation.isPending ||
    updateStatusMutation.isPending ||
    updatePriorityMutation.isPending ||
    addNoteMutation.isPending ||
    requestFollowupMutation.isPending ||
    pauseSubscriptionMutation.isPending ||
    resumeSubscriptionMutation.isPending ||
    deleteHistoryMutation.isPending;

  const refreshWorkspace = () => {
    refetchCases();
    if (selectedCaseId) refetchCase();
  };

  const handleStatusUpdate = () => {
    if (!selectedCaseId) return;
    updateStatusMutation.mutate({
      caseId: selectedCaseId,
      status: statusDraft,
      note: statusNote.trim() || undefined,
    });
  };

  const handlePriorityUpdate = () => {
    if (!selectedCaseId) return;
    updatePriorityMutation.mutate({ caseId: selectedCaseId, priority: priorityDraft });
  };

  const handleAdminAssign = () => {
    if (!selectedCaseId) return;
    assignCaseMutation.mutate({
      caseId: selectedCaseId,
      assignedToUserId: adminAssignee === "unassigned" ? null : Number(adminAssignee),
    });
  };

  const handleAddNote = () => {
    if (!selectedCaseId || !noteText.trim()) {
      toast.error(isRtl ? "اكتب ملاحظة أولاً" : "Write a note first");
      return;
    }
    addNoteMutation.mutate({
      caseId: selectedCaseId,
      content: noteText.trim(),
      noteType: "note",
    });
  };

  const handleFollowupRequest = () => {
    if (!selectedCaseId) return;
    requestFollowupMutation.mutate({
      caseId: selectedCaseId,
      note: noteText.trim() || undefined,
    });
  };

  const handlePauseLexai = () => {
    if (!selectedCase?.lexaiSubscription?.id) return;
    pauseSubscriptionMutation.mutate({
      subscriptionId: selectedCase.lexaiSubscription.id,
      reason: pauseReason.trim() || undefined,
    });
  };

  const handleResumeLexai = () => {
    if (!selectedCase?.lexaiSubscription?.id) return;
    resumeSubscriptionMutation.mutate({ subscriptionId: selectedCase.lexaiSubscription.id });
  };

  const selectedUserLabel = getCaseDisplayName(selectedCaseIdentity, isRtl);
  const selectedUserSecondaryLabel = getCaseSecondaryLabel(selectedCaseIdentity, isRtl);
  const selectedUserIsDeleted = isDeletedUserRecord(selectedCaseIdentity);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-emerald-500" />
              {isRtl ? "مساحة LexAI" : "LexAI Workspace"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isRtl
                ? "عرض conversation-first لمتابعة LexAI مع لمحة عميل سريعة وفتح الملف الكامل عند الحاجة."
                : "A conversation-first LexAI workspace with a compact client snapshot and one-click access to the full profile when needed."}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshWorkspace} disabled={fetchingCases || fetchingCase || busy}>
            {fetchingCases || fetchingCase ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <RefreshCw className="w-4 h-4 me-2" />}
            {isRtl ? "تحديث" : "Refresh"}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label={isRtl ? "إجمالي الحالات" : "Total Cases"} value={summary.total} />
          <SummaryCard label={isRtl ? "الحالات المفتوحة" : "Open Cases"} value={summary.open} />
          <SummaryCard label={isRtl ? "اشتراك LexAI النشط" : "Active LexAI"} value={summary.active} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card className={selectedCaseId ? "hidden xl:block" : ""}>
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MessageSquare className="w-5 h-5 text-emerald-500" />
                    {isRtl ? "قائمة الحالات" : "Case Queue"}
                  </CardTitle>
                  <CardDescription>
                    {isRtl ? `${supportCases.length} حالة مطابقة للفلاتر الحالية` : `${supportCases.length} cases matching the current filters`}
                  </CardDescription>
                </div>
                {(fetchingCases || loadingCases) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>

              <div className="relative">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={isRtl ? "بحث بالاسم أو البريد..." : "Search by name or email..."}
                  className="ps-9"
                />
              </div>

              <div className="flex flex-col gap-3">
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isRtl ? "كل الحالات" : "All Cases"}</SelectItem>
                    <SelectItem value="open">{isRtl ? "مفتوح" : "Open"}</SelectItem>
                    <SelectItem value="waiting_student">{isRtl ? "بانتظار الطالب" : "Waiting Student"}</SelectItem>
                    <SelectItem value="escalated">{isRtl ? "مصعد" : "Escalated"}</SelectItem>
                    <SelectItem value="resolved">{isRtl ? "محلول" : "Resolved"}</SelectItem>
                  </SelectContent>
                </Select>

                {!isAdmin && (
                  <Button
                    type="button"
                    variant={assignedToMe ? "default" : "outline"}
                    onClick={() => setAssignedToMe((prev) => !prev)}
                    className="justify-start"
                  >
                    <UserRound className="w-4 h-4 me-2" />
                    {assignedToMe
                      ? (isRtl ? "عرض جميع الحالات" : "Show all cases")
                      : (isRtl ? "حالتي فقط" : "Assigned to me")}
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              {loadingCases ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : supportCases.length === 0 ? (
                <EmptyState
                  title={isRtl ? "لا توجد حالات مطابقة" : "No matching cases"}
                  description={isRtl
                    ? "جرّب تغيير البحث أو الفلاتر لرؤية حالات أخرى."
                    : "Try changing the search or filters to see other cases."}
                />
              ) : (
                <ScrollArea className="h-[calc(100vh-22rem)] min-h-[420px] pe-3">
                  <div className="space-y-2">
                    {supportCases.map((supportCase) => {
                      const isActive = supportCase.id === selectedCaseId;
                      const caseLabel = getCaseDisplayName(supportCase, isRtl);
                      const caseSecondaryLabel = getCaseSecondaryLabel(supportCase, isRtl);
                      return (
                        <button
                          key={supportCase.id}
                          type="button"
                          onClick={() => setSelectedCaseId(supportCase.id)}
                          className={`w-full rounded-xl border p-4 text-start transition ${
                            isActive
                              ? "border-emerald-300 bg-emerald-50 shadow-sm"
                              : "bg-white hover:border-emerald-200 hover:bg-emerald-50/40"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold truncate">
                                {caseLabel}
                              </p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {caseSecondaryLabel}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <Badge className={statusStyles[supportCase.status] || "bg-slate-100 text-slate-700"}>
                                {pickLabel(statusLabels, supportCase.status, isRtl)}
                              </Badge>
                              <Badge className={priorityStyles[supportCase.priority] || "border-slate-200 text-slate-700"} variant="outline">
                                {pickLabel(priorityLabels, supportCase.priority, isRtl)}
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Badge className={subscriptionStyles[supportCase.lexaiSubscriptionState] || "bg-slate-100 text-slate-700"}>
                              {pickLabel(subscriptionLabels, supportCase.lexaiSubscriptionState, isRtl)}
                            </Badge>
                            {supportCase.supportNeedsHuman && (
                              <Badge className="bg-amber-100 text-amber-800">
                                {isRtl ? "الدعم يطلب متابعة" : "Support needs follow-up"}
                              </Badge>
                            )}
                          </div>

                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                            <span>{isRtl ? `آخر رسالة: ${formatDate(supportCase.lastMessageAt, locale)}` : `Last message: ${formatDate(supportCase.lastMessageAt, locale)}`}</span>
                            <span>{isRtl ? `الرسائل: ${supportCase.messageCount}` : `Messages: ${supportCase.messageCount}`}</span>
                            <span>{isRtl ? `آخر تحليل: ${supportCase.lastAnalysisType || "-"}` : `Last analysis: ${supportCase.lastAnalysisType || "-"}`}</span>
                            <span>{isRtl ? `المكلّف: ${supportCase.assignedToName || "غير مخصص"}` : `Assigned: ${supportCase.assignedToName || "Unassigned"}`}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            {selectedCaseId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedCaseId(null)}
                className="xl:hidden"
              >
                <ArrowLeft className="h-4 w-4 me-2" />
                {isRtl ? "العودة للقائمة" : "Back to Queue"}
              </Button>
            )}

            {!selectedCaseSummary ? (
              <Card>
                <CardContent className="py-16">
                  <EmptyState
                    title={isRtl ? "اختر حالة من القائمة" : "Select a case from the queue"}
                    description={isRtl
                      ? "عند اختيار حالة ستظهر هنا المحادثات والملاحظات والإجراءات الخاصة بها."
                      : "Once a case is selected, its messages, notes, and actions will appear here."}
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="space-y-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <CardTitle className="text-2xl flex items-center gap-2">
                          <UserRound className="w-5 h-5 text-emerald-500" />
                          {selectedUserLabel}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {selectedUserSecondaryLabel}
                        </CardDescription>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {selectedUserIsDeleted && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-800">
                            {isRtl ? "سجل محذوف" : "Deleted Record"}
                          </Badge>
                        )}
                        <Badge className={subscriptionStyles[selectedCase?.lexaiSubscription?.subscriptionState || selectedCaseSummary.lexaiSubscriptionState] || "bg-slate-100 text-slate-700"}>
                          {pickLabel(subscriptionLabels, selectedCase?.lexaiSubscription?.subscriptionState || selectedCaseSummary.lexaiSubscriptionState, isRtl)}
                        </Badge>
                        {fetchingCase && <Badge variant="outline"><Loader2 className="w-3 h-3 animate-spin me-1" />{isRtl ? "تحديث" : "Refreshing"}</Badge>}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <InfoRow label={isRtl ? "آخر رسالة" : "Last Message"} value={formatDate(selectedCase?.lastMessageAt || selectedCaseSummary?.lastMessageAt, locale)} />
                      <InfoRow label={isRtl ? "آخر مراجعة" : "Last Review"} value={formatDate(selectedCase?.lastReviewedAt || selectedCaseSummary?.lastReviewedAt, locale)} />
                      <InfoRow label={isRtl ? "آخر نوع تحليل" : "Last Analysis"} value={selectedCaseSummary?.lastAnalysisType || "-"} />
                      <InfoRow label={isRtl ? "الرسائل المستخدمة" : "Messages Used"} value={String(selectedCase?.lexaiSubscription?.messagesUsed ?? selectedCaseSummary?.messagesUsed ?? 0)} />
                    </div>
                  </CardHeader>
                </Card>

                <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Bot className="w-5 h-5 text-emerald-500" />
                        {isRtl ? "محادثة LexAI" : "LexAI Conversation"}
                      </CardTitle>
                      <CardDescription>
                        {isRtl ? `${sortedMessages.length} رسالة في هذه الحالة` : `${sortedMessages.length} messages in this case`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingCase && !selectedCase ? (
                        <div className="flex justify-center py-16">
                          <Loader2 className="w-6 h-6 animate-spin" />
                        </div>
                      ) : sortedMessages.length === 0 ? (
                        <EmptyState
                          title={isRtl ? "لا توجد رسائل" : "No messages yet"}
                          description={isRtl ? "سيظهر سجل المحادثة هنا عند توفره." : "The conversation history will appear here when available."}
                        />
                      ) : (
                        <ScrollArea className="h-[55vh] md:h-[640px] pe-3">
                          <div className="space-y-3">
                            {sortedMessages.map((message) => {
                              const isClient = message.role === "user";
                              return (
                                <div
                                  key={message.id}
                                  className={`rounded-xl border p-4 ${
                                    isClient ? "bg-white border-emerald-100" : "bg-slate-50 border-slate-200"
                                  }`}
                                >
                                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge className={isClient ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}>
                                        {isClient ? (isRtl ? "العميل" : "Client") : "LexAI"}
                                      </Badge>
                                      {message.analysisType && <Badge variant="outline">{message.analysisType}</Badge>}
                                    </div>
                                    <span className="text-xs text-muted-foreground">{formatDate(message.createdAt, locale)}</span>
                                  </div>

                                  {message.imageUrl && (
                                    <div className="mb-3">
                                      <img
                                        src={message.imageUrl}
                                        alt="Chart"
                                        className="h-[90px] w-[120px] cursor-pointer rounded-lg bg-black/5 object-cover transition-opacity hover:opacity-85"
                                        onClick={() => window.open(message.imageUrl ?? "", "_blank")}
                                      />
                                    </div>
                                  )}

                                  <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                    {message.content}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>

                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <ExternalLink className="w-5 h-5 text-emerald-500" />
                          {isRtl ? "لمحة العميل" : "Client Snapshot"}
                        </CardTitle>
                        <CardDescription>
                          {isRtl
                            ? "احتفظ بالمحادثة في الواجهة الأساسية وافتح ملف العميل الكامل عند الحاجة للسياق التفصيلي."
                            : "Keep the daily view conversation-first and open the full client profile only when detailed context is needed."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <Badge className={subscriptionStyles[selectedCase?.lexaiSubscription?.subscriptionState || selectedCaseSummary.lexaiSubscriptionState] || "bg-slate-100 text-slate-700"}>
                            {pickLabel(subscriptionLabels, selectedCase?.lexaiSubscription?.subscriptionState || selectedCaseSummary.lexaiSubscriptionState, isRtl)}
                          </Badge>
                          <Badge className={subscriptionStyles[recommendationState] || "bg-slate-100 text-slate-700"}>
                            {pickLabel(subscriptionLabels, recommendationState, isRtl)}
                          </Badge>
                          {selectedCase?.supportConversation && (
                            <Badge className={selectedCase.supportConversation.status === "open" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}>
                              {selectedCase.supportConversation.status === "open"
                                ? (isRtl ? "دعم مفتوح" : "Support Open")
                                : (isRtl ? "دعم مغلق" : "Support Closed")}
                            </Badge>
                          )}
                          {selectedCase?.supportConversation?.needsHuman && (
                            <Badge className="bg-amber-100 text-amber-800">
                              {isRtl ? "بحاجة رد بشري" : "Needs Human"}
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <InfoRow label={isRtl ? "الأيام المتبقية في LexAI" : "LexAI Remaining Days"} value={String(selectedCase?.lexaiSubscription?.remainingDays ?? selectedCaseSummary?.remainingDays ?? 0)} />
                          <InfoRow label={isRtl ? "الأيام المتبقية في التوصيات" : "Recommendations Remaining"} value={String(recommendationRemainingDays)} />
                          <InfoRow label={isRtl ? "آخر نوع تحليل" : "Last Analysis"} value={selectedCaseSummary?.lastAnalysisType || "-"} />
                          <InfoRow label={isRtl ? "الدعم المرتبط" : "Linked Support"} value={selectedCase?.supportConversation ? `#${selectedCase.supportConversation.id}` : (isRtl ? "لا يوجد" : "None")} />
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2">
                          <Button
                            className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
                            onClick={() => selectedCaseIdentity?.userId && setProfileUserId(selectedCaseIdentity.userId)}
                            disabled={!selectedCaseIdentity?.userId}
                          >
                            <ExternalLink className="w-4 h-4 me-2" />
                            {isRtl ? "فتح ملف العميل" : "Open Client Profile"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setLocation(
                                selectedCase?.supportConversation
                                  ? `/admin/support?conversationId=${selectedCase.supportConversation.id}`
                                  : "/admin/support",
                              );
                            }}
                            disabled={!selectedCase?.supportConversation}
                          >
                            <MessageSquare className="w-4 h-4 me-2" />
                            {isRtl ? "فتح الدعم" : "Open Support"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {isAdmin && (
                      <Card className="border-amber-100">
                        <CardHeader>
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <CardTitle className="flex items-center gap-2 text-lg">
                                <ShieldAlert className="w-5 h-5 text-amber-500" />
                                {isRtl ? "التحكم التشغيلي" : "Ops Controls"}
                              </CardTitle>
                              <CardDescription>
                                {isRtl
                                  ? "أدوات الإدارة والإجراءات التشغيلية محفوظة هنا ومخفية بشكل افتراضي عن العرض اليومي."
                                  : "Admin workflow controls stay here and remain hidden by default from the daily conversation view."}
                              </CardDescription>
                            </div>
                            <Button variant="outline" onClick={() => setShowOps((current) => !current)}>
                              {showOps
                                ? (isRtl ? "إخفاء الأدوات" : "Hide Ops")
                                : (isRtl ? "إظهار الأدوات" : "Show Ops")}
                            </Button>
                          </div>
                        </CardHeader>

                        {showOps && (
                          <CardContent className="space-y-6">
                            <Card className="border-slate-200 shadow-none">
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <UserPlus className="w-5 h-5 text-emerald-500" />
                                  {isRtl ? "إدارة الحالة" : "Case Management"}
                                </CardTitle>
                                <CardDescription>
                                  {isRtl ? "حدّث الحالة والأولوية وملكية المتابعة لهذا الصف." : "Update queue status, priority, and ownership for this case."}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">{isRtl ? "الحالة" : "Status"}</p>
                                  <Select value={statusDraft} onValueChange={(value) => setStatusDraft(value as typeof statusDraft)}>
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {LEXAI_SUPPORT_CASE_STATUSES.map((value) => (
                                        <SelectItem key={value} value={value}>{pickLabel(statusLabels, value, isRtl)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Textarea
                                    value={statusNote}
                                    onChange={(event) => setStatusNote(event.target.value)}
                                    placeholder={isRtl ? "ملاحظة اختيارية مع تحديث الحالة..." : "Optional note with the status change..."}
                                    rows={3}
                                  />
                                  <Button onClick={handleStatusUpdate} disabled={!statusChanged || updateStatusMutation.isPending} className="w-full">
                                    {updateStatusMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 me-2" />}
                                    {isRtl ? "تحديث الحالة" : "Update Status"}
                                  </Button>
                                </div>

                                <div className="space-y-2">
                                  <p className="text-sm font-medium">{isRtl ? "الأولوية" : "Priority"}</p>
                                  <Select value={priorityDraft} onValueChange={(value) => setPriorityDraft(value as typeof priorityDraft)}>
                                    <SelectTrigger className="w-full">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {LEXAI_SUPPORT_CASE_PRIORITIES.map((value) => (
                                        <SelectItem key={value} value={value}>{pickLabel(priorityLabels, value, isRtl)}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button variant="outline" onClick={handlePriorityUpdate} disabled={!priorityChanged || updatePriorityMutation.isPending} className="w-full">
                                    {updatePriorityMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Pin className="w-4 h-4 me-2" />}
                                    {isRtl ? "تحديث الأولوية" : "Update Priority"}
                                  </Button>
                                </div>

                                <div className="space-y-2 border-t pt-4">
                                  <p className="text-sm font-medium">{isRtl ? "الملكية" : "Ownership"}</p>
                                  <Select value={adminAssignee} onValueChange={setAdminAssignee}>
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder={isRtl ? "اختر موظف دعم LexAI" : "Choose a LexAI staff member"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">{isRtl ? "غير مخصص" : "Unassigned"}</SelectItem>
                                      {assignmentOptions.map((member) => (
                                        <SelectItem key={member.id} value={String(member.id)}>
                                          {member.name || member.email || `User #${member.id}`}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button variant="outline" onClick={handleAdminAssign} disabled={!assignmentChanged || assignCaseMutation.isPending} className="w-full">
                                    {assignCaseMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <UserPlus className="w-4 h-4 me-2" />}
                                    {isRtl ? "حفظ التعيين" : "Save Assignment"}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="border-slate-200 shadow-none">
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <MessageSquare className="w-5 h-5 text-emerald-500" />
                                  {isRtl ? "ملاحظات ومتابعة" : "Notes and Follow-up"}
                                </CardTitle>
                                <CardDescription>
                                  {isRtl ? "اكتب ملاحظة داخلية أو اطلب متابعة من الفريق عند الحاجة." : "Add an internal note or request a team follow-up when needed."}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <Textarea
                                  value={noteText}
                                  onChange={(event) => setNoteText(event.target.value)}
                                  placeholder={isRtl ? "اكتب ما تم مراجعته أو المطلوب من الفريق..." : "Write what was reviewed or what the team should follow up on..."}
                                  rows={6}
                                />
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <Button onClick={handleAddNote} disabled={addNoteMutation.isPending || !noteText.trim()}>
                                    {addNoteMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <MessageSquare className="w-4 h-4 me-2" />}
                                    {isRtl ? "إضافة ملاحظة" : "Add Note"}
                                  </Button>
                                  <Button variant="outline" onClick={handleFollowupRequest} disabled={requestFollowupMutation.isPending}>
                                    {requestFollowupMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 me-2" />}
                                    {isRtl ? "طلب متابعة" : "Request Follow-up"}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>

                            <Card className="border-slate-200 shadow-none">
                              <CardHeader>
                                <CardTitle className="text-base">{isRtl ? "الملاحظات الداخلية" : "Internal Notes"}</CardTitle>
                                <CardDescription>
                                  {isRtl ? `${selectedCase?.notes.length ?? 0} ملاحظة` : `${selectedCase?.notes.length ?? 0} notes`}
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                {(selectedCase?.notes.length ?? 0) === 0 ? (
                                  <EmptyState
                                    title={isRtl ? "لا توجد ملاحظات بعد" : "No notes yet"}
                                    description={isRtl ? "أضف أول ملاحظة لتوثيق المتابعة على هذه الحالة." : "Add the first note to document follow-up on this case."}
                                  />
                                ) : (
                                  <ScrollArea className="h-[240px] pe-3">
                                    <div className="space-y-3">
                                      {selectedCase?.notes.map((note) => (
                                        <div key={note.id} className="rounded-xl border bg-white p-3 space-y-2">
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-2">
                                              <Badge className={noteTypeStyles[note.noteType] || "bg-slate-100 text-slate-700"}>
                                                {pickLabel(noteTypeLabels, note.noteType, isRtl)}
                                              </Badge>
                                              <span className="text-xs text-muted-foreground">
                                                {note.authorName || note.authorEmail || (note.authorUserId < 0 ? "Admin" : "Staff")}
                                              </span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">{formatDate(note.createdAt, locale)}</span>
                                          </div>
                                          <p className="text-sm whitespace-pre-wrap leading-6">{note.content}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </ScrollArea>
                                )}
                              </CardContent>
                            </Card>

                            <Card className="border-slate-200 shadow-none">
                              <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <ShieldAlert className="w-5 h-5 text-amber-500" />
                                  {isRtl ? "إجراءات إدارية" : "Admin Controls"}
                                </CardTitle>
                                <CardDescription>
                                  {isRtl ? "تجميد أو فك تجميد وصول LexAI وحذف السجل عند الحاجة." : "Freeze or unfreeze LexAI access and delete history when required."}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <Textarea
                                  value={pauseReason}
                                  onChange={(event) => setPauseReason(event.target.value)}
                                  placeholder={isRtl ? "سبب التجميد إن وجد..." : "Freeze reason if needed..."}
                                  rows={4}
                                />

                                {selectedCase?.lexaiSubscription?.id ? (
                                  selectedCase.lexaiSubscription.isPaused ? (
                                    <Button onClick={handleResumeLexai} disabled={resumeSubscriptionMutation.isPending} className="w-full">
                                      {resumeSubscriptionMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <PlayCircle className="w-4 h-4 me-2" />}
                                      {isRtl ? "فك تجميد LexAI" : "Unfreeze LexAI"}
                                    </Button>
                                  ) : (
                                    <Button variant="outline" onClick={handlePauseLexai} disabled={pauseSubscriptionMutation.isPending} className="w-full">
                                      {pauseSubscriptionMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <PauseCircle className="w-4 h-4 me-2" />}
                                      {isRtl ? "تجميد LexAI" : "Freeze LexAI"}
                                    </Button>
                                  )
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                    {isRtl ? "لا يوجد اشتراك LexAI مرتبط بهذه الحالة." : "There is no LexAI subscription attached to this case."}
                                  </p>
                                )}

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={!hasMessages || deleteHistoryMutation.isPending} className="w-full">
                                      {deleteHistoryMutation.isPending ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Trash2 className="w-4 h-4 me-2" />}
                                      {isRtl ? "حذف سجل المحادثة" : "Delete Chat History"}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>{isRtl ? "حذف سجل المحادثة؟" : "Delete chat history?"}</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {isRtl
                                          ? `سيتم حذف جميع رسائل LexAI الخاصة بـ ${selectedUserLabel}. لا يمكن التراجع عن هذه العملية.`
                                          : `All LexAI messages for ${selectedUserLabel} will be deleted. This action cannot be undone.`}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => selectedCase && deleteHistoryMutation.mutate({ userId: selectedCase.userId })}>
                                        {isRtl ? "تأكيد الحذف" : "Confirm Delete"}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </CardContent>
                            </Card>
                          </CardContent>
                        )}
                      </Card>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <AdminClientProfileSheet
        userId={profileUserId}
        open={!!profileUserId}
        onOpenChange={(open) => {
          if (!open) setProfileUserId(null);
        }}
        onOpenLexai={(caseId) => {
          setProfileUserId(null);
          if (caseId) {
            setSelectedCaseId(caseId);
            replaceLexaiUrl(caseId);
          }
        }}
        onOpenSupport={(conversationId) => {
          setProfileUserId(null);
          setLocation(conversationId ? `/admin/support?conversationId=${conversationId}` : "/admin/support");
        }}
      />
    </DashboardLayout>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value || "-"}</p>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Clock3 className="w-8 h-8 mx-auto mb-3 opacity-40" />
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm mt-1">{description}</p>
    </div>
  );
}