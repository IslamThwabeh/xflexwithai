import { Link } from 'wouter';
import { Calendar, ExternalLink, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

const typeColors: Record<string, string> = {
  live: 'bg-red-100 text-red-700',
  competition: 'bg-purple-100 text-purple-700',
  discount: 'bg-green-100 text-green-700',
  webinar: 'bg-blue-100 text-blue-700',
};
const typeLabels: Record<string, { en: string; ar: string }> = {
  live: { en: 'Live Session', ar: 'جلسة مباشرة' },
  competition: { en: 'Competition', ar: 'مسابقة' },
  discount: { en: 'Offer', ar: 'عرض' },
  webinar: { en: 'Webinar', ar: 'ندوة' },
};

export default function Events() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { data: events, isLoading } = trpc.events.list.useQuery();

  return (
    <div className={`min-h-screen bg-gray-50 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <Link href="/">
            <Button variant="ghost" className="text-white/80 hover:text-white mb-4">
              <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
              {t('home')}
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-2">{t('events.pageTitle')}</h1>
          <p className="text-blue-100 text-lg">{t('events.pageSubtitle')}</p>
        </div>
      </div>

      {/* Events Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-72 animate-pulse" />
            ))}
          </div>
        ) : !events?.length ? (
          <div className="text-center py-20 text-gray-400">
            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <p className="text-xl">{t('events.noEvents')}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl shadow-sm border hover:shadow-md transition-shadow overflow-hidden">
                {event.imageUrl && (
                  <img src={event.imageUrl} alt="" className="w-full h-48 object-cover" />
                )}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge className={`text-xs ${typeColors[event.eventType] || 'bg-gray-100'}`}>
                      {isRtl ? typeLabels[event.eventType]?.ar : typeLabels[event.eventType]?.en || event.eventType}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {new Date(event.eventDate).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-gray-900 mb-2">
                    {isRtl ? event.titleAr : event.titleEn}
                  </h3>
                  {(isRtl ? event.descriptionAr : event.descriptionEn) && (
                    <p className="text-sm text-gray-600 line-clamp-3 mb-4">
                      {isRtl ? event.descriptionAr : event.descriptionEn}
                    </p>
                  )}
                  {event.linkUrl && (
                    <a href={event.linkUrl} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline" className="w-full">
                        <ExternalLink className="w-3.5 h-3.5 me-1.5" />
                        {t('events.learnMore')}
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
