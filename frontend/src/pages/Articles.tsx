import { Link } from 'wouter';
import { Newspaper } from 'lucide-react';
import ArticlePreviewCard from '@/components/ArticlePreviewCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';

export default function Articles() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { data: articles, isLoading } = trpc.articles.list.useQuery();

  return (
    <CinematicPublicLayout>
      <section className="relative overflow-hidden bg-[#050505] py-20 text-white md:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,193,118,0.12),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(200,169,107,0.10),transparent_28%)]" />
        <div className="absolute left-[-4rem] top-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-[90px]" />
        <div className="absolute bottom-0 right-[-5rem] h-96 w-96 rounded-full bg-amber-400/10 blur-[120px]" />
        <div className="relative container mx-auto px-4 text-center md:px-8">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#00C176]/24 bg-[#00C176]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00C176]" style={{ boxShadow: '0 0 8px #00C176' }} />
            {isRtl ? 'المقالات' : 'Articles'}
          </div>
          <h1 className="mb-4 mt-6 text-3xl font-extrabold tracking-[-0.5px] md:text-5xl">
            {t('articles.pageTitle')}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-white/66">
            {isRtl
              ? 'مقالات مركزة تكشف الوعود الوهمية، تشرح واقع الأرباح، وتفكك طريقة عمل قنوات التوصيات قبل أن تدخل السوق بعين مغمضة.'
              : 'Focused reads that expose deceptive promises, explain the reality behind profits, and unpack how signal channels work before you enter the market blindly.'}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-white/80">
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
              {isRtl ? `${articles?.length ?? 0} مقالات منشورة` : `${articles?.length ?? 0} published reads`}
            </span>
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
              {isRtl ? 'عربي + English' : 'Arabic + English'}
            </span>
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-4 py-2 backdrop-blur-sm">
              {isRtl ? 'مختصرة وواضحة' : 'Short, clear, actionable'}
            </span>
          </div>
        </div>
      </section>

      <section className="bg-[#050505] pb-16">
        <div className="container mx-auto max-w-6xl px-4 md:px-8">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm md:p-6">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-[26px] border border-white/8 bg-white/[0.05]" />
            ))}
          </div>
        ) : !articles?.length ? (
          <div className="py-20 text-center">
            <Newspaper className="mx-auto mb-4 h-16 w-16 text-white/24" />
            <p className="mb-2 text-xl font-semibold text-white/72">
              {isRtl ? 'لا توجد مقالات بعد' : 'No articles yet'}
            </p>
            <p className="text-sm text-white/42">
              {isRtl ? 'ترقبوا مقالاتنا القادمة قريباً' : 'Stay tuned for upcoming articles'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticlePreviewCard key={article.id} article={article} isRtl={isRtl} />
            ))}
          </div>
        )}
          </div>
        </div>
      </section>
    </CinematicPublicLayout>
  );
}
