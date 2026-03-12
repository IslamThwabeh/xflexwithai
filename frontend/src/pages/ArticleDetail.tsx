import { Link, useParams } from 'wouter';
import { ArrowLeft, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

export default function ArticleDetail() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const params = useParams<{ slug: string }>();
  const { data: article, isLoading } = trpc.articles.bySlug.useQuery({ slug: params.slug || '' });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <FileText className="w-16 h-16 text-gray-300" />
        <p className="text-gray-500">{t('articles.notFound')}</p>
        <Link href="/articles">
          <Button variant="outline">{t('articles.backToList')}</Button>
        </Link>
      </div>
    );
  }

  const title = isRtl ? article.titleAr : article.titleEn;
  const content = isRtl ? (article.contentAr || article.contentEn) : (article.contentEn || article.contentAr);

  return (
    <div className={`min-h-screen bg-white ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Hero */}
      {article.thumbnailUrl && (
        <div className="w-full h-64 md:h-96 relative">
          <img src={article.thumbnailUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/articles">
          <Button variant="ghost" size="sm" className="mb-6 text-gray-500">
            <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
            {t('articles.backToList')}
          </Button>
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{title}</h1>

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
            paragraph.trim() ? <p key={i} className="text-gray-700 leading-relaxed mb-4">{paragraph}</p> : null
          ))}
        </div>

        {/* Back */}
        <div className="border-t mt-12 pt-8">
          <Link href="/articles">
            <Button variant="outline">
              <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
              {t('articles.backToList')}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
