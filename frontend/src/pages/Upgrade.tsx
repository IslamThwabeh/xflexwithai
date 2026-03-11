import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowUpCircle, Building2, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useLanguage } from '@/contexts/LanguageContext';
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
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </ClientLayout>
    );
  }

  if (!eligibility?.eligible) {
    return (
      <ClientLayout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <ArrowUpCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">
            {isRtl ? 'غير مؤهل للترقية' : 'Not Eligible for Upgrade'}
          </h1>
          <p className="text-gray-500 mb-6">
            {isRtl
              ? 'يجب أن يكون لديك اشتراك أساسي نشط للترقية إلى الباقة الشاملة.'
              : 'You need an active Basic subscription to upgrade to the Comprehensive package.'}
          </p>
          <Link href="/subscriptions">
            <Button variant="outline">{isRtl ? 'عرض اشتراكاتي' : 'View My Subscriptions'}</Button>
          </Link>
        </div>
      </ClientLayout>
    );
  }

  // Prices are VAT-inclusive: extract VAT from the upgrade price
  const total = eligibility.upgradePrice / 100;
  const vatRate = 16;
  const vat = total * vatRate / (100 + vatRate);
  const upgradePrice = total - vat;
  const renewalPrice = eligibility.renewalPrice / 100;

  return (
    <ClientLayout>
      <div className={`max-w-4xl mx-auto px-4 py-8 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
        <Link href="/subscriptions">
          <Button variant="ghost" size="sm" className="mb-6 text-gray-500">
            <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
            {isRtl ? 'العودة' : 'Back'}
          </Button>
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <ArrowUpCircle className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">{isRtl ? 'ترقية الباقة' : 'Upgrade Package'}</h1>
        </div>

        {/* Upgrade Info Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpCircle className="w-6 h-6" />
            <h2 className="text-xl font-bold">
              {isRtl
                ? `ترقية من ${eligibility.currentPackageNameAr} إلى ${eligibility.targetPackageNameAr}`
                : `Upgrade from ${eligibility.currentPackageName} to ${eligibility.targetPackageName}`}
            </h2>
          </div>
          <p className="text-blue-100">
            {isRtl
              ? `ادفع $${total.toFixed(0)} مرة واحدة فقط، ثم التجديد بسعر $${renewalPrice.toFixed(0)} كالمعتاد`
              : `Pay $${total.toFixed(0)} one-time upgrade fee, then renew at $${renewalPrice.toFixed(0)} as usual`}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Method */}
            <div className="bg-white border rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-4">{isRtl ? 'طريقة الدفع' : 'Payment Method'}</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod('bank_transfer')}
                  className={`border-2 rounded-xl p-4 text-start transition-all ${paymentMethod === 'bank_transfer' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Building2 className="w-6 h-6 mb-2 text-blue-600" />
                  <p className="font-bold">{isRtl ? 'حوالة بنكية' : 'Bank Transfer'}</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'تحويل بنكي مع رفع إيصال' : 'Transfer & upload receipt'}</p>
                </button>
                <button
                  onClick={() => setPaymentMethod('paypal')}
                  className={`border-2 rounded-xl p-4 text-start transition-all ${paymentMethod === 'paypal' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <CreditCard className="w-6 h-6 mb-2 text-blue-600" />
                  <p className="font-bold">PayPal</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'دفع عبر PayPal' : 'Pay with PayPal'}</p>
                </button>
              </div>

              {paymentMethod === 'bank_transfer' && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm">
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
            <div className="bg-white border rounded-2xl p-6">
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
            <div className="bg-white border rounded-2xl p-6 sticky top-8">
              <h2 className="font-bold text-lg mb-4">{isRtl ? 'ملخص الترقية' : 'Upgrade Summary'}</h2>

              <div className="flex items-center gap-3 pb-4 border-b mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold">
                  ⬆
                </div>
                <div>
                  <p className="font-bold">{isRtl ? eligibility.targetPackageNameAr : eligibility.targetPackageName}</p>
                  <p className="text-sm text-gray-500">{isRtl ? 'ترقية' : 'Upgrade'}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">{isRtl ? 'رسوم الترقية' : 'Upgrade Fee'}</span>
                  <span>${upgradePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">VAT ({vatRate}%)</span>
                  <span>${vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-700">
                {isRtl
                  ? `بعد الترقية، سيكون التجديد بسعر $${renewalPrice.toFixed(0)}/شهر`
                  : `After upgrade, renewal will be $${renewalPrice.toFixed(0)}/month`}
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
    </ClientLayout>
  );
}
