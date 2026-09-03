import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'wouter';
import { ArrowLeft, Building2, ShieldCheck, Gift, Loader2, Tag, X, CheckCircle, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RegisterForm } from '@/components/RegisterForm';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/_core/hooks/useAuth';
import { CURRENT_TERMS_VERSION } from '@/lib/legalVersions';
import { formatIlsAmount, getPackageDisplayPricing } from '@/lib/packagePricing';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { trackBeginCheckout, trackOrderRequest } from '@/lib/analytics';
import { isLikelyValidEmail, normalizeEmailAddress } from '@shared/emailValidation';

function CheckoutAccountGate({
  packageName,
  packageSlug,
  isRtl,
}: {
  packageName: string;
  packageSlug: string;
  isRtl: boolean;
}) {
  const [mode, setMode] = useState<"register" | "login">("register");
  const localizedCheckoutPath = `/${isRtl ? "ar" : "en"}/checkout/${packageSlug}`;
  const loginHref = `/auth?mode=login&next=${encodeURIComponent(localizedCheckoutPath)}`;

  return (
    <CinematicPublicLayout>
      <div className="bg-[#050505] py-10 md:py-14" dir={isRtl ? "rtl" : "ltr"}>
        <div className="bg-[var(--color-xf-cream)] py-10 text-slate-900 md:py-14">
          <div className="mx-auto max-w-2xl px-4">
            <Link href={`/packages/${packageSlug}`}>
              <Button
                variant="ghost"
                size="sm"
                className="mb-5 px-0 text-slate-500 hover:bg-transparent hover:text-emerald-700"
              >
                <ArrowLeft
                  className={`h-4 w-4 ${isRtl ? "ms-2 rotate-180" : "me-2"}`}
                />
                {isRtl ? "العودة إلى تفاصيل الباقة" : "Back to package details"}
              </Button>
            </Link>

            <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
              <div className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-amber-50 px-6 py-7 sm:px-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                  {isRtl ? "الخطوة 1 من 2" : "Step 1 of 2"}
                </div>
                <h1 className="mt-4 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
                  {isRtl
                    ? "أهلاً بك في XFlex — لنكمل طلبك معاً"
                    : "Welcome to XFlex — let's complete your order"}
                </h1>
                <p className="mt-3 text-sm leading-7 text-slate-600 sm:text-base">
                  {isRtl
                    ? `اخترت ${packageName}. يرجى تعبئة البيانات أدناه لإنشاء حسابك، وبعدها ستكمل تفاصيل الطلب وترفع إيصال التحويل بسهولة.`
                    : `You selected ${packageName}. Fill in the details below to create your account, then you can complete the order and upload your transfer receipt.`}
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                  {isRtl
                    ? "سيبقى اختيار الباقة محفوظاً خلال هذه الخطوات."
                    : "Your package selection stays with you through these steps."}
                </div>
              </div>

              <div className="p-5 sm:p-8">
                <div
                  className="mb-7 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5"
                  role="tablist"
                  aria-label={
                    isRtl
                      ? "اختيار الدخول أو التسجيل"
                      : "Choose login or registration"
                  }
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "register"}
                    onClick={() => setMode("register")}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all ${
                      mode === "register"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <UserPlus className="h-4 w-4" />
                    {isRtl ? "عميل جديد" : "New customer"}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "login"}
                    onClick={() => setMode("login")}
                    className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all ${
                      mode === "login"
                        ? "bg-white text-emerald-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    <LogIn className="h-4 w-4" />
                    {isRtl ? "لدي حساب" : "I have an account"}
                  </button>
                </div>

                {mode === "register" ? (
                  <RegisterForm />
                ) : (
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 text-center sm:p-6">
                    <LogIn className="mx-auto h-8 w-8 text-emerald-600" />
                    <h2 className="mt-3 text-lg font-bold text-slate-950">
                      {isRtl ? "مرحباً بعودتك" : "Welcome back"}
                    </h2>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-600">
                      {isRtl
                        ? "سجّل الدخول بالطريقة المعتادة، وسنعيدك مباشرة إلى الباقة التي اخترتها لإكمال الطلب."
                        : "Sign in using your usual method and we will bring you straight back to your selected package to complete the order."}
                    </p>
                    <Link href={loginHref}>
                      <Button className="mt-5 w-full bg-emerald-600 text-white hover:bg-emerald-700">
                        <LogIn className="h-4 w-4" />
                        {isRtl
                          ? "المتابعة لتسجيل الدخول"
                          : "Continue to sign in"}
                      </Button>
                    </Link>
                  </div>
                )}

                <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs leading-6 text-slate-500">
                  {isRtl
                    ? "لن يتم إنشاء الطلب أو طلب التحويل قبل تسجيل الدخول ومراجعة الملخص النهائي."
                    : "No order or transfer request is created until you sign in and review the final summary."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </CinematicPublicLayout>
  );
}
export default function Checkout() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { data: pkg, isLoading } = trpc.packages.bySlug.useQuery({ slug: params.slug || '' });
  const { data: liveState } = trpc.packages.livePublicState.useQuery(undefined, { enabled: params.slug === 'live-package' });
  const { data: liveQuote, isLoading: liveQuoteLoading } = trpc.livePackage.myPurchaseQuote.useQuery(
    undefined,
    { enabled: params.slug === 'live-package' && isAuthenticated },
  );

  const paymentMethod = 'bank_transfer' as const;
  const [isGift, setIsGift] = useState(false);
  const [giftEmail, setGiftEmail] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const trackedCheckout = useRef("");

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
      if (pkg) {
        const pricing = getPackageDisplayPricing(pkg.slug, pkg.price, pkg.renewalPrice, pkg.currency);
        trackOrderRequest({
          slug: pkg.slug,
          name: isRtl ? pkg.nameAr : pkg.nameEn,
          valueIls: pkg.packageType === 'live' && liveQuote ? liveQuote.price / 100 : pricing.ilsPrice,
          language,
        });
      }
      toast.success(isRtl ? 'تم إنشاء الطلب بنجاح' : 'Order created successfully');
      navigate(`/orders/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (!pkg?.slug) return;
    if (pkg.packageType === 'live' && !liveQuote) return;
    const trackingKey = `${language}:${pkg.slug}:${pkg.packageType === 'live' ? liveQuote?.price : pkg.price}`;
    if (trackedCheckout.current === trackingKey) return;
    const pricing = getPackageDisplayPricing(pkg.slug, pkg.price, pkg.renewalPrice, pkg.currency);
    trackBeginCheckout({
      slug: pkg.slug,
      name: isRtl ? pkg.nameAr : pkg.nameEn,
      valueIls: pkg.packageType === 'live' && liveQuote ? liveQuote.price / 100 : pricing.ilsPrice,
      language,
    });
    trackedCheckout.current = trackingKey;
  }, [isRtl, language, liveQuote, pkg]);

  if (isLoading || authLoading || (params.slug === 'live-package' && isAuthenticated && liveQuoteLoading)) {
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

  const isLive = pkg.packageType === 'live';
  if (isLive && !liveState?.purchasable) {
    return <CinematicPublicLayout><div className="min-h-[60vh] bg-[#050505] px-4 py-20" dir={isRtl ? 'rtl' : 'ltr'}><div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white p-8 text-center"><h1 className="text-2xl font-bold">{isRtl ? 'الشراء غير متاح حالياً' : 'Purchase is not currently available'}</h1><p className="mt-3 text-sm text-slate-500">{isRtl ? 'ترقبوا الحدث الأضخم هالسنة' : 'Live Package checkout will open only after the cohort is approved for sale.'}</p></div></div></CinematicPublicLayout>;
  }
  if (isLive && liveQuote?.alreadyOwned) {
    return <CinematicPublicLayout><div className="min-h-[60vh] bg-[#050505] px-4 py-20" dir={isRtl ? 'rtl' : 'ltr'}><div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-white p-8 text-center"><h1 className="text-2xl font-bold">{isRtl ? 'لديك وصول بالفعل' : 'You already have access'}</h1><p className="mt-3 text-sm text-slate-500">{isRtl ? 'لا يمكن إنشاء طلب آخر لنفس فوج بكج لايف.' : 'Another order cannot be created for the same Live cohort.'}</p></div></div></CinematicPublicLayout>;
  }

  if (!isAuthenticated) {
    return (
      <CheckoutAccountGate
        packageName={isRtl ? pkg.nameAr : pkg.nameEn}
        packageSlug={pkg.slug}
        isRtl={isRtl}
      />
    );
  }

  const displayPricing = getPackageDisplayPricing(pkg.slug, pkg.price, pkg.renewalPrice, pkg.currency);
  const effectivePriceIls = isLive && liveQuote ? liveQuote.price / 100 : displayPricing.ilsPrice;
  const livePriceReason = !isLive || !liveQuote ? null : isRtl
    ? (liveQuote.tier === 'comprehensiveSubscriber'
        ? 'سعر مشترك الشاملة الحالي'
        : liveQuote.tier === 'basicSubscriber'
          ? 'سعر مشترك الأساسية الحالي'
          : 'السعر القياسي للحساب غير المؤهل للخصم')
    : (liveQuote.tier === 'comprehensiveSubscriber'
        ? 'Active Comprehensive subscriber price'
        : liveQuote.tier === 'basicSubscriber'
          ? 'Active Basic subscriber price'
          : 'Standard price for accounts without an active subscriber discount');
  // Backend coupon `discount` is returned in USD cents (matches pkg.price). Convert to ILS
  // using the same 3.5x reference rate used by packagePricing.ts so the on-screen summary stays
  // consistent with the marketing ILS prices.
  const USD_TO_ILS = 3.5;
  const discountIls = appliedCoupon ? (appliedCoupon.discount / 100) * USD_TO_ILS : 0;
  const totalIls = Math.max(effectivePriceIls - discountIls, 0);
  const vatRate = 16;
  const vatIls = totalIls * vatRate / (100 + vatRate);
  const subtotalIls = totalIls - vatIls;
  const normalizedGiftEmail = normalizeEmailAddress(giftEmail);
  const giftEmailValid = !isGift || isLikelyValidEmail(normalizedGiftEmail);

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
    if (!giftEmailValid) {
      toast.error(isRtl ? 'أدخل بريدًا إلكترونيًا صحيحًا لمستلم الهدية' : 'Enter a valid gift recipient email');
      return;
    }
    createOrder.mutate({
      items: [{ itemType: 'package', packageId: pkg.id }],
      paymentMethod,
      isGift,
      giftEmail: isGift ? normalizedGiftEmail : undefined,
      giftMessage: isGift ? giftMessage.trim() || undefined : undefined,
      notes: notes || undefined,
      couponCode: appliedCoupon?.code || undefined,
      termsAcceptedAt: new Date().toISOString(),
      termsAcceptedVersion: CURRENT_TERMS_VERSION,
    });
  };

  return (
    <CinematicPublicLayout>
      <div className="bg-[#050505] py-10 md:py-14" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="bg-[var(--color-xf-cream)] py-10 text-slate-900 md:py-14">
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
                <p className="mt-1 text-emerald-700">{isLive ? (isRtl ? 'وصول خاص بالفوج' : 'Cohort access') : pkg.isLifetime ? (isRtl ? 'وصول مدى الحياة' : 'Lifetime access') : ''}</p>
                <p className="mt-1 text-emerald-700">{formatIlsAmount(effectivePriceIls)}</p>
                {livePriceReason && <p className="mt-1 max-w-xs text-xs leading-5 text-emerald-800">{livePriceReason}</p>}
              </div>
            </div>
          </div>

          {isLive && liveState?.cohortStatus === 'in_progress' && <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-7 text-sky-950">{isRtl ? 'الفوج قائم حالياً: يشمل طلبك التسجيلات المنشورة السابقة، اللقاءات القادمة المجدولة، وما تبقى من اللقاءات المباشرة.' : 'This cohort is already in progress: your purchase includes prior published recordings, scheduled upcoming sessions, and the remaining live sessions.'}</div>}
          {isLive && liveState?.cohortStatus === 'completed' && <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold leading-7 text-amber-950">{isRtl ? 'الفوج مكتمل. هذا الطلب يمنح وصولاً إلى التسجيلات المنشورة ولا يتضمن وعداً بلقاءات مباشرة مستقبلية.' : 'This cohort is completed. This purchase grants access to published recordings and does not promise future live sessions.'}</div>}

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

            {/* Live eligibility is account-bound, so gifting is intentionally unavailable. */}
            {!isLive && <div className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
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
                    <Input
                      value={giftEmail}
                      onChange={(e) => setGiftEmail(e.target.value)}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      aria-invalid={giftEmail.trim().length > 0 && !giftEmailValid}
                      className="mt-1"
                    />
                    {giftEmail.trim().length > 0 && !giftEmailValid && (
                      <p className="mt-1 text-xs text-red-600">
                        {isRtl ? 'بريد المستلم غير صحيح' : 'Recipient email is not valid'}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>{isRtl ? 'رسالة الهدية (اختياري)' : 'Gift message (optional)'}</Label>
                    <Textarea value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} rows={2} className="mt-1" />
                  </div>
                </div>
              )}
            </div>}

            {/* Coupons remain disabled for the native-ILS Live product until an ILS coupon policy is approved. */}
            {!isLive && <>
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
            </>}

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
                  <p className="text-sm text-gray-500">{isLive ? (isRtl ? 'خاص بالفوج' : 'Cohort access') : pkg.isLifetime ? (isRtl ? 'مدى الحياة' : 'Lifetime') : ''}</p>
                  {livePriceReason && <p className="mt-1 text-xs leading-5 text-emerald-700">{livePriceReason}</p>}
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

              <div className="mb-4 flex items-start gap-3 text-sm text-gray-600">
                <input
                  id="checkout-terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="leading-6">
                  <label htmlFor="checkout-terms" className="cursor-pointer select-none">
                    {isRtl ? 'أوافق على ' : 'I agree to the '}
                  </label>
                  <Link href="/terms"><span className="cursor-pointer font-medium text-emerald-700 underline">{isRtl ? 'الشروط والأحكام' : 'Terms & Conditions'}</span></Link>
                  <span>{isRtl ? ' و' : ' and '}</span>
                  <Link href="/refund-policy"><span className="cursor-pointer font-medium text-emerald-700 underline">{isRtl ? 'سياسة الاسترداد' : 'Refund Policy'}</span></Link>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {isRtl
                      ? 'لأغراض التحقق من الطلب وحماية الطرفين عند وجود نزاع، سيتم حفظ وقت الموافقة وعنوان IP ومعلومات المتصفح/الجهاز مع هذا الطلب.'
                      : 'For order verification and dispute protection, we record the acceptance time, IP address, and browser/device information with this order.'}
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={createOrder.isPending || !giftEmailValid || !termsAccepted}
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
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>
    </CinematicPublicLayout>
  );
}
