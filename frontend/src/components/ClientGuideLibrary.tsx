import { useEffect, useRef, useState } from 'react';
import { PlayCircle, RotateCw, Video } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import { withApiBase } from '@/lib/apiBase';
import { Button } from '@/components/ui/button';
import {
  CLIENT_GUIDES, CLIENT_GUIDE_TOPICS, formatGuideDuration, getClientGuidePoster,
  type ClientGuide, type ClientGuideFilter,
} from '@shared/clientGuides';

function GuidePlayer({ guide, compact }: { guide: ClientGuide; compact: boolean }) {
  const { language } = useLanguage();
  const ar = language === 'ar';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaError, setMediaError] = useState(false);
  const playback = trpc.clientGuides.playback.useQuery({ slug: guide.slug }, {
    staleTime: 60 * 60 * 1000, retry: 1, refetchOnWindowFocus: false,
  });
  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (!video) return;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, []);

  return (
    <section aria-label={ar ? guide.titleAr : guide.titleEn} className="min-w-0 rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm sm:p-5">
      <div className="overflow-hidden rounded-xl bg-black">
        <video
          ref={videoRef}
          controls playsInline preload="none" crossOrigin="anonymous"
          poster={getClientGuidePoster(guide.slug)}
          src={playback.data ? withApiBase(playback.data.streamPath) : undefined}
          className={`block w-full object-contain ${compact ? 'h-[46svh] sm:h-[52svh]' : 'h-[56svh] sm:h-[62svh]'}`}
          onError={() => setMediaError(true)}
          aria-label={ar ? guide.titleAr : guide.titleEn}
        />
      </div>
      {(playback.isError || mediaError) && (
        <div role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-950">
          <p>{ar ? 'تعذر تحميل الفيديو. أعد المحاولة أو تواصل مع الدعم.' : 'The video could not load. Try again or contact support.'}</p>
          <Button variant="outline" size="sm" className="mt-2" disabled={playback.isFetching} onClick={async () => { setMediaError(false); await playback.refetch(); videoRef.current?.load(); }}>
            <RotateCw className="h-4 w-4" />{ar ? 'إعادة المحاولة' : 'Try again'}
          </Button>
        </div>
      )}
      {playback.isLoading && <p role="status" className="mt-3 text-sm text-slate-500">{ar ? 'جارٍ تجهيز الفيديو…' : 'Preparing the video…'}</p>}
      <div className="mt-4 flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold leading-8 text-slate-950">{ar ? guide.titleAr : guide.titleEn}</h2>
        <span dir="ltr" className="mt-1 shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">{formatGuideDuration(guide.seconds)}</span>
      </div>
      <p className="mt-2 text-sm leading-7 text-slate-600">{ar ? guide.descriptionAr : guide.descriptionEn}</p>
      <p className="mt-3 text-xs leading-6 text-slate-500">{ar ? 'الشرح باللغة العربية. اضغط تشغيل للمشاهدة، ويمكنك تكبير الفيديو إلى ملء الشاشة.' : 'Arabic audio. Press play to watch, or use the fullscreen control.'}</p>
    </section>
  );
}

export default function ClientGuideLibrary({ initialTopic = 'all', compact = false }: { initialTopic?: ClientGuideFilter; compact?: boolean }) {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [topic, setTopic] = useState<ClientGuideFilter>(initialTopic);
  const [selectedSlug, setSelectedSlug] = useState<string>(() => CLIENT_GUIDES.find(guide => initialTopic === 'all' || guide.topic === initialTopic)!.slug);
  const guides = CLIENT_GUIDES.filter(guide => topic === 'all' || guide.topic === topic);
  const selected = guides.find(guide => guide.slug === selectedSlug) ?? guides[0];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-w-0 space-y-5">
      <div role="group" aria-label={ar ? 'أقسام دليل الاستخدام' : 'Guide categories'} className="flex flex-wrap gap-2">
        {CLIENT_GUIDE_TOPICS.map(category => (
          <Button key={category.id} variant={topic === category.id ? 'default' : 'outline'} size="sm" aria-pressed={topic === category.id} onClick={() => {
            setTopic(category.id);
            setSelectedSlug(CLIENT_GUIDES.find(guide => category.id === 'all' || guide.topic === category.id)!.slug);
          }}>{ar ? category.ar : category.en}</Button>
        ))}
      </div>
      <div className="grid min-w-0 items-start gap-5 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <GuidePlayer key={selected.slug} guide={selected} compact={compact} />
        <div className="min-w-0 space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Video className="h-4 w-4 text-emerald-700" />{ar ? `الشروحات المتاحة (${guides.length})` : `Available guides (${guides.length})`}</p>
          {guides.map(guide => (
            <button key={guide.slug} type="button" aria-pressed={selected.slug === guide.slug} onClick={() => setSelectedSlug(guide.slug)} className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-start transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 ${selected.slug === guide.slug ? 'border-emerald-400 bg-emerald-50 shadow-sm' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
              <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-900">
                <img src={getClientGuidePoster(guide.slug)} alt="" className="h-full w-full object-cover" width={56} height={80} loading="lazy" />
                <PlayCircle aria-hidden="true" className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-black/60 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-6 text-slate-900">{ar ? guide.titleAr : guide.titleEn}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{ar ? guide.descriptionAr : guide.descriptionEn}</p>
                <p dir="ltr" className="mt-1 text-start text-xs font-semibold text-emerald-800">{formatGuideDuration(guide.seconds)}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
