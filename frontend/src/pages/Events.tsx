import { Link } from 'wouter';
import { Calendar, ExternalLink, ArrowUpRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';

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
    <CinematicPublicLayout>
      <section className="relative overflow-hidden bg-[#050505] py-20 text-white md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,193,118,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(200,169,107,0.10),transparent_28%)]" />
        <div className="absolute left-[-4rem] top-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[90px]" />
        <div className="absolute bottom-0 right-[-5rem] h-96 w-96 rounded-full bg-amber-400/10 blur-[120px]" />

        <div className="relative container mx-auto px-4 text-center md:px-8">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#00C176]/24 bg-[#00C176]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
            {isRtl ? 'الفعاليات' : 'Events'}
          </div>
          <h1 className="mb-4 mt-6 text-3xl font-extrabold tracking-[-0.5px] md:text-5xl">
            {t('events.pageTitle')}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/66">
            {isRtl
              ? 'جلسات مباشرة، عروض محددة، وفعاليات نعلن عنها بشكل أوضح حتى تعرف ما يستحق المتابعة الآن بدل البحث بين الصفحات.'
              : 'Live sessions, timely offers, and public events presented more clearly so you can see what is worth following now without hunting across the site.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/80">
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
              {isRtl ? `${events?.length ?? 0} فعاليات معلنة` : `${events?.length ?? 0} announced events`}
            </span>
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
              {isRtl ? 'جلسات + عروض + ندوات' : 'Sessions + offers + webinars'}
            </span>
          </div>
        </div>
      </section>

      <section className="bg-[#050505] pb-16">
        <div className="container mx-auto max-w-6xl px-4 md:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm md:p-6">
            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-72 animate-pulse rounded-[26px] border border-white/8 bg-white/[0.05]" />
                ))}
              </div>
            ) : !events?.length ? (
              <div className="py-20 text-center">
                <Calendar className="mx-auto mb-4 h-16 w-16 text-white/24" />
                <p className="mb-2 text-xl font-semibold text-white/72">
                  {isRtl ? 'لا توجد فعاليات بعد' : 'No events yet'}
                </p>
                <p className="text-sm text-white/42">
                  {isRtl ? 'ترقبوا فعالياتنا القادمة قريباً' : 'Stay tuned for upcoming events'}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {events.map((event) => (
                  <div key={event.id} className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[0.04] transition-all duration-300 hover:border-[#00C176]/20 hover:bg-white/[0.06]">
                    {event.imageUrl ? (
                      <img src={event.imageUrl} alt="" className="h-48 w-full object-cover" />
                    ) : (
                      <div className="flex h-48 w-full items-center justify-center bg-[linear-gradient(135deg,rgba(0,193,118,0.12),rgba(200,169,107,0.14))]">
                        <Calendar className="h-10 w-10 text-white/44" />
                      </div>
                    )}
                    <div className="p-5 text-white">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge className={`text-xs ${typeColors[event.eventType] || 'bg-gray-100'}`}>
                          {isRtl ? typeLabels[event.eventType]?.ar : typeLabels[event.eventType]?.en || event.eventType}
                        </Badge>
                        <span className="text-xs text-white/42">
                          {new Date(event.eventDate).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </span>
                      </div>
                      <h3 className="mb-2 text-lg font-extrabold tracking-[-0.3px] text-white">
                        {isRtl ? event.titleAr : event.titleEn}
                      </h3>
                      {(isRtl ? event.descriptionAr : event.descriptionEn) ? (
                        <p className="mb-4 line-clamp-3 text-sm leading-6 text-white/58">
                          {isRtl ? event.descriptionAr : event.descriptionEn}
                        </p>
                      ) : null}
                      {event.linkUrl ? (
                        <a
                          href={event.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#00C176] transition-colors hover:text-white"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {t('events.learnMore')}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </CinematicPublicLayout>
  );
}
