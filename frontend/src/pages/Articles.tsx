import { Link } from 'wouter';
import { Newspaper } from 'lucide-react';
import ArticlePreviewCard from '@/components/ArticlePreviewCard';
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
          <p className="text-emerald-100/80 text-lg max-w-2xl mx-auto">
            {isRtl
              ? 'مقالات مركزة تكشف الوعود الوهمية، تشرح واقع الأرباح، وتفكك طريقة عمل قنوات التوصيات قبل أن تدخل السوق بعين مغمضة.'
              : 'Focused reads that expose deceptive promises, explain the reality behind profits, and unpack how signal channels work before you enter the market blindly.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-emerald-50/90">
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {isRtl ? `${articles?.length ?? 0} مقالات منشورة` : `${articles?.length ?? 0} published reads`}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {isRtl ? 'عربي + English' : 'Arabic + English'}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {isRtl ? 'مختصرة وواضحة' : 'Short, clear, actionable'}
            </span>
          </div>
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
              <ArticlePreviewCard key={article.id} article={article} isRtl={isRtl} />
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
