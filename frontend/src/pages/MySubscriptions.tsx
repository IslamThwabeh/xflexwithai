import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Package, CheckCircle, Clock, AlertCircle, ArrowUpCircle, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';

export default function MySubscriptions() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const [, setLocation] = useLocation();
  const [freezeRequested, setFreezeRequested] = useState(false);
  const { data: subscriptions, isLoading } = trpc.subscriptions.mySubscriptions.useQuery();
  const { data: activePackage } = trpc.subscriptions.myActivePackage.useQuery();
  const pkg = (activePackage as any)?.package;

  const freezeMutation = trpc.subscriptions.requestFreeze.useMutation({
    onSuccess: () => {
      setFreezeRequested(true);
      // Redirect to support chat after a brief moment
      setTimeout(() => setLocation('/support'), 1500);
    },
  });

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Package className="w-6 h-6 text-emerald-600" />
          <h1 className="text-2xl font-bold">{t('mySubscriptions.title')}</h1>
        </div>

        {/* Active Package Banner */}
        {pkg && (
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6" />
              <h2 className="text-xl font-bold">{t('mySubscriptions.activePkg')}</h2>
            </div>
            <p className="text-2xl font-bold mb-1">
              {isRtl ? pkg.nameAr : pkg.nameEn}
            </p>
            <p className="text-emerald-200 text-sm">
              {pkg.isLifetime
                ? (isRtl ? 'وصول مدى الحياة' : 'Lifetime Access')
                : activePackage?.renewalDueDate
                  ? `${isRtl ? 'التجديد' : 'Renews'}: ${new Date(activePackage.renewalDueDate).toLocaleDateString()}`
                  : ''
              }
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              {pkg.includesLexai ? <Badge className="bg-white/20 text-white">LexAI</Badge> : null}
              {pkg.includesRecommendations ? <Badge className="bg-white/20 text-white">{isRtl ? 'التوصيات' : 'Recommendations'}</Badge> : null}
              {pkg.includesSupport ? <Badge className="bg-white/20 text-white">{isRtl ? 'الدعم' : 'Support'}</Badge> : null}
              {pkg.includesPdf ? <Badge className="bg-white/20 text-white">PDF</Badge> : null}
            </div>
          </div>
        )}

        {/* Upgrade CTA for Basic subscribers */}
        {pkg && pkg.slug === 'basic' && (
          <div className="bg-gradient-to-r from-amber-50 to-emerald-50 border-2 border-amber-200 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <ArrowUpCircle className="w-8 h-8 text-amber-600" />
                <div>
                  <h3 className="font-bold text-lg text-amber-900">
                    {isRtl ? 'ترقية إلى الباقة الشاملة' : 'Upgrade to Comprehensive'}
                  </h3>
                  <p className="text-sm text-amber-600">
                    {isRtl
                      ? 'احصل على جميع المميزات بما فيها LexAI مع استمرار التوصيات والدعم المباشر'
                      : 'Get all features including LexAI, while keeping recommendations and live support'}
                  </p>
                </div>
              </div>
              <Link href="/upgrade">
                <Button className="bg-amber-600 hover:bg-amber-700">
                  <ArrowUpCircle className="w-4 h-4 me-2" />
                  {isRtl ? 'ترقية الآن' : 'Upgrade Now'}
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Subscriptions List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="bg-white rounded-xl h-20 animate-pulse border" />)}
          </div>
        ) : !subscriptions?.length ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{t('mySubscriptions.noSubs')}</p>
            <Link href="/my-packages">
              <Button>{t('mySubscriptions.browsePkgs')}</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="bg-white border rounded-xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${sub.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {sub.isActive ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-gray-400" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{isRtl ? (sub as any).packageNameAr : (sub as any).packageNameEn}</span>
                      <Badge className={sub.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {sub.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'منتهي' : 'Expired')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {isRtl ? 'بدأ' : 'Started'}: {new Date(sub.startDate).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
                      {sub.endDate && ` • ${isRtl ? 'ينتهي' : 'Ends'}: ${new Date(sub.endDate).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}`}
                    </p>
                  </div>
                </div>
                {sub.orderId && (
                  <Link href={`/orders/${sub.orderId}`}>
                    <Button variant="outline" size="sm">{isRtl ? 'عرض الطلب' : 'View Order'}</Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Freeze Request Section */}
        {subscriptions && subscriptions.length > 0 && subscriptions.some(s => s.isActive) && (
          <div className="mt-8 border rounded-xl p-5 bg-emerald-50/50">
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
      </div>
    </ClientLayout>
  );
}
