import AdminClientProfileSheet from "@/components/admin/AdminClientProfileSheet";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import {
  Headphones,
  Send,
  Loader2,
  MessageCircle,
  Clock,
  User,
  XCircle,
  PlayCircle,
  Paperclip,
  FileIcon,
  X,
  Search,
  Sparkles,
  AlertTriangle,
  Bot,
  Pencil,
  Trash2,
  MoreVertical,
  Check,
} from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import VoiceRecorder from "@/components/VoiceRecorder";
import AudioPlayer from "@/components/AudioPlayer";
import { useLocation } from "wouter";

export default function AdminSupport() {
  const [, setLocation] = useLocation();
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; file: File; size: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const didHydrateConversationRef = useRef(false);
  const didSyncQueryRef = useRef(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [activeMenuMsgId, setActiveMenuMsgId] = useState<number | null>(null);
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const replaceSupportUrl = (conversationId: number | null) => {
    if (typeof window === "undefined") return;
    const nextUrl = conversationId ? `/admin/support?conversationId=${conversationId}` : "/admin/support";
    window.history.replaceState(window.history.state, "", nextUrl);
  };

  const clearSelectedConversation = () => {
    replaceSupportUrl(null);
    setSelectedConvId(null);
  };

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data: conversations,
    isLoading: loadingConvs,
    refetch: refetchConvs,
  } = trpc.supportChat.listAll.useQuery(
    debouncedSearch.length >= 2 ? { search: debouncedSearch } : undefined,
    { refetchInterval: 8000 }
  );

  // Client-side status filter + sort escalated to top
  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    let list = statusFilter === "all" ? [...conversations] : conversations.filter(c => c.status === statusFilter);
    // Escalated (needsHuman) conversations float to top
    list.sort((a: any, b: any) => {
      if (a.needsHuman && !b.needsHuman) return -1;
      if (!a.needsHuman && b.needsHuman) return 1;
      return 0; // preserve existing order (by updatedAt desc from backend)
    });
    return list;
  }, [conversations, statusFilter]);

  const selectedConversationSummary = useMemo(
    () => conversations?.find((conversation) => conversation.id === selectedConvId) ?? null,
    [conversations, selectedConvId],
  );

  useEffect(() => {
    if (didHydrateConversationRef.current || typeof window === "undefined" || !conversations) return;
    didHydrateConversationRef.current = true;

    const rawConversationId = new URLSearchParams(window.location.search).get("conversationId");
    if (!rawConversationId) return;

    const requestedConversationId = Number(rawConversationId);
    if (!Number.isFinite(requestedConversationId) || requestedConversationId <= 0) {
      replaceSupportUrl(null);
      return;
    }

    if (conversations.some((conversation) => conversation.id === requestedConversationId)) {
      setSelectedConvId(requestedConversationId);
      return;
    }

    replaceSupportUrl(null);
  }, [conversations]);

  useEffect(() => {
    if (!didSyncQueryRef.current) {
      didSyncQueryRef.current = true;
      return;
    }
    replaceSupportUrl(selectedConvId);
  }, [selectedConvId]);

  const {
    data: selectedData,
    isLoading: loadingMessages,
    refetch: refetchMessages,
  } = trpc.supportChat.getMessages.useQuery(
    { conversationId: selectedConvId! },
    { enabled: !!selectedConvId, refetchInterval: 5000 }
  );

  const replyMutation = trpc.supportChat.reply.useMutation({
    onSuccess: () => {
      setReply("");
      refetchMessages();
      refetchConvs();
    },
    onError: (err) => toast.error(err.message),
  });

  const closeMutation = trpc.supportChat.close.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم إغلاق المحادثة' : 'Conversation closed');
      clearSelectedConversation();
      refetchConvs();
    },
    onError: (err) => toast.error(err.message),
  });

  const reopenMutation = trpc.supportChat.reopen.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم إعادة فتح المحادثة' : 'Conversation reopened');
      refetchConvs();
      refetchMessages();
    },
    onError: (err) => toast.error(err.message),
  });

  const suggestReplyMutation = trpc.supportChat.suggestReply.useMutation({
    onSuccess: (data) => {
      setReply(data.suggestion);
      toast.success(isRtl ? 'تم توليد اقتراح الرد' : 'AI suggestion generated');
    },
    onError: (err) => toast.error(err.message),
  });

  const clearEscalationMutation = trpc.supportChat.clearEscalation.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تمت إزالة علامة التصعيد' : 'Escalation cleared');
      refetchConvs();
      refetchMessages();
    },
    onError: (err) => toast.error(err.message),
  });

  const editMessageMutation = trpc.supportChat.editMessage.useMutation({
    onSuccess: () => {
      setEditingMsgId(null);
      setEditContent("");
      refetchMessages();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMessageMutation = trpc.supportChat.deleteMessage.useMutation({
    onSuccess: () => {
      setActiveMenuMsgId(null);
      refetchMessages();
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadMutation = trpc.supportChat.uploadAttachment.useMutation();
  const selectedConversationUserId = selectedData?.conversation?.userId ?? selectedConversationSummary?.userId ?? null;

  const uploadFileToR2 = async (file: File | Blob, fileName: string, contentType: string, attachmentType: 'file' | 'voice') => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);
    return uploadMutation.mutateAsync({ fileData: base64, fileName, contentType, attachmentType });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large (max 5MB)"); return; }
    setAttachment({ name: file.name, file, size: file.size });
    e.target.value = '';
  };

  const scrollToBottom = () => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    if (!selectedConvId || !selectedData?.messages?.length) return;
    scrollToBottom();
  }, [selectedConvId, selectedData?.messages]);

  const { t, language } = useLanguage();
  const isRtl = language === 'ar';

  // Date separator helper for grouping chat messages by day
  const getDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return isRtl ? 'اليوم' : 'Today';
    if (sameDay(d, yesterday)) return isRtl ? 'أمس' : 'Yesterday';
    return d.toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const handleSendReply = async () => {
    const trimmed = reply.trim();
    if ((!trimmed && !attachment) || !selectedConvId) return;
    try {
      setUploading(true);
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;
      if (attachment) {
        const uploaded = await uploadFileToR2(attachment.file, attachment.name, attachment.file.type || 'application/octet-stream', 'file');
        attachmentUrl = uploaded.url;
        attachmentName = attachment.name;
      }
      replyMutation.mutate({
        conversationId: selectedConvId,
        content: trimmed || (attachment ? `📎 ${attachment.name}` : ''),
        attachmentUrl,
        attachmentName,
        attachmentType: attachment ? 'file' : undefined,
      });
      setAttachment(null);
    } catch {
      toast.error("Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleVoiceRecording = async (blob: Blob, durationSec: number) => {
    if (!selectedConvId) return;
    try {
      setUploading(true);
      const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
      const uploaded = await uploadFileToR2(blob, `voice-note.${ext}`, blob.type, 'voice');
      replyMutation.mutate({
        conversationId: selectedConvId,
        content: '🎤 Voice note',
        attachmentUrl: uploaded.url,
        attachmentName: `voice-note.${ext}`,
        attachmentType: 'voice',
        attachmentDuration: Math.round(durationSec),
      });
    } catch {
      toast.error("Failed to upload voice note");
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const totalOpen = (conversations ?? []).filter((c) => c.status === "open").length;
  const totalUnread = (conversations ?? []).reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
  const totalEscalated = (conversations ?? []).filter((c: any) => c.needsHuman).length;
  const displayedCount = filteredConversations.length;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Headphones className="h-6 w-6" /> {t('admin.support.title')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.support.subtitle')}
          </p>
        </div>

        {/* Summary cards — clickable to filter */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            onClick={() => setStatusFilter("open")}
            className={`rounded-lg border px-3 py-2 text-center transition hover:shadow-sm ${statusFilter === "open" ? "ring-2 ring-inset ring-emerald-400 bg-emerald-50" : "bg-white"}`}
          >
            <p className="text-lg font-bold">{totalOpen}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{t('admin.support.openConvos')}</p>
          </button>
          <button
            onClick={() => { setStatusFilter("all"); /* unread has no direct filter — show all */ }}
            className={`rounded-lg border px-3 py-2 text-center transition hover:shadow-sm bg-white`}
          >
            <p className={`text-lg font-bold ${totalUnread > 0 ? 'text-red-600' : ''}`}>{totalUnread}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{t('admin.support.unread')}</p>
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg border px-3 py-2 text-center transition hover:shadow-sm ${totalEscalated > 0 ? "border-amber-300 bg-amber-50" : "bg-white"}`}
          >
            <p className={`text-lg font-bold ${totalEscalated > 0 ? 'text-amber-600' : ''}`}>{totalEscalated}</p>
            <p className="text-[11px] text-muted-foreground leading-tight flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {isRtl ? 'طلب وكيل بشري' : 'Escalated'}
            </p>
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg border px-3 py-2 text-center transition hover:shadow-sm ${statusFilter === "all" ? "ring-2 ring-inset ring-emerald-400 bg-emerald-50" : "bg-white"}`}
          >
            <p className="text-lg font-bold">{(conversations ?? []).length}</p>
            <p className="text-[11px] text-muted-foreground leading-tight">{t('admin.support.totalConvos')}</p>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Conversation list — hidden on mobile when a conversation is selected */}
          <Card className={`lg:col-span-1 ${selectedConvId ? 'hidden lg:block' : ''}`}>
            <CardHeader className="pb-3 space-y-3">
              <CardTitle className="text-lg">{t('admin.support.convos')}</CardTitle>
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isRtl ? 'البحث بالاسم أو البريد أو الرسالة...' : 'Search by name, email, or message...'}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
                {searchInput && (
                  <button
                    onClick={() => setSearchInput("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {/* Status filter */}
              <div className="flex gap-1">
                {(["all", "open", "closed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1 text-xs rounded-full transition ${
                      statusFilter === s
                        ? "bg-emerald-100 text-emerald-700 font-medium"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s === "all" ? (isRtl ? 'الكل' : 'All') : s === "open" ? (isRtl ? 'مفتوح' : 'Open') : (isRtl ? 'مغلق' : 'Closed')}
                    {s === "all" && ` (${(conversations ?? []).length})`}
                    {s === "open" && ` (${totalOpen})`}
                    {s === "closed" && ` (${(conversations ?? []).length - totalOpen})`}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingConvs ? (
                <p className="text-center text-muted-foreground py-8">{t('admin.loading')}</p>
              ) : filteredConversations.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {debouncedSearch.length >= 2 ? (
                    <div>
                      <Search className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">{isRtl ? `لا توجد محادثات تطابق "${debouncedSearch}"` : `No conversations match "${debouncedSearch}"`}</p>
                    </div>
                  ) : (
                    <p>{t('admin.support.noConvos')}</p>
                  )}
                </div>
              ) : (
                <div className="divide-y max-h-[600px] overflow-y-auto">
                  {filteredConversations.map((conv) => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedConvId(conv.id)}
                      className={`w-full text-left p-3 hover:bg-gray-50 transition ${
                        selectedConvId === conv.id ? "bg-emerald-50 border-r-2 border-emerald-600" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-amber-500 flex items-center justify-center text-white text-xs font-semibold">
                            {(conv.userName ?? conv.userEmail ?? "?").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[140px]">
                              {conv.userName || conv.userEmail}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[140px]">
                              {conv.userEmail}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(conv as any).needsHuman && (
                            <Badge className="bg-amber-500 text-white text-xs animate-pulse">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />
                              {isRtl ? 'بحاجة رد بشري' : 'Needs Human'}
                            </Badge>
                          )}
                          {conv.status === "open" ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
                              {t('admin.support.open')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              {t('admin.support.closed')}
                            </Badge>
                          )}
                          {(conv.unreadCount ?? 0) > 0 && (
                            <Badge className="bg-red-500 text-white text-xs min-w-[20px] justify-center">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {conv.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {conv.lastMessage.senderType === "client" ? (isRtl ? 'العميل: ' : 'Client: ')
                            : conv.lastMessage.senderType === "bot" ? (isRtl ? '🤖 الذكاء: ' : '🤖 AI: ')
                            : (isRtl ? 'أنت: ' : 'You: ')}
                          {conv.lastMessage.content}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(conv.updatedAt).toLocaleString(isRtl ? 'ar-EG' : 'en-US')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message view — full width on mobile when conversation selected */}
          <Card className={`lg:col-span-2 flex flex-col ${!selectedConvId ? 'hidden lg:flex' : ''}`} style={{ minHeight: "600px" }}>
            {!selectedConvId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>{t('admin.support.selectConvo')}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Conversation header */}
                <CardHeader className="pb-2 border-b px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-8 w-8"
                      type="button"
                      onClick={clearSelectedConversation}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <p className="font-medium text-sm flex-1 min-w-0">
                      {conversations?.find((c) => c.id === selectedConvId)?.userName ??
                        conversations?.find((c) => c.id === selectedConvId)?.userEmail}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5 ps-10">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => selectedConversationUserId && setProfileUserId(selectedConversationUserId)}
                      disabled={!selectedConversationUserId}
                    >
                      <User className="h-3 w-3 me-1" />
                      {isRtl ? 'ملف العميل' : 'Profile'}
                    </Button>
                    {(selectedData?.conversation as any)?.needsHuman && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2 text-amber-600 border-amber-300"
                        onClick={() => clearEscalationMutation.mutate({ conversationId: selectedConvId! })}
                        disabled={clearEscalationMutation.isPending}
                      >
                        <AlertTriangle className="h-3 w-3 me-1" />
                        {isRtl ? 'إزالة' : 'Clear'}
                      </Button>
                    )}
                    {selectedData?.conversation?.status === "open" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => closeMutation.mutate({ conversationId: selectedConvId! })}
                        disabled={closeMutation.isPending}
                      >
                        <Check className="h-3 w-3 me-1" /> {isRtl ? 'تم الحل' : 'Resolved'}
                      </Button>
                    ) : selectedData?.conversation?.status === "closed" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2 text-green-600"
                        onClick={() => reopenMutation.mutate({ conversationId: selectedConvId! })}
                        disabled={reopenMutation.isPending}
                      >
                        <PlayCircle className="h-3 w-3 me-1" />
                        {t('admin.support.reopen') || 'Reopen'}
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>

                {/* Messages */}
                <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    (selectedData?.messages ?? []).map((msg, idx, arr) => {
                      const isClient = msg.senderType === "client";
                      const isBot = msg.senderType === "bot";
                      const isDeleted = !!(msg as any).deletedAt;
                      const isEdited = !!(msg as any).editedAt;
                      const canEdit = !isClient && !isBot && !isDeleted;
                      const canDelete = !isClient && !isBot && !isDeleted;
                      // Date separator logic
                      const currentDate = new Date(msg.createdAt).toDateString();
                      const prevDate = idx > 0 ? new Date(arr[idx - 1].createdAt).toDateString() : null;
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
                          className={`group flex ${isClient ? "justify-start" : isBot ? "justify-start" : "justify-end"}`}
                          style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
                          onTouchStart={() => {
                            if (!canEdit && !canDelete) return;
                            longPressTimer.current = setTimeout(() => setActiveMenuMsgId(msg.id), 500);
                          }}
                          onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                          onTouchMove={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
                        >
                          {/* Desktop hover actions — left side for own messages */}
                          {!isClient && !isBot && (canEdit || canDelete) && !isDeleted && (
                            <div className="hidden lg:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity me-1 self-center">
                              <button
                                className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                                onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); setActiveMenuMsgId(null); }}
                                title={isRtl ? 'تعديل' : 'Edit'}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                                onClick={() => { if (confirm(isRtl ? 'هل تريد حذف هذه الرسالة؟' : 'Delete this message?')) deleteMessageMutation.mutate({ messageId: msg.id }); }}
                                title={isRtl ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 relative ${
                              isDeleted
                                ? "bg-gray-50 border border-dashed border-gray-200 text-gray-400 italic"
                                : isClient
                                ? "bg-gray-100 text-gray-900 rounded-bl-md"
                                : isBot
                                ? "bg-amber-50 border border-amber-200 text-gray-900 rounded-bl-md"
                                : "bg-emerald-600 text-white rounded-br-md"
                            }`}
                          >
                            {isDeleted ? (
                              <p className="text-sm">{isRtl ? 'تم حذف هذه الرسالة' : 'This message was deleted'}</p>
                            ) : (
                              <>
                            {(isBot || !isClient) && (
                              <p
                                className={`text-xs font-semibold mb-1 ${
                                  isBot ? "text-amber-600" : isClient ? "text-emerald-600" : "text-emerald-200"
                                }`}
                              >
                                {isBot
                                  ? (isRtl ? '🤖 المساعد الذكي' : '🤖 AI Assistant')
                                  : msg.senderType === "admin" ? t('admin.support.admin') : t('admin.support.support')}
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
                                  <button
                                    onClick={() => { setEditingMsgId(null); setEditContent(""); }}
                                    className="p-1 rounded hover:bg-white/20 text-emerald-200"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
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
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {msg.content}
                              </p>
                            )}
                            {msg.attachmentUrl && (msg as any).attachmentType === 'voice' ? (
                              <div className="mt-1">
                                <AudioPlayer src={msg.attachmentUrl} duration={(msg as any).attachmentDuration} isOwn={!isClient} />
                              </div>
                            ) : msg.attachmentUrl && msg.attachmentUrl.startsWith('http') ? (
                              <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 text-xs mt-1 underline ${isClient ? 'text-emerald-600' : 'text-emerald-200'}`}>
                                <FileIcon className="w-3 h-3" />
                                {(msg.attachmentName && msg.attachmentName !== 'attachment_name') ? msg.attachmentName : 'Attachment'}
                              </a>
                            ) : null}
                            <div className={`flex items-center gap-1 mt-1 ${isClient ? "text-gray-400" : "text-emerald-200"}`}>
                              {isEdited && <span className="text-[10px] italic">{isRtl ? 'معدّل' : 'edited'}</span>}
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
                          {activeMenuMsgId === msg.id && (canEdit || canDelete) && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setActiveMenuMsgId(null)} />
                              <div className="absolute z-50 bg-white border rounded-lg shadow-lg py-1 min-w-[120px]"
                                style={{ marginTop: '-8px' }}>
                                {canEdit && (
                                  <button
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
                                    onClick={() => { setEditingMsgId(msg.id); setEditContent(msg.content); setActiveMenuMsgId(null); }}
                                  >
                                    <Pencil className="h-3.5 w-3.5" /> {isRtl ? 'تعديل' : 'Edit'}
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                    onClick={() => { if (confirm(isRtl ? 'هل تريد حذف هذه الرسالة؟' : 'Delete this message?')) deleteMessageMutation.mutate({ messageId: msg.id }); setActiveMenuMsgId(null); }}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" /> {isRtl ? 'حذف' : 'Delete'}
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </CardContent>

                {/* Reply input */}
                {selectedData?.conversation?.status === "open" && (
                  <div className="border-t p-3">
                    {attachment && (
                      <div className="flex items-center gap-2 mb-2 bg-emerald-50 rounded-lg px-3 py-2 text-sm">
                        <FileIcon className="w-4 h-4 text-emerald-500" />
                        <span className="truncate flex-1">{attachment.name}</span>
                        <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
                      </div>
                    )}
                    {/* Action buttons row */}
                    <div className="flex items-center gap-1 mb-2">
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect}
                        accept="image/*,.pdf,.doc,.docx,.txt" />
                      <Button variant="ghost" size="icon" className="rounded-lg h-8 w-8 shrink-0"
                        onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-lg h-8 w-8 shrink-0 text-amber-500 hover:text-amber-600 hover:bg-amber-50"
                        onClick={() => suggestReplyMutation.mutate({ conversationId: selectedConvId! })}
                        disabled={suggestReplyMutation.isPending}
                        title={isRtl ? 'اقتراح رد بالذكاء الاصطناعي' : 'AI Suggest Reply'}
                      >
                        {suggestReplyMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                      <VoiceRecorder
                        onRecordingComplete={handleVoiceRecording}
                        disabled={uploading || replyMutation.isPending}
                      />
                    </div>
                    {/* Textarea + send row */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1 relative">
                        <textarea
                          value={reply}
                          onChange={(e) => { if (e.target.value.length <= 5000) setReply(e.target.value); }}
                          onKeyDown={handleKeyDown}
                          placeholder={t('admin.support.replyPlaceholder')}
                          maxLength={5000}
                          rows={2}
                          className="w-full resize-none border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 max-h-32"
                          style={{ minHeight: "60px" }}
                        />
                        {reply.length > 4500 && (
                          <span className={`absolute bottom-0.5 right-2 text-[10px] tabular-nums ${
                            reply.length >= 5000 ? 'text-red-500 font-semibold' : 'text-gray-400'
                          }`}>
                            {reply.length}/5000
                          </span>
                        )}
                      </div>
                      <Button
                        onClick={handleSendReply}
                        disabled={replyMutation.isPending || uploading || (!reply.trim() && !attachment)}
                        size="icon"
                        className="rounded-xl h-[42px] w-[42px] shrink-0"
                      >
                        {(replyMutation.isPending || uploading) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
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
          setLocation(caseId ? `/admin/lexai?caseId=${caseId}` : "/admin/lexai");
        }}
        onOpenSupport={(conversationId) => {
          setProfileUserId(null);
          if (conversationId) {
            setSelectedConvId(conversationId);
            replaceSupportUrl(conversationId);
            return;
          }
          replaceSupportUrl(selectedConvId);
        }}
      />
    </DashboardLayout>
  );
}
