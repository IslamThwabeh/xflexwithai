import { Link, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, Clock, FileText } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';
import { useSeoMetadata } from '@/lib/seo';
import { SITE_ORIGIN } from '@shared/seo';

export default function ArticleDetail() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const params = useParams<{ slug: string }>();
  const { data: article, isLoading } = trpc.articles.bySlug.useQuery({ slug: params.slug || '' });
  const localizedArticlePath = `/${isRtl ? 'ar' : 'en'}/articles/${params.slug || ''}`;
  const seoTitle = article
    ? ((isRtl ? article.seoTitleAr : article.seoTitleEn) || (isRtl ? article.titleAr : article.titleEn))
    : undefined;
  const seoDescription = article
    ? ((isRtl ? article.seoDescriptionAr : article.seoDescriptionEn)
      || (isRtl ? article.excerptAr || article.excerptEn : article.excerptEn || article.excerptAr)
      || undefined)
    : undefined;
  useSeoMetadata('articles', isRtl ? 'ar' : 'en', {
    title: seoTitle ? `${seoTitle} | XFlex` : undefined,
    description: seoDescription,
    image: (article?.socialImageUrl || article?.thumbnailUrl)
      ? ((article.socialImageUrl || article.thumbnailUrl)!.startsWith('http')
        ? (article.socialImageUrl || article.thumbnailUrl)!
        : `${SITE_ORIGIN}${article.socialImageUrl || article.thumbnailUrl}`)
      : undefined,
    canonicalPath: localizedArticlePath,
    type: 'article',
    jsonLd: article ? {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: seoTitle,
      description: seoDescription,
      image: article.socialImageUrl || article.thumbnailUrl || `${SITE_ORIGIN}/xflex-logo-2026-transparent.png`,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt || article.publishedAt,
      inLanguage: isRtl ? 'ar' : 'en',
      mainEntityOfPage: `${SITE_ORIGIN}${localizedArticlePath}`,
      author: {
        '@type': 'Organization',
        name: (isRtl ? article.authorNameAr : article.authorNameEn) || 'XFlex Editorial Team',
        url: `${SITE_ORIGIN}/${isRtl ? 'ar' : 'en'}/authors/xflex-editorial-team`,
      },
      publisher: { '@id': `${SITE_ORIGIN}/#organization` },
    } : undefined,
  });

  if (isLoading) {
    return (
      <CinematicPublicLayout>
        <div className="flex items-center justify-center bg-[#050505] py-32">
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </CinematicPublicLayout>
    );
  }

  if (!article) {
    return (
      <CinematicPublicLayout>
        <div className="flex flex-col items-center justify-center gap-4 bg-[#050505] py-32">
          <FileText className="w-16 h-16 text-white/24" />
          <p className="text-white/58">{t('articles.notFound')}</p>
          <Link href={`/${isRtl ? 'ar' : 'en'}/articles`}>
            <button className="rounded-full border border-white/12 bg-white/[0.04] px-6 py-2.5 text-sm font-medium text-white/76 transition-all hover:bg-white/[0.08] hover:text-white">
              {t('articles.backToList')}
            </button>
          </Link>
        </div>
      </CinematicPublicLayout>
    );
  }

  const title = isRtl ? article.titleAr : article.titleEn;
  const subject = isRtl ? article.subjectAr : article.subjectEn;
  const excerpt = isRtl ? article.excerptAr || article.excerptEn : article.excerptEn || article.excerptAr;
  const content = isRtl ? (article.contentAr || article.contentEn) : (article.contentEn || article.contentAr);
  const authorName = (isRtl ? article.authorNameAr : article.authorNameEn)
    || (isRtl ? 'فريق XFlex التحريري' : 'XFlex Editorial Team');
  const reviewerName = isRtl ? article.reviewerNameAr : article.reviewerNameEn;
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const themeClass = article.theme === 'amber'
    ? 'from-amber-950 via-amber-900 to-slate-950'
    : article.theme === 'teal'
      ? 'from-teal-950 via-teal-900 to-slate-950'
      : 'from-emerald-950 via-emerald-900 to-slate-950';

  return (
    <CinematicPublicLayout>
      <section className={`relative overflow-hidden bg-gradient-to-br ${themeClass} text-white`}>
        {article.thumbnailUrl ? (
          <img src={article.thumbnailUrl} alt={title} className="absolute inset-0 h-full w-full object-cover opacity-30" />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_45%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-20">
          <Link href={`/${isRtl ? 'ar' : 'en'}/articles`}>
            <button className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-sm transition-all hover:bg-white/15">
              <BackIcon className="h-4 w-4" />
              {t('articles.backToList')}
            </button>
          </Link>

          <div className="mt-10 flex flex-wrap items-center gap-3 text-sm text-white/85">
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 font-semibold tracking-[0.14em] uppercase backdrop-blur-sm">
              {subject}
            </span>
            {article.publishedAt ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
                <Clock className="h-4 w-4" />
                {new Date(article.publishedAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
                  year: 'numeric', month: 'long', day: 'numeric',
                })}
              </span>
            ) : null}
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {isRtl ? `${article.readingTimeMinutes} دقائق قراءة` : `${article.readingTimeMinutes} min read`}
            </span>
          </div>

          <h1 className="mt-6 max-w-4xl text-3xl font-extrabold tracking-[-0.6px] md:text-5xl md:leading-[1.1]">
            {title}
          </h1>

          {excerpt ? (
            <p className="mt-5 max-w-3xl text-base leading-8 text-white/82 md:text-lg">
              {excerpt}
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/72">
            <Link href={`/${isRtl ? 'ar' : 'en'}/authors/xflex-editorial-team`} className="underline decoration-white/30 underline-offset-4">
              {isRtl ? `إعداد: ${authorName}` : `By ${authorName}`}
            </Link>
            {reviewerName ? <span>{isRtl ? `مراجعة: ${reviewerName}` : `Reviewed by ${reviewerName}`}</span> : null}
            {article.updatedAt ? (
              <span>
                {isRtl ? 'آخر تحديث: ' : 'Updated: '}
                {new Date(article.updatedAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <div className="bg-[#050505] pb-16">
        <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
          <div className="rounded-[28px] border border-white/10 bg-[#F6F3EC] px-6 py-8 shadow-[0_18px_50px_rgba(15,23,42,0.18)] md:px-9 md:py-10">
            <div className="space-y-6">
              {content?.split('\n\n').map((paragraph, index) => (
                paragraph.trim() ? (
                  <p key={index} className="text-[15px] leading-8 text-slate-700 md:text-[17px]">
                    {paragraph}
                  </p>
                ) : null
              ))}
            </div>

            <div className="mt-10 border-t border-slate-200/80 pt-6">
              {article.sources ? (
                <section className="mb-8">
                  <h2 className="text-lg font-bold text-slate-900">{isRtl ? 'المصادر' : 'Sources'}</h2>
                  <ul className="mt-3 list-disc space-y-2 ps-5 text-sm text-slate-600">
                    {article.sources.split(/\r?\n/).filter(Boolean).map((source) => (
                      <li key={source}>
                        <a href={source} rel="noreferrer" target="_blank" className="break-all text-emerald-700 underline">
                          {source}
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              <Link href={`/${isRtl ? 'ar' : 'en'}/articles`}>
                <button className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-6 py-2.5 text-sm font-medium text-slate-600 transition-all hover:border-emerald-300 hover:text-xf-dark">
                  <BackIcon className="h-4 w-4" />
                  {t('articles.backToList')}
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </CinematicPublicLayout>
  );
}
