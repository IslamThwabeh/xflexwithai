import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { PauseCircle, PlayCircle, UserCog, Bell, TrendingUp, Copy, Trash2, ArrowDown, ArrowUp, Plus, Clock3, Megaphone, XCircle, Info } from "lucide-react";
import { useDataTable, DataTablePagination, zebraRow } from "@/components/DataTable";
import { buildRecommendationThreads, groupRecommendationThreadsByDay } from "@/lib/recommendationThreads";

type RecommendationType = "recommendation" | "update" | "result";
type FollowUpPresetGroupKey = "pips" | "management" | "outcome";

const QUICK_SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "US30"];

const FOLLOW_UP_PRESET_GROUPS = [
  {
    key: "pips",
    labelEn: "Pips",
    labelAr: "النقاط",
    modes: ["update", "result"] as RecommendationType[],
    items: [
      { key: "p5", labelEn: "+5", labelAr: "+5", valueEn: "+5 pips ✅", valueAr: "+5 نقاط ✅" },
      { key: "p10", labelEn: "+10", labelAr: "+10", valueEn: "+10 pips ✅", valueAr: "+10 نقاط ✅" },
      { key: "p15", labelEn: "+15", labelAr: "+15", valueEn: "+15 pips ✅", valueAr: "+15 نقاط ✅" },
      { key: "p30", labelEn: "+30", labelAr: "+30", valueEn: "+30 pips ✅", valueAr: "+30 نقاط ✅" },
      { key: "p50", labelEn: "+50", labelAr: "+50", valueEn: "+50 pips ✅", valueAr: "+50 نقاط ✅" },
      { key: "p100", labelEn: "+100", labelAr: "+100", valueEn: "+100 pips ✅", valueAr: "+100 نقاط ✅" },
      { key: "p150", labelEn: "+150", labelAr: "+150", valueEn: "+150 pips ✅", valueAr: "+150 نقاط ✅" },
    ],
  },
  {
    key: "management",
    labelEn: "Management",
    labelAr: "إدارة",
    modes: ["update"] as RecommendationType[],
    items: [
      { key: "secure", labelEn: "Secure", labelAr: "تأمين", valueEn: "Secure the trade ✅", valueAr: "تأمين الصفقة ✅" },
      { key: "moveStop", labelEn: "Move SL", labelAr: "نقل الستوب", valueEn: "Move SL to entry.", valueAr: "نقل الستوب إلى الدخول." },
      { key: "reserve", labelEn: "Reserve", labelAr: "حجز", valueEn: "Reserve part of the profit ✅", valueAr: "حجز جزء من الربح ✅" },
      { key: "partial", labelEn: "Partial close", labelAr: "إغلاق جزئي", valueEn: "Take partial profit and hold the rest.", valueAr: "إغلاق جزء من العقد وترك الباقي." },
    ],
  },
  {
    key: "outcome",
    labelEn: "Outcome",
    labelAr: "النتيجة",
    modes: ["result"] as RecommendationType[],
    items: [
      { key: "tp1", labelEn: "TP1", labelAr: "هدف 1", valueEn: "TP1 hit ✅", valueAr: "ضرب الهدف الأول ✅" },
      { key: "tp2", labelEn: "TP2", labelAr: "هدف 2", valueEn: "TP2 hit ✅✅", valueAr: "ضرب الهدف الثاني ✅✅" },
      { key: "tp3", labelEn: "TP3", labelAr: "هدف 3", valueEn: "TP3 hit ✅✅✅", valueAr: "ضرب الهدف الثالث ✅✅✅" },
      { key: "stopped", labelEn: "Stopped", labelAr: "ستوب", valueEn: "Stopped out ❌", valueAr: "ضرب ستوب ❌" },
    ],
  },
] as const;

function formatCountdown(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getMessageTypeLabel(type: string, isRTL: boolean) {
  if (type === "result") return isRTL ? "نتيجة" : "Result";
  if (type === "update") return isRTL ? "تحديث" : "Update";
  if (type === "alert") return isRTL ? "تنبيه" : "Alert";
  return isRTL ? "توصية" : "Recommendation";
}

function getMessageTypeClass(type: string) {
  if (type === "result") return "border-teal-300 text-teal-700 dark:text-teal-300";
  if (type === "update") return "border-amber-300 text-amber-700 dark:text-amber-300";
  if (type === "alert") return "border-emerald-300 text-emerald-700 dark:text-emerald-300";
  return "border-emerald-300 text-emerald-700 dark:text-emerald-400";
}

function formatMessageTimestamp(value: unknown, language: string) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(language === "ar" ? "ar-EG" : "en-US");
}

function getThreadContainerClass(paletteIndex: number, isClosed: boolean) {
  const base = paletteIndex % 2 === 0
    ? "border-slate-200 bg-white"
    : "border-slate-300 bg-slate-50/90";

  return isClosed
    ? `${base} shadow-sm`
    : `${base} ring-1 ring-emerald-200/80 shadow-sm shadow-emerald-100/60 dark:ring-emerald-800/30 dark:shadow-none`;
}

function getThreadRootPanelClass(paletteIndex: number, isClosed: boolean) {
  if (isClosed) {
    return paletteIndex % 2 === 0
      ? "border-slate-200 bg-slate-50/85"
      : "border-slate-200 bg-slate-100/70";
  }

  return paletteIndex % 2 === 0
    ? "border-slate-200 bg-white/90"
    : "border-slate-200 bg-white/75";
}

function getThreadChildPanelClass(type: string, paletteIndex: number) {
  if (type === "result") {
    return paletteIndex % 2 === 0
      ? "border-teal-200 bg-teal-50/85 dark:border-teal-800/40 dark:bg-teal-900/10"
      : "border-teal-200 bg-teal-100/65 dark:border-teal-800/40 dark:bg-teal-900/15";
  }

  return paletteIndex % 2 === 0
    ? "border-amber-200 bg-amber-50/85 dark:border-amber-800/40 dark:bg-amber-900/10"
    : "border-amber-200 bg-amber-100/65 dark:border-amber-800/40 dark:bg-amber-900/15";
}

function getThreadStatusLabel(isClosed: boolean, isRTL: boolean) {
  return isClosed ? (isRTL ? "مغلقة" : "Closed") : (isRTL ? "مفتوحة" : "Open");
}

function getThreadStatusClass(isClosed: boolean) {
  return isClosed
    ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
    : "bg-emerald-600 text-white";
}

function buildCopyBlock(message: any, t: (key: string) => string) {
  const lines: string[] = [];
  if (message.symbol) lines.push(`${t('rec.copySymbol')}: ${message.symbol}`);
  if (message.side) lines.push(`${t('rec.copySide')}: ${message.side}`);
  if (message.entryPrice) lines.push(`${t('rec.copyEntry')}: ${message.entryPrice}`);
  if (message.stopLoss) lines.push(`${t('rec.copySL')}: ${message.stopLoss}`);
  if (message.takeProfit1) lines.push(`${t('rec.copyTP1')}: ${message.takeProfit1}`);
  if (message.takeProfit2) lines.push(`${t('rec.copyTP2')}: ${message.takeProfit2}`);
  if (message.riskPercent) lines.push(`${t('rec.copyRisk')}: ${message.riskPercent}`);
  lines.push("");
  lines.push(message.content || "");
  return lines.join("\n").trim();
}

function formatRecommendationUiError(message: string, isRTL: boolean) {
  const waitMatch = message.match(/^Wait (\d+) more seconds before sending the next channel message\.$/);

  if (isRTL) {
    if (waitMatch) {
      return `هذا طبيعي: انتظر ${waitMatch[1]} ثانية إضافية قبل إرسال الرسالة التالية في القناة.`;
    }

    switch (message) {
      case "Notify clients first, then wait one minute before sending in the recommendations channel.":
        return "بعد 15 دقيقة من الصمت يجب أولاً الضغط على إخطار العملاء، ثم انتظار دقيقة واحدة قبل إرسال أي رسالة جديدة.";
      case "The chat paused after 15 minutes of analyst silence. Notify clients again before sending a new message.":
        return "توقفت الدردشة بعد 15 دقيقة من صمت المحلل. أرسل إخطاراً جديداً للعملاء قبل كتابة الرسالة التالية.";
      case "Choose the symbol first.":
        return "اختر الزوج أولاً قبل نشر التوصية.";
      case "Choose the parent recommendation first.":
        return "اختر التوصية الأم أولاً قبل إضافة تحديث أو نتيجة.";
      case "Top-level recommendations cannot be posted inside another thread.":
        return "التوصية الجديدة يجب أن تكون رسالة رئيسية، وليست داخل سلسلة قائمة.";
      case "Parent recommendation not found.":
        return "تعذر العثور على التوصية الأم. حدّث الصفحة ثم اختر التوصية من جديد.";
      case "Replies and results can only be added to an existing recommendation.":
        return "يمكن إضافة التحديثات والنتائج فقط داخل توصية موجودة بالفعل.";
      case "Same-trade updates must stay on the original recommendation symbol.":
        return "تحديثات نفس الصفقة يجب أن تبقى على نفس زوج التوصية الأصلية.";
      case "There is already an active chat session. Wait for it to pause or cancel it before starting a new one.":
        return "لديك دردشة نشطة بالفعل. انتظر حتى تتوقف تلقائياً أو ألغها قبل بدء جلسة جديدة.";
      case "Notification window not found":
        return "تعذر العثور على جلسة القناة المطلوبة.";
      case "You can only cancel your own notification window":
        return "يمكنك إلغاء جلسة القناة الخاصة بك فقط.";
      case "This notification window is no longer active":
        return "هذه الجلسة لم تعد نشطة.";
      default:
        return message;
    }
  }

  if (waitMatch) {
    return `This is expected: wait ${waitMatch[1]} more seconds before sending the next channel message.`;
  }

  switch (message) {
    case "Notify clients first, then wait one minute before sending in the recommendations channel.":
      return "After 15 minutes of silence, click Notify Clients first. Typing unlocks one minute later.";
    case "The chat paused after 15 minutes of analyst silence. Notify clients again before sending a new message.":
      return "The chat paused after 15 minutes of analyst silence. Click Notify Clients again before sending a new message.";
    default:
      return message;
  }
}

/* ─── Analyst view: posting form + recent messages ─── */
function AnalystView() {
  const { t, language, isRTL } = useLanguage();
  const utils = trpc.useUtils();

  const [type, setType] = useState<RecommendationType>("recommendation");
  const [content, setContent] = useState("");
  const [symbol, setSymbol] = useState("XAUUSD");
  const [side, setSide] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit1, setTakeProfit1] = useState("");
  const [takeProfit2, setTakeProfit2] = useState("");
  const [riskPercent, setRiskPercent] = useState("");
  const [parentMessage, setParentMessage] = useState<any | null>(null);
  const [showTradeDetails, setShowTradeDetails] = useState(false);
  const [activePresetGroup, setActivePresetGroup] = useState<FollowUpPresetGroupKey>("pips");
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: me } = trpc.recommendations.me.useQuery();
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery();
  const canManageChannel = !!me?.canPublish || !!adminCheck?.isAdmin;
  const { data: publishState } = trpc.recommendations.publishState.useQuery(undefined, {
    enabled: canManageChannel,
    refetchInterval: canManageChannel ? 1000 : false,
  });
  const { data: feed = [], isLoading: feedLoading } = trpc.recommendations.feed.useQuery(
    { limit: 200 },
    { enabled: canManageChannel }
  );

  const notifyClientsMutation = trpc.recommendations.notifyClients.useMutation({
    onSuccess: (result) => {
      toast.success(
        isRTL
          ? `تم إخطار ${result.recipientCount} عميل. الكتابة ستفتح بعد دقيقة واحدة، وبعدها تبقى الدردشة مفتوحة ما دمت تستمر في الإرسال.`
          : `Notified ${result.recipientCount} clients. Typing unlocks in one minute, and the chat stays live while you keep sending.`
      );
      utils.recommendations.publishState.invalidate();
      utils.recommendations.activeAlerts.invalidate();
    },
    onError: (error) => toast.error(formatRecommendationUiError(error.message, isRTL)),
  });

  const cancelAlertMutation = trpc.recommendations.cancelAlert.useMutation({
    onSuccess: () => {
      toast.success(
        isRTL
          ? "تم إلغاء جلسة القناة. عند الجاهزية أرسل إخطاراً جديداً لبدء جلسة أخرى."
          : "Channel session cancelled. When you're ready, send a new alert to start another session."
      );
      utils.recommendations.publishState.invalidate();
      utils.recommendations.activeAlerts.invalidate();
    },
    onError: (error) => toast.error(formatRecommendationUiError(error.message, isRTL)),
  });

  const postMessageMutation = trpc.recommendations.postMessage.useMutation({
    onSuccess: () => {
      toast.success(
        type === "result"
          ? (isRTL ? "تم نشر النتيجة" : "Result published")
          : type === "update"
            ? (isRTL ? "تم إرسال التحديث" : "Update sent")
            : (isRTL ? "تم نشر التوصية" : "Recommendation published")
      );
      setContent("");
      setSide("");
      setEntryPrice("");
      setStopLoss("");
      setTakeProfit1("");
      setTakeProfit2("");
      setRiskPercent("");
      setShowTradeDetails(false);
      setParentMessage(null);
      setType("recommendation");
      setActivePresetGroup("pips");
      if (type === "recommendation") {
        setSymbol("XAUUSD");
      }
      utils.recommendations.feed.invalidate();
      utils.recommendations.publishState.invalidate();
      utils.recommendations.activeAlerts.invalidate();
    },
    onError: (error) => toast.error(formatRecommendationUiError(error.message, isRTL)),
  });

  const deleteMessageMutation = trpc.recommendations.deleteMessage.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف الرسالة" : "Message deleted");
      utils.recommendations.feed.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const closeThreadMutation = trpc.recommendations.closeThread.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم إغلاق الصفقة" : "Thread closed");
      utils.recommendations.feed.invalidate();
    },
    onError: (error) => toast.error(formatRecommendationUiError(error.message, isRTL)),
  });

  const normalizedSymbol = symbol.trim().toUpperCase();
  const activeAlert = publishState?.activeAlert;
  const hasActiveAlert = !!activeAlert;
  const canPostMessages = !!publishState?.canPostMessages;
  const requiresAlert = !hasActiveAlert;
  const isWaitingForUnlock = hasActiveAlert && !canPostMessages;
  const showComposerFields = hasActiveAlert;
  const channelDisabledReason = requiresAlert
    ? (isRTL
        ? "بعد 15 دقيقة من الصمت يجب أولاً الضغط على إخطار العملاء قبل كتابة رسالة جديدة."
        : "After 15 minutes of silence, click Notify Clients before typing a new message.")
    : canPostMessages
      ? ""
      : (isRTL
          ? `تم إرسال الإخطار. يمكنك الكتابة بعد ${formatCountdown(publishState?.secondsUntilUnlock ?? 0)}.`
          : `Alert sent. You can type in ${formatCountdown(publishState?.secondsUntilUnlock ?? 0)}.`);
  const publishDisabledReason = type === "recommendation"
    ? (!normalizedSymbol
        ? (isRTL ? "اختر الزوج أولاً" : "Choose the symbol first")
        : channelDisabledReason)
    : (!parentMessage?.id
        ? (isRTL ? "اختر التوصية الأم أولاً" : "Choose the parent recommendation first")
        : channelDisabledReason);
  const sessionStatusTitle = requiresAlert
    ? (isRTL ? "الدردشة متوقفة مؤقتاً" : "Chat paused")
    : isWaitingForUnlock
      ? (isRTL ? "تم إرسال التنبيه" : "Alert sent")
      : (isRTL ? "الدردشة نشطة الآن" : "Chat live now");
  const sessionStatusDescription = requiresAlert
    ? (isRTL
        ? "بعد 15 دقيقة من الصمت، اضغط إخطار العملاء لإعادة فتح القناة."
        : "After 15 minutes of silence, alert clients to reopen the channel.")
    : isWaitingForUnlock
      ? (isRTL
          ? `تم إخطار العملاء. تفتح القناة خلال ${formatCountdown(publishState?.secondsUntilUnlock ?? 0)}.`
          : `Clients were notified. The channel unlocks in ${formatCountdown(publishState?.secondsUntilUnlock ?? 0)}.`)
      : (isRTL
          ? `القناة تعمل الآن. كل رسالة جديدة تمدد الجلسة، ويتبقى ${formatCountdown(publishState?.secondsUntilExpiry ?? 0)} قبل قفل الصمت.`
          : `The channel is live now. Each new message extends the session, and ${formatCountdown(publishState?.secondsUntilExpiry ?? 0)} remains before the silence lock.`);

  useEffect(() => {
    if (!showComposerFields || type === "recommendation") return;

    const frame = window.requestAnimationFrame(() => {
      composerRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [showComposerFields, type, parentMessage]);

  const onNotifyClients = () => {
    notifyClientsMutation.mutate({});
  };

  const onPublish = () => {
    if (!content.trim()) { toast.error(t('rec.toastWriteMessage')); return; }
    if (type !== "recommendation" && !parentMessage?.id) {
      toast.error(isRTL ? "اختر التوصية الأم أولاً" : "Choose the parent recommendation first");
      return;
    }

    postMessageMutation.mutate({
      type,
      content: content.trim(),
      symbol: type === "recommendation" ? normalizedSymbol || undefined : parentMessage?.symbol || undefined,
      side: type === "recommendation" ? side.trim() || undefined : undefined,
      entryPrice: type === "recommendation" ? entryPrice.trim() || undefined : undefined,
      stopLoss: type === "recommendation" ? stopLoss.trim() || undefined : undefined,
      takeProfit1: type === "recommendation" ? takeProfit1.trim() || undefined : undefined,
      takeProfit2: type === "recommendation" ? takeProfit2.trim() || undefined : undefined,
      riskPercent: type === "recommendation" ? riskPercent.trim() || undefined : undefined,
      parentId: parentMessage?.id ?? undefined,
    });
  };

  const copyMessage = (message: any) => {
    navigator.clipboard.writeText(buildCopyBlock(message, t));
    toast.success(t('rec.toastCopied'));
  };

  const startFollowUp = (parent: any, nextType: RecommendationType = "update") => {
    setType(nextType);
    setParentMessage(parent);
    setContent("");
    setShowTradeDetails(false);
    setActivePresetGroup(nextType === "result" ? "outcome" : "pips");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const threads = useMemo(() => buildRecommendationThreads(feed, { openFirst: true }), [feed]);
  const availablePresetGroups = useMemo(
    () => FOLLOW_UP_PRESET_GROUPS.filter((group) => group.modes.includes(type)),
    [type],
  );
  const activePresetConfig = availablePresetGroups.find((group) => group.key === activePresetGroup) ?? availablePresetGroups[0] ?? null;

  useEffect(() => {
    if (!availablePresetGroups.some((group) => group.key === activePresetGroup)) {
      setActivePresetGroup(type === "result" ? "outcome" : "pips");
    }
  }, [activePresetGroup, availablePresetGroups, type]);
  const openThreadGroups = useMemo(
    () => groupRecommendationThreadsByDay(threads.filter((thread) => !thread.isClosed), language),
    [threads, language],
  );
  const closedThreadGroups = useMemo(
    () => groupRecommendationThreadsByDay(threads.filter((thread) => thread.isClosed), language),
    [threads, language],
  );
  const openThreadCount = threads.filter((thread) => !thread.isClosed).length;
  const closedThreadCount = threads.filter((thread) => thread.isClosed).length;

  const renderThreadGroups = (groups: any[], isClosedSection: boolean) => (
    <div className="space-y-4">
      {groups.map((group: any) => (
        <section key={`${isClosedSection ? "closed" : "open"}-${group.key}`} className="space-y-3">
          <div className="px-1">
            <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
              {group.label}
            </p>
          </div>

          <div className="space-y-3">
            {group.threads.map((thread: any) => {
              const message = thread.root;
              const children = thread.children;
              const canDeleteMessage = !!adminCheck?.isAdmin || message.userId === me?.userId;

              return (
                <div key={message.id} className={`rounded-2xl border p-3 space-y-3 sm:p-4 ${getThreadContainerClass(thread.paletteIndex, thread.isClosed)}`}>
                  <div className={`rounded-xl border p-4 space-y-3 ${getThreadRootPanelClass(thread.paletteIndex, thread.isClosed)}`}>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={getMessageTypeClass(message.type)}>
                            {getMessageTypeLabel(message.type, isRTL)}
                          </Badge>
                          <Badge className={getThreadStatusClass(thread.isClosed)}>
                            {getThreadStatusLabel(thread.isClosed, isRTL)}
                          </Badge>
                          {message.symbol && <Badge className="bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 text-xs">{message.symbol}</Badge>}
                          {message.side && (
                            <Badge className={message.side === "BUY" ? "bg-emerald-100 text-emerald-700 text-xs" : "bg-red-100 text-red-700 text-xs"}>
                              {message.side === "BUY" ? "↑ BUY" : "↓ SELL"}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 text-xs">
                            #{message.id}
                          </Badge>
                          {children.length > 0 && (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300 text-xs">
                              {isRTL
                                ? `${children.length} ${children.length === 1 ? 'متابعة' : 'متابعات'}`
                                : `${children.length} ${children.length === 1 ? 'follow-up' : 'follow-ups'}`}
                            </Badge>
                          )}
                        </div>

                        {children.length > 0 && thread.latestActivityAt !== message.createdAt && (
                          <p className="text-xs text-muted-foreground">
                            {isRTL
                              ? `بدأت الصفقة ${formatMessageTimestamp(message.createdAt, language)} وآخر تحديث كان ${formatMessageTimestamp(thread.latestActivityAt, language)}`
                              : `Trade opened ${formatMessageTimestamp(message.createdAt, language)} and was last updated ${formatMessageTimestamp(thread.latestActivityAt, language)}`}
                          </p>
                        )}
                      </div>

                      <div className="text-[11px] text-muted-foreground sm:text-xs lg:text-right">
                        {formatMessageTimestamp(thread.latestActivityAt, language)}
                      </div>
                    </div>

                    {(message.entryPrice || message.stopLoss || message.takeProfit1 || message.takeProfit2 || message.riskPercent) && (
                      <div className="grid grid-cols-1 gap-2 rounded-xl border bg-gray-50 p-3 text-xs sm:grid-cols-2 xl:grid-cols-4 dark:bg-white/5">
                        {message.entryPrice && <div><span className="text-muted-foreground">{isRTL ? "دخول:" : "Entry:"}</span> <span className="font-mono font-medium">{message.entryPrice}</span></div>}
                        {message.stopLoss && <div><span className="text-muted-foreground">{isRTL ? "وقف:" : "SL:"}</span> <span className="font-mono font-medium text-red-600">{message.stopLoss}</span></div>}
                        {message.takeProfit1 && <div><span className="text-muted-foreground">{isRTL ? "هدف 1:" : "TP1:"}</span> <span className="font-mono font-medium text-emerald-600">{message.takeProfit1}</span></div>}
                        {message.takeProfit2 && <div><span className="text-muted-foreground">{isRTL ? "هدف 2:" : "TP2:"}</span> <span className="font-mono font-medium text-emerald-600">{message.takeProfit2}</span></div>}
                        {message.riskPercent && <div><span className="text-muted-foreground">{isRTL ? "مخاطرة:" : "Risk:"}</span> <span className="font-mono font-medium">{message.riskPercent}</span></div>}
                      </div>
                    )}

                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => copyMessage(message)}>
                        <Copy className="h-3.5 w-3.5 me-1" /> {t('rec.copy')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => startFollowUp(message)} className="text-amber-700 border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/20">
                        <Plus className="h-3.5 w-3.5 me-1" /> {isRTL ? "متابعة" : "Follow-up"}
                      </Button>
                      {!thread.isClosed && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!thread.hasResultChild || closeThreadMutation.isPending}
                          onClick={() => {
                            if (confirm(isRTL ? "إغلاق هذه الصفقة؟" : "Close this thread?")) {
                              closeThreadMutation.mutate({ messageId: message.id });
                            }
                          }}
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                        >
                          <Clock3 className="h-3.5 w-3.5 me-1" /> {isRTL ? "إغلاق الصفقة" : "Close Thread"}
                        </Button>
                      )}
                      {canDeleteMessage && (
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { if (confirm(isRTL ? "هل تريد حذف هذه الرسالة؟" : "Delete this message?")) deleteMessageMutation.mutate({ messageId: message.id }); }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {!thread.isClosed && !thread.hasResultChild && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-100">
                        {isRTL
                          ? "أرسل نتيجة واحدة على الأقل داخل هذه الصفقة قبل إغلاقها."
                          : "Send at least one result inside this trade before closing it."}
                      </div>
                    )}
                  </div>

                  {children.length > 0 && (
                    <div className="space-y-2">
                      {children.map((child: any) => (
                        <div key={child.id} className={`rounded-xl border p-3 space-y-2 ${getThreadChildPanelClass(child.type, thread.paletteIndex)}`}>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <Badge variant="outline" className={getMessageTypeClass(child.type) + " text-xs"}>
                                {getMessageTypeLabel(child.type, isRTL)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">#{child.id}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] text-muted-foreground sm:text-xs">
                                {formatMessageTimestamp(child.createdAt, language)}
                              </span>
                              {(!!adminCheck?.isAdmin || child.userId === me?.userId) && (
                                <Button
                                  size="sm" variant="ghost"
                                  onClick={() => { if (confirm(isRTL ? "حذف المتابعة؟" : "Delete follow-up?")) deleteMessageMutation.mutate({ messageId: child.id }); }}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{child.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('rec.publishNew')}</h1>
        <p className="text-muted-foreground">{t('rec.publishDesc')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {type === "recommendation"
              ? (isRTL ? "نشر توصية جديدة" : "Publish Recommendation")
              : parentMessage
                ? (isRTL ? `متابعة للتوصية #${parentMessage.id}` : `Follow-up for Recommendation #${parentMessage.id}`)
                : (isRTL ? "دردشة التوصيات" : "Recommendations Chat")}
          </CardTitle>
          <CardDescription>
            {type === "recommendation"
              ? (isRTL
                  ? "أرسل الفكرة الرئيسية أولاً، وأضف المستويات فقط عند الحاجة."
                  : "Send the main trade idea first, and add levels only when they are needed.")
              : (isRTL
                  ? "اختر تحديثاً لإدارة الصفقة أو نتيجة لتوثيق الإغلاق النهائي."
                  : "Choose Update for live trade management or Result for the final outcome.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className={!hasActiveAlert
            ? "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100"
            : canPostMessages
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/10 dark:text-emerald-100"
              : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-100"}
          >
            <Info className="h-4 w-4" />
            <AlertTitle>{sessionStatusTitle}</AlertTitle>
            <AlertDescription>{sessionStatusDescription}</AlertDescription>
          </Alert>

          {showComposerFields && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {type === "recommendation"
                      ? (isRTL ? "التوصية الرئيسية" : "Main recommendation")
                      : (isRTL ? `متابعة للتوصية #${parentMessage?.id}` : `Follow-up for recommendation #${parentMessage?.id}`)}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {type === "recommendation"
                      ? (isRTL
                          ? "ابدأ بالصفقة الأساسية، ثم استخدم المتابعة لأي تحديث أو نتيجة داخل السلسلة نفسها."
                          : "Start with the main trade, then use follow-up for any update or result inside the same thread.")
                      : (isRTL
                          ? "اختر نوع المتابعة ثم أرسل رسالة قصيرة وواضحة داخل نفس الصفقة."
                          : "Choose the follow-up mode, then send a short clear message inside the same trade.")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={type === "recommendation" ? "default" : "outline"}
                    onClick={() => { setType("recommendation"); setParentMessage(null); setActivePresetGroup("pips"); }}
                    className={type === "recommendation" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
                  >
                    <TrendingUp className="h-4 w-4 me-1" /> {isRTL ? "توصية جديدة" : "New Recommendation"}
                  </Button>

                  {parentMessage && (
                    <>
                      <Button
                        size="sm"
                        variant={type === "update" ? "default" : "outline"}
                        onClick={() => { setType("update"); setActivePresetGroup("pips"); }}
                        className={type === "update" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
                      >
                        <Bell className="h-4 w-4 me-1" /> {isRTL ? "تحديث" : "Update"}
                      </Button>
                      <Button
                        size="sm"
                        variant={type === "result" ? "default" : "outline"}
                        onClick={() => { setType("result"); setActivePresetGroup("outcome"); }}
                        className={type === "result" ? "bg-teal-600 hover:bg-teal-700 text-white" : ""}
                      >
                        <Plus className="h-4 w-4 me-1" /> {isRTL ? "نتيجة" : "Result"}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {parentMessage && type !== "recommendation" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-xs border-teal-300 text-teal-700 dark:text-teal-300">
                    {isRTL ? `مرتبطة بالتوصية #${parentMessage.id}` : `Linked to Rec #${parentMessage.id}`}
                  </Badge>
                  {parentMessage.symbol && (
                    <Badge className="bg-white text-slate-700 dark:bg-white/10 dark:text-slate-200 text-xs">
                      {parentMessage.symbol}
                    </Badge>
                  )}
                  <button
                    onClick={() => { setParentMessage(null); setType("recommendation"); setActivePresetGroup("pips"); }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    {isRTL ? "إلغاء الربط" : "Unlink"}
                  </button>
                </div>
              )}
            </div>
          )}

          {showComposerFields && type === "recommendation" && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {isRTL ? "الأصل / الزوج" : "Symbol / Pair"}
              </label>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {QUICK_SYMBOLS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSymbol(s)}
                    disabled={isWaitingForUnlock}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      symbol === s
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                        : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                disabled={isWaitingForUnlock}
                placeholder={t('rec.symbolPlaceholder')}
                className="max-w-xs"
              />
            </div>
          )}

          {showComposerFields && type === "recommendation" && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {isRTL ? "الاتجاه" : "Direction"}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSide("BUY")}
                  disabled={isWaitingForUnlock}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                    side === "BUY"
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                      : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-emerald-300"
                  }`}
                >
                  <ArrowUp className="w-4 h-4" /> BUY
                </button>
                <button
                  onClick={() => setSide("SELL")}
                  disabled={isWaitingForUnlock}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                    side === "SELL"
                      ? "bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20"
                      : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-red-300"
                  }`}
                >
                  <ArrowDown className="w-4 h-4" /> SELL
                </button>
              </div>
            </div>
          )}

          {showComposerFields && type === "recommendation" && (
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-800 dark:bg-slate-950/30">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {isRTL ? "تفاصيل إضافية اختيارية" : "Optional trade levels"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isRTL
                      ? "أضف الدخول ووقف الخسارة والأهداف فقط عندما تحتاجها. ليست مطلوبة للنشر السريع."
                      : "Add entry, stop loss, and targets only when you need them. They are not required for the fast posting flow."}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTradeDetails((current) => !current)}
                >
                  {showTradeDetails
                    ? (isRTL ? "إخفاء المستويات" : "Hide levels")
                    : (isRTL ? "إضافة مستويات" : "Add levels")}
                </Button>
              </div>

              {showTradeDetails && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <span className="text-xs text-muted-foreground">{isRTL ? "سعر الدخول" : "Entry"}</span>
                    <Input value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0.00" disabled={isWaitingForUnlock} />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">{isRTL ? "وقف الخسارة" : "Stop Loss"}</span>
                    <Input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0.00" disabled={isWaitingForUnlock} />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">{isRTL ? "هدف 1" : "Target 1"}</span>
                    <Input value={takeProfit1} onChange={(e) => setTakeProfit1(e.target.value)} placeholder="0.00" disabled={isWaitingForUnlock} />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">{isRTL ? "هدف 2" : "Target 2"}</span>
                    <Input value={takeProfit2} onChange={(e) => setTakeProfit2(e.target.value)} placeholder="0.00" disabled={isWaitingForUnlock} />
                  </div>
                  <div className="sm:max-w-[220px]">
                    <span className="text-xs text-muted-foreground">{isRTL ? "نسبة المخاطرة" : "Risk %"}</span>
                    <Input value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} placeholder="1%" disabled={isWaitingForUnlock} />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-800/40 dark:bg-emerald-900/10">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                  {isRTL ? "إجراءات الجلسة" : "Session actions"}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-900/85 dark:text-emerald-100/85">
                  <Badge className={requiresAlert
                    ? "bg-slate-700 text-white"
                    : isWaitingForUnlock
                      ? "bg-amber-500 text-white"
                      : "bg-emerald-600 text-white"}
                  >
                    {requiresAlert
                      ? (isRTL ? "متوقفة" : "Paused")
                      : isWaitingForUnlock
                        ? (isRTL ? "بانتظار الفتح" : "Unlocking")
                        : (isRTL ? "مباشرة" : "Live")}
                  </Badge>
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" />
                    {requiresAlert
                      ? (isRTL ? "يجب إخطار العملاء لإعادة الفتح" : "Alert clients to reopen the channel")
                      : canPostMessages
                        ? (isRTL ? `قفل الصمت بعد ${formatCountdown(publishState?.secondsUntilExpiry ?? 0)}` : `Silence lock in ${formatCountdown(publishState?.secondsUntilExpiry ?? 0)}`)
                        : (isRTL ? `تفتح خلال ${formatCountdown(publishState?.secondsUntilUnlock ?? 0)}` : `Opens in ${formatCountdown(publishState?.secondsUntilUnlock ?? 0)}`)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        type="button"
                        onClick={onNotifyClients}
                        disabled={notifyClientsMutation.isPending || hasActiveAlert}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <Megaphone className="h-4 w-4 me-1" />
                        {isRTL ? "إخطار العملاء" : "Alert Clients"}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8}>
                    {hasActiveAlert
                      ? (isRTL ? "الدردشة نشطة بالفعل. ألغها فقط إذا أردت إيقاف الكتابة الآن." : "The chat is already active. Cancel it only if you want to pause typing now.")
                      : (isRTL ? "ضغطة واحدة ترسل التنبيه للعملاء، وبعد دقيقة تفتح القناة من جديد." : "One tap alerts clients, then the channel unlocks again after one minute.")}
                  </TooltipContent>
                </Tooltip>

                {hasActiveAlert && activeAlert && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => cancelAlertMutation.mutate({ alertId: activeAlert.id })}
                    disabled={cancelAlertMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 me-1" />
                    {isRTL ? "إلغاء الجلسة" : "Cancel Session"}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {showComposerFields && type !== "recommendation" && parentMessage && (
            <div className="space-y-3">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {isRTL ? "متابعات سريعة" : "Quick follow-ups"}
              </label>
              <div className="flex flex-wrap gap-2">
                {availablePresetGroups.map((group) => (
                  <Button
                    key={group.key}
                    type="button"
                    size="sm"
                    variant={activePresetConfig?.key === group.key ? "default" : "outline"}
                    disabled={isWaitingForUnlock}
                    onClick={() => setActivePresetGroup(group.key as FollowUpPresetGroupKey)}
                    className={activePresetConfig?.key === group.key
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/20"}
                  >
                    {isRTL ? group.labelAr : group.labelEn}
                  </Button>
                ))}
              </div>

              {activePresetConfig && (
                <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                  {activePresetConfig.items.map((preset) => (
                    <Button
                      key={preset.key}
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isWaitingForUnlock}
                      onClick={() => setContent(isRTL ? preset.valueAr : preset.valueEn)}
                      className="border-amber-200 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20"
                    >
                      {isRTL ? preset.labelAr : preset.labelEn}
                    </Button>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "النقاط الصغيرة تبقى الأسرع للوصول، بينما القيم الأكبر موجودة داخل نفس المجموعة عند الحاجة."
                  : "Smaller pip moves stay quickest to reach, while larger outcomes remain available inside the same group when needed."}
              </p>
            </div>
          )}

          {showComposerFields && (
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              {isRTL ? "اكتب الرسالة" : "Type Message"}
            </label>
            <Textarea
              ref={composerRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isWaitingForUnlock}
              placeholder={isWaitingForUnlock
                ? (isRTL ? "انتظر انتهاء الدقيقة أولاً" : "Wait for the 1-minute unlock first")
                : type === "recommendation"
                  ? (isRTL ? "اكتب التوصية الرئيسية هنا" : "Write the main recommendation here")
                  : type === "result"
                    ? (isRTL ? "اكتب النتيجة هنا" : "Write the result here")
                    : (isRTL ? "اكتب التحديث هنا" : "Write the update here")}
              rows={3}
            />
          </div>
          )}

          {showComposerFields && (
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t">
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={onPublish}
                    disabled={postMessageMutation.isPending || !!publishDisabledReason}
                    className={type === "recommendation"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : type === "result"
                        ? "bg-teal-600 hover:bg-teal-700 text-white"
                        : "bg-amber-500 hover:bg-amber-600 text-white"}
                  >
                    {postMessageMutation.isPending
                      ? (isRTL ? "جاري النشر..." : "Publishing...")
                      : type === "recommendation"
                        ? (isRTL ? "إرسال التوصية" : "Send Recommendation")
                        : type === "result"
                          ? (isRTL ? "إرسال النتيجة" : "Send Result")
                          : (isRTL ? "إرسال التحديث" : "Send Update")}
                  </Button>
                </span>
              </TooltipTrigger>
              {publishDisabledReason && (
                <TooltipContent sideOffset={8}>{publishDisabledReason}</TooltipContent>
              )}
            </Tooltip>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Recent messages */}
      <Card>
        <CardHeader>
          <CardTitle>{t('rec.messages')}</CardTitle>
          <CardDescription>{t('rec.messagesDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedLoading ? (
            <p className="text-sm text-muted-foreground">{t('rec.loadingMessages')}</p>
          ) : threads.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('rec.noMessages')}</p>
          ) : (
            <div className="space-y-6">
              <section className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {isRTL ? "الصفقات المفتوحة" : "Open Threads"}
                  </h3>
                  <Badge className="bg-emerald-600 text-white">{openThreadCount}</Badge>
                </div>
                {openThreadGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? "لا توجد صفقات مفتوحة حالياً." : "No open threads right now."}
                  </p>
                ) : renderThreadGroups(openThreadGroups, false)}
              </section>

              <section className="space-y-4 border-t pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {isRTL ? "الصفقات المغلقة" : "Closed Threads"}
                  </h3>
                  <Badge className="bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900">{closedThreadCount}</Badge>
                </div>
                {closedThreadGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isRTL ? "لا توجد صفقات مغلقة بعد." : "No closed threads yet."}
                  </p>
                ) : renderThreadGroups(closedThreadGroups, true)}
              </section>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Admin view: analyst management + subscription management ─── */
function AdminView() {
  const { t, isRTL } = useLanguage();

  const utils = trpc.useUtils();

  const { data: analysts = [] } = trpc.recommendationAdmin.listAnalysts.useQuery();
  const { data: subscriptions = [] } = trpc.recommendationAdmin.subscriptions.list.useQuery();

  const pauseSubscriptionMutation = trpc.recommendationAdmin.subscriptions.pause.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تجميد الاشتراك" : "Subscription frozen");
      utils.recommendationAdmin.subscriptions.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeSubscriptionMutation = trpc.recommendationAdmin.subscriptions.resume.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم فك تجميد الاشتراك" : "Subscription unfrozen");
      utils.recommendationAdmin.subscriptions.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const subTable = useDataTable(subscriptions as any[], undefined, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.rec.title')}</h1>
        <p className="text-muted-foreground">{t('admin.rec.subtitle')}</p>
      </div>

        {/* Active analysts summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> {isRTL ? 'المحللون النشطون' : 'Active Analysts'}</CardTitle>
            <CardDescription>{isRTL ? 'المحللون المعينون حالياً — لتعديل الأدوار اذهب إلى صفحة الأدوار' : 'Currently assigned analysts — to manage roles go to the Roles page'}</CardDescription>
          </CardHeader>
          <CardContent>
            {analysts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isRTL ? 'لا يوجد محللون' : 'No analysts assigned'}</p>
            ) : (
              <div className="space-y-2">
                {analysts.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between border rounded p-3">
                    <div>
                      <p className="font-medium">{a.name || "-"}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800">{isRTL ? 'محلل' : 'Analyst'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'اشتراكات التوصيات' : 'Recommendation Subscriptions'}</CardTitle>
            <CardDescription>{isRTL ? 'تجميد أو فك تجميد الاشتراكات النشطة مؤقتاً' : 'Temporarily freeze or unfreeze active recommendation access'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'المستخدم' : 'User'}</TableHead>
                  <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{isRTL ? 'ينتهي' : 'Ends'}</TableHead>
                  <TableHead>{isRTL ? 'المتبقي عند التجميد' : 'Frozen balance'}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subTable.paged.map((subscription: any, i: number) => (
                  <TableRow key={subscription.id} className={zebraRow(i)}>
                    <TableCell>{subscription.userName || '-'}</TableCell>
                    <TableCell>{subscription.userEmail || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={subscription.isPaused ? 'secondary' : 'default'}>
                        {subscription.isPaused ? (isRTL ? 'مجمّد' : 'Frozen') : (isRTL ? 'نشط' : 'Active')}
                      </Badge>
                    </TableCell>
                    <TableCell>{subscription.endDate ? new Date(subscription.endDate).toLocaleDateString(isRTL ? 'ar-EG' : undefined) : '-'}</TableCell>
                    <TableCell>{subscription.pausedRemainingDays ? `${subscription.pausedRemainingDays}d` : '-'}</TableCell>
                    <TableCell>
                      {subscription.isPaused ? (
                        <Button size="sm" variant="outline" onClick={() => resumeSubscriptionMutation.mutate({ subscriptionId: subscription.id })}>
                          <PlayCircle className="h-4 w-4 mr-1" />
                          {isRTL ? 'فك التجميد' : 'Unfreeze'}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => pauseSubscriptionMutation.mutate({ subscriptionId: subscription.id })}>
                          <PauseCircle className="h-4 w-4 mr-1" />
                          {isRTL ? 'تجميد' : 'Freeze'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </ResponsiveTable>
            <DataTablePagination
              page={subTable.page}
              pageSize={subTable.pageSize}
              totalPages={subTable.totalPages}
              totalItems={subTable.totalItems}
              setPage={subTable.setPage}
              changePageSize={subTable.changePageSize}
              isRtl={isRTL}
            />
          </CardContent>
        </Card>
      </div>
  );
}

/* ─── Main export: routes to correct view based on role ─── */
export default function AdminRecommendations() {
  const { t, isRTL } = useLanguage();
  const { data: adminCheck, isLoading } = trpc.auth.isAdmin.useQuery();
  const [activeTab, setActiveTab] = useState<"manage" | "channel">("manage");

  if (isLoading) return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Loading...</div></DashboardLayout>;

  const isAdmin = adminCheck?.isAdmin;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>
        {isAdmin ? (
          <>
            {/* Pill-style tabs for admin */}
            <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-white/[0.06] rounded-xl p-1 w-fit">
              <button
                onClick={() => setActiveTab("manage")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "manage"
                    ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {isRTL ? "الإدارة" : "Management"}
              </button>
              <button
                onClick={() => setActiveTab("channel")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "channel"
                    ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {isRTL ? "قناة التوصيات" : "Channel View"}
              </button>
            </div>
            {activeTab === "manage" ? <AdminView /> : <AnalystView />}
          </>
        ) : (
          <AnalystView />
        )}
      </div>
    </DashboardLayout>
  );
}
