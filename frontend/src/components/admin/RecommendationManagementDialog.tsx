import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { recommendationManagementCopy, type RecommendationManagementAction } from '@shared/recommendationIntegrity';
import { toast } from 'sonner';

export function RecommendationManagementDialog({ rootId, action, onClose, onSuccess }: {
  rootId: number; action: RecommendationManagementAction; onClose: () => void; onSuccess: () => void;
}) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const [reason,setReason] = useState('');
  const [confirmed,setConfirmed] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const copy = recommendationManagementCopy(action);
  const mutation = trpc.recommendations.manageRecommendation.useMutation({
    onSuccess: () => { toast.success(ar ? 'تم نشر التعليمات وإضافة إشعارات العملاء إلى قائمة الإرسال' : 'Instruction published and client notifications queued'); onSuccess(); onClose(); },
    onError: () => toast.error(ar ? 'تعذر نشر التعليمات. حدّث الصفحة وتحقق من حالة التوصية، ثم حاول مجددًا.' : 'Unable to publish. Refresh and check the recommendation state, then retry.'),
  });
  return <Dialog open onOpenChange={open => { if (!open && !mutation.isPending) onClose(); }}>
    <DialogContent dir={ar ? 'rtl' : 'ltr'} className="max-h-[90dvh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{ar ? copy.titleAr : copy.titleEn} #{rootId}</DialogTitle>
        <DialogDescription>{ar ? copy.instructionAr : copy.instructionEn}</DialogDescription>
      </DialogHeader>
      <label className="space-y-2 text-sm">
        <span>{ar ? 'السبب والتفاصيل التي سيستلمها العملاء' : 'Reason and details clients will receive'}</span>
        <Textarea value={reason} onChange={event=>setReason(event.target.value)} maxLength={1000} rows={4} />
      </label>
      {action === 'cancel_pending' && <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} className="mt-1" />
        <span>{ar ? 'أؤكد أن أمر الدخول لم يتفعّل. إذا كان التفعيل غير مؤكد، أستخدم تحديث الصفقة وأطلب مراجعة الإدارة.' : 'I confirm the entry has never triggered. If uncertain, I will use a trade update and request BO review.'}</span>
      </label>}
      {action === 'early_close' && <p className="text-sm text-muted-foreground">{ar ? 'بعد نشر التعليمات، سجّل نتيجة الإغلاق الفعلية ثم أغلق سجل الصفقة. لا تُحذف الأرباح أو الخسائر.' : 'After publishing, record the actual closing result, then close the thread. Gains and losses remain recorded.'}</p>}
      <DialogFooter>
        <Button variant="outline" disabled={mutation.isPending} onClick={onClose}>{ar ? 'رجوع' : 'Back'}</Button>
        <Button disabled={mutation.isPending || reason.trim().length < 5 || (action === 'cancel_pending' && !confirmed)} onClick={()=>mutation.mutate({rootId,action,reason:reason.trim(),requestId,confirmUntriggered:confirmed})}>
          {mutation.isPending ? (ar ? 'جارٍ النشر…' : 'Publishing…') : (ar ? 'نشر وإخطار العملاء' : 'Publish and notify clients')}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
