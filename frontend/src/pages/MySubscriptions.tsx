import { Link } from 'wouter';
import { Package, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';

export default function MySubscriptions() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { data: subscriptions, isLoading } = trpc.subscriptions.mySubscriptions.useQuery();
  const { data: activePackage } = trpc.subscriptions.myActivePackage.useQuery();
  const pkg = (activePackage as any)?.package;

  return (
    <ClientLayout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Package className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">{t('mySubscriptions.title')}</h1>
        </div>

        {/* Active Package Banner */}
        {pkg && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl p-6 mb-8">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="w-6 h-6" />
              <h2 className="text-xl font-bold">{t('mySubscriptions.activePkg')}</h2>
            </div>
            <p className="text-2xl font-bold mb-1">
              {isRtl ? pkg.nameAr : pkg.nameEn}
            </p>
            <p className="text-blue-200 text-sm">
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

        {/* Subscriptions List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="bg-white rounded-xl h-20 animate-pulse border" />)}
          </div>
        ) : !subscriptions?.length ? (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{t('mySubscriptions.noSubs')}</p>
            <Link href="/#packages">
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
                      <span className="font-bold text-gray-900">{isRtl ? (sub as any).packageNameAr || `Package #${sub.packageId}` : (sub as any).packageNameEn || `Package #${sub.packageId}`}</span>
                      <Badge className={sub.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {sub.isActive ? (isRtl ? 'نشط' : 'Active') : (isRtl ? 'منتهي' : 'Expired')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      {isRtl ? 'بدأ' : 'Started'}: {new Date(sub.startDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}
                      {sub.endDate && ` • ${isRtl ? 'ينتهي' : 'Ends'}: ${new Date(sub.endDate).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US')}`}
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
      </div>
    </ClientLayout>
  );
}
