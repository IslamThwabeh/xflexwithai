import { useState } from 'react';
import { Check, Lock, Pencil, Plus, RotateCcw, Send, ShieldCheck, Unlock, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatAdminCurrencyFromIls } from '@/lib/adminCurrency';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

type AdjustmentDraft = {
  effectiveDate: string;
  amountIls: string;
  description: string;
  reason: string;
  internalNotes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyAdjustment = (): AdjustmentDraft => ({
  effectiveDate: today(),
  amountIls: '',
  description: '',
  reason: '',
  internalNotes: '',
});
const toMinor = (value: string) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0;

const statuses: Record<string, { en: string; ar: string }> = {
  draft: { en: 'Draft', ar: 'مسودة' },
  pending_approval: { en: 'Awaiting approval', ar: 'بانتظار الموافقة' },
  approved: { en: 'Approved', ar: 'معتمد' },
  rejected: { en: 'Rejected', ar: 'مرفوض' },
};

export default function AdminFinancialControls() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.financialControls.workspace.useQuery(undefined, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
  const [draft, setDraft] = useState<AdjustmentDraft>(emptyAdjustment);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<number, string>>({});
  const [lockMonth, setLockMonth] = useState(today().slice(0, 7));
  const [lockReason, setLockReason] = useState('');
  const [unlockReasons, setUnlockReasons] = useState<Record<string, string>>({});
  const [reversalForms, setReversalForms] = useState<Record<number, { effectiveDate: string; reason: string; replacementAmount: string; replacementDescription: string }>>({});
  const [reclassificationForms, setReclassificationForms] = useState<Record<number, { nextPurpose: 'new_sale' | 'renewal' | 'upgrade'; reason: string }>>({});

  const refresh = async () => {
    await utils.financialControls.workspace.invalidate();
    await utils.financialReports.dashboard.invalidate();
  };
  const fail = (cause: unknown) => toast.error(cause instanceof Error ? cause.message : (isRtl ? 'تعذر إكمال العملية' : 'Action failed'));
  const complete = (messageEn: string, messageAr: string) => { toast.success(isRtl ? messageAr : messageEn); void refresh(); };

  const create = trpc.financialControls.createAdjustment.useMutation({
    onSuccess: () => { complete('Adjustment draft saved', 'تم حفظ مسودة التسوية'); setDraft(emptyAdjustment()); }, onError: fail,
  });
  const update = trpc.financialControls.updateAdjustment.useMutation({
    onSuccess: () => { complete('Adjustment draft updated', 'تم تحديث مسودة التسوية'); setEditingId(null); setDraft(emptyAdjustment()); }, onError: fail,
  });
  const submit = trpc.financialControls.submitAdjustment.useMutation({ onSuccess: () => complete('Submitted for independent review', 'تم الإرسال للمراجعة المستقلة'), onError: fail });
  const review = trpc.financialControls.reviewAdjustment.useMutation({ onSuccess: () => complete('Review recorded', 'تم تسجيل قرار المراجعة'), onError: fail });
  const setLock = trpc.financialControls.setPeriodLock.useMutation({ onSuccess: () => { complete('Period control updated', 'تم تحديث إقفال الفترة'); setLockReason(''); }, onError: fail });
  const reverse = trpc.financialControls.reverseEntry.useMutation({ onSuccess: () => complete('Append-only correction recorded', 'تم تسجيل التصحيح دون تعديل الأصل'), onError: fail });
  const reclassify = trpc.financialControls.reclassifyPayment.useMutation({ onSuccess: () => complete('Payment category reclassified; total cash is unchanged', 'تم تعديل تصنيف الدفعة دون تغيير إجمالي النقد'), onError: fail });

  const adjustmentPayload = () => ({
    effectiveDate: draft.effectiveDate,
    amountIlsMinor: toMinor(draft.amountIls),
    description: draft.description,
    reason: draft.reason,
    internalNotes: draft.internalNotes || null,
  });
  const saveAdjustment = () => {
    if (!draft.effectiveDate || !toMinor(draft.amountIls) || draft.description.trim().length < 3 || draft.reason.trim().length < 3) {
      toast.error(isRtl ? 'أدخل التاريخ ومبلغاً غير صفري والوصف والسبب' : 'Enter a date, non-zero amount, description, and reason');
      return;
    }
    if (editingId) update.mutate({ adjustmentId: editingId, ...adjustmentPayload() });
    else create.mutate(adjustmentPayload());
  };
  const editAdjustment = (item: any) => {
    setEditingId(item.id);
    setDraft({
      effectiveDate: String(item.effectiveAt).slice(0, 10),
      amountIls: (Number(item.amountIlsMinor) / 100).toFixed(2),
      description: item.description,
      reason: item.reason,
      internalNotes: item.internalNotes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const reversalForm = (id: number) => reversalForms[id] || { effectiveDate: today(), reason: '', replacementAmount: '', replacementDescription: '' };
  const updateReversal = (id: number, values: Partial<ReturnType<typeof reversalForm>>) => setReversalForms(current => ({ ...current, [id]: { ...reversalForm(id), ...values } }));
  const reclassificationForm = (id: number, currentPurpose?: string | null) => reclassificationForms[id] || { nextPurpose: currentPurpose === 'new_sale' ? 'renewal' as const : 'new_sale' as const, reason: '' };
  const updateReclassification = (id: number, currentPurpose: string | null | undefined, values: Partial<ReturnType<typeof reclassificationForm>>) => setReclassificationForms(current => ({ ...current, [id]: { ...reclassificationForm(id, currentPurpose), ...values } }));

  if (isLoading) return <DashboardLayout><div className="p-8">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div></DashboardLayout>;
  if (error || !data) return <DashboardLayout><div className="p-8"><div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{isRtl ? 'لا تملك صلاحية الضوابط المالية.' : 'You do not have financial-control access.'}</div></div></DashboardLayout>;

  return <DashboardLayout><main className="space-y-6 p-4 md:p-6" dir={isRtl ? 'rtl' : 'ltr'}>
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><ShieldCheck className="h-6 w-6 text-indigo-700" />{isRtl ? 'الضوابط والتسويات المالية' : 'Financial Controls & Adjustments'}</h1><p className="mt-1 text-sm text-muted-foreground">{isRtl ? 'كل تصحيح يحفظ الأصل ويضيف قيداً عكسياً مدققاً. لا يوجد حذف أو تعديل صامت.' : 'Every correction preserves the original and appends an audited reversal. Nothing is silently deleted or rewritten.'}</p></header>

    <section className="rounded-2xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{editingId ? (isRtl ? `تعديل المسودة #${editingId}` : `Edit draft #${editingId}`) : (isRtl ? 'تسوية يدوية جديدة' : 'New manual adjustment')}</h2>{editingId && <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setDraft(emptyAdjustment()); }}><X className="me-1 h-4 w-4" />{isRtl ? 'إلغاء' : 'Cancel'}</Button>}</div>
      <div className="grid gap-4 md:grid-cols-2"><div><Label>{isRtl ? 'تاريخ القيد' : 'Posting date'}</Label><Input type="date" value={draft.effectiveDate} onChange={event => setDraft({ ...draft, effectiveDate: event.target.value })} /></div><div><Label>{isRtl ? 'المبلغ بالشيكل (+ زيادة، − تخفيض)' : 'Amount in ILS (+ increase, − decrease)'}</Label><Input inputMode="decimal" placeholder="0.00" value={draft.amountIls} onChange={event => setDraft({ ...draft, amountIls: event.target.value })} /></div><div><Label>{isRtl ? 'الوصف' : 'Description'}</Label><Input value={draft.description} onChange={event => setDraft({ ...draft, description: event.target.value })} /></div><div><Label>{isRtl ? 'سبب التسوية (إلزامي)' : 'Adjustment reason (required)'}</Label><Input value={draft.reason} onChange={event => setDraft({ ...draft, reason: event.target.value })} /></div><div className="md:col-span-2"><Label>{isRtl ? 'ملاحظات داخلية' : 'Internal notes'}</Label><Textarea value={draft.internalNotes} onChange={event => setDraft({ ...draft, internalNotes: event.target.value })} /></div></div>
      <div className="mt-4 flex justify-end"><Button onClick={saveAdjustment} disabled={create.isPending || update.isPending}><Plus className="me-2 h-4 w-4" />{editingId ? (isRtl ? 'حفظ التعديل' : 'Save changes') : (isRtl ? 'حفظ كمسودة' : 'Save draft')}</Button></div><p className="mt-3 text-xs text-muted-foreground">{isRtl ? 'لا تدخل التسوية في P&L حتى يعتمدها مستخدم مالي آخر. الفترة المقفلة تتطلب اعتماد المالك.' : 'The adjustment does not enter P&L until another finance user approves it. A locked period requires owner approval.'}</p>
    </section>

    <section className="rounded-2xl border bg-card p-5 shadow-sm"><h2 className="mb-4 font-semibold">{isRtl ? 'طلبات التسوية' : 'Adjustment requests'}</h2><div className="space-y-3">{data.adjustments.map((item: any) => { const reviewReason = reviewReasons[item.id] || ''; return <article key={item.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-3"><div><div className="flex items-center gap-2"><strong>#{item.id}</strong><Badge variant="outline">{statuses[item.status]?.[language] || item.status}</Badge></div><p className="mt-1 text-sm">{String(item.effectiveAt).slice(0, 10)} · {item.description}</p><p className="text-xs text-muted-foreground">{item.reason}</p></div><strong className={Number(item.amountIlsMinor) >= 0 ? 'text-emerald-700' : 'text-red-700'}>{formatAdminCurrencyFromIls(Number(item.amountIlsMinor) / 100, language)}</strong></div>{item.canEdit && <div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => editAdjustment(item)}><Pencil className="me-1 h-4 w-4" />{isRtl ? 'تعديل' : 'Edit'}</Button><Button size="sm" onClick={() => submit.mutate({ adjustmentId: item.id })}><Send className="me-1 h-4 w-4" />{isRtl ? 'إرسال' : 'Submit'}</Button></div>}{item.canReview && <div className="mt-3 flex flex-col gap-2 md:flex-row"><Input placeholder={isRtl ? 'سبب قرار المراجعة' : 'Review decision reason'} value={reviewReason} onChange={event => setReviewReasons(current => ({ ...current, [item.id]: event.target.value }))} /><Button disabled={reviewReason.trim().length < 3} onClick={() => review.mutate({ adjustmentId: item.id, decision: 'approved', reason: reviewReason })}><Check className="me-1 h-4 w-4" />{isRtl ? 'اعتماد' : 'Approve'}</Button><Button variant="destructive" disabled={reviewReason.trim().length < 3} onClick={() => review.mutate({ adjustmentId: item.id, decision: 'rejected', reason: reviewReason })}><X className="me-1 h-4 w-4" />{isRtl ? 'رفض' : 'Reject'}</Button></div>}</article>; })}{data.adjustments.length === 0 && <p className="py-6 text-center text-muted-foreground">{isRtl ? 'لا توجد طلبات تسوية.' : 'No adjustment requests.'}</p>}</div></section>

    {data.canManageLocks && <section className="rounded-2xl border bg-card p-5 shadow-sm"><h2 className="mb-4 flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" />{isRtl ? 'إقفال الفترات' : 'Period locks'}</h2><div className="grid gap-3 md:grid-cols-[180px_1fr_auto]"><Input type="month" value={lockMonth} onChange={event => setLockMonth(event.target.value)} /><Input placeholder={isRtl ? 'سبب الإقفال' : 'Lock reason'} value={lockReason} onChange={event => setLockReason(event.target.value)} /><Button disabled={lockReason.trim().length < 3} onClick={() => setLock.mutate({ month: lockMonth, action: 'locked', reason: lockReason })}><Lock className="me-1 h-4 w-4" />{isRtl ? 'إقفال' : 'Lock'}</Button></div><div className="mt-4 space-y-2">{data.locks.map((lock: any) => <div key={lock.month} className="grid items-center gap-2 rounded-lg border p-3 md:grid-cols-[100px_1fr_auto]"><strong>{lock.month}</strong><Input placeholder={isRtl ? 'سبب فتح الفترة (إلزامي)' : 'Unlock reason (required)'} value={unlockReasons[lock.month] || ''} onChange={event => setUnlockReasons(current => ({ ...current, [lock.month]: event.target.value }))} /><Button size="sm" variant="outline" disabled={(unlockReasons[lock.month] || '').trim().length < 3} onClick={() => setLock.mutate({ month: lock.month, action: 'unlocked', reason: unlockReasons[lock.month] })}><Unlock className="me-1 h-4 w-4" />{isRtl ? 'فتح' : 'Unlock'}</Button></div>)}</div></section>}

    {data.canReverse && <section className="rounded-2xl border bg-card p-5 shadow-sm"><h2 className="mb-2 flex items-center gap-2 font-semibold"><RotateCcw className="h-4 w-4" />{isRtl ? 'عكس أو تصحيح قيد معتمد' : 'Reverse or correct an approved entry'}</h2><p className="mb-4 text-xs text-muted-foreground">{isRtl ? 'القيمة البديلة اختيارية؛ عند إدخالها يضاف قيد بديل في نفس العملية الذرية. إعادة تصنيف الدفعة تحفظ تاريخ الدفع وإجمالي النقد.' : 'The replacement amount is optional; when supplied, a replacement entry is appended atomically. Payment reclassification preserves paidAt and total cash.'}</p><div className="space-y-4">{data.reversibleEntries.map((entry: any) => { const form = reversalForm(entry.id); const classification = reclassificationForm(entry.id, entry.transactionPurpose); return <article key={entry.id} className="rounded-xl border p-4"><div className="flex flex-wrap justify-between gap-2"><div><strong>#{entry.id} · {entry.entryType}</strong><p className="text-xs text-muted-foreground">{String(entry.effectiveAt).slice(0, 10)} · {entry.description || entry.sourceReference}</p></div><strong>{formatAdminCurrencyFromIls(Number(entry.baseAmountIlsMinor) / 100, language)}</strong></div>{entry.entryType === 'payment' && entry.transactionPurpose && <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3"><p className="mb-2 text-xs font-semibold text-blue-950">{isRtl ? `إعادة تصنيف فقط: ${entry.transactionPurpose} — إجمالي النقد لا يتغير` : `Category-only reclassification from ${entry.transactionPurpose}; total cash does not change`}</p><div className="grid gap-2 md:grid-cols-[180px_1fr_auto]"><select className="h-10 rounded-md border bg-white px-3" value={classification.nextPurpose} onChange={event => updateReclassification(entry.id, entry.transactionPurpose, { nextPurpose: event.target.value as typeof classification.nextPurpose })}><option value="new_sale">{isRtl ? 'شراء جديد' : 'New Sale'}</option><option value="renewal">{isRtl ? 'تجديد مدفوع' : 'Paid Renewal'}</option><option value="upgrade">{isRtl ? 'ترقية' : 'Upgrade'}</option></select><Input placeholder={isRtl ? 'سبب موثق (5 أحرف على الأقل)' : 'Documented reason (at least 5 characters)'} value={classification.reason} onChange={event => updateReclassification(entry.id, entry.transactionPurpose, { reason: event.target.value })} /><Button variant="outline" disabled={classification.reason.trim().length < 5 || classification.nextPurpose === entry.transactionPurpose || reclassify.isPending} onClick={() => reclassify.mutate({ entryId: entry.id, nextPurpose: classification.nextPurpose, reason: classification.reason })}>{isRtl ? 'إعادة التصنيف' : 'Reclassify'}</Button></div></div>}<div className="mt-3 grid gap-2 md:grid-cols-2"><Input type="date" value={form.effectiveDate} onChange={event => updateReversal(entry.id, { effectiveDate: event.target.value })} /><Input placeholder={isRtl ? 'سبب العكس (إلزامي)' : 'Reversal reason (required)'} value={form.reason} onChange={event => updateReversal(entry.id, { reason: event.target.value })} /><Input inputMode="decimal" placeholder={isRtl ? 'مبلغ بديل اختياري بالشيكل' : 'Optional replacement amount in ILS'} value={form.replacementAmount} onChange={event => updateReversal(entry.id, { replacementAmount: event.target.value })} /><Input placeholder={isRtl ? 'وصف القيد البديل' : 'Replacement description'} value={form.replacementDescription} onChange={event => updateReversal(entry.id, { replacementDescription: event.target.value })} /></div><div className="mt-3 flex justify-end"><Button variant="destructive" disabled={form.reason.trim().length < 3 || (form.replacementAmount !== '' && (!toMinor(form.replacementAmount) || form.replacementDescription.trim().length < 3))} onClick={() => reverse.mutate({ entryId: entry.id, effectiveDate: form.effectiveDate, reason: form.reason, replacementAmountIlsMinor: form.replacementAmount === '' ? null : toMinor(form.replacementAmount), replacementDescription: form.replacementDescription || null })}><RotateCcw className="me-1 h-4 w-4" />{form.replacementAmount === '' ? (isRtl ? 'عكس القيد' : 'Reverse entry') : (isRtl ? 'عكس وإضافة البديل' : 'Reverse and replace')}</Button></div></article>; })}{data.reversibleEntries.length === 0 && <p className="py-6 text-center text-muted-foreground">{isRtl ? 'لا توجد قيود قابلة للعكس.' : 'No reversible entries.'}</p>}</div></section>}
  </main></DashboardLayout>;
}
