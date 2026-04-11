import { Link, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, Clock, FileText } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import PublicLayout from '@/components/PublicLayout';

export default function ArticleDetail() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const params = useParams<{ slug: string }>();
  const { data: article, isLoading } = trpc.articles.bySlug.useQuery({ slug: params.slug || '' });

  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  if (!article) {
    return (
      <PublicLayout>
        <div className="flex flex-col items-center justify-center gap-4 py-32">
          <FileText className="w-16 h-16 text-gray-300" />
          <p className="text-gray-500">{t('articles.notFound')}</p>
          <Link href="/articles">
            <button className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:text-xf-dark transition-all text-sm font-medium">
              {t('articles.backToList')}
            </button>
          </Link>
        </div>
      </PublicLayout>
    );
  }

  const title = isRtl ? article.titleAr : article.titleEn;
  const subject = isRtl ? article.subjectAr : article.subjectEn;
  const excerpt = isRtl ? article.excerptAr || article.excerptEn : article.excerptEn || article.excerptAr;
  const content = isRtl ? (article.contentAr || article.contentEn) : (article.contentEn || article.contentAr);
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const themeClass = article.theme === 'amber'
    ? 'from-amber-950 via-amber-900 to-slate-950'
    : article.theme === 'teal'
      ? 'from-teal-950 via-teal-900 to-slate-950'
      : 'from-emerald-950 via-emerald-900 to-slate-950';

  return (
    <PublicLayout>
      <section className={`relative overflow-hidden bg-gradient-to-br ${themeClass} text-white`}>
        {article.thumbnailUrl ? (
          <img src={article.thumbnailUrl} alt={title} className="absolute inset-0 h-full w-full object-cover opacity-30" />
        ) : null}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_45%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-20">
          <Link href="/articles">
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
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 md:py-16">
        <div className="rounded-[28px] border border-slate-200/80 bg-white px-6 py-8 shadow-[0_18px_50px_rgba(15,23,42,0.06)] md:px-9 md:py-10">
          <div className="space-y-6">
            {content?.split('\n\n').map((paragraph, index) => (
              paragraph.trim() ? (
                <p key={index} className="text-[15px] leading-8 text-slate-700 md:text-[17px]">
                  {paragraph}
                </p>
              ) : null
            ))}
          </div>

          <div className="mt-10 border-t border-slate-100 pt-6">
            <Link href="/articles">
              <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-6 py-2.5 text-sm font-medium text-slate-600 transition-all hover:border-emerald-200 hover:text-xf-dark">
                <BackIcon className="h-4 w-4" />
                {t('articles.backToList')}
              </button>
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
