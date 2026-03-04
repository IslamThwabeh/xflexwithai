import { Link } from 'wouter';
import { Play, ArrowLeft, BookOpen, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import { trpc } from '@/lib/trpc';

export default function FreeContent() {
  const { language, t } = useLanguage();
  const isRtl = language === 'ar';
  const { data: courses, isLoading } = trpc.courses.free.useQuery();

  return (
    <div className={`min-h-screen bg-gray-50 ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 text-white py-16">
        <div className="max-w-6xl mx-auto px-4">
          <Link href="/">
            <Button variant="ghost" className="text-white/80 hover:text-white mb-4">
              <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
              {t('home')}
            </Button>
          </Link>
          <h1 className="text-4xl font-bold mb-2">{t('freeContent.pageTitle')}</h1>
          <p className="text-orange-100 text-lg">{t('freeContent.pageSubtitle')}</p>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl h-72 animate-pulse" />
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
                  <div className="bg-white rounded-2xl shadow-sm border hover:shadow-md transition-shadow overflow-hidden cursor-pointer group h-full flex flex-col">
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
                      <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-orange-700 transition-colors">
                        {isRtl ? course.titleAr : course.titleEn}
                      </h3>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-1">
                        {isRtl ? course.descriptionAr : course.descriptionEn}
                      </p>
                      <Button size="sm" className="w-full bg-orange-600 hover:bg-orange-700">
                        <Play className="w-3.5 h-3.5 me-1.5" />
                        {isRtl ? 'شاهد الآن' : 'Watch Now'}
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Upsell */}
            <div className="mt-16 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-2xl p-8 text-center">
              <Lock className="w-10 h-10 mx-auto mb-3 opacity-80" />
              <h3 className="text-2xl font-bold mb-2">{t('freeContent.wantMore')}</h3>
              <p className="text-blue-200 mb-6 max-w-lg mx-auto">{t('freeContent.upgradeMsg')}</p>
              <Link href="/#packages">
                <Button variant="secondary" size="lg">{t('freeContent.viewPackages')}</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
