import { useParams, Link } from 'wouter';
import { CheckCircle, ChevronRight, ArrowLeft, X, Star, BookOpen, ShoppingCart, MessageSquareQuote, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PublicLayout from '@/components/PublicLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatIlsAmount, getPackageDisplayPricing } from '@/lib/packagePricing';
import { trpc } from '@/lib/trpc';

export default function PackageDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { t, language, isRTL } = useLanguage();

  const { data: pkg, isLoading, error } = trpc.packages.bySlug.useQuery(
    { slug: slug || '' },
    { enabled: !!slug }
  );

  const { data: packageCourses } = trpc.packages.courses.useQuery(
    { packageId: pkg?.id || 0 },
    { enabled: !!pkg?.id }
  );

  const { data: packageTestimonials } = trpc.testimonials.listWithContext.useQuery(
    { packageSlug: pkg?.slug, limit: 4 },
    { enabled: !!pkg?.slug }
  );

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center bg-[var(--color-xf-cream)]" dir={isRTL ? 'rtl' : 'ltr'}>
          <div className="animate-pulse text-gray-400">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
        </div>
      </PublicLayout>
    );
  }

  if (error || !pkg) {
    return (
      <PublicLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-[var(--color-xf-cream)] px-4" dir={isRTL ? 'rtl' : 'ltr'}>
          <p className="text-gray-500">{language === 'ar' ? 'الباقة غير موجودة' : 'Package not found'}</p>
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 me-1" />
              {language === 'ar' ? 'الرئيسية' : 'Home'}
            </Button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const isComprehensive = pkg.slug === 'comprehensive';
  const displayPricing = getPackageDisplayPricing(pkg.slug, pkg.price, pkg.renewalPrice);
  const priceFormatted = formatIlsAmount(displayPricing.ilsPrice);
  const renewalFormatted = displayPricing.ilsRenewal ? formatIlsAmount(displayPricing.ilsRenewal) : null;
  const vatIncludedLabel = language === 'ar' ? 'السعر يشمل ضريبة القيمة المضافة 16%' : 'Price includes 16% VAT';

  const features = [
    { key: 'courses', label: t('home.packages.courses'), included: true },
    { key: 'pdf', label: t('home.packages.pdf'), included: !!pkg.includesPdf },
    { key: 'introVideos', label: t('home.packages.introVideos'), included: true },
    { key: 'support', label: t('home.packages.support'), included: !!pkg.includesSupport },
    { key: 'recommendations', label: t('home.packages.recommendations'), included: !!pkg.includesRecommendations },
    { key: 'lexai', label: t('home.packages.lexai'), included: !!pkg.includesLexai },
  ];

  return (
    <PublicLayout>
      <div className="bg-[var(--color-xf-cream)] py-10 md:py-14" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="container mx-auto max-w-5xl px-4">
          <div className="mb-8 rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:px-8 md:py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm text-gray-400">
                  <Link href="/"><span className="cursor-pointer hover:text-emerald-600">{t('home.footer.home')}</span></Link>
                  <ChevronRight className="h-3.5 w-3.5" />
                  <span className="text-gray-700">{isRTL ? pkg.nameAr : pkg.nameEn}</span>
                </div>
                <div className="flex items-center gap-3 mb-3">
                  {isComprehensive && (
                    <Badge className="bg-yellow-100 text-yellow-800 font-medium">
                      <Star className="w-3 h-3 mr-1 fill-current" />
                      {t('home.packages.mostPopular')}
                    </Badge>
                  )}
                </div>
                <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
                  {isRTL ? pkg.nameAr : pkg.nameEn}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-8 text-gray-600 md:text-lg">
                  {isRTL ? pkg.descriptionAr : pkg.descriptionEn}
                </p>
              </div>
              <Link href="/">
                <Button variant="outline" size="sm" className="rounded-full border-slate-200 bg-white px-4">
                  <ArrowLeft className="w-4 h-4 me-1" />
                  {language === 'ar' ? 'العودة للرئيسية' : 'Back Home'}
                </Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-8 md:grid-cols-5">
          {/* Package Info */}
          <div className="md:col-span-3">
            {/* Features */}
            <div className="mb-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)] md:p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{t('home.packages.includes')}:</h2>
              <ul className="space-y-3">
                {features.map((f) => (
                  <li key={f.key} className={`flex items-center gap-3 text-sm ${f.included ? 'text-gray-700' : 'text-gray-400'}`}>
                    {f.included ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    )}
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* Courses in this package */}
            {packageCourses && packageCourses.length > 0 && (
              <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)] md:p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  {language === 'ar' ? 'الدورات المشمولة' : 'Included Courses'}
                </h2>
                <div className="space-y-3">
                  {packageCourses.map((pc: any, i: number) => (
                    <div key={pc.id || i} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-3">
                          <BookOpen className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              {isRTL ? pc.course?.titleAr || pc.courseId : pc.course?.titleEn || `Course #${pc.courseId}`}
                            </p>
                            <p className="text-xs text-gray-500 capitalize">{pc.course?.level || (language === 'ar' ? 'عام' : 'General')}</p>
                          </div>
                        </div>
                        {pc.course?.isFree && (
                          <Badge variant="outline" className="text-[10px]">{language === 'ar' ? 'مجاني' : 'Free'}</Badge>
                        )}
                      </div>
                      {(isRTL ? pc.course?.descriptionAr : pc.course?.descriptionEn) && (
                        <p className="text-xs text-gray-600 line-clamp-2">{isRTL ? pc.course?.descriptionAr : pc.course?.descriptionEn}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Value Angle */}
            <div className="mt-8 rounded-[28px] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.04)] md:p-8">
              <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-emerald-600" />
                {language === 'ar' ? 'لمن صممت هذه الباقة؟' : 'Who Is This Package For?'}
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                {language === 'ar'
                  ? 'هذه الباقة مناسبة للمتداول الذي يريد خطة واضحة، محتوى تدريجي، ودعم عملي يساعده على اتخاذ قرارات أكثر انضباطا.'
                  : 'This package fits traders who want a clear roadmap, progressive learning content, and practical support to make more disciplined decisions.'}
              </p>
            </div>

            {/* Package Testimonials */}
            {packageTestimonials && packageTestimonials.length > 0 && (
              <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)] md:p-8">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <MessageSquareQuote className="w-5 h-5 text-emerald-600" />
                  {language === 'ar' ? 'ماذا يقول الطلاب عن هذه الباقة؟' : 'What Students Say About This Package'}
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {packageTestimonials.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-slate-100 bg-[var(--color-xf-cream)] p-4">
                      <div className="flex gap-0.5 mb-2">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`w-3.5 h-3.5 ${n <= item.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                        ))}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">"{isRTL ? item.textAr : item.textEn}"</p>
                      <p className="text-xs text-gray-500">{isRTL ? item.nameAr : item.nameEn}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pricing Card */}
          <div className="md:col-span-2">
            <div className={`rounded-2xl p-6 sticky top-24 ${
              isComprehensive
                ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-500/20'
                : 'bg-white border-2 border-gray-200 shadow-lg'
            }`}>
              <div className="text-center mb-6">
                <div className="text-4xl font-extrabold mb-1">{priceFormatted}</div>
                <p className={`text-sm ${isComprehensive ? 'text-emerald-100' : 'text-gray-500'}`}>
                  {t('home.packages.price')} • {t('home.packages.lifetime')}
                </p>
                {renewalFormatted && (
                  <p className={`text-xs mt-2 ${isComprehensive ? 'text-emerald-200' : 'text-emerald-600'}`}>
                    {t('home.packages.renewal')}: {renewalFormatted}{t('home.packages.perMonth')}
                  </p>
                )}
              </div>

              <div className={`border-t ${isComprehensive ? 'border-white/20' : 'border-gray-100'} pt-4 mb-4`}>
                <p className={`text-xs ${isComprehensive ? 'text-emerald-100' : 'text-gray-500'}`}>
                  {vatIncludedLabel}
                </p>
              </div>

              <Link href={`/checkout/${pkg.slug}`}>
                <Button
                  size="lg"
                  className={`w-full font-bold ${
                    isComprehensive
                      ? 'bg-white text-emerald-700 hover:bg-emerald-50'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  <ShoppingCart className="w-4 h-4" />
                  {t('home.packages.choosePlan')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      </div>
    </PublicLayout>
  );
}
