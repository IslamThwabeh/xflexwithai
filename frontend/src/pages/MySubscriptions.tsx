import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Package, CheckCircle, AlertCircle, ArrowUpCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatLocalizedDate } from '@/lib/dateLocale';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';
import { Checkbox } from '@/components/ui/checkbox';
import { CURRENT_TERMS_VERSION } from '@/lib/legalVersions';
import { toast } from 'sonner';

export default function MySubscriptions() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const [, navigate] = useLocation();
  const [accepted, setAccepted] = useState(false);
  const { data: subscriptions, isLoading } = trpc.subscriptions.mySubscriptions.useQuery();
  const { data: activePackage } = trpc.subscriptions.myActivePackage.useQuery();
  const pkg = (activePackage as any)?.package;
  const renewal = trpc.renewals.quote.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const createRenewal = trpc.renewals.createOrder.useMutation({
    onSuccess: (result) => {
      toast.success(isRtl ? 'تم إنشاء طلب التجديد. أرفقي إثبات الدفع لإرساله للمراجعة.' : 'Renewal order created. Attach payment proof for review.');
      navigate(`/orders/${result.order.id}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const money = (minor: number) => new Intl.NumberFormat(isRtl ? 'ar' : 'en', { style: 'currency', currency: 'ILS' }).format(minor / 100);

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
                  ? `${isRtl ? 'التجديد' : 'Renews'}: ${formatLocalizedDate(activePackage.renewalDueDate, language)}`
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

        {renewal.data && (
          <section className="mb-8 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="mb-4 flex items-start gap-3"><RefreshCw className="mt-1 h-6 w-6 text-emerald-700" /><div><h2 className="text-lg font-bold text-emerald-950">{isRtl ? 'تجديد مدفوع للخدمات المحددة المدة' : 'Paid timed-services renewal'}</h2><p className="text-sm text-emerald-800">{isRtl ? 'التجديد يمدّد التوصيات وLexAI بحسب باقتك؛ الوصول للدورات يبقى كما هو.' : 'Renewal extends Recommendations and LexAI included in your package; course access remains unchanged.'}</p></div></div>
            <div className="grid gap-3 rounded-xl bg-white p-4 text-sm md:grid-cols-2">
              <p><strong>{isRtl ? 'الباقة:' : 'Package:'}</strong> {isRtl ? renewal.data.packageNameAr : renewal.data.packageNameEn}</p>
              <p><strong>{isRtl ? 'السعر:' : 'Price:'}</strong> {money(renewal.data.amountIlsMinor)}</p>
              <p><strong>{isRtl ? 'المدة:' : 'Duration:'}</strong> {renewal.data.entitlementDays} {isRtl ? 'يومًا' : 'days'}</p>
              <p><strong>{isRtl ? 'الدورات:' : 'Courses:'}</strong> {isRtl ? 'لا تتغير' : 'Unchanged'}</p>
              {renewal.data.includesRecommendations && <p><strong>{isRtl ? 'التوصيات حتى:' : 'Recommendations through:'}</strong> {formatLocalizedDate(renewal.data.recommendationsProjectedEndAt!, language)}</p>}
              {renewal.data.includesLexai && <p><strong>LexAI {isRtl ? 'حتى:' : 'through:'}</strong> {formatLocalizedDate(renewal.data.lexaiProjectedEndAt!, language)}</p>}
            </div>
            <p className="mt-3 text-xs text-emerald-900">{isRtl ? 'يُسجّل الدخل مرة واحدة فقط عند تأكيد استلام دفعة التجديد. إنشاء الطلب أو إصدار المفتاح أو تفعيله لا يُنشئ إيرادًا.' : 'Income is recorded once only when the renewal payment is confirmed. Creating the order, issuing the key, or activating it does not create revenue.'}</p>
            <label className="mt-4 flex items-start gap-2 text-sm"><Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} /><span>{isRtl ? 'أوافق على ' : 'I agree to the '}<Link className="font-semibold underline" href="/terms">{isRtl ? 'الشروط والأحكام' : 'Terms and Conditions'}</Link>.</span></label>
            <Button className="mt-4" disabled={!accepted || createRenewal.isPending} onClick={() => createRenewal.mutate({ paymentMethod: 'bank_transfer', termsAcceptedAt: new Date().toISOString(), termsAcceptedVersion: CURRENT_TERMS_VERSION })}><RefreshCw className="me-2 h-4 w-4" />{createRenewal.isPending ? (isRtl ? 'جاري الإنشاء...' : 'Creating...') : (isRtl ? 'إنشاء طلب التجديد' : 'Create renewal order')}</Button>
          </section>
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

      </div>
    </ClientLayout>
  );
}
