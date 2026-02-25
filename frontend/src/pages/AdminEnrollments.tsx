// client/src/pages/AdminEnrollments.tsx
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { GraduationCap, Users, BookOpen, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminEnrollments() {
  const { t } = useLanguage();
  return (
    <DashboardLayout>
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('admin.enrollments.title')}</h1>
        <p className="text-gray-600">
          {t('admin.enrollments.trackDesc')}
        </p>
      </div>

      {/* Coming Soon Message */}
      <Card className="mb-8 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-green-600" />
            {t('admin.enrollments.comingSoon')}
          </CardTitle>
          <CardDescription>
            {t('admin.enrollments.devDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            {t('admin.enrollments.underDev')}
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>{t('admin.enrollments.viewAll')}</span>
            </li>
            <li className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-600" />
              <span>{t('admin.enrollments.trackProgress')}</span>
            </li>
            <li className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span>{t('admin.enrollments.monitorEngagement')}</span>
            </li>
            <li className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-yellow-600" />
              <span>{t('admin.enrollments.certificates')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Info Box */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('admin.enrollments.what')}</CardTitle>
          <CardDescription>
            {t('admin.enrollments.whatDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            {t('admin.enrollments.whatText')}
          </p>
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">{t('admin.enrollments.keyFeatures')}</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              <li>• {t('admin.enrollments.feature1')}</li>
              <li>• {t('admin.enrollments.feature2')}</li>
              <li>• {t('admin.enrollments.feature3')}</li>
              <li>• {t('admin.enrollments.feature4')}</li>
              <li>• {t('admin.enrollments.feature5')}</li>
            </ul>
          </div>
          <p className="text-gray-600 mt-4 text-sm">
            {t('admin.enrollments.note')}
          </p>
        </CardContent>
      </Card>

      {/* Placeholder Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t('admin.enrollments.total')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('admin.comingSoon')}</div>
            <p className="text-xs text-gray-500 mt-1">{t('admin.enrollments.studentEnrollments')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t('admin.enrollments.activeStudents')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('admin.comingSoon')}</div>
            <p className="text-xs text-gray-500 mt-1">{t('admin.enrollments.currentlyLearning')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t('admin.enrollments.completionRate')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('admin.comingSoon')}</div>
            <p className="text-xs text-gray-500 mt-1">{t('admin.enrollments.averageCompletion')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  );
}
