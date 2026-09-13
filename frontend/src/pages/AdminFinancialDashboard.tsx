import { useMemo, useState } from 'react';
import { BarChart3, Download, Filter, Landmark, Printer, Receipt, RotateCcw, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatAdminCurrencyFromIls } from '@/lib/adminCurrency';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { printReport } from '@/lib/printReport';

type Grouping = 'month' | 'year';

const categoryLabels: Record<string, { en: string; ar: string }> = {
  payroll: { en: 'Payroll', ar: 'الرواتب' },
  advertising: { en: 'Advertising', ar: 'الإعلانات' },
  software_and_subscriptions: { en: 'Software & subscriptions', ar: 'البرامج والاشتراكات' },
  professional_services: { en: 'Professional services', ar: 'الخدمات المهنية' },
  payment_and_bank_fees: { en: 'Payment & bank fees', ar: 'رسوم الدفع والبنوك' },
  rent_and_office: { en: 'Rent & office', ar: 'الإيجار والمكتب' },
  taxes_and_government_fees: { en: 'Taxes & government fees', ar: 'الضرائب والرسوم الحكومية' },
  training_and_content: { en: 'Training & content', ar: 'التدريب والمحتوى' },
  other: { en: 'Other', ar: 'أخرى' },
};

const entryLabels: Record<string, { en: string; ar: string }> = {
  payment: { en: 'Confirmed income', ar: 'دخل مؤكد' },
  refund: { en: 'Refund', ar: 'استرداد' },
  expense: { en: 'Expense', ar: 'مصروف' },
  adjustment: { en: 'Adjustment', ar: 'تسوية' },
  reversal: { en: 'Reversal', ar: 'قيد عكسي' },
  opening_balance: { en: 'Opening balance', ar: 'رصيد افتتاحي' },
};

const purposeLabels: Record<string, { en: string; ar: string }> = {
  new_sale: { en: 'New sale', ar: 'شراء جديد' },
  renewal: { en: 'Paid renewal', ar: 'تجديد مدفوع' },
  upgrade: { en: 'Upgrade', ar: 'ترقية' },
  legacy_migration: { en: 'Legacy migration — no revenue', ar: 'ترحيل قديم — دون إيراد' },
};

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export default function AdminFinancialDashboard() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const year = new Date().getFullYear();
  const initial = { from: `${year}-01-01`, to: new Date().toISOString().slice(0, 10), grouping: 'month' as Grouping };
  const [draftFilters, setDraftFilters] = useState(initial);
  const [filters, setFilters] = useState(initial);
  const query = trpc.financialReports.dashboard.useQuery(filters, {
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: false,
  });
  const data = query.data;
  const fmt = (minor: number) => formatAdminCurrencyFromIls(minor / 100, language);
  const maxPeriodValue = useMemo(() => Math.max(1, ...(data?.periods ?? []).map(period => Math.max(
    period.confirmedIncomeMinor,
    period.expensesMinor,
    Math.abs(period.netAdjustmentsMinor),
    Math.abs(period.operatingProfitLossMinor),
  ))), [data?.periods]);

  const applyFilters = () => {
    if (!draftFilters.from || !draftFilters.to || draftFilters.from > draftFilters.to) {
      toast.error(isRtl ? 'تحقق من نطاق التاريخ' : 'Check the date range');
      return;
    }
    setFilters({ ...draftFilters });
  };

  const exportCsv = () => {
    if (!data) return;
    const rows: unknown[][] = [
      ['Report', 'Management P&L'],
      ['Accounting basis', 'Cash basis: confirmed-payment date; refunds by refund date'],
      ['Currency', 'ILS'],
      ['From', data.from],
      ['To', data.to],
      [],
      ['Period', 'New sales (ILS)', 'Paid renewals (ILS)', 'Upgrades (ILS)', 'Confirmed income (ILS)', 'Refunds (ILS)', 'Net revenue (ILS)', 'Expenses (ILS)', 'Net adjustments/reversals (ILS)', 'Operating profit/loss (ILS)'],
      ...data.periods.map(period => [period.period, (period.newSalesMinor / 100).toFixed(2), (period.renewalsMinor / 100).toFixed(2), (period.upgradesMinor / 100).toFixed(2), (period.confirmedIncomeMinor / 100).toFixed(2), (period.refundsMinor / 100).toFixed(2), (period.netRevenueMinor / 100).toFixed(2), (period.expensesMinor / 100).toFixed(2), (period.netAdjustmentsMinor / 100).toFixed(2), (period.operatingProfitLossMinor / 100).toFixed(2)]),
      ['TOTAL', (data.totals.newSalesMinor / 100).toFixed(2), (data.totals.renewalsMinor / 100).toFixed(2), (data.totals.upgradesMinor / 100).toFixed(2), (data.totals.confirmedIncomeMinor / 100).toFixed(2), (data.totals.refundsMinor / 100).toFixed(2), (data.totals.netRevenueMinor / 100).toFixed(2), (data.totals.expensesMinor / 100).toFixed(2), (data.totals.netAdjustmentsMinor / 100).toFixed(2), (data.totals.operatingProfitLossMinor / 100).toFixed(2)],
      [],
      ['Expense category', 'Approved expenses (ILS)'],
      ...data.categories.map(category => [categoryLabels[category.category]?.en || category.category, (category.amountMinor / 100).toFixed(2)]),
      ['TOTAL EXPENSES', (data.totals.expensesMinor / 100).toFixed(2)],
    ];
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `xflex-management-pnl-${data.from}-${data.to}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <main className="print-title space-y-6 p-4 print:p-0 md:p-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold"><Landmark className="h-6 w-6 text-emerald-700" />{isRtl ? 'لوحة الإدارة المالية' : 'Financial Management Dashboard'}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{isRtl ? 'أساس نقدي بالشيكل: الدخل عند تأكيد الدفع، والاسترداد بتاريخ الاسترداد.' : 'ILS cash basis: income on confirmed-payment date and refunds on refund date.'}</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => printReport(isRtl ? 'تقرير الأرباح والخسائر الإداري' : 'Management Profit & Loss Report')} disabled={!data}><Printer className="me-2 h-4 w-4" />{isRtl ? 'طباعة / PDF' : 'Print / PDF'}</Button>
            <Button variant="outline" onClick={exportCsv} disabled={!data}><Download className="me-2 h-4 w-4" />{isRtl ? 'تصدير P&L CSV' : 'Export P&L CSV'}</Button>
          </div>
        </header>

        <section className="no-print rounded-2xl border bg-card p-4 shadow-sm">
          <div className="grid items-end gap-3 md:grid-cols-[1fr_1fr_180px_auto]">
            <div><Label>{isRtl ? 'من' : 'From'}</Label><Input type="date" value={draftFilters.from} onChange={event => setDraftFilters({ ...draftFilters, from: event.target.value })} /></div>
            <div><Label>{isRtl ? 'إلى' : 'To'}</Label><Input type="date" value={draftFilters.to} onChange={event => setDraftFilters({ ...draftFilters, to: event.target.value })} /></div>
            <div><Label>{isRtl ? 'التجميع' : 'Grouping'}</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draftFilters.grouping} onChange={event => setDraftFilters({ ...draftFilters, grouping: event.target.value as Grouping })}><option value="month">{isRtl ? 'شهري' : 'Monthly'}</option><option value="year">{isRtl ? 'سنوي' : 'Annual'}</option></select></div>
            <Button onClick={applyFilters} disabled={query.isFetching}><Filter className="me-2 h-4 w-4" />{isRtl ? 'تطبيق' : 'Apply'}</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{isRtl ? 'لا يوجد تحديث تلقائي. تتغير البيانات فقط عند فتح الصفحة أو تطبيق نطاق جديد، لحماية حصة D1 اليومية.' : 'No automatic refresh. Data changes only when the page opens or you apply a new range, protecting the daily D1 allowance.'}</p>
        </section>

        {query.isLoading ? <div className="rounded-xl border p-10 text-center text-muted-foreground">{isRtl ? 'جاري تحميل التقرير...' : 'Loading report...'}</div> : query.error ? <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">{query.error.message}</div> : data && <>
          <section className="grid gap-4 print:grid-cols-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-9">
            <Metric icon={Wallet} label={isRtl ? 'مبيعات جديدة' : 'New sales'} value={fmt(data.totals.newSalesMinor)} tone="emerald" />
            <Metric icon={Wallet} label={isRtl ? 'تجديدات مدفوعة' : 'Paid renewals'} value={fmt(data.totals.renewalsMinor)} tone="emerald" />
            <Metric icon={Wallet} label={isRtl ? 'ترقيات' : 'Upgrades'} value={fmt(data.totals.upgradesMinor)} tone="emerald" />
            <Metric icon={Wallet} label={isRtl ? 'الدخل المؤكد' : 'Confirmed income'} value={fmt(data.totals.confirmedIncomeMinor)} tone="emerald" />
            <Metric icon={RotateCcw} label={isRtl ? 'الاستردادات' : 'Refunds'} value={fmt(data.totals.refundsMinor)} tone="rose" />
            <Metric icon={TrendingUp} label={isRtl ? 'صافي الإيراد' : 'Net revenue'} value={fmt(data.totals.netRevenueMinor)} tone="blue" />
            <Metric icon={Receipt} label={isRtl ? 'المصروفات المعتمدة' : 'Approved expenses'} value={fmt(data.totals.expensesMinor)} tone="amber" />
            <Metric icon={RotateCcw} label={isRtl ? 'صافي التسويات والقيود العكسية' : 'Net adjustments/reversals'} value={fmt(data.totals.netAdjustmentsMinor)} tone={data.totals.netAdjustmentsMinor >= 0 ? 'blue' : 'rose'} />
            <Metric icon={data.totals.operatingProfitLossMinor >= 0 ? TrendingUp : TrendingDown} label={isRtl ? 'الربح / الخسارة التشغيلية' : 'Operating profit / loss'} value={fmt(data.totals.operatingProfitLossMinor)} tone={data.totals.operatingProfitLossMinor >= 0 ? 'emerald' : 'rose'} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="rounded-2xl border bg-card p-5 shadow-sm print:break-inside-avoid print:shadow-none">
              <div className="mb-4"><h2 className="font-semibold">{filters.grouping === 'month' ? (isRtl ? 'P&L الشهري' : 'Monthly management P&L') : (isRtl ? 'P&L السنوي' : 'Annual management P&L')}</h2><p className="text-xs text-muted-foreground">{data.from} — {data.to}</p></div>
              {data.periods.length === 0 ? <p className="py-10 text-center text-muted-foreground">{isRtl ? 'لا توجد حركات مالية مؤكدة في هذا النطاق.' : 'No confirmed financial activity in this range.'}</p> : <div className="space-y-4">{data.periods.map(period => <div key={period.period} className="rounded-xl border p-4"><div className="mb-3 flex items-center justify-between"><strong>{period.period}</strong><span className={period.operatingProfitLossMinor >= 0 ? 'font-bold text-emerald-700' : 'font-bold text-red-700'}>{fmt(period.operatingProfitLossMinor)}</span></div><div className="mb-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-xs"><span>{isRtl ? 'جديد' : 'New'}: {fmt(period.newSalesMinor)}</span><span>{isRtl ? 'تجديد' : 'Renewal'}: {fmt(period.renewalsMinor)}</span><span>{isRtl ? 'ترقية' : 'Upgrade'}: {fmt(period.upgradesMinor)}</span></div><div className="space-y-2 text-xs"><Bar label={isRtl ? 'الدخل' : 'Income'} value={period.confirmedIncomeMinor} max={maxPeriodValue} color="bg-emerald-500" formatted={fmt(period.confirmedIncomeMinor)} /><Bar label={isRtl ? 'المصروفات' : 'Expenses'} value={period.expensesMinor} max={maxPeriodValue} color="bg-amber-500" formatted={fmt(period.expensesMinor)} /><Bar label={isRtl ? 'التسويات' : 'Adjustments'} value={Math.abs(period.netAdjustmentsMinor)} max={maxPeriodValue} color={period.netAdjustmentsMinor >= 0 ? 'bg-sky-500' : 'bg-purple-500'} formatted={fmt(period.netAdjustmentsMinor)} /><Bar label={isRtl ? 'الربح/الخسارة' : 'Profit/loss'} value={Math.abs(period.operatingProfitLossMinor)} max={maxPeriodValue} color={period.operatingProfitLossMinor >= 0 ? 'bg-blue-500' : 'bg-red-500'} formatted={fmt(period.operatingProfitLossMinor)} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><span>{isRtl ? 'الاستردادات' : 'Refunds'}: {fmt(period.refundsMinor)}</span><span>{isRtl ? 'صافي الإيراد' : 'Net revenue'}: {fmt(period.netRevenueMinor)}</span></div></div>)}</div>}
            </div>

            <div className="rounded-2xl border bg-card p-5 shadow-sm print:break-inside-avoid print:shadow-none">
              <h2 className="mb-4 font-semibold">{isRtl ? 'المصروفات حسب الفئة' : 'Expenses by category'}</h2>
              {data.categories.length === 0 ? <p className="py-10 text-center text-muted-foreground">{isRtl ? 'لا توجد مصروفات معتمدة.' : 'No approved expenses.'}</p> : <div className="space-y-3">{data.categories.map(category => <div key={category.category} className="flex items-center justify-between gap-3 border-b pb-3 text-sm last:border-0"><span>{categoryLabels[category.category]?.[language] || category.category}</span><strong>{fmt(category.amountMinor)}</strong></div>)}</div>}
            </div>
          </section>

          {data.canViewLedger && <section className="rounded-2xl border bg-card p-5 shadow-sm print:shadow-none"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">{isRtl ? 'دفتر الحركات المعتمدة' : 'Approved ledger'}</h2><p className="text-xs text-muted-foreground">{isRtl ? 'آخر 100 حركة في النطاق؛ لا يشمل المسودات.' : 'Latest 100 entries in the range; drafts are excluded.'}</p></div>{data.ledgerTruncated && <Badge variant="outline">{isRtl ? 'تم تحديد العرض إلى 100' : 'Display limited to 100'}</Badge>}</div><div className="overflow-x-auto print:overflow-visible"><table className="w-full text-sm"><thead className="bg-muted/50"><tr><th className="px-3 py-2 text-start">{isRtl ? 'التاريخ' : 'Date'}</th><th className="px-3 py-2 text-start">{isRtl ? 'النوع' : 'Type'}</th><th className="px-3 py-2 text-start">{isRtl ? 'الغرض' : 'Purpose'}</th><th className="px-3 py-2 text-start">{isRtl ? 'الوصف' : 'Description'}</th><th className="px-3 py-2 text-start">{isRtl ? 'المرجع' : 'Reference'}</th><th className="px-3 py-2 text-end">{isRtl ? 'المبلغ' : 'Amount'}</th></tr></thead><tbody className="divide-y">{(data.ledger as any[]).map(entry => <tr key={entry.id}><td className="px-3 py-2 whitespace-nowrap">{formatLocalizedDate(entry.effectiveAt, language)}</td><td className="px-3 py-2">{entryLabels[entry.entryType]?.[language] || entry.entryType}</td><td className="px-3 py-2">{entry.transactionPurpose ? purposeLabels[entry.transactionPurpose]?.[language] || entry.transactionPurpose : '—'}</td><td className="max-w-md px-3 py-2" dir="auto">{entry.description || '—'}</td><td className="px-3 py-2 font-mono text-xs">{entry.sourceReference || '—'}</td><td className={`px-3 py-2 text-end font-bold ${Number(entry.baseAmountIlsMinor) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(Number(entry.baseAmountIlsMinor))}</td></tr>)}</tbody></table></div>{data.ledger.length === 0 && <p className="py-8 text-center text-muted-foreground">{isRtl ? 'لا توجد حركات.' : 'No ledger entries.'}</p>}</section>}

          <footer className="text-xs text-muted-foreground">{isRtl ? `تم إعداد التقرير: ${formatLocalizedDate(data.generatedAt, language)}. التفعيل والوصول التشغيلي لا يدخلان في هذه الأرقام.` : `Report generated: ${formatLocalizedDate(data.generatedAt, language)}. Activation and operational access are not included in these figures.`}</footer>
        </>}
      </main>
    </DashboardLayout>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof BarChart3; label: string; value: string; tone: 'emerald' | 'rose' | 'blue' | 'amber' }) {
  const tones = { emerald: 'text-emerald-700 bg-emerald-50', rose: 'text-rose-700 bg-rose-50', blue: 'text-blue-700 bg-blue-50', amber: 'text-amber-800 bg-amber-50' };
  return <div className="rounded-2xl border bg-card p-4 shadow-sm"><div className={`mb-3 inline-flex rounded-lg p-2 ${tones[tone]}`}><Icon className="h-5 w-5" /></div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>;
}

function Bar({ label, value, max, color, formatted }: { label: string; value: number; max: number; color: string; formatted: string }) {
  return <div className="grid grid-cols-[80px_1fr_auto] items-center gap-2"><span>{label}</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(value > 0 ? 2 : 0, Math.min(100, (value / max) * 100))}%` }} /></div><span className="font-medium">{formatted}</span></div>;
}
