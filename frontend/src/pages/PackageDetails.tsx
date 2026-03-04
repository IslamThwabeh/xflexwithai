import { useParams, Link } from 'wouter';
import { CheckCircle, ChevronRight, ArrowLeft, X, Star, BookOpen, Phone, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

export default function PackageDetails() {
  const { slug } = useParams<{ slug: string }>();
  const { t, language, setLanguage, isRTL } = useLanguage();

  const { data: pkg, isLoading, error } = trpc.packages.bySlug.useQuery(
    { slug: slug || '' },
    { enabled: !!slug }
  );

  const { data: packageCourses } = trpc.packages.courses.useQuery(
    { packageId: pkg?.id || 0 },
    { enabled: !!pkg?.id }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-gray-400">{language === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
      </div>
    );
  }

  if (error || !pkg) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <p className="text-gray-500">{language === 'ar' ? 'الباقة غير موجودة' : 'Package not found'}</p>
        <Link href="/">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 me-1" />
            {language === 'ar' ? 'الرئيسية' : 'Home'}
          </Button>
        </Link>
      </div>
    );
  }

  const isComprehensive = pkg.slug === 'comprehensive';
  const priceFormatted = `$${(pkg.price / 100).toFixed(0)}`;
  const renewalFormatted = pkg.renewalPrice ? `$${(pkg.renewalPrice / 100).toFixed(0)}` : null;

  const features = [
    { key: 'courses', label: t('home.packages.courses'), included: true },
    { key: 'pdf', label: t('home.packages.pdf'), included: !!pkg.includesPdf },
    { key: 'introVideos', label: t('home.packages.introVideos'), included: true },
    { key: 'support', label: t('home.packages.support'), included: !!pkg.includesSupport },
    { key: 'recommendations', label: t('home.packages.recommendations'), included: !!pkg.includesRecommendations },
    { key: 'lexai', label: t('home.packages.lexai'), included: !!pkg.includesLexai },
  ];

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Nav */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent cursor-pointer">
              XFlex
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition"
            >
              <Globe className="w-4 h-4" />
              {language === 'ar' ? 'EN' : 'عربي'}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-8">
          <Link href="/"><span className="hover:text-blue-600 cursor-pointer">{t('home.footer.home')}</span></Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-700">{isRTL ? pkg.nameAr : pkg.nameEn}</span>
        </div>

        <div className="grid md:grid-cols-5 gap-10">
          {/* Package Info */}
          <div className="md:col-span-3">
            <div className="flex items-center gap-3 mb-3">
              {isComprehensive && (
                <Badge className="bg-yellow-100 text-yellow-800 font-medium">
                  <Star className="w-3 h-3 mr-1 fill-current" />
                  {t('home.packages.mostPopular')}
                </Badge>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {isRTL ? pkg.nameAr : pkg.nameEn}
            </h1>

            <p className="text-gray-600 text-lg leading-relaxed mb-8">
              {isRTL ? pkg.descriptionAr : pkg.descriptionEn}
            </p>

            {/* Features */}
            <div className="mb-8">
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
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  {language === 'ar' ? 'الدورات المشمولة' : 'Included Courses'}
                </h2>
                <div className="space-y-2">
                  {packageCourses.map((pc: any, i: number) => (
                    <div key={pc.id || i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <BookOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700">{pc.courseId}</span>
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
                ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-500/20'
                : 'bg-white border-2 border-gray-200 shadow-lg'
            }`}>
              <div className="text-center mb-6">
                <div className="text-4xl font-extrabold mb-1">{priceFormatted}</div>
                <p className={`text-sm ${isComprehensive ? 'text-blue-100' : 'text-gray-500'}`}>
                  {t('home.packages.price')} • {t('home.packages.lifetime')}
                </p>
                {renewalFormatted && (
                  <p className={`text-xs mt-2 ${isComprehensive ? 'text-blue-200' : 'text-blue-600'}`}>
                    {t('home.packages.renewal')}: {renewalFormatted}{t('home.packages.perMonth')}
                  </p>
                )}
              </div>

              <div className={`border-t ${isComprehensive ? 'border-white/20' : 'border-gray-100'} pt-4 mb-4`}>
                <p className={`text-xs ${isComprehensive ? 'text-blue-100' : 'text-gray-500'}`}>
                  {language === 'ar' ? 'ضريبة القيمة المضافة 16% ستُضاف عند الدفع' : 'VAT 16% will be added at checkout'}
                </p>
              </div>

              <a
                href="https://wa.me/972597596030"
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button
                  size="lg"
                  className={`w-full font-bold ${
                    isComprehensive
                      ? 'bg-white text-blue-700 hover:bg-blue-50'
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  {t('home.packages.choosePlan')}
                </Button>
              </a>

              <p className={`text-center text-xs mt-3 ${isComprehensive ? 'text-blue-200' : 'text-gray-400'}`}>
                {language === 'ar' 
                  ? 'تواصل معنا عبر واتساب لإتمام عملية الشراء'
                  : 'Contact us via WhatsApp to complete your purchase'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
