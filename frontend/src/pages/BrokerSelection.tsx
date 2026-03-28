import { Building2, ExternalLink, MessageCircle, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import ClientLayout from '@/components/ClientLayout';

export default function BrokerSelection() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const { data: brokers, isLoading } = trpc.brokers.listActive.useQuery();

  const parseFeatures = (json: string | null | undefined): string[] => {
    if (!json) return [];
    try { return JSON.parse(json); } catch { return []; }
  };

  return (
    <ClientLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-7 h-7 text-blue-600" />
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {brokers.map((b) => {
              const features = parseFeatures(isRtl ? b.featuresAr : b.featuresEn);
              return (
                <div key={b.id} className="bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  {/* Logo + Name */}
                  <div className="flex items-center gap-3 mb-4">
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={isRtl ? b.nameAr : b.nameEn} className="h-12 w-12 object-contain rounded-lg" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                    )}
                    <h2 className="text-xl font-bold">{isRtl ? b.nameAr : b.nameEn}</h2>
                  </div>

                  {/* Description */}
                  {(isRtl ? b.descriptionAr : b.descriptionEn) && (
                    <p className="text-sm text-gray-600 mb-4" dir={isRtl ? 'rtl' : 'ltr'}>
                      {isRtl ? b.descriptionAr : b.descriptionEn}
                    </p>
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
                      <DollarSign className="w-4 h-4" />
                      <span>
                        {isRtl ? 'الحد الأدنى للإيداع: ' : 'Min Deposit: '}
                        <span className="font-semibold text-gray-700">${b.minDeposit}</span>
                      </span>
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
