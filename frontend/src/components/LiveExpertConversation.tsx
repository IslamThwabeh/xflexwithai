import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Send, X } from 'lucide-react';
import { trpc, type RouterOutputs } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { usePageVisible } from '@/hooks/usePageVisible';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LIVE_EXPERT_IMAGE_MAX_BYTES } from '@shared/liveExpert';
import { toast } from 'sonner';

type Message = RouterOutputs['liveExpert']['messages']['messages'][number];

function PrivateScreenshot({ id, fileName, onClose }: { id: string; fileName: string; onClose: () => void }) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const image = trpc.liveExpert.image.useQuery({ id }, { retry: false, gcTime: 0, refetchOnWindowFocus: false });
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto">
      <DialogHeader><DialogTitle>{fileName}</DialogTitle><DialogDescription>{isAr ? 'صورة خاصة بهذه المحادثة.' : 'A private screenshot from this conversation.'}</DialogDescription></DialogHeader>
      {image.isLoading ? <Loader2 className="animate-spin" /> : image.error ? <p role="alert">{image.error.message}</p> : image.data ? <img className="max-h-[70vh] w-full object-contain" src={`data:${image.data.contentType};base64,${image.data.data}`} alt={fileName} /> : null}
    </DialogContent>
  </Dialog>;
}

export default function LiveExpertConversation({ conversationId, viewer, title, onRead }: {
  conversationId: number; viewer: 'client' | 'staff'; title: string; onRead?: () => void;
}) {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const visible = usePageVisible();
  const utils = trpc.useUtils();
  const [messages, setMessages] = useState<Message[]>([]);
  const [beforeId, setBeforeId] = useState<number>();
  const [hasOlder, setHasOlder] = useState(false);
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<{ id: string; fileName: string } | null>(null);
  const [screenshot, setScreenshot] = useState<{ id: string; fileName: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastRead = useRef(0);
  const attempt = useRef<{ signature: string; nonce: string } | null>(null);
  const lastId = messages.at(-1)?.id ?? 0;
  const history = trpc.liveExpert.messages.useQuery({ conversationId, beforeId }, { retry: false, refetchOnWindowFocus: false });
  const changes = trpc.liveExpert.messages.useQuery({ conversationId, afterId: lastId }, {
    enabled: visible && history.isSuccess, retry: false,
    refetchInterval: visible ? 15000 : false, refetchIntervalInBackground: false,
  });
  const read = trpc.liveExpert.markRead.useMutation({ onSuccess: () => {
    void utils.liveExpert.myWorkspace.invalidate();
    void utils.liveExpert.inbox.invalidate();
    onRead?.();
  } });
  const merge = (rows: Message[]) => setMessages(current => {
    const merged = new Map(current.map(message => [message.id, message]));
    for (const message of rows) merged.set(message.id, message);
    return [...merged.values()].sort((a, b) => a.id - b.id);
  });
  useEffect(() => {
    if (!history.data) return;
    merge(history.data.messages);
    setHasOlder(history.data.hasMore);
  }, [history.data]);
  useEffect(() => { if (changes.data?.messages.length) merge(changes.data.messages); }, [changes.data]);
  useEffect(() => {
    if (stickToBottom.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lastId]);
  useEffect(() => {
    if (visible && lastId > lastRead.current && !read.isPending) {
      lastRead.current = lastId;
      read.mutate({ conversationId, throughId: lastId }, { onError: () => { lastRead.current = 0; } });
    }
  }, [visible, lastId, conversationId]);

  const upload = trpc.liveExpert.uploadImage.useMutation({ onSuccess: setAttachment, onError: error => toast.error(error.message) });
  const remove = trpc.liveExpert.deletePendingImage.useMutation({ onError: error => toast.error(error.message) });
  const send = trpc.liveExpert.send.useMutation({
    onSuccess: async () => {
      setText(''); setAttachment(null); attempt.current = null; stickToBottom.current = true;
      await changes.refetch();
      void utils.liveExpert.inbox.invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const canSend = changes.data?.canSend ?? history.data?.canSend ?? false;
  const busy = send.isPending || upload.isPending || remove.isPending;
  const pickImage = async (file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > LIVE_EXPERT_IMAGE_MAX_BYTES) {
      toast.error(isAr ? 'اختر صورة PNG أو JPEG أو WebP بحجم لا يتجاوز 2 ميغابايت.' : 'Choose a PNG, JPEG or WebP screenshot up to 2 MB.');
      return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Unable to read screenshot'));
        reader.readAsDataURL(file);
      });
      upload.mutate({ conversationId, data, contentType: file.type as 'image/png' | 'image/jpeg' | 'image/webp', fileName: file.name.slice(0, 180) });
    } catch { toast.error(isAr ? 'تعذرت قراءة الصورة.' : 'Unable to read screenshot.'); }
  };
  const submit = () => {
    const content = text.trim();
    if ((!content && !attachment) || busy || !canSend) return;
    const signature = JSON.stringify({ content, attachmentId: attachment?.id });
    if (attempt.current?.signature !== signature) attempt.current = { signature, nonce: crypto.randomUUID() };
    send.mutate({ conversationId, content, attachmentId: attachment?.id, nonce: attempt.current.nonce });
  };

  return <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-white text-slate-950 shadow-sm" dir={isAr ? 'rtl' : 'ltr'} aria-label={title}>
    <header className="border-b bg-emerald-50 p-4"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-600">{isAr ? 'محادثة خاصة بين العميل وخبيره، مع إمكانية مراجعتها من الإدارة.' : 'Private between the client and assigned expert, with admin oversight.'}</p></header>
    <div ref={scrollRef} onScroll={() => { const element = scrollRef.current; if (element) stickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80; }} className="h-[420px] overflow-y-auto p-4 md:h-[480px]" aria-label={isAr ? 'الرسائل' : 'Messages'}>
      {history.isLoading ? <p>{isAr ? 'جاري تحميل الرسائل…' : 'Loading messages…'}</p> : null}
      {history.error || changes.error ? <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"><p>{(history.error || changes.error)?.message}</p><Button variant="outline" onClick={() => { void history.refetch(); void changes.refetch(); }}>{isAr ? 'إعادة المحاولة' : 'Retry'}</Button></div> : null}
      {hasOlder ? <Button variant="outline" size="sm" className="mx-auto mb-4 block" disabled={history.isFetching} onClick={() => { stickToBottom.current = false; setBeforeId(messages[0]?.id); }}>{isAr ? 'تحميل رسائل أقدم' : 'Load older messages'}</Button> : null}
      {history.isSuccess && !messages.length ? <p className="py-12 text-center text-sm text-slate-500">{isAr ? 'ابدأ بسؤالك عن الدروس أو اللقاءات.' : 'Start with a question about your lessons or classes.'}</p> : null}
      <div className="space-y-4" role="log" aria-live="polite" aria-relevant="additions">
        {messages.map(message => {
          const outgoing = viewer === 'client' ? message.sender_role === 'client' : message.sender_role !== 'client';
          return <article key={message.id} className={`w-fit max-w-[90%] rounded-2xl p-3 ${outgoing ? 'ms-auto bg-emerald-100' : 'me-auto bg-slate-100'}`}>
            <p className="mb-1 text-xs font-semibold text-slate-600">{message.sender_name}{message.sender_role === 'admin' ? (isAr ? ' · الإدارة' : ' · Admin') : ''}</p>
            {message.content ? <p dir="auto" className="whitespace-pre-wrap break-words text-sm leading-6 [overflow-wrap:anywhere]">{message.content}</p> : null}
            {message.attachment_id ? <Button variant="outline" size="sm" className="mt-2 max-w-full" onClick={() => setScreenshot({ id: message.attachment_id!, fileName: message.file_name || 'Screenshot' })}><ImagePlus className="me-2 h-4 w-4 shrink-0" /><span className="truncate">{message.file_name || (isAr ? 'عرض الصورة' : 'View screenshot')}</span></Button> : null}
            <time className="mt-2 block text-[11px] text-slate-500" dateTime={message.created_at}>{new Intl.DateTimeFormat(isAr ? 'ar-JO' : 'en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Amman' }).format(new Date(message.created_at))}</time>
          </article>;
        })}
      </div>
    </div>
    <form className="space-y-3 border-t p-4" onSubmit={event => { event.preventDefault(); submit(); }}>
      {!canSend && history.isSuccess ? <p role="status" className="text-sm text-amber-800">{isAr ? 'الرسائل السابقة متاحة للقراءة. إرسال رسائل جديدة غير متاح حالياً.' : 'Previous messages remain readable. New messages are currently unavailable.'}</p> : null}
      {attachment ? <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2 text-sm"><span className="truncate">{attachment.fileName}</span><Button type="button" size="icon" variant="ghost" disabled={busy} aria-label={isAr ? 'إزالة الصورة' : 'Remove screenshot'} onClick={() => { remove.mutate({ id: attachment.id }, { onSuccess: () => setAttachment(null) }); }}><X className="h-4 w-4" /></Button></div> : null}
      <label className="sr-only" htmlFor={`expert-message-${conversationId}`}>{isAr ? 'رسالتك' : 'Your message'}</label>
      <Textarea id={`expert-message-${conversationId}`} value={text} onChange={event => setText(event.target.value)} disabled={!canSend || send.isPending} maxLength={5000} rows={3} placeholder={isAr ? 'اكتب سؤالك هنا…' : 'Write your question here…'} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label={isAr ? 'اختر صورة' : 'Choose screenshot'} disabled={!canSend || busy || !!attachment} onChange={event => { void pickImage(event.target.files?.[0]); event.target.value = ''; }} />
        <Button type="button" variant="outline" disabled={!canSend || busy || !!attachment} onClick={() => fileRef.current?.click()}><ImagePlus className="me-2 h-4 w-4" />{isAr ? 'صورة · حتى 2 MB' : 'Screenshot · up to 2 MB'}</Button>
        <Button type="submit" disabled={!canSend || busy || (!text.trim() && !attachment)}>{busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}{isAr ? 'إرسال' : 'Send'}</Button>
      </div>
    </form>
    {screenshot ? <PrivateScreenshot {...screenshot} onClose={() => setScreenshot(null)} /> : null}
  </section>;
}
