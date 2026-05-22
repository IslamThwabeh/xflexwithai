import { Link, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Lock, Play, Sparkles, ArrowUpRight } from 'lucide-react';
import ArticlePreviewCard from '@/components/ArticlePreviewCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';
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
    <CinematicPublicLayout>
      <div className="min-h-screen bg-[#050505]" dir={isRtl ? 'rtl' : 'ltr'}>
        <section className="relative overflow-hidden py-20 text-white md:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,193,118,0.10),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(200,169,107,0.12),transparent_30%)]" />
          <div className="absolute left-[-5rem] top-8 h-72 w-72 rounded-full bg-emerald-500/10 blur-[90px]" />
          <div className="absolute bottom-0 right-[-5rem] h-96 w-96 rounded-full bg-amber-400/10 blur-[120px]" />

          <div className="relative container mx-auto max-w-5xl px-4 text-center md:px-8">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#00C176]/24 bg-[#00C176]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
              {isRtl ? 'المحتوى المجاني' : 'Free Content'}
            </div>
            <h1 className="mt-6 text-3xl font-extrabold tracking-[-0.03em] md:text-5xl">
              {t('freeContent.pageTitle')}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/62 md:text-lg">
              {t('freeContent.pageSubtitle')}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/80">
              <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
                {isRtl ? 'فيديوهات عربية مجانية' : 'Free Arabic videos'}
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
                {isRtl ? 'مقالات كاملة' : 'Full articles'}
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
                {isRtl ? 'دون اشتراك' : 'No subscription needed'}
              </span>
            </div>
          </div>
        </section>

        <section id="free-videos" className="bg-[#050505] pb-12">
          <div className="container mx-auto max-w-6xl px-4 md:px-8">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm md:p-8">
              <div className="mb-10 text-center">
                <div className="mb-4 flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#00C176]/22 bg-[#00C176]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
                    <Sparkles className="h-3.5 w-3.5" />
                    {isRtl ? 'مكتبة البداية المجانية' : 'Free Starter Library'}
                  </span>
                </div>
                <h2 className="text-3xl font-extrabold tracking-[-0.03em] text-white md:text-4xl">
                  {isRtl ? 'فيديوهات عملية + مقالات مفصّلة في مكان واحد' : 'Actionable videos + full articles in one place'}
                </h2>
                <p className="mx-auto mt-4 max-w-3xl text-base leading-7 text-white/62 md:text-lg">
                  {isRtl
                    ? 'هذا القسم يجمع المواد المجانية الجديدة بشكل مرتب: شاهد الفيديو من داخل الصفحة، ثم افتح المقال المرتبط بالفكرة نفسها حتى تقرأها كاملة بدل الاكتفاء بملخص سريع.'
                    : 'This section brings the new free material together in a cleaner format: watch the video inside the page, then open the article tied to that idea so you can read it in full rather than settle for a quick summary.'}
                </p>
              </div>

              {freeLibraryLoading ? (
                <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                  <div className="h-[420px] animate-pulse rounded-[20px] bg-white/[0.06]" />
                  <div className="space-y-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="h-32 animate-pulse rounded-[18px] bg-white/[0.06]" />
                    ))}
                  </div>
                </div>
              ) : freeLibrary ? (
                <>
                  <FreeLibrarySection data={freeLibrary} isRtl={isRtl} initialVideoSlug={selectedVideoSlug} />

                  {featuredArticles.length > 0 ? (
                    <div className="mt-12 rounded-[1.8rem] border border-white/8 bg-black/20 p-5 md:p-6">
                      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#C8A96B]">
                            {isRtl ? 'اقرأ أكثر' : 'Read Next'}
                          </p>
                          <h3 className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-white">
                            {isRtl ? 'مقالات منفصلة لكل فكرة' : 'Standalone articles for each idea'}
                          </h3>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/62 md:text-base">
                            {isRtl
                              ? 'اختر الموضوع الذي يهمك، ثم افتح القراءة الكاملة مباشرة من دون الحاجة إلى تنزيل ملف شامل.'
                              : 'Pick the topic you care about, then open the full read directly without downloading one bundled file.'}
                          </p>
                        </div>
                        <Link href="/articles">
                          <button className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white transition hover:border-[#00C176]/30 hover:bg-white/[0.08]">
                            {isRtl ? 'عرض كل المقالات' : 'View all articles'}
                            <ArrowUpRight className="h-4 w-4" />
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
            </div>
          </div>
        </section>

        <section className="bg-[#050505] pb-20">
          <div className="container mx-auto max-w-6xl px-4 md:px-8">
            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-72 animate-pulse rounded-[1.8rem] bg-white/[0.05]" />
                ))}
              </div>
            ) : !courses?.length ? null : (
              <>
                <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
                      {isRtl ? 'فيديوهات إضافية' : 'More free lessons'}
                    </p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.03em] text-white md:text-3xl">
                      {isRtl ? 'دورات مجانية للدخول العملي' : 'Free courses for hands-on entry'}
                    </h2>
                  </div>
                  <p className="text-sm text-white/56">
                    {isRtl
                      ? `${courses.length} دورة مجانية متاحة`
                      : `${courses.length} free course${courses.length > 1 ? 's' : ''} available`}
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {courses.map((course) => (
                    <Link key={course.id} href={`/course/${course.id}`}>
                      <div className="group flex h-full cursor-pointer flex-col overflow-hidden rounded-[1.8rem] border border-white/10 bg-white/[0.04] transition-all duration-300 hover:border-[#00C176]/22 hover:bg-white/[0.06]">
                        {course.thumbnailUrl ? (
                          <img src={course.thumbnailUrl} alt="" className="h-48 w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                        ) : (
                          <div className="flex h-48 w-full items-center justify-center bg-[linear-gradient(135deg,rgba(0,193,118,0.12),rgba(200,169,107,0.16))]">
                            <Play className="h-12 w-12 text-white/46" />
                          </div>
                        )}
                        <div className="flex flex-1 flex-col p-5 text-white">
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge className="bg-[#00C176]/12 text-[#00C176] hover:bg-[#00C176]/12">{isRtl ? 'مجاني' : 'Free'}</Badge>
                            {((course as any).stageNumber ?? 0) > 0 ? (
                              <Badge variant="outline" className="border-white/12 bg-white/[0.03] text-white/72">
                                {isRtl ? `المرحلة ${(course as any).stageNumber}` : `Stage ${(course as any).stageNumber}`}
                              </Badge>
                            ) : null}
                            <Badge variant="outline" className="border-white/12 bg-white/[0.03] text-white/72 capitalize">{course.level}</Badge>
                          </div>
                          <h3 className="mb-2 text-lg font-extrabold tracking-[-0.02em] text-white transition-colors group-hover:text-[#C8A96B]">
                            {isRtl ? course.titleAr : course.titleEn}
                          </h3>
                          <p className="mb-5 flex-1 text-sm leading-6 text-white/58">
                            {isRtl ? course.descriptionAr : course.descriptionEn}
                          </p>
                          <button className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(0,193,118,0.28)] transition hover:translate-y-[-2px]">
                            <Play className="h-3.5 w-3.5" />
                            {isRtl ? 'شاهد الآن' : 'Watch now'}
                          </button>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-16 rounded-[2rem] border border-[#00C176]/18 bg-[linear-gradient(135deg,rgba(0,193,118,0.18),rgba(6,12,10,0.92),rgba(200,169,107,0.14))] p-8 text-center text-white md:p-10">
                  <Lock className="mx-auto mb-4 h-10 w-10 text-[#00C176]" />
                  <h3 className="text-2xl font-extrabold tracking-[-0.03em]">{t('freeContent.wantMore')}</h3>
                  <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-white/68">{t('freeContent.upgradeMsg')}</p>
                  <Link href="/#packages">
                    <button className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-3 text-base font-semibold text-white shadow-[0_14px_36px_rgba(0,193,118,0.28)] transition hover:translate-y-[-2px]">
                      {t('freeContent.viewPackages')}
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </Link>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </CinematicPublicLayout>
  );
}
