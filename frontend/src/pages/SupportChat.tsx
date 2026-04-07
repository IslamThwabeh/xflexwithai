import ClientLayout from "@/components/ClientLayout";
import SupportBugReportsPanel from "@/components/SupportBugReportsPanel";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Send, Headphones, Loader2, Paperclip, FileIcon, X, Bot, UserRound, Pencil, Trash2, Check, Bug } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import VoiceRecorder from "@/components/VoiceRecorder";
import AudioPlayer from "@/components/AudioPlayer";

function getRequestedSupportTab() {
  if (typeof window === "undefined") return "chat" as const;
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab === "bugs" ? ("bugs" as const) : ("chat" as const);
}

export default function SupportChat() {
  const { t, isRTL } = useLanguage();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; file: File; size: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "bugs">(() => getRequestedSupportTab());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<number | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isChatTab = activeTab === "chat";

  const { data, isLoading, refetch } = trpc.supportChat.myConversation.useQuery(undefined, {
    enabled: isChatTab,
    refetchInterval: isChatTab ? 5000 : false,
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
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const requestHumanMutation = trpc.supportChat.requestHuman.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? 'تم طلب وكيل بشري — سيتم الرد خلال ساعات العمل' : 'Human agent requested — you\'ll get a reply during working hours');
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const hasRequestedHuman = data?.conversation?.needsHuman === true;

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isChatTab) scrollToBottom();
  }, [data?.messages, isChatTab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextUrl = activeTab === "bugs" ? "/support?tab=bugs" : "/support";
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [activeTab]);

  const uploadFileToR2 = async (file: File | Blob, fileName: string, contentType: string, attachmentType: 'file' | 'voice') => {
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
    });
    return result;
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed && !attachment) return;

    if (attachment && attachment.file) {
      // Upload file to R2 first, then send message
      setUploading(true);
      try {
        const uploaded = await uploadFileToR2(attachment.file, attachment.name, attachment.file.type, 'file');
        sendMutation.mutate({
          content: trimmed || `[${attachment.name}]`,
          attachmentUrl: uploaded.url,
          attachmentName: attachment.name,
          attachmentSize: uploaded.size,
          attachmentType: 'file',
        });
      } catch {
        toast.error(isRTL ? 'فشل رفع الملف' : 'File upload failed');
      } finally {
        setUploading(false);
      }
    } else {
      sendMutation.mutate({ content: trimmed });
    }
  };

  const handleVoiceRecording = async (blob: Blob, durationSec: number) => {
    setUploading(true);
    try {
      const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
      const fileName = `voice-${Date.now()}.${ext}`;
      const uploaded = await uploadFileToR2(blob, fileName, blob.type, 'voice');
      sendMutation.mutate({
        content: isRTL ? '🎙️ رسالة صوتية' : '🎙️ Voice message',
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? 'حجم الملف أكبر من 5 ميجابايت' : 'File size exceeds 5MB');
      return;
    }
    setAttachment({ name: file.name, file, size: file.size });
    e.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages = data?.messages ?? [];

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

  return (
    <ClientLayout>
      <div className="container mx-auto max-w-3xl px-4 py-6" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="mb-4 border-b pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
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
                          ? (isRTL ? 'فريق الدعم متاح الآن' : 'Support team is online')
                          : (isRTL ? 'خارج ساعات العمل — المساعد الذكي يجيبك' : 'Outside working hours — AI assistant is here')}
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
            {isChatTab && !isOnline && !hasRequestedHuman && messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 text-amber-600 border-amber-300 hover:bg-amber-50"
                onClick={() => requestHumanMutation.mutate()}
                disabled={requestHumanMutation.isPending}
              >
                <UserRound className="h-4 w-4 mr-1" />
                {isRTL ? 'طلب وكيل بشري' : 'Request Human'}
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
          <SupportBugReportsPanel />
        ) : (
          <div className="flex min-h-[65vh] flex-col">
        {/* AI disclaimer banner outside working hours */}
        {!isOnline && !hasRequestedHuman && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <Bot className="h-4 w-4 shrink-0" />
            <span>
              {isRTL
                ? 'أنت تتحدث مع المساعد الذكي. للتحدث مع شخص حقيقي، اضغط "طلب وكيل بشري".'
                : 'You\'re chatting with our AI assistant. To speak with a human, tap "Request Human".'}
            </span>
          </div>
        )}
        {hasRequestedHuman && !isOnline && (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            <UserRound className="h-4 w-4 shrink-0" />
            <span>
              {isRTL
                ? 'تم طلب وكيل بشري. سيتم الرد عليك خلال ساعات العمل (الأحد-الخميس ١٢-٨ مساءً).'
                : 'Human agent requested. You\'ll get a reply during working hours (Sun-Thu 12-8 PM).'}
            </span>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-2">
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
            messages.map((msg, idx) => {
              const isOwn = msg.senderType === "client";
              const isBot = msg.senderType === "bot";
              const isDeleted = !!(msg as any).deletedAt;
              const isEdited = !!(msg as any).editedAt;
              // Date separator logic
              const currentDate = new Date(msg.createdAt).toDateString();
              const prevDate = idx > 0 ? new Date(messages[idx - 1].createdAt).toDateString() : null;
              const showDateSeparator = idx === 0 || currentDate !== prevDate;

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
                    style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
                    onTouchStart={() => {
                      if (!isOwn || isDeleted) return;
                      longPressTimer.current = setTimeout(() => setActiveMenuMsgId(msg.id), 500);
                    }}
                    onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                    onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                  >
                  {/* Desktop hover actions — shown next to own messages */}
                  {isOwn && !isDeleted && (
                    <div className="hidden lg:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity me-1 self-center">
                      <button
                        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                        onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); setActiveMenuMsgId(null); }}
                        title={isRTL ? 'تعديل' : 'Edit'}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        onClick={() => { if (confirm(isRTL ? 'هل تريد حذف هذه الرسالة؟' : 'Delete this message?')) deleteMessageMutation.mutate({ messageId: msg.id }); }}
                        title={isRTL ? 'حذف' : 'Delete'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
                    {!isOwn && (
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
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    )}
                    {msg.attachmentUrl && (msg as any).attachmentType === 'voice' ? (
                      <div className="mt-1">
                        <AudioPlayer src={msg.attachmentUrl} duration={(msg as any).attachmentDuration} isOwn={isOwn} />
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
                    </div>
                      </>
                    )}
                  </div>

                  {/* Mobile long-press action menu */}
                  {activeMenuMsgId === msg.id && isOwn && !isDeleted && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setActiveMenuMsgId(null)} />
                      <div className="absolute z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[120px]"
                        style={{ marginTop: '-8px' }}>
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); setActiveMenuMsgId(null); }}
                        >
                          <Pencil className="h-3.5 w-3.5" /> {isRTL ? 'تعديل' : 'Edit'}
                        </button>
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          onClick={() => { if (confirm(isRTL ? 'هل تريد حذف هذه الرسالة؟' : 'Delete this message?')) deleteMessageMutation.mutate({ messageId: msg.id }); setActiveMenuMsgId(null); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> {isRTL ? 'حذف' : 'Delete'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t pt-3">
          {attachment && (
            <div className="flex items-center gap-2 mb-2 bg-emerald-50 rounded-lg px-3 py-2 text-sm">
              <FileIcon className="w-4 h-4 text-emerald-500" />
              <span className="truncate flex-1">{attachment.name}</span>
              <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.txt" />
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
        )}
      </div>
    </ClientLayout>
  );
}
