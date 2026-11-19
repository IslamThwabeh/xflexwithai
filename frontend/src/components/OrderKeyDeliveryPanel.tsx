import { Copy, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { ACADEMY_TIME_LABEL_AR, ACADEMY_TIME_LABEL_EN, formatAcademyDateTime } from '@shared/academyLocale';

const labels: Record<string, { ar: string; en: string }> = {
  pending: { ar: 'الرسالة في قائمة الإرسال', en: 'Email queued' },
  processing: { ar: 'جارٍ إرسال الرسالة', en: 'Sending email' },
  sent: { ar: 'تم الإرسال إلى مزوّد البريد', en: 'Sent to email provider' },
  failed: { ar: 'تعذر الإرسال — ستتم إعادة المحاولة تلقائياً', en: 'Send failed — automatic retry scheduled' },
  dead_letter: { ar: 'توقفت المحاولات — يلزم التدخل', en: 'Retries exhausted — needs attention' },
  skipped_suppressed: { ar: 'لم تُرسل الرسالة — يلزم مراجعة المستلم والمفتاح', en: 'Email not sent — review recipient and key' },
  skipped_unsubscribed: { ar: 'لم تُرسل الرسالة — يلزم المراجعة', en: 'Email not sent — needs review' },
};

/** Mounted only for an expanded order and authorized operational staff. No polling. */
export default function OrderKeyDeliveryPanel({ orderId }: { orderId: number }) {
  const { language } = useLanguage();
  const utils = trpc.useUtils();
  const details = trpc.orders.adminKeyDelivery.useQuery({ orderId }, {
    retry: false, staleTime: 0, gcTime: 0,
    refetchOnWindowFocus: false, refetchOnReconnect: false,
  });
  const resend = trpc.orders.adminResendKey.useMutation({
    onSuccess: data => {
      utils.orders.adminKeyDelivery.setData({ orderId }, data);
      if (data.delivery?.status === 'sent') toast.success(language === 'ar' ? 'تم إرسال المفتاح إلى مزوّد البريد' : 'Key email sent to provider');
      else toast.info(language === 'ar' ? 'تم تحديث حالة إرسال المفتاح' : 'Key email delivery status updated');
    },
    onError: () => {
      toast.error(language === 'ar' ? 'تعذر إعادة الإرسال. حدّث الحالة وتأكد من أن المفتاح صالح ولم تتم محاولة إرساله خلال الدقيقة الأخيرة.' : 'Could not resend. Refresh status and check that the key is valid and was not attempted within the last minute.');
      void details.refetch();
    },
  });
  const recovery = trpc.orders.adminRecoverKeyDelivery.useMutation({
    onSuccess: data => {
      utils.orders.adminKeyDelivery.setData({ orderId }, data);
      if (data.diagnostics?.job?.status === 'completed') toast.success(language === 'ar' ? 'تم تحديث تسليم المفتاح' : 'Key delivery updated');
      else toast.warning(language === 'ar' ? 'التسليم يحتاج متابعة. راجع حالة كل قناة أدناه.' : 'Delivery needs attention. Check each channel below.');
    },
    onError: () => toast.error(language === 'ar' ? 'تعذر استعادة التسليم. حدّث الحالة وأعد المحاولة.' : 'Could not recover delivery. Refresh status and try again.'),
  });
  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success(language === 'ar' ? 'تم نسخ المفتاح' : 'Key copied');
    } catch { toast.error(language === 'ar' ? 'تعذر النسخ. حدّد المفتاح وانسخه يدوياً.' : 'Could not copy. Select the key and copy it manually.'); }
  };
  const data = details.data;
  const status = data?.delivery?.status;
  const job = data?.diagnostics?.job;
  const providerEvent = data?.diagnostics?.email;
  const busy = resend.isPending || recovery.isPending || details.isFetching;
  const needsAttention = !data?.delivery || ['failed', 'dead_letter', 'skipped_suppressed', 'skipped_unsubscribed'].includes(status ?? '');
  return <section className="mb-4 min-w-0 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3" aria-label={language === 'ar' ? 'المفتاح وحالة الإرسال' : 'Key and delivery status'}>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">{language === 'ar' ? 'المفتاح وحالة الإرسال' : 'Key and delivery status'}</h3>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => void details.refetch()}>
        <RefreshCw className="me-1 h-3.5 w-3.5" />{language === 'ar' ? 'تحديث الحالة' : 'Refresh status'}
      </Button>
    </div>
    {details.isLoading && <p role="status">{language === 'ar' ? 'جارٍ تحميل المفتاح...' : 'Loading key...'}</p>}
    {details.isError && <p role="alert" className="text-sm text-amber-900">{language === 'ar' ? 'تعذر تحميل حالة الإرسال. أعد المحاولة.' : 'Could not load delivery status. Please retry.'}</p>}
    {data && <>
      <p className="mb-2 break-all text-sm">{language === 'ar' ? 'المستلم: ' : 'Recipient: '}<bdi>{data.recipientEmail}</bdi></p>
      {data.keys.map(key => <div key={key.id} className="mb-2 flex min-w-0 flex-col items-stretch gap-2 rounded border bg-white p-2 sm:flex-row sm:items-center">
        <code dir="ltr" className="min-w-0 w-full select-all break-all text-left font-mono text-sm font-semibold sm:flex-1">{key.keyCode}</code>
        <Button className="shrink-0 self-end" size="sm" variant="outline" onClick={() => void copyKey(key.keyCode)}>
          <Copy className="me-1 h-3.5 w-3.5" />{language === 'ar' ? 'نسخ المفتاح' : 'Copy key'}
        </Button>
      </div>)}
      <p role="status" className={`text-sm font-medium ${needsAttention ? 'text-amber-900' : 'text-emerald-900'}`}>
        {language === 'ar' ? 'البريد: ' : 'Email: '}
        {status && labels[status] ? labels[status][language] : (language === 'ar' ? 'حالة إرسال البريد غير متاحة' : 'Email delivery status unavailable')}
      </p>
      {providerEvent && <p className="mt-1 text-sm">
        {language === 'ar' ? 'آخر نتيجة من مزوّد البريد: ' : 'Last provider result: '}
        {providerEvent.status === 'delivered' ? (language === 'ar' ? 'أكّد خادم بريد العميل الاستلام؛ لا يؤكد القراءة أو صندوق الوارد.' : 'Recipient mail server confirmed receipt; inbox placement and reading are unconfirmed.')
          : ['bounced_hard','bounced_soft','rejected','complained','deferred'].includes(providerEvent.status)
            ? (language === 'ar' ? 'تعثر التسليم — راجع سجل البريد.' : 'Delivery issue — review the email log.')
            : (language === 'ar' ? 'لم يصل تأكيد استلام من خادم بريد العميل.' : 'Recipient mail-server receipt is unconfirmed.')}
        {providerEvent.eventAt && <> {formatAcademyDateTime(providerEvent.eventAt, language)} · {language === 'ar' ? ACADEMY_TIME_LABEL_AR : ACADEMY_TIME_LABEL_EN}</>}
      </p>}
      {data.delivery && <p className="mt-1 text-xs text-slate-600">
        {language === 'ar' ? 'محاولات الإرسال: ' : 'Email attempts: '}{data.delivery.attempts ?? 0}
        {data.delivery.provider && <> · {data.delivery.provider}</>}
        {data.delivery.errorCategory && <> · {language === 'ar' ? 'فئة الخطأ: ' : 'Error category: '}{data.delivery.errorCategory}</>}
      </p>}
      <p role="status" className="mt-3 text-sm font-medium">
        {language === 'ar' ? 'محادثة الدعم: ' : 'Support conversation: '}
        {job?.supportStatus === 'delivered' ? (language === 'ar' ? 'تم حفظ المفتاح في محادثة العميل الخاصة' : 'Key saved in the client’s private conversation')
          : job?.supportStatus === 'recipient_unregistered' ? (language === 'ar' ? 'المستلم لا يملك حساباً بعد؛ المفتاح أُعدّ للبريد فقط' : 'Recipient has no account yet; support copy is unavailable')
            : job ? (language === 'ar' ? 'لم يكتمل حفظ المفتاح — يلزم المتابعة' : 'Key has not been saved yet — needs attention')
              : (language === 'ar' ? 'لا يوجد سجل تسليم عبر الدعم لهذا الطلب' : 'No support-delivery record for this order')}
      </p>
      {job?.supportDeliveredAt && <p className="mt-1 text-xs text-slate-600">{formatAcademyDateTime(job.supportDeliveredAt, language)} · {language === 'ar' ? ACADEMY_TIME_LABEL_AR : ACADEMY_TIME_LABEL_EN}</p>}
      {job?.lastErrorCode && <p className="mt-1 break-words text-xs text-amber-900">
        {language === 'ar' ? 'رمز المتابعة: ' : 'Diagnostic code: '}{job.lastErrorCode} · {language === 'ar' ? 'المحاولات: ' : 'Attempts: '}{job.attempts}
        {job.status === 'failed' && <> · {language === 'ar' ? 'إعادة المحاولة: ' : 'Retry: '}{formatAcademyDateTime(job.nextAttemptAt, language)}</>}
      </p>}
      {!data.blockReason && (job?.supportStatus !== 'delivered' || ['failed','dead_letter','blocked'].includes(job?.status ?? '')) &&
        <Button className="mt-3 h-auto max-w-full whitespace-normal py-2" size="sm" variant="outline"
          disabled={busy || job?.status === 'processing'} onClick={() => recovery.mutate({ orderId })}>
          {language === 'ar' ? 'استعادة التسليم الناقص للبريد والدعم' : 'Recover missing email / support delivery'}
        </Button>}
      {data.delivery?.sentAt && <p className="mt-1 text-xs text-slate-600">{language === 'ar' ? 'آخر إرسال: ' : 'Last sent: '}{formatAcademyDateTime(data.delivery.sentAt, language)} · {language === 'ar' ? ACADEMY_TIME_LABEL_AR : ACADEMY_TIME_LABEL_EN}</p>}
      {status === 'failed' && data.delivery?.nextAttemptAt && <p className="mt-1 text-xs text-slate-600">{language === 'ar' ? 'المحاولة التالية: ' : 'Next attempt: '}{formatAcademyDateTime(data.delivery.nextAttemptAt, language)} · {language === 'ar' ? ACADEMY_TIME_LABEL_AR : ACADEMY_TIME_LABEL_EN}</p>}
      {data.blockReason ? <p className="mt-2 text-sm text-slate-600">{language === 'ar' ? 'إعادة الإرسال متاحة فقط لطلب مؤكد ومفتاح صالح غير مستخدم ومربوط بالمستلم.' : 'Sending requires confirmed payment and valid, unused keys assigned to the recipient.'}</p> : <>
        <Button className="mt-3 h-auto max-w-full whitespace-normal py-2" size="sm" disabled={!data.canResend || busy} onClick={() => resend.mutate({ orderId })}>
          <Mail className="me-1 h-3.5 w-3.5 shrink-0" />{data.delivery ? (language === 'ar' ? 'إعادة إرسال المفتاح نفسه' : 'Resend same key') : (language === 'ar' ? 'إرسال المفتاح للعميل' : 'Send key to client')}
        </Button>
        {!data.canResend && <p className="mt-2 text-xs text-slate-600">{language === 'ar' ? 'انتظر اكتمال الإرسال ودقيقة بعد آخر محاولة، ثم حدّث الحالة. الحالات المحظورة تحتاج مراجعة.' : 'Wait for sending to finish and one minute after the last attempt, then refresh. Blocked deliveries need review.'}</p>}
      </>}
      <p className="mt-2 text-xs text-slate-600">{language === 'ar' ? 'الإرسال إلى مزوّد البريد لا يؤكد وصول الرسالة إلى صندوق الوارد.' : 'Sent to provider does not confirm arrival in the client’s inbox.'}</p>
    </>}
  </section>;
}
