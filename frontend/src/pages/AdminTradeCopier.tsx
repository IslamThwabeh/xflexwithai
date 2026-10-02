import { useMemo, useState } from 'react';
import { CheckCircle, Copy, ExternalLink, Loader2, RefreshCw, ShieldCheck, TrendingUp } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatAdminCurrencyFromIls } from '@/lib/adminCurrency';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

const statuses = ['pending_payment', 'awaiting_external_link', 'active', 'suspended', 'expired', 'cancelled'] as const;
type CopierStatus = typeof statuses[number];

const statusLabels: Record<CopierStatus, { en: string; ar: string }> = {
  pending_payment: { en: 'Pending payment', ar: 'بانتظار الدفع' },
  awaiting_external_link: { en: 'Awaiting external link', ar: 'بانتظار الربط الخارجي' },
  active: { en: 'Active', ar: 'مفعل' },
  suspended: { en: 'Suspended', ar: 'معلق' },
  expired: { en: 'Expired', ar: 'منتهي' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
};

const statusClass: Record<CopierStatus, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-800',
  awaiting_external_link: 'bg-blue-100 text-blue-800',
  active: 'bg-emerald-100 text-emerald-800',
  suspended: 'bg-slate-100 text-slate-800',
  expired: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

const toDatetimeLocal = (iso?: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const fromDatetimeLocal = (value: string) => value ? new Date(value).toISOString() : '';

type RowDraft = {
  status: CopierStatus;
  externalProvider: string;
  tradingAccountRef: string;
  supportNotes: string;
  paidAt: string;
  paymentReference: string;
  rationale: string;
};

export default function AdminTradeCopier() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<CopierStatus | ''>('');
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>({});

  const { data: access } = trpc.auth.isAdmin.useQuery();
  const { data: financeAuthority } = trpc.roles.myFinanceAuthority.useQuery(undefined, {
    enabled: access?.isAdmin === true,
    retry: false,
  });
  const { data: offer } = trpc.tradeCopier.offer.useQuery();
  const { data: rows, isLoading } = trpc.tradeCopier.adminList.useQuery(filter ? { status: filter, limit: 500 } : { limit: 500 });
  const staffRoles = access?.staffRoles ?? [];
  const canConfirmPayment = financeAuthority?.isFinanceOwner === true || staffRoles.includes('finance_manager');
  const canUpdateLinking = access?.isAdmin === true || staffRoles.includes('support') || staffRoles.includes('key_manager');

  const refresh = () => utils.tradeCopier.adminList.invalidate();
  const confirmPayment = trpc.tradeCopier.adminConfirmPayment.useMutation({
    onSuccess: () => {
      toast.success(isAr ? 'تم تأكيد الدفع ونقل الحالة للربط الخارجي' : 'Payment confirmed and moved to external linking');
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateSubscription = trpc.tradeCopier.adminUpdateSubscription.useMutation({
    onSuccess: () => {
      toast.success(isAr ? 'تم تحديث حالة الناسخ' : 'Trade copier status updated');
      refresh();
    },
    onError: (error) => toast.error(error.message),
  });

  const checkoutUrl = useMemo(() => {
    const path = `/${isAr ? 'ar' : 'en'}/copier/checkout`;
    if (typeof window === 'undefined') return path;
    return `${window.location.origin}${path}`;
  }, [isAr]);

  const list = rows ?? [];
  const stats = useMemo(() => {
    const paidStatuses = new Set<CopierStatus>(['awaiting_external_link', 'active', 'suspended', 'expired']);
    const totalRevenueMinor = list.reduce((sum: number, row: any) => (
      paidStatuses.has(row.status) ? sum + Number(row.amountIlsMinor ?? 0) : sum
    ), 0);
    return {
      total: list.length,
      active: list.filter((row: any) => row.status === 'active').length,
      awaiting: list.filter((row: any) => row.status === 'awaiting_external_link').length,
      pending: list.filter((row: any) => row.status === 'pending_payment').length,
      totalRevenueMinor,
    };
  }, [list]);

  const draftFor = (row: any): RowDraft => drafts[row.id] ?? {
    status: row.status,
    externalProvider: row.externalProvider ?? '',
    tradingAccountRef: row.tradingAccountRef ?? '',
    supportNotes: row.supportNotes ?? '',
    paidAt: toDatetimeLocal(new Date().toISOString()),
    paymentReference: row.paymentReference ?? '',
    rationale: isAr ? 'تأكيد دفع اشتراك الناسخ حسب الوصل المرفوع' : 'Trade copier payment confirmed from uploaded receipt',
  };

  const updateDraft = (row: any, patch: Partial<RowDraft>) => {
    setDrafts((current) => ({ ...current, [row.id]: { ...draftFor(row), ...patch } }));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      toast.success(isAr ? 'تم نسخ رابط الاشتراك' : 'Checkout link copied');
    } catch {
      toast.error(isAr ? 'تعذر النسخ تلقائياً' : 'Could not copy automatically');
    }
  };

  return (
    <DashboardLayout>
      <main className="space-y-6 p-6" dir={isAr ? 'rtl' : 'ltr'}>
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
                {isAr ? 'إدارة الناسخ' : 'Trade Copier'}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                {isAr
                  ? 'استخدم هذا الرابط الخاص مع العملاء عبر الدعم. العميل ينشئ حساباً أو يسجل الدخول، ثم يتم الطلب ورفع الوصل. الربط الفعلي لحساب التداول يتم خارج الموقع.'
                  : 'Use this private link through support. The client registers or signs in, places the order, and uploads the receipt. Actual trading-account linking happens outside the website.'}
              </p>
            </div>
            <Button variant="outline" onClick={() => refresh()}>
              <RefreshCw className="me-2 h-4 w-4" />
              {isAr ? 'تحديث' : 'Refresh'}
            </Button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <Input value={checkoutUrl} readOnly dir="ltr" className="font-mono text-sm" />
            <Button onClick={copyLink}>
              <Copy className="me-2 h-4 w-4" />
              {isAr ? 'نسخ الرابط' : 'Copy link'}
            </Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {isAr
              ? 'ملاحظة: الرابط غير معلن لكنه قابل للمشاركة، لذلك التحكم الحقيقي يتم عبر الحساب، الطلب، وتأكيد الدفع اليدوي.'
              : 'Note: the link is unlisted but shareable, so real control is through account login, order tracking, and manual payment approval.'}
          </p>
        </section>

        <section className="grid gap-3 md:grid-cols-5">
          {[
            [isAr ? 'إجمالي السجلات' : 'Total records', stats.total],
            [isAr ? 'بانتظار الدفع' : 'Pending payment', stats.pending],
            [isAr ? 'بانتظار الربط' : 'Awaiting link', stats.awaiting],
            [isAr ? 'مفعل' : 'Active', stats.active],
            [isAr ? 'دخل الناسخ المؤكد' : 'Confirmed copier revenue', formatAdminCurrencyFromIls(stats.totalRevenueMinor / 100, language)],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-2 text-2xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{isAr ? 'مشتركو الناسخ' : 'Trade copier subscribers'}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {isAr ? 'تتبع الدفع والربط الخارجي لكل عميل.' : 'Track payment and external linking for each client.'}
              </p>
            </div>
            <select className="h-10 rounded-md border bg-white px-3" value={filter} onChange={(event) => setFilter(event.target.value as CopierStatus | '')}>
              <option value="">{isAr ? 'كل الحالات' : 'All statuses'}</option>
              {statuses.map((status) => <option key={status} value={status}>{statusLabels[status][language]}</option>)}
            </select>
          </div>

          {isLoading ? (
            <div className="py-10 text-center text-slate-500">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
          ) : list.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">
              {isAr ? 'لا يوجد مشتركون مطابقون حالياً.' : 'No matching subscribers yet.'}
            </div>
          ) : (
            <div className="space-y-4">
              {list.map((row: any) => {
                const draft = draftFor(row);
                const status = row.status as CopierStatus;
                const canConfirmRow = canConfirmPayment && row.orderStatus !== 'completed' && row.paymentProofUrl;
                return (
                  <article key={row.id} className="rounded-2xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{row.userName || row.userEmail || `#${row.userId}`}</h3>
                          <Badge className={statusClass[status]}>{statusLabels[status][language]}</Badge>
                          <Badge variant="outline">#{row.orderId}</Badge>
                        </div>
                        <p className="mt-1 text-sm text-slate-500" dir="ltr">{row.userEmail} {row.userPhone ? ` · ${row.userPhone}` : ''}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {isAr ? 'أُنشئ' : 'Created'}: {formatLocalizedDate(row.createdAt, language)}
                          {row.endsAt ? ` · ${isAr ? 'ينتهي' : 'Ends'}: ${formatLocalizedDate(row.endsAt, language)}` : ''}
                        </p>
                      </div>
                      <div className="text-end">
                        <p className="font-black">{formatAdminCurrencyFromIls(Number(row.amountIlsMinor ?? 0) / 100, language)}</p>
                        <p className="text-xs text-slate-500">{row.accessDays} {isAr ? 'يوم' : 'days'}</p>
                        <Button asChild size="sm" variant="ghost" className="mt-1">
                          <a href={`/admin/orders?orderId=${row.orderId}`}>
                            <ExternalLink className="me-1 h-4 w-4" />
                            {isAr ? 'الطلب' : 'Order'}
                          </a>
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <h4 className="mb-2 font-semibold">{isAr ? 'الدفع' : 'Payment'}</h4>
                        <p className="text-sm text-slate-600">
                          {isAr ? 'حالة الطلب' : 'Order status'}: <b>{row.orderStatus}</b>
                          {row.paymentReference ? ` · ${row.paymentReference}` : ''}
                        </p>
                        {row.paymentProofUrl ? (
                          <a className="mt-2 inline-flex text-sm font-semibold text-emerald-700 underline" href={row.paymentProofUrl} target="_blank" rel="noreferrer">
                            {isAr ? 'فتح وصل الدفع' : 'Open payment receipt'}
                          </a>
                        ) : (
                          <p className="mt-2 text-sm text-amber-700">{isAr ? 'لم يرفع العميل وصل الدفع بعد.' : 'The client has not uploaded a receipt yet.'}</p>
                        )}
                        {canConfirmPayment && row.orderStatus !== 'completed' && (
                          <div className="mt-3 grid gap-2">
                            <Input type="datetime-local" value={draft.paidAt} onChange={(event) => updateDraft(row, { paidAt: event.target.value })} />
                            <Input value={draft.paymentReference} onChange={(event) => updateDraft(row, { paymentReference: event.target.value })} placeholder={isAr ? 'مرجع الدفع (اختياري)' : 'Payment reference (optional)'} />
                            <Textarea value={draft.rationale} onChange={(event) => updateDraft(row, { rationale: event.target.value })} placeholder={isAr ? 'سبب التأكيد' : 'Confirmation rationale'} />
                            <Button
                              disabled={!canConfirmRow || confirmPayment.isPending || draft.rationale.trim().length < 5}
                              onClick={() => confirmPayment.mutate({
                                orderId: row.orderId,
                                paidAt: fromDatetimeLocal(draft.paidAt),
                                baseAmountIlsMinor: Number(row.amountIlsMinor),
                                paymentReference: draft.paymentReference.trim() || undefined,
                                rationale: draft.rationale.trim(),
                              })}
                            >
                              {confirmPayment.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="me-2 h-4 w-4" />}
                              {isAr ? 'تأكيد الدفع' : 'Confirm payment'}
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <h4 className="mb-2 font-semibold">{isAr ? 'الربط الخارجي' : 'External linking'}</h4>
                        <div className="grid gap-2">
                          <select className="h-10 rounded-md border bg-white px-3" value={draft.status} disabled={!canUpdateLinking} onChange={(event) => updateDraft(row, { status: event.target.value as CopierStatus })}>
                            {statuses.map((item) => <option key={item} value={item}>{statusLabels[item][language]}</option>)}
                          </select>
                          <Input value={draft.externalProvider} disabled={!canUpdateLinking} onChange={(event) => updateDraft(row, { externalProvider: event.target.value })} placeholder={isAr ? 'مزود الناسخ / المنصة' : 'Copier provider / platform'} />
                          <Input value={draft.tradingAccountRef} disabled={!canUpdateLinking} onChange={(event) => updateDraft(row, { tradingAccountRef: event.target.value })} placeholder={isAr ? 'مرجع حساب التداول' : 'Trading account reference'} />
                          <Textarea value={draft.supportNotes} disabled={!canUpdateLinking} onChange={(event) => updateDraft(row, { supportNotes: event.target.value })} placeholder={isAr ? 'ملاحظات الدعم' : 'Support notes'} />
                          {canUpdateLinking && (
                            <Button
                              variant="outline"
                              disabled={updateSubscription.isPending}
                              onClick={() => updateSubscription.mutate({
                                id: row.id,
                                status: draft.status,
                                externalProvider: draft.externalProvider.trim() || null,
                                tradingAccountRef: draft.tradingAccountRef.trim() || null,
                                supportNotes: draft.supportNotes.trim() || null,
                              })}
                            >
                              {updateSubscription.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CheckCircle className="me-2 h-4 w-4" />}
                              {isAr ? 'حفظ حالة الربط' : 'Save linking status'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {offer && (
          <p className="text-xs text-slate-500">
            {isAr
              ? `العرض الحالي: ${formatAdminCurrencyFromIls(offer.amountIlsMinor / 100, language)} لمدة ${offer.accessDays} يوم.`
              : `Current offer: ${formatAdminCurrencyFromIls(offer.amountIlsMinor / 100, language)} for ${offer.accessDays} days.`}
          </p>
        )}
      </main>
    </DashboardLayout>
  );
}
