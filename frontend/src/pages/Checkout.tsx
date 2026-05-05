import { useState } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { ArrowLeft, CreditCard, Building2, ShieldCheck, Gift, Loader2, Tag, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import PublicLayout from '@/components/PublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatIlsAmount, formatUsdAmount, getPackageDisplayPricing } from '@/lib/packagePricing';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function Checkout() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { data: pkg, isLoading } = trpc.packages.bySlug.useQuery({ slug: params.slug || '' });

  const [paymentMethod, setPaymentMethod] = useState<'paypal' | 'bank_transfer'>('bank_transfer');
  const [isGift, setIsGift] = useState(false);
  const [giftEmail, setGiftEmail] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [notes, setNotes] = useState('');

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ couponId: number; code: string; discount: number; discountType: string; discountValue: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  const validateCoupon = trpc.coupons.validate.useQuery(
    { code: couponCode.trim(), subtotal: pkg?.price || 0, packageId: pkg?.id },
    { enabled: false }
  );

  const createOrder = trpc.orders.create.useMutation({
    onSuccess: (data) => {
      toast.success(isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully');
      navigate(`/orders/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center bg-[var(--color-xf-cream)]" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  if (!pkg) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-[var(--color-xf-cream)] px-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <p className="text-gray-500">{isRtl ? 'الباقة غير موجودة' : 'Package not found'}</p>
          <Link href="/"><Button variant="outline">{t('home')}</Button></Link>
        </div>
      </PublicLayout>
    );
  }

  const displayPricing = getPackageDisplayPricing(pkg.slug, pkg.price, pkg.renewalPrice);
  const discountAmount = appliedCoupon ? appliedCoupon.discount / 100 : 0;
  const total = Math.max(displayPricing.usdPrice - discountAmount, 0);
  const vatRate = 16;
  const vat = total * vatRate / (100 + vatRate);
  const subtotal = total - vat;

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponLoading(true);
    try {
      const result = await validateCoupon.refetch();
      if (result.data) {
        setAppliedCoupon(result.data);
        toast.success(isRtl ? 'تم تطبيق الكوبون!' : 'Coupon applied!');
      }
    } catch (err: any) {
      setCouponError(err.message || (isRtl ? 'كوبون غير صالح' : 'Invalid coupon'));
      setAppliedCoupon(null);
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const handleSubmit = () => {
    createOrder.mutate({
      items: [{ itemType: 'package', packageId: pkg.id }],
      paymentMethod,
      isGift,
      giftEmail: isGift ? giftEmail : undefined,
      giftMessage: isGift ? giftMessage : undefined,
      notes: notes || undefined,
      couponCode: appliedCoupon?.code || undefined,
    });
  };

  return (
    <PublicLayout>
      <div className="bg-[var(--color-xf-cream)] py-10 md:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="mb-8 rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:px-8 md:py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <Link href={`/packages/${pkg.slug}`}>
                  <Button variant="ghost" size="sm" className="mb-4 px-0 text-gray-500 hover:bg-transparent hover:text-emerald-700">
                    <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
                    {isRtl ? 'العودة إلى تفاصيل الباقة' : 'Back to Package Details'}
                  </Button>
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">{t('checkout.title')}</h1>
                <p className="mt-3 text-base leading-7 text-gray-600">
                  {isRtl
                    ? 'أكمل الطلب من داخل نفس الواجهة العامة الجديدة مع الحفاظ على نفس خيارات الدفع والخصم الحالية.'
                    : 'Complete the order inside the same branded public shell while keeping the current payment and discount flow intact.'}
                </p>
              </div>
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <p className="font-semibold">{isRtl ? pkg.nameAr : pkg.nameEn}</p>
                <p className="mt-1 text-emerald-700">{pkg.isLifetime ? (isRtl ? 'وصول مدى الحياة' : 'Lifetime access') : ''}</p>
                <p className="mt-1 text-emerald-700">{formatIlsAmount(displayPricing.ilsPrice)} / {formatUsdAmount(displayPricing.usdPrice)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Method */}
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
              <h2 className="font-bold text-lg mb-4">{t('checkout.paymentMethod')}</h2>
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

            {/* Gift option */}
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGift}
                  onChange={(e) => setIsGift(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <Gift className="w-5 h-5 text-pink-500" />
                <span className="font-medium">{isRtl ? 'إرسال كهدية' : 'Send as a gift'}</span>
              </label>
              {isGift && (
                <div className="mt-4 space-y-3 ps-7">
                  <div>
                    <Label>{isRtl ? 'بريد المستلم' : "Recipient's email"}</Label>
                    <Input value={giftEmail} onChange={(e) => setGiftEmail(e.target.value)} type="email" className="mt-1" />
                  </div>
                  <div>
                    <Label>{isRtl ? 'رسالة الهدية (اختياري)' : 'Gift message (optional)'}</Label>
                    <Textarea value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} rows={2} className="mt-1" />
                  </div>
                </div>
              )}
            </div>

            {/* Coupon Code */}
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-5 h-5 text-emerald-500" />
                <span className="font-medium">{isRtl ? 'كوبون خصم' : 'Discount Code'}</span>
              </div>
              {appliedCoupon ? (
                <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium text-sm">{appliedCoupon.code}</span>
                    <span className="text-xs">
                      ({appliedCoupon.discountType === 'percentage' ? `${appliedCoupon.discountValue}%` : `$${(appliedCoupon.discountValue / 100).toFixed(2)}`} {isRtl ? 'خصم' : 'off'})
                    </span>
                  </div>
                  <button onClick={removeCoupon} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <Input
                      value={couponCode}
                      onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(''); }}
                      placeholder={isRtl ? 'أدخل كود الخصم' : 'Enter coupon code'}
                      dir="ltr"
                      className="flex-1"
                    />
                    <Button onClick={handleApplyCoupon} disabled={couponLoading || !couponCode.trim()} variant="outline">
                      {couponLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRtl ? 'تطبيق' : 'Apply')}
                    </Button>
                  </div>
                  {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
              <Label>{isRtl ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-2" placeholder={isRtl ? 'أي ملاحظات إضافية...' : 'Any additional notes...'} />
            </div>
          </div>

          {/* Right: Order Summary */}
          <div>
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 sticky top-24 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
              <h2 className="font-bold text-lg mb-4">{t('checkout.summary')}</h2>

              <div className="flex items-center gap-3 pb-4 border-b mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center text-white font-bold">
                  {pkg.slug === 'basic' ? 'B' : 'C'}
                </div>
                <div>
                  <p className="font-bold">{isRtl ? pkg.nameAr : pkg.nameEn}</p>
                  <p className="text-sm text-gray-500">{pkg.isLifetime ? (isRtl ? 'مدى الحياة' : 'Lifetime') : ''}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">{isRtl ? 'السعر المرجعي المحلي' : 'Local price reference'}</span>
                  <span>{formatIlsAmount(displayPricing.ilsPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{isRtl ? 'السعر المفوتر (USD)' : 'Billed price (USD)'}</span>
                  <span>{formatUsdAmount(subtotal, true)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-green-600">
                    <span>{isRtl ? 'خصم (USD)' : 'Discount (USD)'}</span>
                    <span>-{formatUsdAmount(discountAmount, true)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">VAT ({vatRate}%) USD</span>
                  <span>{formatUsdAmount(vat, true)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>{isRtl ? 'الإجمالي المفوتر الآن (USD)' : 'Total billed now (USD)'}</span>
                  <span>{formatUsdAmount(total, true)}</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-xs text-slate-600 leading-6 mb-4">
                {isRtl
                  ? 'السعر بالشيكل معروض كمرجع محلي، بينما يتم إنشاء الطلب والفاتورة بالدولار الأمريكي حتى تبقى الخصومات والإجمالي متطابقة مع النظام.'
                  : 'The shekel price is shown as a local reference, while the order and invoice are created in USD so discounts and totals stay aligned with the backend.'}
              </div>

              <Button
                onClick={handleSubmit}
                disabled={createOrder.isPending || (isGift && !giftEmail)}
                className="w-full h-12 text-base"
                size="lg"
              >
                {createOrder.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin me-2" />
                ) : (
                  <ShieldCheck className="w-4 h-4 me-2" />
                )}
                {createOrder.isPending
                  ? (isRtl ? 'جاري الإنشاء...' : 'Processing...')
                  : (isRtl ? 'إتمام الطلب' : 'Place Order')}
              </Button>

              <p className="text-xs text-gray-400 text-center mt-3">
                {isRtl ? 'بالضغط على إتمام الطلب، أنت توافق على ' : 'By placing your order, you agree to our '}
                <Link href="/terms"><span className="underline cursor-pointer">{isRtl ? 'شروط الخدمة' : 'Terms of Service'}</span></Link>
              </p>
            </div>
          </div>
        </div>
      </div>
      </div>
    </PublicLayout>
  );
}
