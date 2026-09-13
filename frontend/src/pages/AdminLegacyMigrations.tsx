import { useState } from 'react';
import { ArchiveRestore, Check, FileUp, Search, Send, X } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/apiBase';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const labels: Record<string, { en: string; ar: string }> = {
  draft: { en: 'Draft', ar: 'مسودة' }, pending_approval: { en: 'Awaiting owner approval', ar: 'بانتظار موافقة المالك' },
  approved: { en: 'Migrated', ar: 'تم الترحيل' }, rejected: { en: 'Rejected', ar: 'مرفوض' },
};

export default function AdminLegacyMigrations() {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const utils = trpc.useUtils();
  const [email, setEmail] = useState('');
  const [clientName, setClientName] = useState('');
  const [client, setClient] = useState<{ id: number; email: string; name: string | null } | null>(null);
  const [form, setForm] = useState({ packageId: '', originalPurchaseDate: '', oldReference: '', originalAmount: '', originalCurrency: 'ILS', timedServicesEndAt: '', reason: '', notes: '' });
  const [reviewReasons, setReviewReasons] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState<number | null>(null);
  const access = trpc.legacyMigrations.access.useQuery(undefined, { retry: false });
  const packages = trpc.packages.list.useQuery();
  const list = trpc.legacyMigrations.list.useQuery({ limit: 100 }, { enabled: Boolean(access.data), refetchOnWindowFocus: false });
  const lookup = trpc.legacyMigrations.lookupClient.useMutation({
    onSuccess: value => { setClient(value); if (!value) toast.error(ar ? 'لم يتم العثور على الحساب.' : 'Client account was not found.'); },
    onError: error => toast.error(error.message),
  });
  const create = trpc.legacyMigrations.createDraft.useMutation({
    onSuccess: async () => { toast.success(ar ? 'تم حفظ المسودة دون أثر مالي.' : 'Zero-impact migration draft saved.'); setClient(null); setEmail(''); setForm({ packageId: '', originalPurchaseDate: '', oldReference: '', originalAmount: '', originalCurrency: 'ILS', timedServicesEndAt: '', reason: '', notes: '' }); await utils.legacyMigrations.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const createClient = trpc.legacyMigrations.createClientAccount.useMutation({
    onSuccess: value => { setClient(value); toast.success(ar ? 'تم إنشاء حساب العميل وتسجيل العملية.' : 'Client account created and audited.'); },
    onError: error => toast.error(error.message),
  });
  const submit = trpc.legacyMigrations.submit.useMutation({ onSuccess: async () => { toast.success(ar ? 'أُرسلت لموافقة المالك.' : 'Submitted for owner approval.'); await utils.legacyMigrations.list.invalidate(); }, onError: error => toast.error(error.message) });
  const review = trpc.legacyMigrations.review.useMutation({ onSuccess: async () => { toast.success(ar ? 'تم تسجيل قرار المالك.' : 'Owner decision recorded.'); await utils.legacyMigrations.list.invalidate(); }, onError: error => toast.error(error.message) });
  const standardPackages = (packages.data ?? []).filter((pkg: any) => pkg.slug === 'basic' || pkg.slug === 'comprehensive');

  const save = () => {
    if (!client || !form.packageId || form.reason.trim().length < 5) return toast.error(ar ? 'حددي العميل والباقة والسبب.' : 'Select the client, package, and reason.');
    const amount = form.originalAmount.trim() ? Math.round(Number(form.originalAmount) * 100) : null;
    if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0)) return toast.error(ar ? 'المبلغ التاريخي غير صحيح.' : 'Historic amount is invalid.');
    create.mutate({ userId: client.id, packageId: Number(form.packageId), originalPurchaseDate: form.originalPurchaseDate || null, oldReference: form.oldReference || null, originalAmountMinor: amount, originalCurrency: amount === null ? null : form.originalCurrency, timedServicesEndAt: form.timedServicesEndAt ? new Date(form.timedServicesEndAt).toISOString() : null, reason: form.reason, notes: form.notes || null });
  };
  const upload = async (id: number, file?: File) => {
    if (!file) return; setUploading(id);
    try {
      const response = await apiFetch(`/api/finance/legacy-migrations/${id}/receipt`, { method: 'POST', headers: { 'content-type': file.type, 'x-file-name': encodeURIComponent(file.name) }, body: file });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Upload failed');
      toast.success(ar ? 'تم إرفاق الإثبات التاريخي.' : 'Historic evidence attached.'); await utils.legacyMigrations.list.invalidate();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Upload failed'); } finally { setUploading(null); }
  };

  return <DashboardLayout><main className="space-y-6 p-4 md:p-6" dir={ar ? 'rtl' : 'ltr'}>
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><ArchiveRestore className="h-6 w-6 text-blue-700" />{ar ? 'ترحيل العملاء القدامى' : 'Legacy Customer Migration'}</h1><p className="mt-1 text-sm text-muted-foreground">{ar ? 'منح استحقاق لدفعة تاريخية سبقت الموقع. لا طلب حالي، ولا تأكيد دفع حالي، ولا إيراد حالي.' : 'Grant entitlement for a payment made before the website. No current order, payment confirmation, or current revenue.'}</p></header>
    {access.error ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">{ar ? 'لا تملك صلاحية هذا المسار.' : 'You do not have access to this workflow.'}</div> : <>
      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">{ar ? '1. إنشاء مسودة ترحيل بلا أثر مالي' : '1. Create a zero-impact migration draft'}</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]"><div><Label>{ar ? 'بريد العميل' : 'Client email'}</Label><Input type="email" value={email} onChange={e => { setEmail(e.target.value); setClient(null); }} /></div><Button className="self-end" variant="outline" onClick={() => lookup.mutate({ email })} disabled={!email || lookup.isPending}><Search className="me-2 h-4 w-4" />{ar ? 'بحث' : 'Find'}</Button></div>
        {client && <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">#{client.id} · {client.name || '—'} · {client.email}</div>}
        {!client && access.data?.canCreateClient && <div className="grid gap-3 rounded-lg border border-dashed p-3 md:grid-cols-[1fr_auto]"><div><Label>{ar ? 'اسم العميل لإنشاء حساب جديد عند الحاجة' : 'Client name, if a new account is needed'}</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} /></div><Button className="self-end" variant="outline" disabled={!email || clientName.trim().length < 2 || createClient.isPending} onClick={() => createClient.mutate({ email, name: clientName })}>{ar ? 'إنشاء الحساب' : 'Create account'}</Button></div>}
        <div className="grid gap-3 md:grid-cols-2"><div><Label>{ar ? 'الباقة' : 'Package'}</Label><select className="h-10 w-full rounded-md border bg-background px-3" value={form.packageId} onChange={e => setForm({ ...form, packageId: e.target.value })}><option value="">—</option>{standardPackages.map((pkg: any) => <option key={pkg.id} value={pkg.id}>{ar ? pkg.nameAr : pkg.nameEn}</option>)}</select></div><div><Label>{ar ? 'تاريخ الشراء القديم (إن عُرف)' : 'Historic purchase date (if known)'}</Label><Input type="date" value={form.originalPurchaseDate} onChange={e => setForm({ ...form, originalPurchaseDate: e.target.value })} /></div><div><Label>{ar ? 'المرجع القديم' : 'Old reference'}</Label><Input value={form.oldReference} onChange={e => setForm({ ...form, oldReference: e.target.value })} /></div><div><Label>{ar ? 'نهاية الخدمات المحددة المدة' : 'Timed-services end'}</Label><Input type="datetime-local" value={form.timedServicesEndAt} onChange={e => setForm({ ...form, timedServicesEndAt: e.target.value })} /></div><div><Label>{ar ? 'المبلغ التاريخي (معلومة فقط)' : 'Historic amount (informational only)'}</Label><Input type="number" min="0" step="0.01" value={form.originalAmount} onChange={e => setForm({ ...form, originalAmount: e.target.value })} /></div><div><Label>{ar ? 'عملة المبلغ القديم' : 'Historic currency'}</Label><Input maxLength={3} value={form.originalCurrency} onChange={e => setForm({ ...form, originalCurrency: e.target.value.toUpperCase() })} /></div></div>
        <div><Label>{ar ? 'سبب الترحيل' : 'Migration reason'}</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div><div><Label>{ar ? 'ملاحظات داخلية' : 'Internal notes'}</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        <Button onClick={save} disabled={create.isPending}>{ar ? 'حفظ المسودة' : 'Save draft'}</Button>
      </section>
      <section className="space-y-3 rounded-2xl border bg-card p-5"><h2 className="font-semibold">{ar ? '2. المسودات والمراجعة' : '2. Drafts and review'}</h2>{list.isLoading ? <p>{ar ? 'جاري التحميل...' : 'Loading...'}</p> : list.data?.map((row: any) => <article key={row.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><strong>#{row.id} · {ar ? row.packageNameAr : row.packageNameEn}</strong><p className="text-xs text-muted-foreground">{ar ? 'عميل' : 'Client'} #{row.userId} · {row.originalPurchaseDate || (ar ? 'التاريخ غير معروف' : 'date unknown')}</p></div><Badge>{labels[row.status]?.[language] || row.status}</Badge></div><p className="mt-2 text-sm" dir="auto">{row.reason}</p><p className="mt-2 text-xs font-semibold text-blue-800">{ar ? 'الأثر المالي: صفر — لا يظهر في الإيرادات' : 'Financial impact: zero — excluded from revenue'}</p><div className="mt-3 flex flex-wrap gap-2">{row.status === 'draft' && <><label className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm"><FileUp className="me-1 h-4 w-4" />{uploading === row.id ? (ar ? 'جاري الرفع...' : 'Uploading...') : row.hasOldReceipt ? (ar ? 'استبدال الإثبات' : 'Replace evidence') : (ar ? 'إرفاق إثبات' : 'Attach evidence')}<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => { void upload(row.id, e.target.files?.[0]); e.currentTarget.value = ''; }} /></label><Button size="sm" onClick={() => submit.mutate({ migrationId: row.id })}><Send className="me-1 h-4 w-4" />{ar ? 'إرسال للمراجعة' : 'Submit'}</Button></>}{row.hasOldReceipt && <Button size="sm" variant="outline" onClick={() => window.open(`/api/finance/legacy-migrations/${row.id}/receipt`, '_blank', 'noopener,noreferrer')}>{ar ? 'عرض الإثبات' : 'View evidence'}</Button>}</div>{access.data?.canApprove && row.status === 'pending_approval' && <div className="mt-3 flex flex-wrap gap-2"><Input className="min-w-64 flex-1" placeholder={ar ? 'سبب القرار' : 'Decision reason'} value={reviewReasons[row.id] || ''} onChange={e => setReviewReasons({ ...reviewReasons, [row.id]: e.target.value })} /><Button size="sm" onClick={() => review.mutate({ migrationId: row.id, decision: 'approved', reason: reviewReasons[row.id] || '' })}><Check className="me-1 h-4 w-4" />{ar ? 'اعتماد وترحيل' : 'Approve & migrate'}</Button><Button size="sm" variant="destructive" onClick={() => review.mutate({ migrationId: row.id, decision: 'rejected', reason: reviewReasons[row.id] || '' })}><X className="me-1 h-4 w-4" />{ar ? 'رفض' : 'Reject'}</Button></div>}</article>)}</section>
    </>}
  </main></DashboardLayout>;
}
