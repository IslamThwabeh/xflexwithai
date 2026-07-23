// client/src/pages/AdminSettings.tsx
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Settings, Bell, Mail, Save, Loader2, GraduationCap, MessageCircle, Shield, Eye, EyeOff, KeyRound, SlidersHorizontal, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { trpc } from '@/lib/trpc';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { STAFF_NOTIFICATION_EVENTS } from '@shared/const';
import { type AdminFeatureFlagKey } from '@shared/featureFlags';

function parseNotificationEmailList(value: string) {
  return Array.from(new Set(
    value
      .split(/[\n,;]+/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  ));
}

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

  // Local state for admin emails
  const [notifEmailsText, setNotifEmailsText] = useState('');
  const [emailPrefs, setEmailPrefs] = useState<Record<string, boolean>>({});
  const [studyPeriodDays, setStudyPeriodDays] = useState(14);
  const [aiResumeMinutes, setAiResumeMinutes] = useState(30);
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [showAdminPasswords, setShowAdminPasswords] = useState(false);
  const [pendingFeatureChange, setPendingFeatureChange] = useState<{
    key: AdminFeatureFlagKey;
    enabled: boolean;
    label: string;
  } | null>(null);

  const updateFeatureFlag = trpc.adminSettings.updateFeatureFlag.useMutation({
    onSuccess: async () => {
      toast.success(isRtl ? 'تم تحديث حالة الميزة' : 'Feature status updated');
      setPendingFeatureChange(null);
      await Promise.all([
        utils.adminSettings.getAll.invalidate(),
        utils.staffPerformance.availability.invalidate(),
        utils.studentSurveys.availability.invalidate(),
        utils.community.availability.invalidate(),
        utils.points.rewardsAvailability.invalidate(),
        utils.studentJobEligibility.availability.invalidate(),
      ]);
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (allSettings) {
      let parsedEmails: string[] = [];
      if (allSettings.notification_emails_json) {
        try {
          const raw = JSON.parse(allSettings.notification_emails_json);
          if (Array.isArray(raw)) {
            parsedEmails = raw.filter((item): item is string => typeof item === 'string' && !!item.trim());
          }
        } catch {
          parsedEmails = [];
        }
      }

      setNotifEmailsText(parsedEmails.length > 0
        ? parsedEmails.join('\n')
        : (allSettings.notification_email ?? ''));

      try {
        setEmailPrefs(allSettings.email_alert_prefs ? JSON.parse(allSettings.email_alert_prefs) : {});
      } catch { setEmailPrefs({}); }

      setStudyPeriodDays(allSettings.study_period_days ? parseInt(allSettings.study_period_days, 10) || 14 : 14);
      setAiResumeMinutes(allSettings.support_ai_resume_minutes ? parseInt(allSettings.support_ai_resume_minutes, 10) || 30 : 30);
    }
  }, [allSettings]);

  // My per-event prefs
  const [myEventPrefs, setMyEventPrefs] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (myPrefs) setMyEventPrefs(myPrefs);
  }, [myPrefs]);

  const changeAdminPassword = trpc.auth.changeAdminPassword.useMutation({
    onSuccess: () => {
      toast.success(isRtl ? 'تم تغيير كلمة مرور الإدارة. يرجى تسجيل الدخول من جديد.' : 'Admin password changed. Please sign in again.');
      setCurrentAdminPassword('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
      window.location.href = '/admin?reason=password_changed';
    },
    onError: (e) => toast.error(e.message),
  });

  const saveNotificationEmails = async () => {
    const emails = parseNotificationEmailList(notifEmailsText);
    const invalid = emails.find((email) => !/^\S+@\S+\.\S+$/.test(email));
    if (invalid) {
      toast.error(isRtl ? `بريد غير صالح: ${invalid}` : `Invalid email: ${invalid}`);
      return;
    }

    await updateSetting.mutateAsync({
      key: 'notification_emails_json',
      value: JSON.stringify(emails),
    });

    await updateSetting.mutateAsync({
      key: 'notification_email',
      value: emails[0] ?? '',
    });
  };

  const canSubmitAdminPassword = currentAdminPassword.length > 0
    && newAdminPassword.length >= 8
    && newAdminPassword === confirmAdminPassword;

  const submitAdminPasswordChange = () => {
    if (!currentAdminPassword || !newAdminPassword || !confirmAdminPassword) {
      toast.error(isRtl ? 'يرجى تعبئة كل الحقول' : 'Please fill all password fields');
      return;
    }
    if (newAdminPassword !== confirmAdminPassword) {
      toast.error(isRtl ? 'كلمة المرور الجديدة غير متطابقة' : 'New passwords do not match');
      return;
    }
    changeAdminPassword.mutate({
      currentPassword: currentAdminPassword,
      newPassword: newAdminPassword,
    });
  };

  const featureFlags: Array<{
    key: AdminFeatureFlagKey;
    label: string;
    description: string;
    caution?: boolean;
  }> = [
    {
      key: 'staff_performance_enabled',
      label: isRtl ? 'إدارة أداء الموظفين' : 'Staff performance management',
      description: isRtl ? 'الخطط الشهرية، العمل اليومي، التقارير والمراجعات.' : 'Monthly plans, daily work, reports, and reviews.',
    },
    {
      key: 'student_surveys_enabled',
      label: isRtl ? 'استبيانات الطلاب' : 'Student surveys',
      description: isRtl ? 'إنشاء الاستبيانات وإرسالها لعينة من الطلاب ومراجعة الإجابات.' : 'Create surveys, assign a student pilot, and review responses.',
    },
    {
      key: 'student_surveys_blocking_enabled',
      label: isRtl ? 'الحجب التدريجي بسبب الاستبيانات' : 'Gradual survey access blocking',
      description: isRtl ? 'ميزة عالية التأثير. لا تفعّل إلا بعد نجاح تجربة الاستبيانات على حساب تجريبي.' : 'High-impact control. Enable only after a successful survey pilot.',
      caution: true,
    },
    {
      key: 'loyalty_rewards_enabled',
      label: isRtl ? 'كتالوج المكافآت والاستبدال' : 'Rewards catalog and redemption',
      description: isRtl ? 'النقاط الأساسية تبقى متاحة؛ هذا المفتاح يشغّل عرض المكافآت وطلبات استبدالها.' : 'Core points remain available; this enables reward browsing and redemption.',
    },
    {
      key: 'student_community_enabled',
      label: isRtl ? 'مجتمع الطلاب' : 'Student community',
      description: isRtl ? 'المنشورات والتعليقات والبلاغات مع لوحة الإشراف.' : 'Posts, comments, reports, and moderation.',
    },
    {
      key: 'student_job_eligibility_enabled',
      label: isRtl ? 'أهلية الطلاب للوظائف' : 'Student job eligibility',
      description: isRtl ? 'قواعد الأهلية والملف المهني وطلبات المراجعة.' : 'Eligibility rules, career profiles, and review requests.',
    },
  ];

  const isFeatureEnabled = (key: AdminFeatureFlagKey) => allSettings?.[key] === 'true';

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
            <Card className="border-emerald-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-emerald-600" />
                  {isRtl ? 'إدارة تفعيل الميزات' : 'Feature activation'}
                </CardTitle>
                <CardDescription>
                  {isRtl
                    ? 'الصفحات الإدارية تبقى ظاهرة لكِ لمعرفة حالتها، بينما لا تظهر الميزة للطلاب أو الموظفين المخولين إلا بعد تفعيلها هنا. يفضّل تشغيل ميزة واحدة وتجربتها قبل الانتقال للتالية.'
                    : 'Admin pages remain discoverable, while students and assigned staff see a feature only after it is enabled here. Enable and pilot one feature at a time.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {featureFlags.map((feature) => {
                  const enabled = isFeatureEnabled(feature.key);
                  const blockingPrerequisiteMissing = feature.key === 'student_surveys_blocking_enabled'
                    && !isFeatureEnabled('student_surveys_enabled');
                  return (
                    <div
                      key={feature.key}
                      className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${feature.caution ? 'border-amber-200 bg-amber-50/50' : 'bg-background'}`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold">{feature.label}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                            {enabled ? (isRtl ? 'مفعّلة' : 'Enabled') : (isRtl ? 'غير مفعّلة' : 'Disabled')}
                          </span>
                          {feature.caution && <AlertTriangle className="h-4 w-4 text-amber-600" />}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{feature.description}</p>
                        {blockingPrerequisiteMissing && (
                          <p className="mt-1 text-xs font-medium text-amber-700">
                            {isRtl ? 'يجب تفعيل استبيانات الطلاب أولاً.' : 'Student surveys must be enabled first.'}
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={enabled}
                        disabled={updateFeatureFlag.isPending || (blockingPrerequisiteMissing && !enabled)}
                        onCheckedChange={(checked) => setPendingFeatureChange({ key: feature.key, enabled: checked, label: feature.label })}
                        aria-label={feature.label}
                        className="mt-1"
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Global Admin Emails */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  {isRtl ? 'أمان الإدارة' : 'Admin Security'}
                </CardTitle>
                <CardDescription>
                  {isRtl
                    ? 'تغيير كلمة مرور الإدارة يخرج كل جلسات الإدارة الحالية فوراً.'
                    : 'Changing the admin password immediately signs out every current admin session.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="max-w-xl space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-sm font-medium">{isRtl ? 'كلمة المرور الحالية' : 'Current password'}</label>
                    <Input
                      type={showAdminPasswords ? 'text' : 'password'}
                      value={currentAdminPassword}
                      onChange={(event) => setCurrentAdminPassword(event.target.value)}
                      autoComplete="current-password"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">{isRtl ? 'كلمة المرور الجديدة' : 'New password'}</label>
                    <Input
                      type={showAdminPasswords ? 'text' : 'password'}
                      value={newAdminPassword}
                      onChange={(event) => setNewAdminPassword(event.target.value)}
                      autoComplete="new-password"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">{isRtl ? 'تأكيد كلمة المرور' : 'Confirm password'}</label>
                    <Input
                      type={showAdminPasswords ? 'text' : 'password'}
                      value={confirmAdminPassword}
                      onChange={(event) => setConfirmAdminPassword(event.target.value)}
                      autoComplete="new-password"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAdminPasswords((current) => !current)}
                  >
                    {showAdminPasswords ? <EyeOff className="me-2 h-4 w-4" /> : <Eye className="me-2 h-4 w-4" />}
                    {showAdminPasswords ? (isRtl ? 'إخفاء' : 'Hide') : (isRtl ? 'إظهار' : 'Show')}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canSubmitAdminPassword || changeAdminPassword.isPending}
                      >
                        {changeAdminPassword.isPending ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <KeyRound className="me-2 h-4 w-4" />}
                        {isRtl ? 'تغيير كلمة المرور' : 'Change Password'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir={isRtl ? 'rtl' : 'ltr'}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{isRtl ? 'تأكيد تغيير كلمة مرور الإدارة' : 'Confirm Admin Password Change'}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {isRtl
                            ? 'بعد التأكيد سيتم تسجيل خروج كل جلسات الإدارة الحالية، وستحتاجين لتسجيل الدخول بكلمة المرور الجديدة.'
                            : 'After confirming, every current admin session will be signed out and the new password will be required.'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{isRtl ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                        <AlertDialogAction onClick={submitAdminPasswordChange}>
                          {isRtl ? 'تأكيد' : 'Confirm'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isRtl
                    ? 'يجب أن تحتوي كلمة المرور على 8 أحرف على الأقل، وحرف كبير، وحرف صغير، ورقم.'
                    : 'Password must have at least 8 characters, one uppercase letter, one lowercase letter, and one number.'}
                </p>
              </CardContent>
            </Card>

            {/* Global Admin Emails */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-500" />
                  {isRtl ? 'بريد إشعارات الإدارة' : 'Admin Notification Emails'}
                </CardTitle>
                <CardDescription>
                  {isRtl
                    ? 'يمكنك إضافة أكثر من بريد. افصل بينها بسطر جديد أو فاصلة.'
                    : 'Add one or more recipients. Separate by new line or comma.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <textarea
                  value={notifEmailsText}
                  onChange={(e) => setNotifEmailsText(e.target.value)}
                  rows={4}
                  className="w-full max-w-md border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                  placeholder={isRtl
                    ? 'admin@xflexacademy.com\nops@xflexacademy.com'
                    : 'admin@xflexacademy.com\nops@xflexacademy.com'}
                  dir="ltr"
                />
                <Button
                  size="sm"
                  onClick={saveNotificationEmails}
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

            {/* Support Chat Setting */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-emerald-500" />
                  {isRtl ? 'إعدادات الدردشة' : 'Support Chat'}
                </CardTitle>
                <CardDescription>
                  {isRtl
                    ? 'المدة التي ينتظرها الذكاء الاصطناعي قبل استئناف الرد تلقائيًا بعد طلب موظف حقيقي'
                    : 'Minutes to wait before AI auto-resumes replying after a student requests a human agent'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={aiResumeMinutes}
                    onChange={e => setAiResumeMinutes(Math.max(1, Math.min(1440, parseInt(e.target.value, 10) || 30)))}
                    className="w-24 border rounded px-3 py-2 text-sm dark:bg-slate-900 dark:border-slate-700"
                    dir="ltr"
                  />
                  <span className="text-sm text-gray-500">{isRtl ? 'دقيقة' : 'minutes'}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => updateSetting.mutate({ key: 'support_ai_resume_minutes', value: String(aiResumeMinutes) })}
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

        <AlertDialog open={Boolean(pendingFeatureChange)} onOpenChange={(open) => !open && setPendingFeatureChange(null)}>
          <AlertDialogContent dir={isRtl ? 'rtl' : 'ltr'}>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingFeatureChange?.enabled
                  ? (isRtl ? 'تأكيد تفعيل الميزة' : 'Confirm feature activation')
                  : (isRtl ? 'تأكيد إيقاف الميزة' : 'Confirm feature deactivation')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingFeatureChange?.enabled
                  ? (isRtl
                    ? `سيتم تفعيل «${pendingFeatureChange?.label ?? ''}» للمستخدمين المسموح لهم. ابدئي بعينة تجريبية صغيرة.`
                    : `“${pendingFeatureChange?.label ?? ''}” will become available to authorized users. Start with a small pilot.`)
                  : (isRtl
                    ? `سيتم إخفاء «${pendingFeatureChange?.label ?? ''}» عن المستخدمين. البيانات الحالية لن تُحذف.`
                    : `“${pendingFeatureChange?.label ?? ''}” will be hidden from users. Existing data will not be deleted.`)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{isRtl ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => pendingFeatureChange && updateFeatureFlag.mutate({
                  key: pendingFeatureChange.key,
                  enabled: pendingFeatureChange.enabled,
                })}
              >
                {isRtl ? 'تأكيد' : 'Confirm'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
