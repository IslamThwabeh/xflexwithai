import { Link } from 'wouter';
import { Play, BookOpen, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';
import PublicLayout from '@/components/PublicLayout';

export default function FreeContent() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { data: courses, isLoading } = trpc.courses.free.useQuery();

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
        </div>
      </section>

      {/* Courses Grid */}
      <section className="container mx-auto px-4 py-16 max-w-6xl">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card h-72 animate-pulse" />
            ))}
          </div>
        ) : !courses?.length ? (
          <div className="text-center py-20 text-gray-400">
            <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <p className="text-xl">{t('freeContent.noCourses')}</p>
            <p className="text-sm mt-2">{t('freeContent.comingSoon')}</p>
          </div>
        ) : (
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
