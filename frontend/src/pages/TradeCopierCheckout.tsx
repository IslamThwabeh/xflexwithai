import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, Building2, CheckCircle, Copy, LogIn, Loader2, ShieldCheck, TrendingUp, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RegisterForm } from '@/components/RegisterForm';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { CURRENT_TERMS_VERSION } from '@/lib/legalVersions';
import { formatIlsAmount } from '@/lib/packagePricing';
import { trpc } from '@/lib/trpc';

function CopierAccountGate({ isRtl }: { isRtl: boolean }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const checkoutPath = `/${isRtl ? 'ar' : 'en'}/copier/checkout`;
  const loginHref = `/auth?mode=login&next=${encodeURIComponent(checkoutPath)}`;

  return (
    <CinematicPublicLayout>
      <div className="bg-[#050505] py-10 md:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-[var(--color-xf-cream)] py-10 text-slate-900 md:py-14">
          <div className="mx-auto max-w-2xl px-4">
            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
              <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 px-6 py-7 sm:px-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                  {isRtl ? 'الخطوة 1 من 2' : 'Step 1 of 2'}
                </div>
                <h1 className="mt-4 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                  {isRtl ? 'أنشئ حسابك لإكمال اشتراك الناسخ' : 'Create your account to complete copier access'}
                </h1>
                <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                  {isRtl
                    ? 'بعد إنشاء الحساب أو تسجيل الدخول ستعود إلى صفحة الناسخ الخاصة لإتمام الطلب ورفع وصل التحويل.'
                    : 'After registering or signing in, you will return to the private copier checkout to place the order and upload your receipt.'}
                </p>
              </div>

              <div className="p-5 sm:p-8">
                <div className="mb-7 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
                  <button
                    type="button"
                    onClick={() => setMode('register')}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all ${
                      mode === 'register' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <UserPlus className="h-4 w-4" />
                    {isRtl ? 'عميل جديد' : 'New customer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all ${
                      mode === 'login' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LogIn className="h-4 w-4" />
                    {isRtl ? 'لدي حساب' : 'I have an account'}
                  </button>
                </div>

                {mode === 'register' ? (
                  <RegisterForm />
                ) : (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-center sm:p-6">
                    <LogIn className="mx-auto h-8 w-8 text-emerald-600" />
                    <h2 className="mt-3 text-lg font-bold text-slate-950">{isRtl ? 'مرحباً بعودتك' : 'Welcome back'}</h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-600">
                      {isRtl
                        ? 'سجل الدخول وسنعيدك مباشرة إلى رابط الناسخ الخاص.'
                        : 'Sign in and we will return you directly to the private copier link.'}
                    </p>
                    <Link href={loginHref}>
                      <Button className="mt-5 w-full bg-emerald-600 text-white hover:bg-emerald-700">
                        <LogIn className="h-4 w-4" />
                        {isRtl ? 'المتابعة لتسجيل الدخول' : 'Continue to sign in'}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </CinematicPublicLayout>
  );
}

export default function TradeCopierCheckout() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [notes, setNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const { data: offer, isLoading: offerLoading } = trpc.tradeCopier.offer.useQuery();
  const createOrder = trpc.tradeCopier.createOrder.useMutation({
    onSuccess: (result) => {
      toast.success(isRtl ? 'تم إنشاء طلب الناسخ بنجاح' : 'Trade copier order created');
      navigate(`/orders/${result.order.id}`);
    },
    onError: (error) => toast.error(error.message),
  });

  if (authLoading || offerLoading || !offer) {
    return (
      <CinematicPublicLayout>
        <div className="flex min-h-[60vh] items-center justify-center bg-[#050505]" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
        </div>
      </CinematicPublicLayout>
    );
  }

  if (!isAuthenticated) return <CopierAccountGate isRtl={isRtl} />;

  const totalIls = offer.amountIlsMinor / 100;
  const vatRate = 16;
  const vatIls = totalIls * vatRate / (100 + vatRate);
  const subtotalIls = totalIls - vatIls;

  const handleSubmit = () => {
    createOrder.mutate({
      paymentMethod: 'bank_transfer',
      notes: notes.trim() || undefined,
      termsAcceptedAt: new Date().toISOString(),
      termsAcceptedVersion: CURRENT_TERMS_VERSION,
    });
  };

  return (
    <CinematicPublicLayout>
      <div className="bg-[#050505] py-10 md:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-[var(--color-xf-cream)] py-10 text-slate-900 md:py-14">
          <div className="mx-auto max-w-5xl px-4">
            <div className="mb-8 rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:px-8 md:py-8">
              <Link href="/">
                <Button variant="ghost" size="sm" className="mb-4 px-0 text-gray-500 hover:bg-transparent hover:text-emerald-700">
                  <ArrowLeft className={`h-4 w-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
                  {isRtl ? 'العودة للرئيسية' : 'Back home'}
                </Button>
              </Link>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">{isRtl ? 'اشتراك الناسخ' : 'Trade Copier Subscription'}</h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
                    {isRtl
                      ? 'هذا رابط خاص لإتمام طلب الناسخ عبر الموقع. بعد الدفع ورفع الوصل، يقوم فريق الدعم بمتابعة ربط حساب التداول خارج الموقع.'
                      : 'This is a private checkout link for the trade copier. After payment and receipt upload, support will handle external trading-account linking outside the website.'}
                  </p>
                </div>
                <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  <p className="font-semibold">{isRtl ? offer.nameAr : offer.nameEn}</p>
                  <p className="mt-1 text-emerald-700">{isRtl ? `${offer.accessDays} يوم` : `${offer.accessDays} days`}</p>
                  <p className="mt-1 text-emerald-700">{formatIlsAmount(totalIls)}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
                  <h2 className="mb-4 text-lg font-bold">{isRtl ? 'طريقة الدفع' : 'Payment method'}</h2>
                  <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50 p-4 text-start">
                    <Building2 className="mb-2 h-6 w-6 text-emerald-600" />
                    <p className="font-bold">{isRtl ? 'حوالة بنكية' : 'Bank Transfer'}</p>
                    <p className="text-xs text-gray-500">{isRtl ? 'تحويل بنكي مع رفع إيصال' : 'Transfer and upload receipt'}</p>
                  </div>
                  <div className="mt-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm">
                    <p className="mb-1 font-medium">{isRtl ? 'تعليمات التحويل البنكي:' : 'Bank transfer instructions:'}</p>
                    <p className="text-gray-600">
                      {isRtl
                        ? 'بعد إنشاء الطلب، حوّل المبلغ المطلوب ثم ارفع صورة الإيصال في صفحة الطلب. لن يبدأ الربط الخارجي قبل تأكيد الدفع.'
                        : 'After placing the order, transfer the required amount and upload the receipt on the order page. External linking starts only after payment is confirmed.'}
                    </p>
                  </div>
                </div>

                <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-950">
                  <div className="mb-2 flex items-center gap-2 font-bold">
                    <TrendingUp className="h-5 w-5" />
                    {isRtl ? 'تنبيه مهم قبل الاشتراك' : 'Important notice before subscribing'}
                  </div>
                  <ul className="list-disc space-y-1 ps-6">
                    <li>{isRtl ? 'الناسخ ينسخ صفقات حساب مصدر إلى حسابات تداول مرتبطة عبر مزود أو إعداد خارجي.' : 'The copier copies trades from a source account to linked trading accounts through an external provider or setup.'}</li>
                    <li>{isRtl ? 'نتائج الربح والخسارة قد تختلف حسب حجم الحساب، الإعدادات، سرعة التنفيذ، السبريد، والانزلاق السعري.' : 'Profit and loss results may differ based on account size, settings, execution speed, spread, and slippage.'}</li>
                    <li>{isRtl ? 'لا يوجد ضمان أرباح أو ضمان مطابقة النتائج بين الحساب المصدر وحسابك.' : 'There is no profit guarantee and no guarantee that your account will match the source account results.'}</li>
                    <li>{isRtl ? 'مدة الوصول لهذا العرض سنة واحدة ما لم يتم الاتفاق كتابياً على خلاف ذلك.' : 'This offer grants one year of access unless otherwise agreed in writing.'}</li>
                  </ul>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
                  <label className="font-medium">{isRtl ? 'ملاحظات للدعم (اختياري)' : 'Notes for support (optional)'}</label>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    className="mt-2"
                    placeholder={isRtl ? 'مثلاً: اسم منصة التداول أو رقم الحساب إن طلبه الدعم...' : 'Example: trading platform or account number if support requested it...'}
                  />
                </div>
              </div>

              <div>
                <div className="sticky top-24 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
                  <h2 className="mb-4 text-lg font-bold">{isRtl ? 'ملخص الطلب' : 'Order summary'}</h2>
                  <div className="mb-4 flex items-center gap-3 border-b pb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 font-bold text-white">
                      <Copy className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold">{isRtl ? offer.nameAr : offer.nameEn}</p>
                      <p className="text-sm text-gray-500">{isRtl ? 'ربط خارجي بعد تأكيد الدفع' : 'External linking after payment approval'}</p>
                    </div>
                  </div>

                  <div className="mb-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{isRtl ? 'السعر قبل الضريبة' : 'Subtotal'}</span>
                      <span>{formatIlsAmount(subtotalIls, true)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{isRtl ? `ضريبة القيمة المضافة (${vatRate}%)` : `VAT (${vatRate}%)`}</span>
                      <span>{formatIlsAmount(vatIls, true)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-2 text-base font-bold">
                      <span>{isRtl ? 'الإجمالي' : 'Total'}</span>
                      <span>{formatIlsAmount(totalIls, true)}</span>
                    </div>
                  </div>

                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-600">
                    {isRtl
                      ? 'بعد رفع الوصل وتأكيد الدفع، ستظهر الحالة لدى فريق الدعم ليتم ربط حساب التداول خارجياً.'
                      : 'After receipt upload and payment approval, support will see the status and complete trading-account linking externally.'}
                  </div>

                  <div className="mb-4 flex items-start gap-3 text-sm text-gray-600">
                    <input
                      id="copier-terms"
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div className="leading-6">
                      <label htmlFor="copier-terms" className="cursor-pointer select-none">
                        {isRtl ? 'أوافق على ' : 'I agree to the '}
                      </label>
                      <Link href="/terms"><span className="cursor-pointer font-medium text-emerald-700 underline">{isRtl ? 'الشروط والأحكام' : 'Terms & Conditions'}</span></Link>
                      <span>{isRtl ? ' و' : ' and '}</span>
                      <Link href="/refund-policy"><span className="cursor-pointer font-medium text-emerald-700 underline">{isRtl ? 'سياسة الاسترداد' : 'Refund Policy'}</span></Link>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {isRtl
                          ? 'أفهم أن الناسخ خدمة تداول عالية المخاطر، وأن الربط الخارجي لا يضمن الأرباح أو تطابق النتائج.'
                          : 'I understand the copier is a high-risk trading service and external linking does not guarantee profit or matching results.'}
                      </p>
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    disabled={createOrder.isPending || !termsAccepted}
                    className="h-12 w-full text-base"
                    size="lg"
                  >
                    {createOrder.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="me-2 h-4 w-4" />}
                    {createOrder.isPending
                      ? (isRtl ? 'جاري الإنشاء...' : 'Processing...')
                      : (isRtl ? 'إتمام طلب الناسخ' : 'Place copier order')}
                  </Button>

                  <div className="mt-4 flex items-center gap-2 text-xs text-emerald-700">
                    <CheckCircle className="h-4 w-4" />
                    {isRtl ? 'السعر غير معروض ضمن البكجات العامة.' : 'This price is not listed with public packages.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CinematicPublicLayout>
  );
}
