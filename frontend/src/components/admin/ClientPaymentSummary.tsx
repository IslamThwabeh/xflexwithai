import { clientPaymentCoverageLabel, isAvailableClientPaymentSummary, type ClientPaymentSummary as Summary } from '../../../../shared/clientPaymentSummary';
import { formatAdminCurrencyFromIls } from '@/lib/adminCurrency';

/** The same display is used by cards, tables, profiles and printed reports. */
export default function ClientPaymentSummary({ summary, language, details = false, canOpenOrders = false }: {
  summary?: Summary | null; language: string; details?: boolean; canOpenOrders?: boolean;
}) {
  const ar = language === 'ar';
  const available = isAvailableClientPaymentSummary(summary);
  const label = clientPaymentCoverageLabel(summary, language);
  const showAmount = available && (summary.receiptCount > 0 || summary.refundsMinor !== 0);
  const money = (minor: number) => formatAdminCurrencyFromIls(minor / 100, language);
  return <div className="space-y-1 text-xs" data-payment-coverage={summary?.coverage ?? 'unavailable'}>
    {showAmount && <div className="font-semibold text-emerald-800">{money(summary.netPaidMinor)} <span className="font-normal">{ar ? 'صافي موثق' : 'net confirmed'}</span></div>}
    <div className={summary?.coverage === 'needs_reconciliation' ? 'text-amber-800' : 'text-muted-foreground'}>{label}</div>
    {available && summary.unusedPaidKeyCount > 0 && <div className="text-amber-800">{ar ? `مفاتيح مدفوعة غير مستخدمة: ${summary.unusedPaidKeyCount}` : `Paid keys not yet used: ${summary.unusedPaidKeyCount}`}</div>}
    {details && available && <>
      {showAmount && <div>{ar ? 'المقبوضات الموثقة' : 'Confirmed receipts'}: {money(summary.receiptsMinor)} · {ar ? 'الاستردادات الموثقة' : 'Confirmed refunds'}: {money(summary.refundsMinor)}</div>}
      {(summary.historicalOrderCount > 0 || summary.historicalKeyCount > 0) && <div className="text-amber-800">{ar ? 'سجلات تحتاج إلى مراجعة' : 'Records needing review'}: {summary.historicalOrderCount} {ar ? 'طلبات' : 'orders'} · {summary.historicalKeyCount} {ar ? 'مفاتيح' : 'keys'}</div>}
      {summary.orderIds.length > 0 && <div className="flex flex-wrap gap-2">{summary.orderIds.map(id => canOpenOrders ? <a key={id} href={`/admin/orders?orderId=${id}`} className="underline">{ar ? 'طلب' : 'Order'} #{id}</a> : <span key={id}>{ar ? 'طلب' : 'Order'} #{id}</span>)}</div>}
      {summary.keyIds.length > 0 && <div>{ar ? 'مراجع المفاتيح' : 'Key references'}: {summary.keyIds.map(id => `#${id}`).join(', ')}</div>}
      {summary.referencesTruncated && <div>{ar ? 'تُعرض أول ١٠ مراجع فقط لكل نوع' : 'Showing the first 10 references per type'}</div>}
      <div className="text-muted-foreground">{ar ? 'هذه الأرقام لا تثبت اكتمال سجل المدفوعات ولا تعني وجود مبلغ مستحق.' : 'Recorded evidence may not cover all historical payments. Review flags do not establish an amount due.'}</div>
      <div className="text-muted-foreground">{ar ? 'آخر قراءة' : 'Read at'}: {new Date(summary.generatedAt).toLocaleString(ar ? 'ar-EG' : 'en-US')}</div>
    </>}
  </div>;
}
