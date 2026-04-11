import { Link, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Lock, Play, Sparkles } from 'lucide-react';
import ArticlePreviewCard from '@/components/ArticlePreviewCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import PublicLayout from '@/components/PublicLayout';
import FreeLibrarySection from '@/components/FreeLibrarySection';

export default function FreeContent() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { data: courses, isLoading } = trpc.courses.free.useQuery();
  const { data: articles } = trpc.articles.list.useQuery();
  const { data: freeLibrary, isLoading: freeLibraryLoading } = trpc.freeLibrary.list.useQuery();
  const [location] = useLocation();
  const selectedVideoSlug = new URLSearchParams(location.split('?')[1] ?? '').get('video');
  const featuredArticles = articles?.slice(0, 3) ?? [];

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden text-white py-20 md:py-28" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #78350f 50%, #92400e 100%)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(245,158,11,0.15), transparent)' }} />
        <div className="absolute top-10 left-10 w-72 h-72 bg-amber-500/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-orange-500/8 rounded-full blur-[100px]" />
        <div className="relative container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-[-0.5px]">
            {t('freeContent.pageTitle')}
          </h1>
          <p className="text-amber-100/80 text-lg max-w-lg mx-auto">
            {t('freeContent.pageSubtitle')}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-amber-50/90">
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {isRtl ? '3 فيديوهات مجانية باللغة العربية' : '3 Arabic free videos'}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {isRtl ? '3 مقالات كاملة' : '3 full articles'}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {isRtl ? 'دون الحاجة لاشتراك' : 'No subscription required'}
            </span>
          </div>
        </div>
      </section>

      <section id="free-videos" className="container mx-auto max-w-6xl px-4 py-14 md:py-16">
        <div className="mb-10 text-center">
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              {isRtl ? 'مكتبة البداية المجانية' : 'Free Starter Library'}
            </span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-[-0.5px] text-xf-dark md:text-4xl">
            {isRtl ? 'فيديوهات عملية + مقالات مفصّلة في مكان واحد' : 'Actionable videos + full articles in one place'}
          </h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-gray-600 md:text-lg">
            {isRtl
              ? 'هذا القسم يجمع المواد المجانية الجديدة بشكل مرتب: شاهد الفيديو من داخل الصفحة، ثم افتح المقال المرتبط بالفكرة نفسها حتى تقرأها كاملة بدل الاكتفاء بملخص سريع.'
              : 'This section brings the new free material together in a cleaner format: watch the video inside the page, then open the article tied to that idea so you can read it in full rather than settle for a quick summary.'}
          </p>
        </div>

        {freeLibraryLoading ? (
          <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
            <div className="h-[420px] animate-pulse rounded-[20px] bg-white shadow-sm" />
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-32 animate-pulse rounded-[18px] bg-white shadow-sm" />
              ))}
            </div>
          </div>
        ) : freeLibrary ? (
          <>
            <FreeLibrarySection data={freeLibrary} isRtl={isRtl} initialVideoSlug={selectedVideoSlug} />

            {featuredArticles.length > 0 ? (
              <div className="mt-12">
                <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">
                      {isRtl ? 'اقرأ أكثر' : 'Read Next'}
                    </p>
                    <h3 className="mt-2 text-2xl font-extrabold tracking-[-0.4px] text-xf-dark">
                      {isRtl ? 'مقالات منفصلة لكل فكرة' : 'Standalone articles for each idea'}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600 md:text-base">
                      {isRtl
                        ? 'اختر الموضوع الذي يهمك، ثم افتح القراءة الكاملة مباشرة من دون الحاجة إلى تنزيل ملف شامل.'
                        : 'Pick the topic you care about, then open the full read directly without downloading one bundled file.'}
                    </p>
                  </div>
                  <Link href="/articles">
                    <button className="rounded-full border border-amber-200 px-5 py-2.5 text-sm font-semibold text-amber-700 transition-all hover:bg-amber-50">
                      {isRtl ? 'عرض كل المقالات' : 'View All Articles'}
                    </button>
                  </Link>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {featuredArticles.map((article) => (
                    <ArticlePreviewCard key={article.id} article={article} isRtl={isRtl} variant="compact" />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {/* Courses Grid */}
      <section className="container mx-auto px-4 py-16 max-w-6xl">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-72 animate-pulse" />
            ))}
          </div>
        ) : !courses?.length ? null : (
          <>
            <p className="text-gray-500 mb-8">
              {isRtl
                ? `${courses.length} دورة مجانية متاحة`
                : `${courses.length} free course${courses.length > 1 ? 's' : ''} available`}
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <Link key={course.id} href={`/course/${course.id}`}>
                  <div className="glass-card overflow-hidden cursor-pointer group h-full flex flex-col hover:shadow-lg transition-all duration-300">
                    {course.thumbnailUrl ? (
                      <img src={course.thumbnailUrl} alt="" className="w-full h-48 object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
                        <Play className="w-12 h-12 text-orange-300" />
                      </div>
                    )}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-green-100 text-green-700 text-xs">{isRtl ? 'مجاني' : 'Free'}</Badge>
                        {((course as any).stageNumber ?? 0) > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {isRtl ? `المرحلة ${(course as any).stageNumber}` : `Stage ${(course as any).stageNumber}`}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">{course.level}</Badge>
                      </div>
                      <h3 className="font-extrabold text-lg text-xf-dark mb-2 group-hover:text-amber-700 transition-colors tracking-[-0.3px]">
                        {isRtl ? course.titleAr : course.titleEn}
                      </h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">
                        {isRtl ? course.descriptionAr : course.descriptionEn}
                      </p>
                      <button className="btn-primary-xf w-full py-2 text-sm inline-flex items-center justify-center gap-1.5">
                        <Play className="w-3.5 h-3.5" />
                        {isRtl ? 'شاهد الآن' : 'Watch Now'}
                      </button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Upsell */}
            <div className="mt-16 rounded-[16px] p-10 text-center text-white" style={{ background: 'linear-gradient(135deg, #0f172a, #1e3a5f)', boxShadow: '0 12px 40px rgba(15,23,42,0.2)' }}>
              <Lock className="w-10 h-10 mx-auto mb-3 opacity-80" />
              <h3 className="text-2xl font-extrabold mb-2">{t('freeContent.wantMore')}</h3>
              <p className="text-gray-300 mb-6 max-w-lg mx-auto">{t('freeContent.upgradeMsg')}</p>
              <Link href="/#packages">
                <button className="btn-primary-xf px-8 py-3 text-base inline-flex items-center justify-center gap-2">
                  {t('freeContent.viewPackages')}
                </button>
              </Link>
            </div>
          </>
        )}
      </section>
    </PublicLayout>
  );
}
