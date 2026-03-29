import { Link } from 'wouter';
import { FileText, Clock, Newspaper } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import PublicLayout from '@/components/PublicLayout';

export default function Articles() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { data: articles, isLoading } = trpc.articles.list.useQuery();

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden text-white py-20 md:py-28" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 50%, #065f46 100%)' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(16,185,129,0.15), transparent)' }} />
        <div className="absolute top-10 left-10 w-72 h-72 bg-emerald-500/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-green-500/8 rounded-full blur-[100px]" />
        <div className="relative container mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-4 tracking-[-0.5px]">
            {t('articles.pageTitle')}
          </h1>
          <p className="text-emerald-100/80 text-lg max-w-lg mx-auto">
            {t('articles.pageSubtitle')}
          </p>
        </div>
      </section>

      {/* Articles Grid */}
      <section className="container mx-auto px-4 py-16 max-w-6xl">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-80 animate-pulse" />
            ))}
          </div>
        ) : !articles?.length ? (
          <div className="text-center py-20">
            <Newspaper className="w-16 h-16 mx-auto mb-4 text-gray-300 opacity-40" />
            <p className="text-xl text-gray-500 font-semibold mb-2">
              {isRtl ? 'لا توجد مقالات بعد' : 'No articles yet'}
            </p>
            <p className="text-sm text-gray-400">
              {isRtl ? 'ترقبوا مقالاتنا القادمة قريباً' : 'Stay tuned for upcoming articles'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link key={article.id} href={`/articles/${article.slug}`}>
                <div className="glass-card overflow-hidden cursor-pointer group h-full flex flex-col hover:shadow-lg transition-all duration-300">
                  {article.thumbnailUrl ? (
                    <img src={article.thumbnailUrl} alt="" className="w-full h-48 object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center">
                      <FileText className="w-12 h-12 text-emerald-300" />
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="font-extrabold text-lg text-xf-dark mb-2 group-hover:text-emerald-700 transition-colors tracking-[-0.3px]">
                      {isRtl ? article.titleAr : article.titleEn}
                    </h3>
                    {(isRtl ? article.excerptAr : article.excerptEn) && (
                      <p className="text-sm text-gray-500 line-clamp-3 mb-4 flex-1">
                        {isRtl ? article.excerptAr : article.excerptEn}
                      </p>
                    )}
                    {article.publishedAt && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-auto">
                        <Clock className="w-3 h-3" />
                        {new Date(article.publishedAt).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US', {
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
      </section>
    </PublicLayout>
  );
}
