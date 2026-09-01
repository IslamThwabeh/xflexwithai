import ClientLayout from "@/components/ClientLayout";
import SupportBugReportsPanel from "@/components/SupportBugReportsPanel";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Send, Headphones, Loader2, Paperclip, FileIcon, X, Bot, UserRound, Pencil, Trash2, Check, Bug, ArrowLeft, Copy, Reply, Video } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import VoiceRecorder from "@/components/VoiceRecorder";
import AudioPlayer from "@/components/AudioPlayer";
import { useLocation } from "wouter";
import {
  formatSupportFileSize,
  getSupportMediaKind,
  getVideoDuration,
  MAX_SUPPORT_FILE_BYTES,
  MAX_SUPPORT_IMAGE_BYTES,
  MAX_SUPPORT_VIDEO_BYTES,
  MAX_SUPPORT_VIDEO_SECONDS,
  type SupportMediaKind,
} from "@/lib/supportMedia";
import { copyTextToClipboard } from "@/lib/copyText";

function getRequestedSupportTab() {
  if (typeof window === "undefined") return "chat" as const;
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "bugs" ? ("bugs" as const) : ("chat" as const);
}

type SupportMessage = RouterOutputs["supportChat"]["myConversation"]["messages"][number];
type SupportHistoryPage = RouterOutputs["supportChat"]["myMessageHistory"];

export default function SupportChat() {
  const { t, isRTL } = useLanguage();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; file: File; size: number; kind: SupportMediaKind; duration?: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "bugs">(() => getRequestedSupportTab());
  const [olderMessagePages, setOlderMessagePages] = useState<SupportHistoryPage[]>([]);
  const [liveMessages, setLiveMessages] = useState<SupportMessage[]>([]);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [hasUnseenMessages, setHasUnseenMessages] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const [changeCursor, setChangeCursor] = useState<{ afterMessageId: number; changedAfter: string } | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shouldStickToBottomRef = useRef(true);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<number | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [replyToMessageId, setReplyToMessageId] = useState<number | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isChatTab = activeTab === "chat";
  const trpcUtils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.supportChat.myConversation.useQuery(undefined, {
    enabled: isChatTab,
    refetchOnWindowFocus: true,
  });

  const { data: workingHoursData } = trpc.supportChat.isWorkingHours.useQuery(undefined, {
    enabled: isChatTab,
    refetchInterval: isChatTab ? 60_000 : false,
  });
  const isOnline = workingHoursData?.working ?? true;

  const sendMutation = trpc.supportChat.send.useMutation({
    onSuccess: () => {
      setMessage("");
      setAttachment(null);
      setReplyToMessageId(null);
      shouldStickToBottomRef.current = true;
      void refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const requestHumanMutation = trpc.supportChat.requestHuman.useMutation({
    onSuccess: () => {
      toast.success(
        isRTL
          ? (isOnline
              ? 'تم طلب وكيل بشري — سينضم أحد أعضاء الفريق إلى المحادثة قريباً'
              : 'تم طلب وكيل بشري — سيتم الرد خلال ساعات العمل')
          : (isOnline
              ? 'Human agent requested — a team member will join the chat soon'
              : 'Human agent requested — you\'ll get a reply during working hours'),
      );
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const resumeAIMutation = trpc.supportChat.resumeAI.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم تفعيل ردود الذكاء الاصطناعي' : 'AI responses re-enabled');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const historyMessages = useMemo(
    () => [
      ...(data?.messages ?? []),
      ...olderMessagePages.flatMap((page) => page.messages),
    ],
    [data?.messages, olderMessagePages],
  );
  const highestLoadedMessageId = useMemo(
    () => Math.max(0, ...historyMessages.map((item) => item.id), ...liveMessages.map((item) => item.id)),
    [historyMessages, liveMessages],
  );
  const changesQuery = trpc.supportChat.myMessageChanges.useQuery(
    changeCursor ?? { afterMessageId: 0, changedAfter: new Date(0).toISOString() },
    {
      enabled: Boolean(isChatTab && isPageVisible && data?.conversation?.id && changeCursor),
      refetchInterval: isPageVisible ? 15_000 : false,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  );
  const currentConversation = changesQuery.data?.conversation ?? data?.conversation;
  const hasRequestedHuman = currentConversation?.needsHuman === true;
  const rawMessages = useMemo(() => {
    const merged = new Map<number, SupportMessage>();
    for (const item of historyMessages) merged.set(item.id, item);
    for (const item of liveMessages) merged.set(item.id, item);
    return Array.from(merged.values()).sort((left, right) => {
      const timeDifference = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      return timeDifference || right.id - left.id;
    });
  }, [historyMessages, liveMessages]);
  const messageMap = useMemo(() => new Map(rawMessages.map((item) => [item.id, item])), [rawMessages]);
  const messages = useMemo(() => [...rawMessages].reverse(), [rawMessages]);
  const latestMessageId = messages.at(-1)?.id;
  const messageNextCursor = olderMessagePages.length
    ? olderMessagePages.at(-1)?.nextCursor
    : data?.nextCursor;
  const hasOlderMessages = Boolean(messageNextCursor);

  const uploadMutation = trpc.supportChat.uploadAttachment.useMutation();
  const [uploading, setUploading] = useState(false);

  const editMessageMutation = trpc.supportChat.editMessage.useMutation({
    onSuccess: () => { setEditingMsgId(null); setEditContent(""); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMessageMutation = trpc.supportChat.deleteMessage.useMutation({
    onSuccess: () => { setActiveMenuMsgId(null); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.scrollTo({ top: container.scrollHeight, behavior });
    shouldStickToBottomRef.current = true;
    setHasUnseenMessages(false);
  };

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom <= 96;
    if (shouldStickToBottomRef.current) setHasUnseenMessages(false);
  };

  const fetchOlderMessages = async () => {
    if (!messageNextCursor || loadingOlderMessages) return;
    const container = messagesContainerRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    const previousTop = container?.scrollTop ?? 0;
    setLoadingOlderMessages(true);
    try {
      const page = await trpcUtils.client.supportChat.myMessageHistory.query({
        limit: 50,
        cursor: messageNextCursor,
      });
      setOlderMessagePages((current) => [...current, page]);
      window.requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = previousTop + container.scrollHeight - previousHeight;
        }
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (isRTL ? "تعذر تحميل الرسائل السابقة" : "Could not load previous messages"));
    } finally {
      setLoadingOlderMessages(false);
    }
  };

  const handleMobileBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }

    setLocation("/courses");
  };

  useEffect(() => {
    if (!isChatTab || !latestMessageId || !shouldStickToBottomRef.current) return;

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom("auto");
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isChatTab, latestMessageId]);

  useEffect(() => {
    if (!isChatTab || !sendMutation.isSuccess) return;

    const timer = window.setTimeout(() => {
      scrollToBottom();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [isChatTab, sendMutation.isSuccess]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextUrl = activeTab === "bugs" ? "/support?tab=bugs" : "/support";
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [activeTab]);

  useEffect(() => {
    const handleVisibility = () => setIsPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!data?.conversation?.id) return;
    setOlderMessagePages([]);
    setLiveMessages([]);
    setHasUnseenMessages(false);
    setChangeCursor({
      afterMessageId: Math.max(0, ...data.messages.map((item) => item.id)),
      changedAfter: data.checkedAt,
    });
  }, [data?.conversation?.id]);

  useEffect(() => {
    const result = changesQuery.data;
    if (!result || !changeCursor) return;
    const newMessages = result.messages.filter((item) => item.id > highestLoadedMessageId);
    if (newMessages.length > 0 && !shouldStickToBottomRef.current) {
      setHasUnseenMessages(true);
    }
    if (result.messages.length > 0) {
      setLiveMessages((current) => {
        const merged = new Map(current.map((item) => [item.id, item]));
        for (const item of result.messages) merged.set(item.id, item);
        return Array.from(merged.values());
      });
    }
    setChangeCursor((current) => current ? {
      ...current,
      afterMessageId: Math.max(current.afterMessageId, ...result.messages.map((item) => item.id), highestLoadedMessageId),
    } : current);
  }, [changesQuery.data]);

  const uploadFileToR2 = async (file: File | Blob, fileName: string, contentType: string, attachmentType: 'file' | 'voice' | 'video', attachmentDuration?: number) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    const result = await uploadMutation.mutateAsync({
      fileData: base64,
      fileName,
      contentType,
      attachmentType,
      attachmentDuration,
    });
    return result;
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed && !attachment) return;
    shouldStickToBottomRef.current = true;

    if (attachment && attachment.file) {
      // Upload file to R2 first, then send message
      setUploading(true);
      try {
        const uploaded = await uploadFileToR2(
          attachment.file,
          attachment.name,
          attachment.file.type || "application/octet-stream",
          attachment.kind === "video" ? "video" : "file",
          attachment.duration,
        );
        sendMutation.mutate({
          content: trimmed || `[${attachment.name}]`,
          replyToMessageId: replyToMessageId || undefined,
          attachmentUrl: uploaded.url,
          attachmentName: attachment.name,
          attachmentSize: uploaded.size,
          attachmentType: attachment.kind === "video" ? "video" : "file",
          attachmentDuration: attachment.kind === "video" ? attachment.duration : undefined,
        });
      } catch {
        toast.error(isRTL ? 'فشل رفع الملف' : 'File upload failed');
      } finally {
        setUploading(false);
      }
    } else {
      sendMutation.mutate({ content: trimmed, replyToMessageId: replyToMessageId || undefined });
    }
  };

  const handleVoiceRecording = async (blob: Blob, durationSec: number) => {
    shouldStickToBottomRef.current = true;
    setUploading(true);
    try {
      const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
      const fileName = `voice-${Date.now()}.${ext}`;
      const uploaded = await uploadFileToR2(blob, fileName, blob.type, 'voice');
      sendMutation.mutate({
        content: isRTL ? '🎙️ رسالة صوتية' : '🎙️ Voice message',
        replyToMessageId: replyToMessageId || undefined,
        attachmentUrl: uploaded.url,
        attachmentName: fileName,
        attachmentSize: uploaded.size,
        attachmentType: 'voice',
        attachmentDuration: durationSec,
      });
    } catch {
      toast.error(isRTL ? 'فشل رفع التسجيل الصوتي' : 'Voice upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const kind = getSupportMediaKind({ contentType: file.type, name: file.name });
    if (kind === "image" && file.size > MAX_SUPPORT_IMAGE_BYTES) {
      toast.error(isRTL ? 'حجم الصورة أكبر من 5 ميجابايت' : 'Image size exceeds 5MB');
      return;
    }
    if (kind === "video") {
      if (file.size > MAX_SUPPORT_VIDEO_BYTES) {
        toast.error(isRTL ? 'حجم الفيديو أكبر من 100 ميجابايت' : 'Video size exceeds 100MB');
        return;
      }
      try {
        const duration = await getVideoDuration(file);
        if (duration >= MAX_SUPPORT_VIDEO_SECONDS) {
          toast.error(isRTL ? 'يجب أن يكون الفيديو أقل من دقيقة واحدة' : 'Video must be shorter than one minute');
          return;
        }
        setAttachment({ name: file.name, file, size: file.size, kind, duration });
      } catch {
        toast.error(isRTL ? 'تعذر قراءة مدة الفيديو. جرّب ملف فيديو آخر.' : 'Could not read video length. Try another video file.');
      }
      return;
    }

    if (file.size > MAX_SUPPORT_FILE_BYTES) {
      toast.error(isRTL ? 'حجم الملف أكبر من 5 ميجابايت' : 'File size exceeds 5MB');
      return;
    }
    setAttachment({ name: file.name, file, size: file.size, kind });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group messages by date for date separators
  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    if (isSameDay(d, today)) return isRTL ? 'اليوم' : 'Today';
    if (isSameDay(d, yesterday)) return isRTL ? 'أمس' : 'Yesterday';
    return d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatReplyPreview = (target: typeof rawMessages[number] | undefined) => {
    if (!target) return isRTL ? 'رسالة غير متاحة' : 'Message unavailable';
    if ((target as any).deletedAt) return isRTL ? 'رسالة محذوفة' : 'Deleted message';
    if ((target as any).attachmentType === 'voice') return isRTL ? 'رسالة صوتية' : 'Voice message';
    if ((target as any).attachmentType === 'video') return isRTL ? 'فيديو قصير' : 'Short video';
    return target.content;
  };

  const copyMessage = async (content: string) => {
    const copied = await copyTextToClipboard(content);
    if (copied) {
      toast.success(isRTL ? 'تم نسخ الرسالة' : 'Message copied');
    } else {
      toast.error(isRTL ? 'تعذر نسخ الرسالة' : 'Failed to copy message');
    }
  };

  const startReply = (messageId: number) => {
    setReplyToMessageId(messageId);
    setActiveMenuMsgId(null);
  };

  const replyTarget = replyToMessageId ? messageMap.get(replyToMessageId) : undefined;

  return (
    <ClientLayout>
      <div className="container relative mx-auto flex h-[calc(100dvh-5rem)] min-h-[32rem] max-w-3xl flex-col overflow-hidden px-4 py-4 md:h-[calc(100dvh-6rem)] md:py-6" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="mb-4 shrink-0 border-b pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleMobileBack}
                className="h-10 w-10 shrink-0 rounded-full md:hidden"
                aria-label={isRTL ? "رجوع" : "Back"}
              >
                <ArrowLeft className={`h-5 w-5 ${isRTL ? "rotate-180" : ""}`} />
              </Button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-teal-500">
                {isChatTab ? <Headphones className="h-5 w-5 text-white" /> : <Bug className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h1 className="text-lg font-bold">{isChatTab ? t("support.title") : (isRTL ? "بلاغات الأخطاء" : "Bug Reports")}</h1>
                <div className="flex items-center gap-2">
                  {isChatTab ? (
                    <>
                      <span className={`inline-block h-2 w-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <p className="text-sm text-muted-foreground">
                        {isOnline
                          ? (isRTL ? 'فريق الدعم متاح الآن — والذكاء الاصطناعي يرد مباشرة حتى تطلب شخصاً حقيقياً' : 'Support team is online — AI replies instantly until you request a human')
                          : (isRTL ? 'فريق الدعم خارج ساعات العمل — والذكاء الاصطناعي يرد حتى يبدأ دوام الفريق' : 'Support team is offline — AI replies until working hours resume')}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {isRTL
                        ? 'أرسل وصفاً أو صورة للمشكلة، وتابع قرار الفريق وعدد النقاط المضافة.'
                        : 'Send a description or screenshot, then track the review result and awarded points.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
            {isChatTab && !hasRequestedHuman && messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto shrink-0 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => requestHumanMutation.mutate()}
                disabled={requestHumanMutation.isPending}
              >
                <UserRound className="h-4 w-4 mr-1" />
                {isRTL ? 'ما زلت بحاجة لموظف؟' : 'Still need a human?'}
              </Button>
            )}
          </div>

          <div className="mt-4 inline-flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("chat")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                isChatTab ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isRTL ? 'الدردشة' : 'Chat'}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bugs")}
              className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                !isChatTab ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {isRTL ? 'بلاغات الأخطاء' : 'Bug Reports'}
            </button>
          </div>
        </div>

        {!isChatTab ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <SupportBugReportsPanel />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* AI replies by default until the student explicitly requests a human */}
        {!hasRequestedHuman && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <Bot className="h-4 w-4 shrink-0" />
            <span>
              {isRTL
                ? 'المساعد الذكي يستطيع حل معظم أسئلة المنصة والاشتراكات مباشرة. يمكنك طلب موظف إذا لم تُحل المشكلة.'
                : 'Our AI assistant can resolve most platform and subscription questions immediately. You can request a human if the issue remains unresolved.'}
            </span>
          </div>
        )}
        {hasRequestedHuman && (
          <div className="flex flex-col gap-2 px-3 py-2 mb-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0" />
              <span>
                {isRTL
                  ? (isOnline
                      ? 'تم طلب وكيل بشري. سينضم أحد أعضاء فريق الدعم إلى المحادثة قريباً.'
                      : 'تم طلب وكيل بشري. سيتم الرد عليك خلال ساعات العمل (الأحد-الخميس ١٢-٨ مساءً).')
                  : (isOnline
                      ? 'Human agent requested. A support team member will join the chat soon.'
                      : 'Human agent requested. You\'ll get a reply during working hours (Sun-Thu 12-8 PM).')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => resumeAIMutation.mutate()}
              disabled={resumeAIMutation.isPending}
              className="self-start text-xs underline text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
            >
              {isRTL ? 'السماح للذكاء الاصطناعي بالرد' : 'Let AI respond'}
            </button>
          </div>
        )}

        {/* Messages area */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            className="h-full space-y-3 overflow-y-auto overscroll-contain px-1 pb-3"
          >
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
              <Headphones className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-lg font-medium">{t("support.empty")}</p>
              <p className="text-sm">{t("support.emptyHint")}</p>
            </div>
          ) : (
            <>
              {hasOlderMessages && (
                <div className={`flex py-2 ${messages.length === 0 ? "min-h-[180px] items-center justify-center" : "justify-center"}`}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchOlderMessages()}
                    disabled={loadingOlderMessages}
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    aria-label={isRTL ? 'عرض الرسائل السابقة' : 'Show previous messages'}
                  >
                    {loadingOlderMessages && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                    {isRTL ? 'تحميل الرسائل السابقة' : 'Load previous messages'}
                  </Button>
                </div>
              )}

              {messages.map((msg, idx) => {
              const isOwn = msg.senderType === "client";
              const isBot = msg.senderType === "bot";
              const isDeleted = !!(msg as any).deletedAt;
              const isEdited = !!(msg as any).editedAt;
              const replyTargetMessage = (msg as any).replyToMessageId ? messageMap.get((msg as any).replyToMessageId) : undefined;
              // Date separator logic
              const currentDate = new Date(msg.createdAt).toDateString();
              const prevDate = idx > 0 ? new Date(messages[idx - 1].createdAt).toDateString() : null;
              const showDateSeparator = idx === 0 || currentDate !== prevDate;
              const previousMessage = idx > 0 ? messages[idx - 1] : null;
              const showSenderLabel = !isOwn && (
                !isBot
                || !previousMessage
                || previousMessage.senderType !== msg.senderType
                || new Date(previousMessage.createdAt).toDateString() !== currentDate
              );
              const canCopy = !isDeleted && !!msg.content;
              const canReply = !isDeleted;
              const canOpenMenu = !isDeleted && (isOwn || canCopy || canReply);

              return (
                <div key={msg.id}>
                  {showDateSeparator && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400 font-medium px-2">{getDateLabel(msg.createdAt)}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}
                  <div
                    className={`group flex ${isOwn ? (isRTL ? "justify-start" : "justify-end") : (isRTL ? "justify-end" : "justify-start")}`}
                    onTouchStart={(event) => {
                      if ((event.target as HTMLElement).closest('[data-support-message-text]')) return;
                      if (!canOpenMenu) return;
                      longPressTimer.current = setTimeout(() => setActiveMenuMsgId(msg.id), 500);
                    }}
                    onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                    onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                  >
                  {/* Desktop hover actions — shown next to own messages */}
                  {canOpenMenu && (
                    <div className="hidden lg:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity me-1 self-center">
                      {canReply && (
                        <button
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          onClick={() => startReply(msg.id)}
                          title={isRTL ? 'رد' : 'Reply'}
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canCopy && (
                        <button
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                          onClick={() => void copyMessage(msg.content)}
                          title={isRTL ? 'نسخ' : 'Copy'}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isOwn && (
                      <button
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); setActiveMenuMsgId(null); }}
                        title={isRTL ? 'تعديل' : 'Edit'}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      )}
                      {isOwn && (
                      <button
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        onClick={() => { if (confirm(isRTL ? 'هل تريد حذف هذه الرسالة؟' : 'Delete this message?')) deleteMessageMutation.mutate({ messageId: msg.id }); }}
                        title={isRTL ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      )}
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isDeleted
                        ? "bg-gray-50 border border-dashed border-gray-200 text-gray-400 italic"
                        : isOwn
                        ? "bg-emerald-600 text-white rounded-br-md"
                        : isBot
                        ? "bg-amber-50 border border-amber-200 text-gray-900 rounded-bl-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    }`}
                  >
                    {isDeleted ? (
                      <p className="text-sm">{isRTL ? 'تم حذف هذه الرسالة' : 'This message was deleted'}</p>
                    ) : (
                      <>
                    {replyTargetMessage && (
                      <button
                        type="button"
                        onClick={() => startReply(replyTargetMessage.id)}
                        className={`mb-2 block w-full rounded-xl border px-3 py-2 text-start text-xs ${
                          isOwn ? 'border-white/15 bg-white/10 text-emerald-100' : 'border-emerald-200 bg-white/70 text-gray-500'
                        }`}
                      >
                        <span className="mb-1 block font-semibold">
                          {replyTargetMessage.senderType === 'client'
                            ? (isRTL ? 'أنت' : 'You')
                            : replyTargetMessage.senderType === 'bot'
                              ? (isRTL ? 'المساعد الذكي' : 'AI Assistant')
                            : replyTargetMessage.senderType === 'admin'
                                ? t("support.admin")
                                : t("support.agent")}
                        </span>
                        <span className="line-clamp-2 break-words">{formatReplyPreview(replyTargetMessage)}</span>
                      </button>
                    )}
                    {showSenderLabel && (
                      <p className={`text-xs font-semibold mb-1 ${isBot ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {isBot
                          ? (isRTL ? '🤖 المساعد الذكي' : '🤖 AI Assistant')
                          : msg.senderType === "admin" ? t("support.admin") : t("support.agent")}
                      </p>
                    )}
                    {editingMsgId === msg.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full text-sm border rounded-lg px-2 py-1.5 text-gray-900 resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          rows={2}
                          maxLength={5000}
                          autoFocus
                        />
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { setEditingMsgId(null); setEditContent(""); }}
                            className="p-1 rounded hover:bg-white/20 text-emerald-200"><X className="h-4 w-4" /></button>
                          <button
                            onClick={() => editMessageMutation.mutate({ messageId: msg.id, content: editContent.trim() })}
                            disabled={!editContent.trim() || editMessageMutation.isPending}
                            className="p-1 rounded hover:bg-white/20 text-emerald-200 disabled:opacity-50"
                          >
                            {editMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p
                        data-support-message-text
                        className="cursor-text select-text text-sm whitespace-pre-wrap break-words"
                        style={{ WebkitUserSelect: 'text', userSelect: 'text' }}
                      >
                        {msg.content}
                      </p>
                    )}
                    {msg.attachmentUrl && (msg as any).attachmentType === 'voice' ? (
                      <div className="mt-1">
                        <AudioPlayer src={msg.attachmentUrl} duration={(msg as any).attachmentDuration} isOwn={isOwn} />
                      </div>
                    ) : msg.attachmentUrl && ((msg as any).attachmentType === 'video' || getSupportMediaKind({ name: msg.attachmentName, url: msg.attachmentUrl }) === "video") ? (
                      <div className="mt-2 overflow-hidden rounded-xl border border-white/15 bg-black/5">
                        <video
                          src={msg.attachmentUrl}
                          controls
                          preload="metadata"
                          className="max-h-72 w-full bg-black object-contain"
                        />
                        <a
                          href={msg.attachmentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-1 px-2 py-1.5 text-xs underline ${isOwn ? 'text-emerald-100' : 'text-emerald-600'}`}
                        >
                          <Video className="h-3 w-3" /> {msg.attachmentName || (isRTL ? "فيديو" : "Video")}
                        </a>
                      </div>
                    ) : msg.attachmentUrl ? (
                      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 text-xs mt-1 underline ${isOwn ? 'text-emerald-200' : 'text-emerald-600'}`}>
                        <FileIcon className="w-3 h-3" /> {msg.attachmentName || 'Attachment'}
                      </a>
                    ) : null}
                    <div className={`flex items-center gap-1 mt-1 ${isOwn ? "text-emerald-200" : "text-gray-400"}`}>
                      {isEdited && <span className="text-[10px] italic">{isRTL ? 'معدّل' : 'edited'}</span>}
                      <p className="text-xs">
                        {(() => {
                          const d = new Date(msg.createdAt);
                          return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        })()}
                      </p>
                      {canCopy && (
                        <button
                          type="button"
                          className={`ms-auto inline-flex h-7 w-7 items-center justify-center rounded-md lg:hidden ${
                            isOwn ? 'text-emerald-100 hover:bg-white/15' : 'text-gray-500 hover:bg-gray-200'
                          }`}
                          onClick={() => void copyMessage(msg.content)}
                          aria-label={isRTL ? 'نسخ الرسالة' : 'Copy message'}
                          title={isRTL ? 'نسخ الرسالة' : 'Copy message'}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                      </>
                    )}
                  </div>

                  {/* Mobile long-press action menu */}
                  {activeMenuMsgId === msg.id && canOpenMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveMenuMsgId(null)} />
                      <div className="absolute z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[120px]"
                        style={{ marginTop: '-8px' }}>
                        {canReply && (
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={() => startReply(msg.id)}
                          >
                            <Reply className="h-3.5 w-3.5" /> {isRTL ? 'رد' : 'Reply'}
                          </button>
                        )}
                        {canCopy && (
                          <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                            onClick={() => { void copyMessage(msg.content); setActiveMenuMsgId(null); }}
                          >
                            <Copy className="h-3.5 w-3.5" /> {isRTL ? 'نسخ' : 'Copy'}
                          </button>
                        )}
                        {isOwn && (
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); setActiveMenuMsgId(null); }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> {isRTL ? 'تعديل' : 'Edit'}
                        </button>
                        )}
                        {isOwn && (
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          onClick={() => { if (confirm(isRTL ? 'هل تريد حذف هذه الرسالة؟' : 'Delete this message?')) deleteMessageMutation.mutate({ messageId: msg.id }); setActiveMenuMsgId(null); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> {isRTL ? 'حذف' : 'Delete'}
                        </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                </div>
              );
              })}
            </>
          )}
          </div>
          {hasUnseenMessages && (
            <Button
              type="button"
              size="sm"
              onClick={() => scrollToBottom()}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 px-4 shadow-lg hover:bg-emerald-700"
            >
              {isRTL ? 'رسائل جديدة' : 'New messages'}
            </Button>
          )}
        </div>

        {/* Input area */}
        <div className="max-h-[45dvh] shrink-0 overflow-y-auto border-t bg-white pt-3 shadow-[0_-8px_24px_-20px_rgba(15,23,42,0.45)]">
          <div className="pb-1" dir={isRTL ? "rtl" : "ltr"}>
          {replyTarget && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
              <Reply className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-emerald-700">
                  {isRTL ? 'الرد على' : 'Replying to'} {replyTarget.senderType === 'client'
                    ? (isRTL ? 'رسالتك' : 'your message')
                    : replyTarget.senderType === 'bot'
                      ? (isRTL ? 'المساعد الذكي' : 'AI Assistant')
                    : replyTarget.senderType === 'admin'
                        ? t("support.admin")
                        : t("support.agent")}
                </p>
                <p className="truncate text-xs text-emerald-800">{formatReplyPreview(replyTarget)}</p>
              </div>
              <button type="button" onClick={() => setReplyToMessageId(null)} className="text-emerald-600 hover:text-emerald-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {attachment && (
            <div className="flex items-center gap-2 mb-2 bg-emerald-50 rounded-lg px-3 py-2 text-sm">
              {attachment.kind === "video" ? <Video className="w-4 h-4 text-emerald-500" /> : <FileIcon className="w-4 h-4 text-emerald-500" />}
              <span className="min-w-0 flex-1 truncate">
                {attachment.name}
                <span className="ms-2 text-xs text-emerald-700">
                  {formatSupportFileSize(attachment.size)}
                  {attachment.kind === "video" && typeof attachment.duration === "number" ? ` · ${Math.round(attachment.duration)}s` : ""}
                </span>
              </span>
              <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
          )}
          <div className="mb-2 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <Video className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {isRTL
                ? 'يمكنك إرفاق صورة أو فيديو قصير، ويجب أن يكون الفيديو أقل من دقيقة واحدة.'
                : 'You can attach an image or short video. Videos must be under one minute.'}
            </span>
          </div>
          <div className="flex items-end gap-2">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt" />
            <Button variant="ghost" size="icon" className="rounded-xl h-[42px] w-[42px] shrink-0"
              onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <VoiceRecorder
              onRecordingComplete={handleVoiceRecording}
              disabled={uploading || sendMutation.isPending}
              isRTL={isRTL}
            />
            <div className="flex-1 relative">
              <textarea
                value={message}
                onChange={(e) => { if (e.target.value.length <= 5000) setMessage(e.target.value); }}
                onKeyDown={handleKeyDown}
                placeholder={t("support.placeholder")}
                maxLength={5000}
                rows={1}
                className="w-full resize-none border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-32"
                style={{ minHeight: "42px" }}
              />
              {message.length > 4500 && (
                <span className={`absolute bottom-0.5 ${isRTL ? 'left-2' : 'right-2'} text-[10px] tabular-nums ${
                  message.length >= 5000 ? 'text-red-500 font-semibold' : 'text-gray-400'
                }`}>
                  {message.length}/5000
                </span>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={sendMutation.isPending || uploading || (!message.trim() && !attachment)}
              size="icon"
              className="rounded-xl h-[42px] w-[42px] shrink-0"
            >
              {(sendMutation.isPending || uploading) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className={`h-4 w-4 ${isRTL ? "rotate-180" : ""}`} />
              )}
            </Button>
          </div>
          </div>
        </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
