// client/src/pages/AdminSettings.tsx
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Settings, Bell, Mail, Save, Loader2, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { trpc } from '@/lib/trpc';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { STAFF_NOTIFICATION_EVENTS } from '@shared/const';

export default function AdminSettings() {
  const { t, language } = useLanguage();
  const isRtl = language === 'ar';
  const utils = trpc.useUtils();

  // Global admin settings
  const { data: allSettings, isLoading } = trpc.adminSettings.getAll.useQuery();
  const updateSetting = trpc.adminSettings.update.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم الحفظ' : 'Saved');
      utils.adminSettings.getAll.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Per-user notification prefs
  const { data: myPrefs } = trpc.adminSettings.getNotificationPrefs.useQuery();
  const updateMyPrefs = trpc.adminSettings.updateNotificationPrefs.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم حفظ تفضيلاتك' : 'Preferences saved');
      utils.adminSettings.getNotificationPrefs.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // Local state for admin email
  const [notifEmail, setNotifEmail] = useState('');
  const [emailPrefs, setEmailPrefs] = useState<Record<string, boolean>>({});
  const [studyPeriodDays, setStudyPeriodDays] = useState(14);

  useEffect(() => {
    if (allSettings) {
      const emailSetting = allSettings.find((s: any) => s.settingKey === 'notification_email');
      setNotifEmail(emailSetting?.settingValue ?? '');

      const ep = allSettings.find((s: any) => s.settingKey === 'email_alert_prefs');
      try {
        setEmailPrefs(ep?.settingValue ? JSON.parse(ep.settingValue) : {});
      } catch { setEmailPrefs({}); }

      const spd = allSettings.find((s: any) => s.settingKey === 'study_period_days');
      setStudyPeriodDays(spd?.settingValue ? parseInt(spd.settingValue, 10) || 14 : 14);
    }
  }, [allSettings]);

  // My per-event prefs
  const [myEventPrefs, setMyEventPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (myPrefs) setMyEventPrefs(myPrefs);
  }, [myPrefs]);

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="mb-4">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Settings className="w-7 h-7 text-emerald-500" />
            {isRtl ? 'إعدادات الإشعارات' : 'Notification Settings'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isRtl ? 'تحكم في إعدادات البريد الإلكتروني والإشعارات' : 'Configure email and notification preferences'}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <>
            {/* Global Admin Email */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-500" />
                  {isRtl ? 'بريد الإشعارات الرئيسي' : 'Admin Notification Email'}
                </CardTitle>
                <CardDescription>
                  {isRtl
                    ? 'البريد الإلكتروني الذي يتلقى إشعارات المشرف (المسؤول)'
                    : 'Email address that receives admin-level alert emails'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  type="email"
                  value={notifEmail}
                  onChange={e => setNotifEmail(e.target.value)}
                  className="w-full max-w-md border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  placeholder="admin@xflexacademy.com"
                  dir="ltr"
                />
                <Button
                  size="sm"
                  onClick={() => updateSetting.mutate({ key: 'notification_email', value: notifEmail })}
                  disabled={updateSetting.isPending}
                >
                  {updateSetting.isPending ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Save className="w-4 h-4 me-1" />}
                  {isRtl ? 'حفظ' : 'Save'}
                </Button>
              </CardContent>
            </Card>

            {/* Study Period Setting */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-emerald-500" />
                  {isRtl ? 'فترة التعلم' : 'Study Period'}
                </CardTitle>
                <CardDescription>
                  {isRtl
                    ? 'عدد الأيام المسموحة للطالب لإنهاء الدورة وفتح حساب الوسيط قبل تفعيل LexAI والتوصيات تلقائياً'
                    : 'Number of days a student has to finish the course and broker onboarding before LexAI & Recommendations auto-activate'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={studyPeriodDays}
                    onChange={e => setStudyPeriodDays(Math.max(1, Math.min(60, parseInt(e.target.value, 10) || 14)))}
                    className="w-24 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                    dir="ltr"
                  />
                  <span className="text-sm text-gray-500">{isRtl ? 'يوم' : 'days'}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => updateSetting.mutate({ key: 'study_period_days', value: String(studyPeriodDays) })}
                  disabled={updateSetting.isPending}
                >
                  {updateSetting.isPending ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Save className="w-4 h-4 me-1" />}
                  {isRtl ? 'حفظ' : 'Save'}
                </Button>
              </CardContent>
            </Card>

            {/* Per-Event Email Toggle (Global) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-emerald-500" />
                  {isRtl ? 'إشعارات البريد لكل حدث' : 'Per-Event Email Alerts'}
                </CardTitle>
                <CardDescription>
                  {isRtl
                    ? 'اختر الأحداث التي ترسل بريدًا إلكترونيًا للمسؤول'
                    : 'Choose which events trigger an admin email alert'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(STAFF_NOTIFICATION_EVENTS).map(([key, ev]) => (
                    <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={emailPrefs[key] !== false}
                        onChange={e => setEmailPrefs(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm">{isRtl ? ev.labelAr : ev.labelEn}</span>
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => updateSetting.mutate({ key: 'email_alert_prefs', value: JSON.stringify(emailPrefs) })}
                  disabled={updateSetting.isPending}
                >
                  {updateSetting.isPending ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Save className="w-4 h-4 me-1" />}
                  {isRtl ? 'حفظ' : 'Save'}
                </Button>
              </CardContent>
            </Card>

            {/* My Personal Notification Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-blue-500" />
                  {isRtl ? 'تفضيلاتي الشخصية' : 'My Notification Preferences'}
                </CardTitle>
                <CardDescription>
                  {isRtl
                    ? 'اختر الأحداث التي تريد تلقي بريد إلكتروني شخصي عنها'
                    : 'Choose which events send you a personal email when you\'re offline'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(STAFF_NOTIFICATION_EVENTS).map(([key, ev]) => (
                    <label key={key} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={myEventPrefs[key] !== false}
                        onChange={e => setMyEventPrefs(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">{isRtl ? ev.labelAr : ev.labelEn}</span>
                    </label>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => updateMyPrefs.mutate({ prefs: myEventPrefs })}
                  disabled={updateMyPrefs.isPending}
                >
                  {updateMyPrefs.isPending ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Save className="w-4 h-4 me-1" />}
                  {isRtl ? 'حفظ تفضيلاتي' : 'Save My Preferences'}
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
