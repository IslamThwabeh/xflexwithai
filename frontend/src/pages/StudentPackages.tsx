import { Link } from 'wouter';
import { Package, CheckCircle2, X, ArrowUpCircle, Clock, Sparkles, MessageSquare, BookOpen, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';

export default function StudentPackages() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  const { data: activePackage, isLoading } = trpc.subscriptions.myActivePackage.useQuery();
  const pkg = (activePackage as any)?.package;

  const isBasic = pkg?.slug === 'basic';
  const isComprehensive = pkg?.slug === 'comprehensive';
  const hasPackage = !!pkg;

  // Calculate remaining days for comprehensive package
  const getRemainingDays = () => {
    if (!activePackage?.endDate) return null;
    const end = new Date(activePackage.endDate);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };
  const remainingDays = getRemainingDays();

  const features = [
    {
      en: 'Trading Course (Lifetime)',
      ar: 'دورة التداول (مدى الحياة)',
      icon: <BookOpen className="w-4 h-4" />,
      basic: true,
      comprehensive: true,
    },
    {
      en: 'LexAI Smart Assistant (1 Month)',
      ar: 'مساعد LexAI الذكي (شهر واحد)',
      icon: <Sparkles className="w-4 h-4" />,
      basic: false,
      comprehensive: true,
    },
    {
      en: 'Live Recommendations (1 Month)',
      ar: 'التوصيات الحية (شهر واحد)',
      icon: <MessageSquare className="w-4 h-4" />,
      basic: false,
      comprehensive: true,
    },
    {
      en: 'Priority Support',
      ar: 'دعم فني ذو أولوية',
      icon: <Shield className="w-4 h-4" />,
      basic: true,
      comprehensive: true,
    },
  ];

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-48" />
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Package className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">{isRtl ? 'باقتي' : 'My Package'}</h1>
        </div>

        {/* Current Package Status */}
        {isComprehensive && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{isRtl ? 'أنت في أفضل باقة!' : "You're on the best plan!"}</h2>
                <p className="text-emerald-100 text-sm">
                  {isRtl ? pkg?.nameAr : pkg?.nameEn}
                </p>
              </div>
            </div>
            <p className="text-emerald-100 mb-4">
              {isRtl
                ? 'استفد من جميع المميزات قبل انتهاء اشتراكك! اجمع أكبر قدر من الأرباح.'
                : 'Make the most of all features before your subscription expires! Collect as much profit as possible.'}
            </p>
            {remainingDays !== null && (
              <div className="bg-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-emerald-100 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {isRtl ? 'الأيام المتبقية للتجديد' : 'Days until renewal'}
                  </span>
                  <span className="text-2xl font-bold">{remainingDays}</span>
                </div>
                <Progress value={Math.max(0, Math.min(100, (remainingDays / 30) * 100))} className="h-2 bg-white/20" />
                {remainingDays <= 7 && (
                  <p className="text-amber-200 text-sm mt-2 font-medium">
                    {isRtl ? '⚠️ اقترب موعد التجديد! جهّز مفتاح التجديد.' : '⚠️ Renewal approaching! Prepare your renewal key.'}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {isBasic && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{isRtl ? 'الباقة الأساسية' : 'Basic Package'}</h2>
                <p className="text-blue-200 text-sm">{isRtl ? pkg?.nameAr : pkg?.nameEn}</p>
              </div>
            </div>
            <p className="text-blue-100 mb-4">
              {isRtl
                ? 'لديك وصول كامل للدورة التعليمية. قم بالترقية للحصول على LexAI والتوصيات الحية!'
                : 'You have full course access. Upgrade to get LexAI and live recommendations!'}
            </p>
          </div>
        )}

        {!hasPackage && (
          <div className="bg-gray-100 rounded-2xl p-6 mb-8 text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold mb-2">{isRtl ? 'لا توجد باقة نشطة' : 'No Active Package'}</h2>
            <p className="text-gray-500 mb-4">
              {isRtl ? 'قم بتفعيل مفتاح الباقة للبدء في رحلة التعلم.' : 'Activate a package key to start your learning journey.'}
            </p>
            <Link href="/activate-key">
              <Button>{isRtl ? 'تفعيل مفتاح' : 'Activate Key'}</Button>
            </Link>
          </div>
        )}

        {/* Feature Comparison */}
        <h2 className="text-xl font-bold mb-4">{isRtl ? 'مقارنة الباقات' : 'Package Comparison'}</h2>
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Basic Package Card */}
          <Card className={`relative ${isBasic ? 'ring-2 ring-blue-500' : ''}`}>
            {isBasic && (
              <Badge className="absolute -top-2.5 start-4 bg-blue-600">
                {isRtl ? 'باقتك الحالية' : 'Your Current Plan'}
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{isRtl ? 'الباقة الأساسية' : 'Basic Package'}</span>
                <span className="text-2xl font-bold text-blue-600">$200</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  {f.basic ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  ) : (
                    <X className="w-4 h-4 text-gray-300 shrink-0" />
                  )}
                  <span className={f.basic ? 'text-gray-700' : 'text-gray-400'}>
                    {f.icon} {isRtl ? f.ar : f.en}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Comprehensive Package Card */}
          <Card className={`relative ${isComprehensive ? 'ring-2 ring-emerald-500' : 'border-2 border-dashed border-purple-300 bg-purple-50/30'}`}>
            {isComprehensive && (
              <Badge className="absolute -top-2.5 start-4 bg-emerald-600">
                {isRtl ? 'باقتك الحالية' : 'Your Current Plan'}
              </Badge>
            )}
            {!isComprehensive && (
              <Badge className="absolute -top-2.5 start-4 bg-purple-600">
                {isRtl ? 'الأفضل قيمة' : 'Best Value'}
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{isRtl ? 'الباقة الشاملة' : 'Comprehensive Package'}</span>
                <span className="text-2xl font-bold text-purple-600">$500</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-gray-700">{f.icon} {isRtl ? f.ar : f.en}</span>
                </div>
              ))}
              {isBasic && (
                <div className="pt-3 border-t mt-3">
                  <Link href="/upgrade">
                    <Button className="w-full bg-purple-600 hover:bg-purple-700">
                      <ArrowUpCircle className="w-4 h-4 me-2" />
                      {isRtl ? 'ترقية الآن' : 'Upgrade Now'}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activate Key CTA */}
        <Card className="bg-gray-50">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              {isRtl ? 'هل لديك مفتاح تفعيل أو تجديد؟' : 'Have an activation or renewal key?'}
            </p>
            <Link href="/activate-key">
              <Button variant="outline">{isRtl ? 'تفعيل مفتاح' : 'Activate Key'}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}
