import ClientLayout from "@/components/ClientLayout";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Send, Headphones, Loader2, Paperclip, FileIcon, X } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import VoiceRecorder from "@/components/VoiceRecorder";
import AudioPlayer from "@/components/AudioPlayer";

export default function SupportChat() {
  const { t, isRTL } = useLanguage();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<{ name: string; file: File; size: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, refetch } = trpc.supportChat.myConversation.useQuery(undefined, {
    refetchInterval: 5000, // poll every 5s
  });

  const sendMutation = trpc.supportChat.send.useMutation({
    onSuccess: () => {
      setMessage("");
      setAttachment(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const uploadMutation = trpc.supportChat.uploadAttachment.useMutation();
  const [uploading, setUploading] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [data?.messages]);

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
      <div className="container mx-auto max-w-3xl px-4 py-6 h-[calc(100vh-80px)] flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
        {/* Header */}
        <div className="flex items-center gap-3 pb-4 border-b mb-4">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 flex items-center justify-center">
            <Headphones className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{t("support.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("support.subtitle")}</p>
          </div>
        </div>

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
                    className={`flex ${isOwn ? (isRTL ? "justify-start" : "justify-end") : (isRTL ? "justify-end" : "justify-start")}`}
                  >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isOwn
                        ? "bg-emerald-600 text-white rounded-br-md"
                        : "bg-gray-100 text-gray-900 rounded-bl-md"
                    }`}
                  >
                    {!isOwn && (
                      <p className="text-xs font-semibold mb-1 text-emerald-600">
                        {msg.senderType === "admin" ? t("support.admin") : t("support.agent")}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
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
                    <p
                      className={`text-xs mt-1 ${
                        isOwn ? "text-emerald-200" : "text-gray-400"
                      }`}
                    >
                      {(() => {
                        const d = new Date(msg.createdAt);
                        return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      })()}
                    </p>
                  </div>
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
    </ClientLayout>
  );
}
