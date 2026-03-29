import { Link } from 'wouter';
import { Calendar, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import PublicLayout from '@/components/PublicLayout';

const typeColors: Record<string, string> = {
  live: 'bg-red-100 text-red-700',
  competition: 'bg-amber-100 text-amber-700',
  discount: 'bg-green-100 text-green-700',
  webinar: 'bg-emerald-100 text-emerald-700',
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
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden text-white py-20 md:py-28" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e40af 100%)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59,130,246,0.12), transparent)' }} />
        <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/8 rounded-full blur-[100px]" />
        <div className="relative container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-[-0.5px]">
            {t('events.pageTitle')}
          </h1>
          <p className="text-emerald-100/80 text-lg max-w-lg mx-auto">
            {t('events.pageSubtitle')}
          </p>
        </div>
      </section>

      {/* Events Grid */}
      <section className="container mx-auto px-4 py-16 max-w-6xl">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-72 animate-pulse" />
            ))}
          </div>
        ) : !events?.length ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300 opacity-40" />
            <p className="text-xl text-gray-500 font-semibold mb-2">
              {isRtl ? 'لا توجد فعاليات بعد' : 'No events yet'}
            </p>
            <p className="text-sm text-gray-400">
              {isRtl ? 'ترقبوا فعالياتنا القادمة قريباً' : 'Stay tuned for upcoming events'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div key={event.id} className="glass-card overflow-hidden hover:shadow-lg transition-all duration-300">
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
                  <h3 className="font-extrabold text-lg text-xf-dark mb-2 tracking-[-0.3px]">
                    {isRtl ? event.titleAr : event.titleEn}
                  </h3>
                  {(isRtl ? event.descriptionAr : event.descriptionEn) && (
                    <p className="text-sm text-gray-500 line-clamp-3 mb-4">
                      {isRtl ? event.descriptionAr : event.descriptionEn}
                    </p>
                  )}
                  {event.linkUrl && (
                    <a href={event.linkUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-xf-primary hover:text-xf-primary-hover font-semibold transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t('events.learnMore')}
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
