import { Link } from 'wouter';
import { FileText, ArrowLeft, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

export default function Articles() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { data: articles, isLoading } = trpc.articles.list.useQuery();

  return (
    <div className={`min-h-screen bg-gray-50 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <Link href="/">
            <Button variant="ghost" className="text-white/80 hover:text-white mb-4">
              <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
              {t('home')}
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-2">{t('articles.pageTitle')}</h1>
          <p className="text-emerald-100 text-lg">{t('articles.pageSubtitle')}</p>
        </div>
      </div>

      {/* Articles Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : !articles?.length ? (
          <div className="text-center py-20 text-gray-400">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <p className="text-xl">{t('articles.noArticles')}</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link key={article.id} href={`/articles/${article.slug}`}>
                <div className="bg-white rounded-2xl shadow-sm border hover:shadow-md transition-shadow overflow-hidden cursor-pointer group h-full flex flex-col">
                  {article.thumbnailUrl ? (
                    <img src={article.thumbnailUrl} alt="" className="w-full h-48 object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                      <FileText className="w-12 h-12 text-emerald-300" />
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-emerald-700 transition-colors">
                      {isRtl ? article.titleAr : article.titleEn}
                    </h3>
                    {(isRtl ? article.excerptAr : article.excerptEn) && (
                      <p className="text-sm text-gray-600 line-clamp-3 mb-4 flex-1">
                        {isRtl ? article.excerptAr : article.excerptEn}
                      </p>
                    )}
                    {article.publishedAt && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-auto">
                        <Clock className="w-3 h-3" />
                        {new Date(article.publishedAt).toLocaleDateString(isRtl ? 'ar-SA' : 'en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
