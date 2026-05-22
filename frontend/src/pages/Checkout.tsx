import { useState } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { ArrowLeft, Building2, ShieldCheck, Gift, Loader2, Tag, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatIlsAmount, getPackageDisplayPricing } from '@/lib/packagePricing';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';

export default function Checkout() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { data: pkg, isLoading } = trpc.packages.bySlug.useQuery({ slug: params.slug || '' });

  const paymentMethod = 'bank_transfer' as const;
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
      <CinematicPublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center bg-[#050505]" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </CinematicPublicLayout>
    );
  }

  if (!pkg) {
    return (
      <CinematicPublicLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-[#050505] px-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <p className="text-white/58">{isRtl ? 'الباقة غير موجودة' : 'Package not found'}</p>
          <Link href="/"><Button variant="outline" className="border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white">{t('home')}</Button></Link>
        </div>
      </CinematicPublicLayout>
    );
  }

  const displayPricing = getPackageDisplayPricing(pkg.slug, pkg.price, pkg.renewalPrice);
  // Backend coupon `discount` is returned in USD cents (matches pkg.price). Convert to ILS
  // using the same 3.5x reference rate used by packagePricing.ts so the on-screen summary stays
  // consistent with the marketing ILS prices.
  const USD_TO_ILS = 3.5;
  const discountIls = appliedCoupon ? (appliedCoupon.discount / 100) * USD_TO_ILS : 0;
  const totalIls = Math.max(displayPricing.ilsPrice - discountIls, 0);
  const vatRate = 16;
  const vatIls = totalIls * vatRate / (100 + vatRate);
  const subtotalIls = totalIls - vatIls;

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
    <CinematicPublicLayout>
      <div className="bg-[#050505] py-10 md:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-[var(--color-xf-cream)] py-10 md:py-14">
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
                    ? 'أكمل طلبك بخطوات واضحة وآمنة، وسيتابع الفريق معك تعليمات الحوالة البنكية وتأكيد الطلب.'
                    : 'Complete your order through a clear, secure flow, and the team will follow up with bank transfer instructions and order confirmation.'}
                </p>
              </div>
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <p className="font-semibold">{isRtl ? pkg.nameAr : pkg.nameEn}</p>
                <p className="mt-1 text-emerald-700">{pkg.isLifetime ? (isRtl ? 'وصول مدى الحياة' : 'Lifetime access') : ''}</p>
                <p className="mt-1 text-emerald-700">{formatIlsAmount(displayPricing.ilsPrice)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Method */}
            <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
              <h2 className="font-bold text-lg mb-4">{t('checkout.paymentMethod')}</h2>
              <div className="grid gap-3">
                <div className="border-2 rounded-xl border-emerald-500 bg-emerald-50 p-4 text-start">
                  <Building2 className="w-6 h-6 mb-2 text-emerald-600" />
                  <p className="font-bold">{isRtl ? 'حوالة بنكية' : 'Bank Transfer'}</p>
                  <p className="text-xs text-gray-500">{isRtl ? 'تحويل بنكي مع رفع إيصال' : 'Transfer & upload receipt'}</p>
                </div>
              </div>

              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm">
                <p className="font-medium mb-1">{isRtl ? 'تعليمات التحويل البنكي:' : 'Bank Transfer Instructions:'}</p>
                <p className="text-gray-600">
                  {isRtl
                    ? 'بعد إنشاء الطلب، قم بتحويل المبلغ المطلوب ثم ارفع صورة الإيصال في صفحة الطلب.'
                    : 'After placing your order, transfer the required amount and upload the receipt on the order page.'}
                </p>
              </div>
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
                      ({appliedCoupon.discountType === 'percentage' ? `${appliedCoupon.discountValue}%` : `${formatIlsAmount((appliedCoupon.discountValue / 100) * USD_TO_ILS, true)}`} {isRtl ? 'خصم' : 'off'})
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
                  <span className="text-gray-500">{isRtl ? 'السعر قبل الضريبة' : 'Subtotal'}</span>
                  <span>{formatIlsAmount(subtotalIls, true)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-green-600">
                    <span>{isRtl ? 'خصم' : 'Discount'}</span>
                    <span>-{formatIlsAmount(discountIls, true)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">{isRtl ? `ضريبة القيمة المضافة (${vatRate}%)` : `VAT (${vatRate}%)`}</span>
                  <span>{formatIlsAmount(vatIls, true)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
                  <span>{formatIlsAmount(totalIls, true)}</span>
                </div>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 text-xs text-slate-600 leading-6 mb-4">
                {isRtl
                  ? 'الأسعار معروضة بالشيكل (₪). سيتم تأكيد المبلغ النهائي وتعليمات الحوالة البنكية مع فريق الدعم بعد إنشاء الطلب.'
                  : 'Prices are shown in shekel (₪). The final amount and bank transfer instructions will be confirmed with the support team after the order is placed.'}
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
      </div>
    </CinematicPublicLayout>
  );
}
