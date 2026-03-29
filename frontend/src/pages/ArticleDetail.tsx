import { Link, useParams } from 'wouter';
import { ArrowLeft, Clock, FileText } from 'lucide-react';
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
  const content = isRtl ? (article.contentAr || article.contentEn) : (article.contentEn || article.contentAr);

  return (
    <PublicLayout>
      {/* Hero */}
      {article.thumbnailUrl && (
        <div className="w-full h-64 md:h-96 relative">
          <img src={article.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link href="/articles">
          <button className="mb-6 px-4 py-2 rounded-full text-sm text-gray-500 hover:text-xf-dark hover:bg-gray-100/80 transition-all inline-flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            {t('articles.backToList')}
          </button>
        </Link>

        <h1 className="text-3xl md:text-4xl font-extrabold text-xf-dark mb-4 tracking-[-0.5px]">{title}</h1>

        {article.publishedAt && (
          <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-8">
            <Clock className="w-4 h-4" />
            {new Date(article.publishedAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </div>
        )}

        {/* Article Content */}
        <div className="prose prose-lg max-w-none prose-emerald">
          {content?.split('\n').map((paragraph, i) => (
            paragraph.trim() ? <p key={i} className="text-gray-600 leading-relaxed mb-4">{paragraph}</p> : null
          ))}
        </div>

        {/* Back */}
        <div className="border-t border-gray-100 mt-12 pt-8">
          <Link href="/articles">
            <button className="px-6 py-2.5 rounded-full border border-gray-200 text-gray-600 hover:text-xf-dark transition-all text-sm font-medium inline-flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              {t('articles.backToList')}
            </button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
