// client/src/pages/AdminAnalytics.tsx
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { BarChart3, TrendingUp, Users, DollarSign } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminAnalytics() {
  const { t } = useLanguage();
  return (
    <DashboardLayout>
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('admin.analytics.title')}</h1>
        <p className="text-gray-600">
          {t('admin.analytics.subtitle')}
        </p>
      </div>

      {/* Coming Soon Message */}
      <Card className="mb-8 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            {t('admin.analytics.comingSoon')}
          </CardTitle>
          <CardDescription>
            {t('admin.analytics.building')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            {t('admin.analytics.underDev')}
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span>{t('admin.analytics.revenue')}</span>
            </li>
            <li className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>{t('admin.analytics.userGrowth')}</span>
            </li>
            <li className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              <span>{t('admin.analytics.viewCompletionRates')}</span>
            </li>
            <li className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-yellow-600" />
              <span>{t('admin.analytics.analyzeUsage')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Placeholder Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t('admin.analytics.totalRevenue')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('admin.comingSoon')}</div>
            <p className="text-xs text-gray-500 mt-1">{t('admin.analytics.revenueTracking')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t('admin.analytics.activeUsers')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('admin.comingSoon')}</div>
            <p className="text-xs text-gray-500 mt-1">{t('admin.analytics.userAnalytics')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t('admin.analytics.courseCompletions')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('admin.comingSoon')}</div>
            <p className="text-xs text-gray-500 mt-1">{t('admin.analytics.courseMetrics')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {t('admin.analytics.flexaiUsage')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('admin.comingSoon')}</div>
            <p className="text-xs text-gray-500 mt-1">{t('admin.analytics.aiAnalytics')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  );
}
