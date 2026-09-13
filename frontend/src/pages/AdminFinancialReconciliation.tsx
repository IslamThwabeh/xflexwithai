import { useState } from 'react';
import { AlertTriangle, ClipboardCheck, Loader2, RefreshCw, Scale } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { trpc } from '@/lib/trpc';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';

type QueueStatus = 'unresolved' | 'approved_opening_balance' | 'approved_adjustment' | 'excluded';
type Treatment = 'genuine_current_new_sale' | 'genuine_current_renewal' | 'genuine_upgrade' | 'legacy_migration_no_financial_impact' | 'historical_payment_known_date' | 'historical_payment_unknown' | 'requires_owner_review' | 'possible_duplicate' | 'excluded_nonfinancial';
type QueueItem = { id: number; sourceType: string; sourceReference: string; issueType: string; confidenceLevel: string; status: string; proposedTreatment: Treatment; proposedAmountIlsMinor?: number | null; notes?: string | null };

const money = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ILS' }).format(minor / 100);
const today = () => new Date().toISOString().slice(0, 10);

export default function AdminFinancialReconciliation() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<QueueStatus>('unresolved');
  const [selected, setSelected] = useState<QueueItem | null>(null);
  const [decision, setDecision] = useState<'excluded' | 'approved_opening_balance' | 'approved_adjustment'>('excluded');
  const [draft, setDraft] = useState<QueueItem | null>(null);
  const [draftTreatment, setDraftTreatment] = useState<Treatment>('requires_owner_review');
  const [draftAmount, setDraftAmount] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [reason, setReason] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(today());
  const [amount, setAmount] = useState('');
  const queryOptions = { staleTime: 5 * 60_000, refetchOnWindowFocus: false, refetchOnMount: false } as const;
  const preview = trpc.financialReconciliation.preview.useQuery(undefined, queryOptions);
  const workspace = trpc.financialReconciliation.workspace.useQuery({ status }, queryOptions);
  const refresh = async () => {
    await Promise.all([
      utils.financialReconciliation.preview.invalidate(),
      utils.financialReconciliation.workspace.invalidate(),
      utils.financialReports.dashboard.invalidate(),
    ]);
  };
  const materialize = trpc.financialReconciliation.materializeQueue.useMutation({
    onSuccess: async result => {
      await refresh();
      toast.success(isRtl ? `تمت إضافة ${result.itemsAdded} عناصر للمراجعة.` : `${result.itemsAdded} review items added.`);
    },
    onError: error => toast.error(error.message),
  });
  const updateDraft = trpc.financialReconciliation.updateDraft.useMutation({
    onSuccess: async () => {
      await refresh();
      setDraft(null);
      toast.success(isRtl ? 'تم تحديث مسودة المطابقة مع سجل تدقيق.' : 'Reconciliation draft and audit trail updated.');
    },
    onError: error => toast.error(error.message),
  });
  const resolve = trpc.financialReconciliation.resolveItem.useMutation({
    onSuccess: async result => {
      await refresh();
      setSelected(null);
      setReason('');
      setAmount('');
      toast.success(result?.idempotent
        ? (isRtl ? 'كان هذا القرار محفوظًا مسبقًا.' : 'This decision was already saved.')
        : (isRtl ? 'تم حفظ قرار المالك وسجل التدقيق.' : 'Owner decision and audit trail saved.'));
    },
    onError: error => toast.error(error.message),
  });
  const submitDecision = () => {
    if (!selected) return;
    const amountMinor = decision !== 'excluded' ? Math.round(Number(amount) * 100) : null;
    resolve.mutate({
      itemId: selected.id,
      decision,
      reason: reason.trim(),
      effectiveDate: decision !== 'excluded' ? effectiveDate : null,
      amountIlsMinor: Number.isSafeInteger(amountMinor) ? amountMinor : null,
    });
  };
  const counts = preview.data?.counts;
  const classifications = preview.data?.classifications;
  const isBusy = preview.isLoading || workspace.isLoading;
  const sourcePath = (item: QueueItem) => item.sourceType === 'order' ? `/admin/orders?orderId=${item.sourceReference}` : '/admin/package-keys';

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Scale className="h-6 w-6 text-emerald-700" />{isRtl ? 'المطابقة المالية التاريخية' : 'Historical Financial Reconciliation'}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{isRtl ? 'مراجعة سجلات قديمة باستخدام أرقام المصادر فقط. الطلبات والمفاتيح الأصلية للقراءة فقط ولا يتم تغييرها.' : 'Review historic records using source IDs only. Original orders and keys stay read-only and are never changed.'}</p>
          </div>
          {preview.data?.canMaterialize && <Button onClick={() => materialize.mutate()} disabled={materialize.isPending || !preview.data.safeToMaterialize}>
            {materialize.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
            {isRtl ? 'إنشاء/تحديث قائمة المراجعة' : 'Build/refresh review queue'}
          </Button>}
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <div className="flex gap-2 font-semibold"><AlertTriangle className="h-5 w-5 shrink-0" />{isRtl ? 'هذه المعاينة لا تسجل دخلاً ولا تفترض تاريخ دفع.' : 'This preview records no income and assumes no payment date.'}</div>
          <p className="mt-1 ps-7">{isRtl ? 'الدفع التاريخي لا يدخل التقارير إلا كتسوية موثقة بتاريخ الدفع الحقيقي. المبلغ أو التاريخ غير المؤكد يبقى خارج قائمة الدخل، والاستبعاد لا يحذف شيئًا.' : 'Historic payment enters reports only as a documented adjustment on the genuine payment date. Unknown amount/date stays outside P&L, and exclusion deletes nothing.'}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [isRtl ? 'طلبات بلا تأكيد دفع' : 'Orders without confirmation', counts?.ordersWithoutConfirmation ?? 0],
            [isRtl ? 'مفاتيح يدوية بسعر' : 'Priced manual keys', counts?.manualPricedKeys ?? 0],
            [isRtl ? 'مفاتيح تجديد' : 'Renewal keys', counts?.renewalKeys ?? 0],
            [isRtl ? 'مفاتيح ترقية' : 'Upgrade keys', counts?.upgradeKeys ?? 0],
          ].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-white p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}
        </div>

        <div className="rounded-xl border bg-slate-50 p-4 text-sm">
          <p className="font-semibold">{isRtl ? 'تصنيف المعاينة' : 'Dry-run classification'}</p>
          <p className="mt-1 text-muted-foreground">{isRtl
            ? `يحتاج قرار المالك: ${classifications?.requiresOwnerReview ?? 0} · دفع تاريخي بتاريخ غير مؤكد: ${classifications?.historicalPaymentUnknown ?? 0} · مستبعد غير مالي: ${classifications?.excludedNonfinancial ?? 0}`
            : `Requires owner review: ${classifications?.requiresOwnerReview ?? 0} · Historic payment with unknown date: ${classifications?.historicalPaymentUnknown ?? 0} · Non-financial excluded: ${classifications?.excludedNonfinancial ?? 0}`}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-muted-foreground">{isRtl ? 'غير محسوم' : 'Unresolved'}</p><p className="text-xl font-bold text-amber-700">{workspace.data?.counts.unresolved ?? 0}</p><p className="text-xs text-muted-foreground">{isRtl ? 'القيمة المقترحة فقط:' : 'Proposed value only:'} {money(workspace.data?.counts.unresolvedProposedMinor ?? 0)}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-muted-foreground">{isRtl ? 'أرصدة معتمدة' : 'Opening balances'}</p><p className="text-xl font-bold text-emerald-700">{workspace.data?.counts.approvedOpeningBalance ?? 0}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-muted-foreground">{isRtl ? 'تسويات معتمدة' : 'Adjustments'}</p><p className="text-xl font-bold text-emerald-700">{workspace.data?.counts.approvedAdjustment ?? 0}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-muted-foreground">{isRtl ? 'مستبعد' : 'Excluded'}</p><p className="text-xl font-bold">{workspace.data?.counts.excluded ?? 0}</p></div>
          <div className="rounded-xl border bg-white p-4"><p className="text-xs text-muted-foreground">{isRtl ? 'الصافي التاريخي المعتمد' : 'Recognized historical net'}</p><p className="text-xl font-bold">{money(workspace.data?.recognized.historicalNetMinor ?? 0)}</p></div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="font-semibold text-blue-950">{isRtl ? 'مؤشرات تشغيلية للمطابقة — ليست إيرادًا' : 'Operational reconciliation indicators — not revenue'}</p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
            <span>{isRtl ? 'دفعات مؤكدة' : 'Confirmed payments'}: {workspace.data?.operationalIndicators.confirmedPayments ?? 0}</span>
            <span>{isRtl ? 'مفاتيح مرتبطة بطلب صادرة' : 'Order-linked keys issued'}: {workspace.data?.operationalIndicators.issuedOrderKeys ?? 0}</span>
            <span>{isRtl ? 'مفاتيح مرتبطة بطلب مفعلة' : 'Order-linked keys activated'}: {workspace.data?.operationalIndicators.activatedOrderKeys ?? 0}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div><h2 className="font-bold">{isRtl ? 'قائمة مراجعة المالك' : 'Owner review queue'}</h2><p className="text-xs text-muted-foreground">{isRtl ? 'لا تظهر أسماء أو بيانات عملاء.' : 'No client names or personal data are displayed.'}</p></div>
            <select className="rounded-md border bg-background px-3 py-2 text-sm" value={status} onChange={event => setStatus(event.target.value as QueueStatus)}>
              <option value="unresolved">{isRtl ? 'غير محسوم' : 'Unresolved'}</option>
              <option value="approved_opening_balance">{isRtl ? 'رصيد افتتاحي معتمد' : 'Approved opening balance'}</option>
              <option value="approved_adjustment">{isRtl ? 'تسوية تاريخية معتمدة' : 'Approved historical adjustment'}</option>
              <option value="excluded">{isRtl ? 'مستبعد' : 'Excluded'}</option>
            </select>
          </div>
          {isBusy ? <div className="p-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
            : !workspace.data?.items.length ? <div className="p-8 text-center text-sm text-muted-foreground">{isRtl ? 'لا توجد عناصر بهذه الحالة.' : 'No items with this status.'}</div>
            : <div className="divide-y">{workspace.data.items.map((item: any) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div><p className="font-medium">{item.issueType.replaceAll('_', ' ')}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{item.sourceType} #{item.sourceReference} · {isRtl ? 'عنصر' : 'item'} #{item.id} · {item.confidenceLevel}</p><p className="mt-1 text-xs text-muted-foreground">{item.proposedTreatment.replaceAll('_', ' ')}</p>{item.proposedAmountIlsMinor != null && <p className="mt-1 text-sm">{money(item.proposedAmountIlsMinor)}</p>}{workspace.data?.access === 'owner' && <a className="mt-1 inline-block text-xs text-emerald-700 underline" href={sourcePath(item)}>{isRtl ? 'فتح المصدر التشغيلي' : 'Open operational source'}</a>}</div>
              {item.status === 'unresolved' && <div className="flex gap-2">{workspace.data?.canManageDrafts && <Button size="sm" variant="outline" onClick={() => { setDraft(item); setDraftTreatment(item.proposedTreatment); setDraftAmount(item.proposedAmountIlsMinor == null ? '' : String(item.proposedAmountIlsMinor / 100)); setDraftNotes(item.notes ?? ''); }}>{isRtl ? 'تحديث المسودة' : 'Edit draft'}</Button>}{workspace.data?.canResolve && <Button size="sm" onClick={() => { setSelected(item); setDecision('excluded'); setReason(''); setAmount(item.proposedAmountIlsMinor == null ? '' : String(item.proposedAmountIlsMinor / 100)); }}>{isRtl ? 'قرار المالك' : 'Owner decision'}</Button>}</div>}
            </div>)}</div>}
          {workspace.data?.truncated && <div className="border-t p-3 text-xs text-muted-foreground">{isRtl ? 'تظهر أحدث 100 نتيجة فقط.' : 'Only the latest 100 results are shown.'}</div>}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={open => { if (!open && !resolve.isPending) setSelected(null); }}>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRtl ? 'قرار المطابقة' : 'Reconciliation decision'}</DialogTitle><DialogDescription>{isRtl ? 'السجل الأصلي لن يتغير. لا تعتمد تسوية إلا بعد توثيق تاريخ الدفع الحقيقي والمبلغ.' : 'The source record will not change. Approve an adjustment only after verifying the genuine payment date and amount.'}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <select className="w-full rounded-md border bg-background px-3 py-2" value={decision} onChange={event => setDecision(event.target.value as typeof decision)}>
              <option value="excluded">{isRtl ? 'استبعاد — قبل وبعد: ₪0' : 'Exclude — before and after: ₪0'}</option>
              <option value="approved_adjustment">{isRtl ? 'اعتماد تسوية تاريخية' : 'Approve historical adjustment'}</option>
            </select>
            {decision !== 'excluded' && <div className="grid gap-3 sm:grid-cols-2"><div><label className="text-sm">{isRtl ? 'تاريخ القيد' : 'Posting date'}</label><Input type="date" value={effectiveDate} max={today()} onChange={event => setEffectiveDate(event.target.value)} /></div><div><label className="text-sm">{isRtl ? 'المبلغ بالشيكل (+ أو -)' : 'ILS amount (+ or -)'}</label><Input type="number" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></div></div>}
            <Textarea value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} placeholder={isRtl ? 'سبب موثق للقرار (5 أحرف على الأقل)' : 'Documented reason (at least 5 characters)'} />
            {decision !== 'excluded' && amount && <div className="rounded-md bg-slate-50 p-3 text-sm"><ClipboardCheck className="me-1 inline h-4 w-4" />{isRtl ? `قبل: ₪0 — بعد: ${money(Math.round(Number(amount) * 100))}` : `Before: ₪0 — after: ${money(Math.round(Number(amount) * 100))}`}</div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSelected(null)} disabled={resolve.isPending}>{isRtl ? 'إلغاء' : 'Cancel'}</Button><Button onClick={submitDecision} disabled={resolve.isPending || reason.trim().length < 5 || (decision !== 'excluded' && (!effectiveDate || !amount || Number(amount) === 0))}>{resolve.isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{isRtl ? 'حفظ قرار المالك' : 'Save owner decision'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!draft} onOpenChange={open => { if (!open && !updateDraft.isPending) setDraft(null); }}>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'}>
          <DialogHeader><DialogTitle>{isRtl ? 'تحديث مسودة المطابقة' : 'Update reconciliation draft'}</DialogTitle><DialogDescription>{isRtl ? 'هذا اقتراح فقط ولا يدخل أي مبلغ في التقارير.' : 'This is only a proposal and recognizes no amount.'}</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <select className="w-full rounded-md border bg-background px-3 py-2" value={draftTreatment} onChange={event => setDraftTreatment(event.target.value as Treatment)}>
              <option value="genuine_current_new_sale">{isRtl ? 'بيع جديد حالي صحيح' : 'Genuine current new sale'}</option>
              <option value="genuine_current_renewal">{isRtl ? 'تجديد حالي صحيح' : 'Genuine current renewal'}</option>
              <option value="genuine_upgrade">{isRtl ? 'ترقية صحيحة' : 'Genuine upgrade'}</option>
              <option value="legacy_migration_no_financial_impact">{isRtl ? 'ترحيل قديم — بلا أثر مالي' : 'Legacy migration — no financial impact'}</option>
              <option value="historical_payment_known_date">{isRtl ? 'دفعة تاريخية بتاريخ معروف' : 'Historical payment — known date'}</option>
              <option value="historical_payment_unknown">{isRtl ? 'دفعة تاريخية غير مؤكدة' : 'Historical payment — unknown'}</option>
              <option value="requires_owner_review">{isRtl ? 'يتطلب مراجعة المالك' : 'Requires owner review'}</option>
              <option value="possible_duplicate">{isRtl ? 'تكرار محتمل' : 'Possible duplicate'}</option>
              <option value="excluded_nonfinancial">{isRtl ? 'مستبعد غير مالي' : 'Excluded non-financial'}</option>
            </select>
            <Input type="number" step="0.01" value={draftAmount} onChange={event => setDraftAmount(event.target.value)} placeholder={isRtl ? 'مبلغ مقترح بالشيكل (اختياري)' : 'Proposed ILS amount (optional)'} />
            <Textarea value={draftNotes} maxLength={1000} onChange={event => setDraftNotes(event.target.value)} placeholder={isRtl ? 'ملاحظات وإثباتات المسودة' : 'Draft evidence notes'} />
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDraft(null)} disabled={updateDraft.isPending}>{isRtl ? 'إلغاء' : 'Cancel'}</Button><Button disabled={updateDraft.isPending || !draft} onClick={() => draft && updateDraft.mutate({ itemId: draft.id, proposedTreatment: draftTreatment, proposedAmountIlsMinor: draftAmount ? Math.round(Number(draftAmount) * 100) : null, notes: draftNotes })}>{isRtl ? 'حفظ المسودة' : 'Save draft'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
