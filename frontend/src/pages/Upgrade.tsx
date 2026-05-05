import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowUpCircle, Building2, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatIlsAmount, getUpgradeDisplayPricing } from '@/lib/packagePricing';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';
import { toast } from 'sonner';

export default function Upgrade() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [, navigate] = useLocation();
  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'bank_transfer'>('bank_transfer');
  const [notes, setNotes] = useState('');

  // Get the comprehensive package to check eligibility
  const { data: comprehensivePkg } = trpc.packages.bySlug.useQuery({ slug: 'comprehensive' });

  const { data: eligibility, isLoading } = trpc.upgrade.checkEligibility.useQuery(
    { targetPackageId: comprehensivePkg?.id || 0 },
    { enabled: !!comprehensivePkg?.id }
  );

  const createUpgradeOrder = trpc.upgrade.createOrder.useMutation({
    onSuccess: (data) => {
      toast.success(isRtl ? 'تم إنشاء طلب الترقية بنجاح' : 'Upgrade order created successfully');
      navigate(`/orders/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSubmit = () => {
    if (!comprehensivePkg) return;
    createUpgradeOrder.mutate({
      targetPackageId: comprehensivePkg.id,
      paymentMethod,
      notes: notes || undefined,
    });
  };

  if (isLoading || !comprehensivePkg) {
    return (
      <ClientLayout>
        <div className="min-h-[60vh] flex items-center justify-center bg-[var(--color-xf-cream)]">
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </ClientLayout>
    );
  }

  if (!eligibility?.eligible) {
    return (
      <ClientLayout>
        <div className="bg-[var(--color-xf-cream)] py-12 md:py-16" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="max-w-2xl mx-auto px-4">
            <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:px-8">
              <ArrowUpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2 text-gray-900">
                {isRtl ? 'غير مؤهل للترقية' : 'Not Eligible for Upgrade'}
              </h1>
              <p className="text-gray-500 mb-6 leading-7">
                {isRtl
                  ? 'يجب أن يكون لديك اشتراك أساسي نشط للترقية إلى الباقة الشاملة.'
                  : 'You need an active Basic subscription to upgrade to the Comprehensive package.'}
              </p>
              <Link href="/my-packages">
                <Button variant="outline" className="border-slate-200 bg-white">{isRtl ? 'عرض باقتي' : 'View My Package'}</Button>
              </Link>
            </div>
          </div>
        </div>
      </ClientLayout>
    );
  }

  const upgradePricing = getUpgradeDisplayPricing('basic', 'comprehensive', eligibility.upgradePrice, eligibility.renewalPrice);
  // Display in ILS. Backend still records the order in USD; final amount is confirmed at payment.
  const totalIls = upgradePricing.ilsPrice;
  const vatRate = 16;
  const vatIls = totalIls * vatRate / (100 + vatRate);
  const upgradePriceIls = totalIls - vatIls;

  return (
    <ClientLayout>
      <div className="bg-[var(--color-xf-cream)] py-10 md:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="mb-8 rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:px-8 md:py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Link href="/my-packages">
                  <Button variant="ghost" size="sm" className="mb-4 px-0 text-gray-500 hover:bg-transparent hover:text-emerald-700">
                    <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
                    {isRtl ? 'العودة إلى باقتي' : 'Back to My Package'}
                  </Button>
                </Link>
                <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">{isRtl ? 'ترقية الباقة' : 'Upgrade Package'}</h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
                  {isRtl
                    ? 'أكمل الترقية من نفس الواجهة المنسقة مع الحفاظ على مسار الدفع الحالي وربط الطلب بحسابك مباشرة.'
                    : 'Complete the upgrade inside the same branded flow while keeping the current payment process and linking the order directly to your account.'}
                </p>
              </div>
              <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">
                  {isRtl
                    ? `${eligibility.currentPackageNameAr} ← ${eligibility.targetPackageNameAr}`
                    : `${eligibility.currentPackageName} → ${eligibility.targetPackageName}`}
                </p>
                <p className="mt-1 text-amber-700">{isRtl ? 'ترقية لمرة واحدة' : 'One-time upgrade'}</p>
              </div>
            </div>
          </div>

          <div className="mb-8 rounded-[28px] bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white shadow-[0_20px_50px_rgba(16,185,129,0.2)] md:p-8">
            <div className="flex items-center gap-2 mb-3">
              <ArrowUpCircle className="w-6 h-6" />
              <h2 className="text-xl font-bold">
                {isRtl
                  ? `ترقية من ${eligibility.currentPackageNameAr} إلى ${eligibility.targetPackageNameAr}`
                  : `Upgrade from ${eligibility.currentPackageName} to ${eligibility.targetPackageName}`}
              </h2>
            </div>
            <p className="text-emerald-50 leading-7">
              {isRtl
                ? `ادفع ${formatIlsAmount(upgradePricing.ilsPrice)} لمرة واحدة، ثم جدّد بسعر ${formatIlsAmount(upgradePricing.ilsRenewal ?? 0)} كالمعتاد.`
                : `Pay ${formatIlsAmount(upgradePricing.ilsPrice)} once, then renew at ${formatIlsAmount(upgradePricing.ilsRenewal ?? 0)} as usual.`}
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Method */}
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
              <h2 className="font-bold text-lg mb-4">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={`border-2 rounded-xl p-4 text-start transition-all ${paymentMethod === 'bank_transfer' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Building2 className="w-6 h-6 mb-2 text-emerald-600" />
                  <p className="font-bold">{isRtl ? 'حوالة بنكية' : 'Bank Transfer'}</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'تحويل بنكي مع رفع إيصال' : 'Transfer & upload receipt'}</p>
                </button>
                <button
                  onClick={() => setPaymentMethod('paypal')}
                  className={`border-2 rounded-xl p-4 text-start transition-all ${paymentMethod === 'paypal' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <CreditCard className="w-6 h-6 mb-2 text-emerald-600" />
                  <p className="font-bold">PayPal</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'دفع عبر PayPal' : 'Pay with PayPal'}</p>
                </button>
              </div>

              {paymentMethod === 'bank_transfer' && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
                  <p className="font-medium mb-1">{isRtl ? 'تعليمات التحويل البنكي:' : 'Bank Transfer Instructions:'}</p>
                  <p className="text-gray-600">
                    {isRtl
                      ? 'بعد إنشاء الطلب، قم بتحويل المبلغ المطلوب ثم ارفع صورة الإيصال في صفحة الطلب.'
                      : 'After placing your order, transfer the required amount and upload the receipt on the order page.'}
                  </p>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
              <Label>{isRtl ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-2"
                placeholder={isRtl ? 'أي ملاحظات إضافية...' : 'Any additional notes...'}
              />
            </div>
          </div>

          {/* Right: Order Summary */}
          <div>
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 sticky top-24 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
              <h2 className="font-bold text-lg mb-4">{isRtl ? 'ملخص الترقية' : 'Upgrade Summary'}</h2>

              <div className="flex items-center gap-3 pb-4 border-b mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-emerald-700 rounded-xl flex items-center justify-center text-white font-bold">
                  ⬆
                </div>
                <div>
                  <p className="font-bold">{isRtl ? eligibility.targetPackageNameAr : eligibility.targetPackageName}</p>
                  <p className="text-sm text-gray-500">{isRtl ? 'ترقية' : 'Upgrade'}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">{isRtl ? 'صافي الترقية' : 'Upgrade subtotal'}</span>
                  <span>{formatIlsAmount(upgradePriceIls, true)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{isRtl ? `ضريبة القيمة المضافة (${vatRate}%)` : `VAT (${vatRate}%)`}</span>
                  <span>{formatIlsAmount(vatIls, true)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
                  <span>{formatIlsAmount(totalIls, true)}</span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs text-emerald-700 leading-6">
                {isRtl
                  ? `بعد الترقية، سيكون التجديد بسعر ${formatIlsAmount(upgradePricing.ilsRenewal ?? 0)}`
                  : `After upgrade, renewal will be ${formatIlsAmount(upgradePricing.ilsRenewal ?? 0)}`}
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-xs text-slate-600 leading-6 mb-4">
                {isRtl
                  ? 'الأسعار معروضة بالشيكل (₪). سيتم تأكيد المبلغ النهائي ووسيلة الدفع مع فريق الدعم بعد إنشاء طلب الترقية.'
                  : 'Prices are shown in shekel (₪). The final amount and payment method will be confirmed with the support team after the upgrade order is placed.'}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={createUpgradeOrder.isPending}
                className="w-full h-12 text-base"
                size="lg"
              >
                {createUpgradeOrder.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                ) : (
                  <ShieldCheck className="w-4 h-4 me-2" />
                )}
                {createUpgradeOrder.isPending
                  ? (isRtl ? 'جاري الإنشاء...' : 'Processing...')
                  : (isRtl ? 'تأكيد الترقية' : 'Confirm Upgrade')}
              </Button>

              <p className="text-xs text-gray-400 text-center mt-3">
                {isRtl ? 'بالضغط على تأكيد الترقية، أنت توافق على ' : 'By confirming, you agree to our '}
                <Link href="/terms"><span className="underline cursor-pointer">{isRtl ? 'شروط الخدمة' : 'Terms of Service'}</span></Link>
              </p>
            </div>
          </div>
        </div>
        </div>
      </div>
    </ClientLayout>
  );
}
