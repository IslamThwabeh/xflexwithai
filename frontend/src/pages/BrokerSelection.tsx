import { Building2, ExternalLink, MessageCircle, ShieldCheck, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatSourceCurrencyAmount } from '@/lib/adminCurrency';
import { parseBrokerFeatures } from '@/lib/brokerFeatures';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';

export default function BrokerSelection() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data: brokers, isLoading } = trpc.brokers.listActive.useQuery();

  const getLocalized = (broker: any, enKey: string, arKey: string) => isRtl ? broker?.[arKey] : broker?.[enKey];

  return (
    <ClientLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            <h1 className="text-2xl font-bold">{isRtl ? 'اختر وسيط التداول' : 'Choose Your Broker'}</h1>
          </div>
          <p className="text-gray-500 text-sm" dir={isRtl ? 'rtl' : 'ltr'}>
            {isRtl
              ? 'اختر وسيط التداول المناسب لك لبدء رحلتك في التداول الحقيقي. جميع الوسطاء مرخصون وموثوقون.'
              : 'Choose a regulated broker to start your real trading journey. All brokers listed are licensed and trusted.'}
          </p>
        </div>

        {/* Broker Cards */}
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : !brokers || brokers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {isRtl ? 'لا يوجد وسطاء متاحين حالياً' : 'No brokers available yet'}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {brokers.map((b, index) => {
              const features = parseBrokerFeatures(isRtl ? b.featuresAr : b.featuresEn);
              const offerSummary = getLocalized(b, 'offerSummaryEn', 'offerSummaryAr');
              const supportHours = getLocalized(b, 'supportHoursEn', 'supportHoursAr');
              const fundingMethods = getLocalized(b, 'fundingMethodsEn', 'fundingMethodsAr');
              const accountRequirements = getLocalized(b, 'accountRequirementsEn', 'accountRequirementsAr');
              const isPrimary = index === 0;

              return (
                <div key={b.id} className={`bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col border ${isPrimary ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-gray-200'}`}>
                  {/* Logo + Name */}
                  <div className="flex items-center gap-4 mb-4">
                    {b.logoUrl ? (
                      <div className={`flex h-14 shrink-0 items-center justify-center rounded-lg border px-4 py-2 ${/(?:^|[_\-/])white|vt-markets/i.test(b.logoUrl) ? 'border-slate-800 bg-slate-900' : 'border-gray-200 bg-white'}`}>
                        <img src={b.logoUrl} alt={isRtl ? b.nameAr : b.nameEn} className="h-8 w-auto max-w-[160px] object-contain" />
                      </div>
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-emerald-600" />
                      </div>
                    )}
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold">{isRtl ? b.nameAr : b.nameEn}</h2>
                        {isPrimary && (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            {isRtl ? 'الخيار الأول حالياً' : 'Current lead option'}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1" dir={isRtl ? 'rtl' : 'ltr'}>
                        {isRtl ? 'الوسيط متاح ضمن رحلة تفعيل XFlex للطلاب' : 'Available inside the XFlex student activation flow'}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  {(isRtl ? b.descriptionAr : b.descriptionEn) && (
                    <p className="text-sm text-gray-600 mb-4" dir={isRtl ? 'rtl' : 'ltr'}>
                      {isRtl ? b.descriptionAr : b.descriptionEn}
                    </p>
                  )}

                  {offerSummary && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 mb-4" dir={isRtl ? 'rtl' : 'ltr'}>
                      <div className="flex items-center gap-2 mb-1 text-amber-800">
                        <ShieldCheck className="h-4 w-4" />
                        <p className="text-sm font-semibold">{isRtl ? 'عرض الإطلاق' : 'Launch Offer'}</p>
                      </div>
                      <p className="text-sm text-amber-700">{offerSummary}</p>
                    </div>
                  )}

                  {/* Features */}
                  {features.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {features.map((f, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Min Deposit */}
                  {b.minDeposit != null && b.minDeposit > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      <Wallet className="w-4 h-4" />
                      <span>
                        {isRtl ? 'الحد الأدنى للإيداع: ' : 'Min Deposit: '}
                        <span className="font-semibold text-gray-700">
                          {formatSourceCurrencyAmount(b.minDeposit, language, {
                            currency: b.minDepositCurrency,
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </span>
                    </div>
                  )}

                  {(supportHours || fundingMethods || accountRequirements) && (
                    <div className="space-y-3 mb-4" dir={isRtl ? 'rtl' : 'ltr'}>
                      {supportHours && (
                        <div className="rounded-xl bg-gray-50 px-4 py-3">
                          <p className="text-xs font-semibold text-gray-700 mb-1">{isRtl ? 'ساعات الدعم' : 'Support Hours'}</p>
                          <p className="text-sm text-gray-600">{supportHours}</p>
                        </div>
                      )}
                      {fundingMethods && (
                        <div className="rounded-xl bg-gray-50 px-4 py-3">
                          <p className="text-xs font-semibold text-gray-700 mb-1">{isRtl ? 'طرق الإيداع والسحب' : 'Funding Methods'}</p>
                          <p className="text-sm text-gray-600">{fundingMethods}</p>
                        </div>
                      )}
                      {accountRequirements && (
                        <div className="rounded-xl bg-gray-50 px-4 py-3">
                          <p className="text-xs font-semibold text-gray-700 mb-1">{isRtl ? 'ملاحظات مهمة' : 'Important Notes'}</p>
                          <p className="text-sm text-gray-600">{accountRequirements}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Spacer */}
                  <div className="flex-1" />

                  {/* Actions */}
                  <div className="flex flex-col gap-2 mt-2">
                    <Button asChild className="w-full gap-2">
                      <a href={b.affiliateUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                        {isRtl ? 'افتح حساب' : 'Open Account'}
                      </a>
                    </Button>
                    {b.supportWhatsapp && (
                      <Button variant="outline" asChild className="w-full gap-2 text-green-700 border-green-200 hover:bg-green-50">
                        <a href={`https://wa.me/${b.supportWhatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="w-4 h-4" />
                          {isRtl ? 'تواصل عبر واتساب' : 'WhatsApp Support'}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ClientLayout>
  );
}
