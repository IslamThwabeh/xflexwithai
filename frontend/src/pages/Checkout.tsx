import { useState } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { ArrowLeft, CreditCard, Building2, ShieldCheck, Gift, Loader2, Tag, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">{isRtl ? 'الباقة غير موجودة' : 'Package not found'}</p>
        <Link href="/"><Button variant="outline">{t('home')}</Button></Link>
      </div>
    );
  }

  // Prices are VAT-inclusive: extract VAT from the displayed price
  const discountAmount = appliedCoupon ? appliedCoupon.discount / 100 : 0;
  const total = pkg.price / 100 - discountAmount;
  const vatRate = 16;
  const vat = total * vatRate / (100 + vatRate);
  const price = total - vat;

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
    <div className={`min-h-screen bg-gray-50 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href={`/packages/${pkg.slug}`}>
          <Button variant="ghost" size="sm" className="mb-6 text-gray-500">
            <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
            {isRtl ? 'العودة' : 'Back'}
          </Button>
        </Link>

        <h1 className="text-3xl font-bold mb-8">{t('checkout.title')}</h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Payment Method */}
            <div className="bg-white border rounded-2xl p-6">
              <h2 className="font-bold text-lg mb-4">{t('checkout.paymentMethod')}</h2>
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

            {/* Gift option */}
            <div className="bg-white border rounded-2xl p-6">
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
            <div className="bg-white border rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-5 h-5 text-blue-500" />
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
            <div className="bg-white border rounded-2xl p-6">
              <Label>{isRtl ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-2" placeholder={isRtl ? 'أي ملاحظات إضافية...' : 'Any additional notes...'} />
            </div>
          </div>

          {/* Right: Order Summary */}
          <div>
            <div className="bg-white border rounded-2xl p-6 sticky top-8">
              <h2 className="font-bold text-lg mb-4">{t('checkout.summary')}</h2>

              <div className="flex items-center gap-3 pb-4 border-b mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center text-white font-bold">
                  {pkg.slug === 'basic' ? 'B' : 'C'}
                </div>
                <div>
                  <p className="font-bold">{isRtl ? pkg.nameAr : pkg.nameEn}</p>
                  <p className="text-sm text-gray-500">{pkg.isLifetime ? (isRtl ? 'مدى الحياة' : 'Lifetime') : ''}</p>
                </div>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">{isRtl ? 'السعر' : 'Price'}</span>
                  <span>${price.toFixed(2)}</span>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between text-green-600">
                    <span>{isRtl ? 'خصم' : 'Discount'}</span>
                    <span>-${discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">VAT ({vatRate}%)</span>
                  <span>${vat.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
                  <span>${total.toFixed(2)}</span>
                </div>
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
  );
}
