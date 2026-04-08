import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Package, CheckCircle2, X, ArrowUpCircle, Clock, Sparkles, MessageSquare, BookOpen, Shield, Snowflake, CheckCircle, AlertCircle, UserPlus, Key, GraduationCap, Landmark, Bot, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPendingActivationDate, getPendingActivationDaysLeft, getPendingActivationWindow } from '@/lib/pendingActivation';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';

export default function StudentPackages() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [, setLocation] = useLocation();
  const [freezeRequested, setFreezeRequested] = useState(false);

  const { data: activePackage, isLoading } = trpc.subscriptions.myActivePackage.useQuery();
  const { data: subscriptions, isLoading: subsLoading } = trpc.subscriptions.mySubscriptions.useQuery();
  const { data: activationStatus } = trpc.subscriptions.activationStatus.useQuery();
  const { data: frozenStatus } = trpc.subscriptions.frozenStatus.useQuery();
  const { data: timeline } = trpc.subscriptions.myTimeline.useQuery();
  const pkg = (activePackage as any)?.package;
  const { studyPeriodDays, entitlementDays } = getPendingActivationWindow(activationStatus);
  const activationDeadline = formatPendingActivationDate(activationStatus?.maxActivationDate, isRtl);
  const activationDaysLeft = getPendingActivationDaysLeft(activationStatus?.maxActivationDate);

  const freezeMutation = trpc.subscriptions.requestFreeze.useMutation({
    onSuccess: () => {
      setFreezeRequested(true);
      setTimeout(() => setLocation('/support'), 1500);
    },
  });

  const isBasic = pkg?.slug === 'basic';
  const isComprehensive = pkg?.slug === 'comprehensive';
  const hasPackage = !!pkg;

  // Calculate remaining days for LexAI/Recommendations (course is forever)
  const getRemainingDays = () => {
    const endDateStr = (activePackage as any)?.lexaiEndDate ?? (activePackage as any)?.recEndDate;
    if (!endDateStr) return null;
    const end = new Date(endDateStr);
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

  if (isLoading || subsLoading) {
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
          <Package className="w-6 h-6 text-emerald-600" />
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
            <div className="flex flex-wrap gap-2 mb-4">
              {pkg.includesLexai && <Badge className="bg-white/20 text-white">LexAI</Badge>}
              {pkg.includesRecommendations && <Badge className="bg-white/20 text-white">{isRtl ? 'التوصيات' : 'Recommendations'}</Badge>}
              {pkg.includesSupport && <Badge className="bg-white/20 text-white">{isRtl ? 'الدعم' : 'Support'}</Badge>}
            </div>
            {remainingDays !== null && (
              <div className="bg-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-emerald-100 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {isRtl ? 'أيام متبقية (LexAI والتوصيات)' : 'Days remaining (LexAI & Recommendations)'}
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
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">{isRtl ? 'الباقة الأساسية' : 'Basic Package'}</h2>
                <p className="text-emerald-200 text-sm">{isRtl ? pkg?.nameAr : pkg?.nameEn}</p>
              </div>
            </div>
            <p className="text-emerald-100 mb-4">
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

        {/* Upgrade CTA for Basic */}
        {isBasic && (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <ArrowUpCircle className="w-8 h-8 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-lg text-emerald-900">
                    {isRtl ? 'ترقية إلى الباقة الشاملة' : 'Upgrade to Comprehensive'}
                  </h3>
                  <p className="text-sm text-emerald-600">
                    {isRtl
                      ? 'احصل على جميع المميزات بما فيها LexAI والتوصيات والدعم المباشر'
                      : 'Get all features including LexAI, Recommendations & Live Support'}
                  </p>
                </div>
              </div>
              <Link href="/upgrade">
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                  <ArrowUpCircle className="w-4 h-4 me-2" />
                  {isRtl ? 'ترقية الآن' : 'Upgrade Now'}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Deferred Activation Status */}
        {activationStatus?.hasPending && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-amber-900">
                {isRtl ? 'تفعيل مؤجل' : 'Deferred Activation'}
              </h3>
            </div>
            <p className="text-sm text-amber-700 mb-2">
              {isRtl
                ? `لديك حتى ${studyPeriodDays} يومًا لإكمال الكورس وإعداد حساب الوسيط. وبعد التفعيل سيبقى LexAI والتوصيات متاحين لمدة ${entitlementDays} يومًا.`
                : `You have up to ${studyPeriodDays} days to finish the course and broker setup. After activation, LexAI and Recommendations remain available for ${entitlementDays} days.`}
            </p>
            {activationDeadline && (
              <p className="text-xs text-amber-700 font-medium mb-2">
                {isRtl ? `آخر موعد قبل بدء التفعيل: ${activationDeadline}` : `Activation deadline: ${activationDeadline}`}
              </p>
            )}
            {activationDaysLeft !== null && (
              <p className="text-xs text-amber-700 mb-2">
                {isRtl
                  ? `يتبقى تقريبًا ${activationDaysLeft} يوم لإكمال الكورس وإعداد حساب الوسيط.`
                  : `You have about ${activationDaysLeft} days left to finish the course and broker setup.`}
              </p>
            )}
            <p className="text-xs text-amber-600 font-medium">
              {isRtl
                ? `⚡ أكمل إعداد الوسيط مبكرًا لتحصل على أقصى استفادة من فترة الـ${entitlementDays} يومًا.`
                : `⚡ Complete your broker setup early to maximize your ${entitlementDays}-day access window!`}
            </p>
          </div>
        )}

        {/* Subscription Frozen Status */}
        {(frozenStatus?.lexaiFrozen || frozenStatus?.recFrozen) && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Snowflake className="w-5 h-5 text-amber-600" />
              <h3 className="font-semibold text-amber-900">
                {isRtl ? 'اشتراكات مُجمّدة' : 'Frozen Subscriptions'}
              </h3>
            </div>
            <div className="space-y-2">
              {frozenStatus.lexaiFrozen && (
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <Sparkles className="w-4 h-4" />
                  <span>
                    LexAI — {isRtl ? 'مُجمّد' : 'Frozen'}
                    {frozenStatus.lexaiFrozenUntil && (
                      <> {isRtl ? 'حتى' : 'until'} {new Date(frozenStatus.lexaiFrozenUntil).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</>
                    )}
                  </span>
                </div>
              )}
              {frozenStatus.recFrozen && (
                <div className="flex items-center gap-2 text-sm text-amber-700">
                  <MessageSquare className="w-4 h-4" />
                  <span>
                    {isRtl ? 'التوصيات' : 'Recommendations'} — {isRtl ? 'مُجمّد' : 'Frozen'}
                    {frozenStatus.recFrozenUntil && (
                      <> {isRtl ? 'حتى' : 'until'} {new Date(frozenStatus.recFrozenUntil).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</>
                    )}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-amber-600 mt-2">
              {isRtl
                ? 'سيتم استئناف الاشتراكات تلقائياً عند انتهاء فترة التجميد.'
                : 'Subscriptions will resume automatically when the freeze period ends.'}
            </p>
          </div>
        )}

        {/* Subscription History */}
        {subscriptions && subscriptions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">{isRtl ? 'سجل الاشتراكات' : 'Subscription History'}</h2>
            <div className="space-y-3">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="bg-white border rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${sub.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                      {sub.isActive ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-gray-400" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{isRtl ? (sub as any).packageNameAr : (sub as any).packageNameEn}</span>
                        <Badge className={sub.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                          {sub.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'منتهي' : 'Expired')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500">
                        {isRtl ? 'بدأ' : 'Started'}: {new Date(sub.startDate).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {isRtl ? '📚 الدورة التعليمية: ملكك للأبد' : '📚 Course: Yours forever'}
                        {isComprehensive && (activePackage as any)?.lexaiEndDate && (
                          <> • {isRtl ? '🤖 LexAI والتوصيات' : '🤖 LexAI & Recommendations'}: {remainingDays !== null && remainingDays > 0
                            ? (isRtl ? `${remainingDays} يوم متبقي` : `${remainingDays} days left`)
                            : (isRtl ? 'منتهي' : 'Expired')}</>
                        )}
                        {isBasic && (activePackage as any)?.recEndDate && (
                          <> • {isRtl ? '📈 التوصيات' : '📈 Recommendations'}: {(() => {
                            const recEnd = new Date((activePackage as any).recEndDate);
                            const recDays = Math.ceil((recEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                            return recDays > 0
                              ? (isRtl ? `${recDays} يوم متبقي` : `${recDays} days left`)
                              : (isRtl ? 'منتهي' : 'Expired');
                          })()}</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline History */}
        {timeline && timeline.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4">{isRtl ? 'سجل الأحداث' : 'Activity Timeline'}</h2>
            <div className="relative border-s-2 border-emerald-200 ms-4">
              {timeline.map((event: any, i: number) => {
                const iconMap: Record<string, React.ReactNode> = {
                  registration: <UserPlus className="w-4 h-4" />,
                  key_activation: <Key className="w-4 h-4" />,
                  enrollment: <BookOpen className="w-4 h-4" />,
                  course_completed: <GraduationCap className="w-4 h-4" />,
                  course_skipped: <GraduationCap className="w-4 h-4" />,
                  broker_completed: <Landmark className="w-4 h-4" />,
                  broker_skipped: <Landmark className="w-4 h-4" />,
                  lexai_activated: <Bot className="w-4 h-4" />,
                  lexai_expired: <Bot className="w-4 h-4" />,
                  rec_activated: <TrendingUp className="w-4 h-4" />,
                  rec_expired: <TrendingUp className="w-4 h-4" />,
                };
                const colorMap: Record<string, string> = {
                  registration: 'bg-emerald-100 text-emerald-600',
                  key_activation: 'bg-amber-100 text-amber-600',
                  enrollment: 'bg-teal-100 text-teal-600',
                  course_completed: 'bg-green-100 text-green-600',
                  course_skipped: 'bg-amber-100 text-amber-600',
                  broker_completed: 'bg-green-100 text-green-600',
                  broker_skipped: 'bg-teal-100 text-teal-600',
                  lexai_activated: 'bg-emerald-100 text-emerald-600',
                  lexai_expired: 'bg-red-100 text-red-500',
                  rec_activated: 'bg-emerald-100 text-emerald-600',
                  rec_expired: 'bg-red-100 text-red-500',
                };
                return (
                  <div key={i} className="mb-4 ms-6 relative">
                    <div className={`absolute -start-[calc(1.5rem+1px)] w-8 h-8 rounded-full flex items-center justify-center ${colorMap[event.type] || 'bg-gray-100 text-gray-500'}`}>
                      {iconMap[event.type] || <Clock className="w-4 h-4" />}
                    </div>
                    <div className="bg-white border rounded-lg p-3 ms-2">
                      <p className="text-sm font-medium text-gray-900">{isRtl ? event.labelAr : event.labelEn}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(event.date).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Feature Comparison */}
        <h2 className="text-xl font-bold mb-4">{isRtl ? 'مقارنة الباقات' : 'Package Comparison'}</h2>
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Basic Package Card */}
          <Card className={`relative ${isBasic ? 'ring-2 ring-emerald-500' : ''}`}>
            {isBasic && (
              <Badge className="absolute -top-2.5 start-4 bg-emerald-600">
                {isRtl ? 'باقتك الحالية' : 'Your Current Plan'}
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{isRtl ? 'الباقة الأساسية' : 'Basic Package'}</span>
                <span className="text-2xl font-bold text-emerald-600">$200</span>
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
          <Card className={`relative ${isComprehensive ? 'ring-2 ring-emerald-500' : 'border-2 border-dashed border-emerald-300 bg-emerald-50/30'}`}>
            {isComprehensive && (
              <Badge className="absolute -top-2.5 start-4 bg-emerald-600">
                {isRtl ? 'باقتك الحالية' : 'Your Current Plan'}
              </Badge>
            )}
            {!isComprehensive && (
              <Badge className="absolute -top-2.5 start-4 bg-amber-600">
                {isRtl ? 'الأفضل قيمة' : 'Best Value'}
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{isRtl ? 'الباقة الشاملة' : 'Comprehensive Package'}</span>
                <span className="text-2xl font-bold text-emerald-600">$500</span>
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
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700">
                      <ArrowUpCircle className="w-4 h-4 me-2" />
                      {isRtl ? 'ترقية الآن' : 'Upgrade Now'}
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Freeze Subscription */}
        {subscriptions && subscriptions.length > 0 && subscriptions.some(s => s.isActive) && (
          <div className="border rounded-xl p-5 bg-emerald-50/50 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Snowflake className="w-5 h-5 text-emerald-500" />
              <h3 className="font-semibold text-gray-900">
                {isRtl ? 'تجميد الاشتراك' : 'Freeze Subscription'}
              </h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              {isRtl
                ? 'يمكنك طلب تجميد اشتراكك مؤقتاً. سيتواصل فريق الدعم معك لتحديد مدة التجميد.'
                : 'You can request a temporary freeze on your subscription. Our support team will contact you to set the freeze duration.'}
            </p>
            {freezeRequested ? (
              <p className="text-sm text-green-600 font-medium">
                {isRtl ? '✅ تم إرسال طلب التجميد. جارٍ تحويلك للدعم...' : '✅ Freeze request sent. Redirecting to support...'}
              </p>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => freezeMutation.mutate()}
                disabled={freezeMutation.isPending}
                className="gap-2"
              >
                <Snowflake className="w-4 h-4" />
                {freezeMutation.isPending
                  ? (isRtl ? 'جارٍ الإرسال...' : 'Sending...')
                  : (isRtl ? 'طلب تجميد' : 'Request Freeze')}
              </Button>
            )}
          </div>
        )}

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
