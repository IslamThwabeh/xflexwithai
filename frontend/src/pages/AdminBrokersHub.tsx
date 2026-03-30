import { useLocation } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import DashboardLayout from '@/components/DashboardLayout';
import { AdminBrokersContent } from './AdminBrokers';
import { AdminBrokerOnboardingContent } from './AdminBrokerOnboarding';

const tabs = [
  { key: 'manage', path: '/admin/brokers', labelEn: 'Manage Brokers', labelAr: 'إدارة الوسطاء' },
  { key: 'onboarding', path: '/admin/broker-onboarding', labelEn: 'Onboarding Review', labelAr: 'مراجعة التسجيل' },
] as const;

export default function AdminBrokersHub() {
  const [location, navigate] = useLocation();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const activeTab = location.includes('broker-onboarding') ? 'onboarding' : 'manage';

  return (
    <DashboardLayout>
      <div className="flex items-center gap-3 mb-6">
        {tabs.map((t, i) => (
          <>
            {i > 0 && <div className="h-6 w-px bg-slate-300" />}
            <button
              key={t.key}
              onClick={() => navigate(t.path)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/60 text-slate-600 hover:bg-white/80'
              }`}
            >
              {isAr ? t.labelAr : t.labelEn}
            </button>
          </>
        ))}
      </div>

      {activeTab === 'manage' ? <AdminBrokersContent /> : <AdminBrokerOnboardingContent />}
    </DashboardLayout>
  );
}
