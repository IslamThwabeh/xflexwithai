// client/src/pages/AdminSettings.tsx
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Settings, Bell, Lock, Database, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminSettings() {
  const { t } = useLanguage();
  return (
    <DashboardLayout>
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{t('admin.settings.title')}</h1>
        <p className="text-gray-600">
          {t('admin.settings.subtitle')}
        </p>
      </div>

      {/* Coming Soon Message */}
      <Card className="mb-8 border-purple-200 bg-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-600" />
            {t('admin.settings.comingSoon')}
          </CardTitle>
          <CardDescription>
            {t('admin.settings.advancedDev')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            {t('admin.settings.underDev')}
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-600" />
              <span>{t('admin.settings.notifPref')}</span>
            </li>
            <li className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-red-600" />
              <span>{t('admin.settings.secSettings')}</span>
            </li>
            <li className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-green-600" />
              <span>{t('admin.settings.emailTemplates')}</span>
            </li>
            <li className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" />
              <span>{t('admin.settings.dbBackup')}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Placeholder Settings Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {t('admin.settings.notifications')}
            </CardTitle>
            <CardDescription>
              {t('admin.settings.configNotif')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">{t('admin.comingSoon')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {t('admin.settings.security')}
            </CardTitle>
            <CardDescription>
              {t('admin.settings.manageSecurity')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">{t('admin.comingSoon')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              {t('admin.settings.email')}
            </CardTitle>
            <CardDescription>
              {t('admin.settings.configEmail')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">{t('admin.comingSoon')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              {t('admin.settings.database')}
            </CardTitle>
            <CardDescription>
              {t('admin.settings.dbMaintenance')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">{t('admin.comingSoon')}</p>
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  );
}
