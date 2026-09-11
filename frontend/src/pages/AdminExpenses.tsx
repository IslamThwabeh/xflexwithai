import { useState } from 'react';
import { Check, FileDown, Loader2, Pencil, Plus, Receipt, Send, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/apiBase';
import { formatAdminCurrencyFromIls } from '@/lib/adminCurrency';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const categories = [
  ['payroll', 'Payroll', 'الرواتب'],
  ['advertising', 'Advertising', 'الإعلانات'],
  ['software_and_subscriptions', 'Software & subscriptions', 'البرامج والاشتراكات'],
  ['professional_services', 'Professional services', 'الخدمات المهنية'],
  ['payment_and_bank_fees', 'Payment & bank fees', 'رسوم الدفع والبنوك'],
  ['rent_and_office', 'Rent & office', 'الإيجار والمكتب'],
  ['taxes_and_government_fees', 'Taxes & government fees', 'الضرائب والرسوم الحكومية'],
  ['training_and_content', 'Training & content', 'التدريب والمحتوى'],
  ['other', 'Other', 'أخرى'],
] as const;

const statusLabels: Record<string, { en: string; ar: string }> = {
  draft: { en: 'Draft', ar: 'مسودة' },
  pending_approval: { en: 'Awaiting approval', ar: 'بانتظار الموافقة' },
  approved: { en: 'Approved', ar: 'معتمد' },
  rejected: { en: 'Rejected', ar: 'مرفوض' },
  reversed: { en: 'Reversed', ar: 'معكوس' },
};

const statusStyles: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  pending_approval: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  reversed: 'bg-purple-100 text-purple-800',
};

type DraftForm = {
  paidAt: string;
  category: typeof categories[number][0];
  supplierOrPayee: string;
  amountIls: string;
  vatRatePercent: string;
  vatAmountIls: string;
  vatIncluded: boolean;
  paymentMethod: 'bank_transfer' | 'cash' | 'card' | 'other';
  paymentReference: string;
  description: string;
  internalNotes: string;
};

const emptyDraft = (): DraftForm => ({
  paidAt: new Date().toISOString().slice(0, 10),
  category: 'other',
  supplierOrPayee: '',
  amountIls: '',
  vatRatePercent: '',
  vatAmountIls: '',
  vatIncluded: false,
  paymentMethod: 'bank_transfer',
  paymentReference: '',
  description: '',
  internalNotes: '',
});

function toMinor(value: string) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function receiptName(value?: string | null) {
  if (!value) return null;
  try { return JSON.parse(value).originalName as string | null; } catch { return null; }
}

export default function AdminExpenses() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();
  const [status, setStatus] = useState<string>('');
  const [draft, setDraft] = useState<DraftForm>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [reviewReasons, setReviewReasons] = useState<Record<number, string>>({});
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const { data: access, isLoading: accessLoading, error: accessError } = trpc.financeExpenses.access.useQuery();
  const { data: expenses = [], isLoading } = trpc.financeExpenses.list.useQuery(
    { status: status ? status as any : undefined, limit: 100 },
    { enabled: Boolean(access) },
  );

  const refresh = () => utils.financeExpenses.list.invalidate();
  const mutationError = (error: unknown) => toast.error(error instanceof Error ? error.message : (isRtl ? 'تعذر إكمال العملية' : 'Action failed'));
  const createDraft = trpc.financeExpenses.createDraft.useMutation({
    onSuccess: () => { toast.success(isRtl ? 'تم حفظ المسودة' : 'Draft saved'); setDraft(emptyDraft()); void refresh(); },
    onError: mutationError,
  });
  const updateDraft = trpc.financeExpenses.updateDraft.useMutation({
    onSuccess: () => { toast.success(isRtl ? 'تم تحديث المسودة' : 'Draft updated'); setEditingId(null); setDraft(emptyDraft()); void refresh(); },
    onError: mutationError,
  });
  const submit = trpc.financeExpenses.submit.useMutation({
    onSuccess: () => { toast.success(isRtl ? 'تم إرسال المصروف للمراجعة' : 'Expense submitted for review'); void refresh(); },
    onError: mutationError,
  });
  const review = trpc.financeExpenses.review.useMutation({
    onSuccess: (_, variables) => {
      toast.success(variables.decision === 'approved' ? (isRtl ? 'تم اعتماد المصروف' : 'Expense approved') : (isRtl ? 'تم رفض المصروف' : 'Expense rejected'));
      setReviewReasons(current => ({ ...current, [variables.expenseId]: '' }));
      void refresh();
    },
    onError: mutationError,
  });

  const payload = () => ({
    paidAt: draft.paidAt,
    category: draft.category,
    supplierOrPayee: draft.supplierOrPayee || null,
    amountMinor: toMinor(draft.amountIls),
    vatRateBps: draft.vatRatePercent ? Math.round(Number(draft.vatRatePercent) * 100) : null,
    vatAmountMinor: draft.vatAmountIls ? toMinor(draft.vatAmountIls) : null,
    vatIncluded: draft.vatRatePercent || draft.vatAmountIls ? draft.vatIncluded : null,
    paymentMethod: draft.paymentMethod,
    paymentReference: draft.paymentReference || null,
    description: draft.description || null,
    internalNotes: draft.internalNotes || null,
  });

  const save = () => {
    if (!draft.paidAt || toMinor(draft.amountIls) <= 0) {
      toast.error(isRtl ? 'أدخل التاريخ والمبلغ' : 'Enter the date and amount');
      return;
    }
    if (editingId) updateDraft.mutate({ expenseId: editingId, ...payload() });
    else createDraft.mutate(payload());
  };

  const edit = (expense: any) => {
    setEditingId(expense.id);
    setDraft({
      paidAt: expense.paidAt,
      category: expense.category,
      supplierOrPayee: expense.supplierOrPayee || '',
      amountIls: (expense.amountMinor / 100).toFixed(2),
      vatRatePercent: expense.vatRate == null ? '' : (expense.vatRate / 100).toString(),
      vatAmountIls: expense.vatAmountMinor == null ? '' : (expense.vatAmountMinor / 100).toFixed(2),
      vatIncluded: Boolean(expense.vatIncluded),
      paymentMethod: expense.paymentMethod || 'bank_transfer',
      paymentReference: expense.paymentReference || '',
      description: expense.description || '',
      internalNotes: expense.internalNotes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadReceipt = async (expenseId: number, file?: File) => {
    if (!file) return;
    setUploadingId(expenseId);
    try {
      const response = await apiFetch(`/api/finance/expenses/${expenseId}/receipt`, {
        method: 'POST',
        headers: { 'content-type': file.type, 'x-file-name': encodeURIComponent(file.name) },
        body: file,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Receipt upload failed');
      toast.success(isRtl ? 'تم إرفاق الإيصال' : 'Receipt attached');
      await refresh();
    } catch (error) { mutationError(error); } finally { setUploadingId(null); }
  };

  if (accessLoading) return <DashboardLayout><div className="p-8">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div></DashboardLayout>;
  if (accessError || !access) return <DashboardLayout><div className="p-8"><div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">{isRtl ? 'لا تملك صلاحية إدارة المصروفات.' : 'You do not have expense-management access.'}</div></div></DashboardLayout>;

  const canReview = access.canReview;
  return (
    <DashboardLayout>
      <main className="space-y-6 p-4 md:p-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><Receipt className="h-6 w-6 text-emerald-700" />{isRtl ? 'إدارة المصروفات' : 'Expense Management'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{isRtl ? 'سجّل المصروف بالشيكل، أرفق الإيصال، ثم أرسله لمراجعة مستقلة.' : 'Record expenses in ILS, attach evidence, then submit for independent review.'}</p>
        </div>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{editingId ? (isRtl ? `تعديل المسودة #${editingId}` : `Edit draft #${editingId}`) : (isRtl ? 'مصروف جديد' : 'New expense')}</h2>
            {editingId && <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setDraft(emptyDraft()); }}><X className="me-1 h-4 w-4" />{isRtl ? 'إلغاء' : 'Cancel'}</Button>}
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div><Label>{isRtl ? 'تاريخ الدفع' : 'Payment date'}</Label><Input type="date" value={draft.paidAt} onChange={e => setDraft({ ...draft, paidAt: e.target.value })} /></div>
            <div><Label>{isRtl ? 'الفئة' : 'Category'}</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value as DraftForm['category'] })}>{categories.map(([value, en, ar]) => <option key={value} value={value}>{isRtl ? ar : en}</option>)}</select></div>
            <div><Label>{isRtl ? 'المبلغ (₪)' : 'Amount (₪)'}</Label><Input inputMode="decimal" placeholder="0.00" value={draft.amountIls} onChange={e => setDraft({ ...draft, amountIls: e.target.value })} /></div>
            <div><Label>{isRtl ? 'المورّد / المستفيد' : 'Supplier / payee'}</Label><Input value={draft.supplierOrPayee} onChange={e => setDraft({ ...draft, supplierOrPayee: e.target.value })} /></div>
            <div><Label>{isRtl ? 'طريقة الدفع' : 'Payment method'}</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.paymentMethod} onChange={e => setDraft({ ...draft, paymentMethod: e.target.value as DraftForm['paymentMethod'] })}><option value="bank_transfer">{isRtl ? 'تحويل بنكي' : 'Bank transfer'}</option><option value="cash">{isRtl ? 'نقداً' : 'Cash'}</option><option value="card">{isRtl ? 'بطاقة' : 'Card'}</option><option value="other">{isRtl ? 'أخرى' : 'Other'}</option></select></div>
            <div><Label>{isRtl ? 'مرجع الدفع' : 'Payment reference'}</Label><Input value={draft.paymentReference} onChange={e => setDraft({ ...draft, paymentReference: e.target.value })} /></div>
            <div><Label>{isRtl ? 'نسبة VAT % (معلومة فقط)' : 'VAT % (informational only)'}</Label><Input inputMode="decimal" value={draft.vatRatePercent} onChange={e => setDraft({ ...draft, vatRatePercent: e.target.value })} /></div>
            <div><Label>{isRtl ? 'قيمة VAT (₪، معلومة فقط)' : 'VAT amount (₪, informational only)'}</Label><Input inputMode="decimal" value={draft.vatAmountIls} onChange={e => setDraft({ ...draft, vatAmountIls: e.target.value })} /></div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" checked={draft.vatIncluded} onChange={e => setDraft({ ...draft, vatIncluded: e.target.checked })} />{isRtl ? 'VAT مشمول في المبلغ' : 'VAT included in total'}</label>
            <div className="md:col-span-2 lg:col-span-3"><Label>{isRtl ? 'الوصف' : 'Description'}</Label><Textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="md:col-span-2 lg:col-span-3"><Label>{isRtl ? 'ملاحظات داخلية' : 'Internal notes'}</Label><Textarea value={draft.internalNotes} onChange={e => setDraft({ ...draft, internalNotes: e.target.value })} /></div>
          </div>
          <div className="mt-4 flex justify-end"><Button onClick={save} disabled={createDraft.isPending || updateDraft.isPending}><Plus className="me-2 h-4 w-4" />{editingId ? (isRtl ? 'حفظ التعديل' : 'Save changes') : (isRtl ? 'حفظ كمسودة' : 'Save draft')}</Button></div>
          <p className="mt-3 text-xs text-muted-foreground">{isRtl ? 'VAT حقول معلوماتية فقط ولا تُحسب أو تُرحّل ضريبياً تلقائياً. لا يمكن حذف السجلات.' : 'VAT fields are informational only; no tax is calculated or filed automatically. Records cannot be deleted.'}</p>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{isRtl ? 'سجل المصروفات' : 'Expense register'}</h2><select className="h-9 rounded-md border bg-background px-3 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="">{isRtl ? 'كل الحالات' : 'All statuses'}</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label[language]}</option>)}</select></div>
          {isLoading ? <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : expenses.length === 0 ? <p className="p-8 text-center text-muted-foreground">{isRtl ? 'لا توجد مصروفات.' : 'No expenses found.'}</p> : <div className="space-y-3">{expenses.map((expense: any) => {
            const reason = reviewReasons[expense.id] || '';
            const attached = receiptName(expense.receiptMetadata);
            return <article key={expense.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><strong>#{expense.id}</strong><Badge className={statusStyles[expense.status]}>{statusLabels[expense.status]?.[language] || expense.status}</Badge></div><p className="mt-1 text-sm">{categories.find(([key]) => key === expense.category)?.[isRtl ? 2 : 1]} · {expense.paidAt}</p><p className="text-sm text-muted-foreground">{expense.supplierOrPayee || expense.description || '—'}</p></div><div className="text-xl font-bold">{formatAdminCurrencyFromIls(expense.amountMinor / 100, language)}</div></div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {expense.status === 'draft' && <><Button size="sm" variant="outline" onClick={() => edit(expense)}><Pencil className="me-1 h-4 w-4" />{isRtl ? 'تعديل' : 'Edit'}</Button><label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm hover:bg-muted"><Receipt className="me-1 h-4 w-4" />{uploadingId === expense.id ? (isRtl ? 'جاري الرفع...' : 'Uploading...') : attached || (isRtl ? 'إرفاق إيصال' : 'Attach receipt')}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={uploadingId === expense.id} onChange={e => { void uploadReceipt(expense.id, e.target.files?.[0]); e.currentTarget.value = ''; }} /></label><Button size="sm" onClick={() => submit.mutate({ expenseId: expense.id })} disabled={submit.isPending}><Send className="me-1 h-4 w-4" />{isRtl ? 'إرسال للمراجعة' : 'Submit'}</Button></>}
                {attached && expense.status !== 'draft' && <Button size="sm" variant="outline" onClick={() => window.open(`/api/finance/expenses/${expense.id}/receipt`, '_blank', 'noopener,noreferrer')}><FileDown className="me-1 h-4 w-4" />{isRtl ? 'تنزيل الإيصال' : 'Download receipt'}</Button>}
              </div>
              {expense.status === 'pending_approval' && canReview && <div className="mt-4 flex flex-col gap-2 rounded-lg bg-muted/50 p-3 md:flex-row"><Input placeholder={isRtl ? 'سبب قرار المراجعة (مطلوب)' : 'Review reason (required)'} value={reason} onChange={e => setReviewReasons(current => ({ ...current, [expense.id]: e.target.value }))} /><Button className="bg-emerald-700 hover:bg-emerald-800" disabled={reason.trim().length < 3 || review.isPending} onClick={() => review.mutate({ expenseId: expense.id, decision: 'approved', reason })}><Check className="me-1 h-4 w-4" />{isRtl ? 'اعتماد' : 'Approve'}</Button><Button variant="destructive" disabled={reason.trim().length < 3 || review.isPending} onClick={() => review.mutate({ expenseId: expense.id, decision: 'rejected', reason })}><X className="me-1 h-4 w-4" />{isRtl ? 'رفض' : 'Reject'}</Button></div>}
              {expense.status === 'rejected' && expense.correctionReason && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{expense.correctionReason}</p>}
            </article>;
          })}</div>}
        </section>
      </main>
    </DashboardLayout>
  );
}
