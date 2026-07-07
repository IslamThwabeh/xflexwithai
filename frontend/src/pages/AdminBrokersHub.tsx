import { useLocation } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import DashboardLayout from '@/components/DashboardLayout';
import { AdminBrokersContent } from './AdminBrokers';
import { AdminBrokerOnboardingContent } from './AdminBrokerOnboarding';
import { AdminBrokerReportContent } from './AdminBrokerReport';

const tabs = [
  { key: 'manage', path: '/admin/brokers', labelEn: 'Manage Brokers', labelAr: 'إدارة الوسطاء' },
  { key: 'onboarding', path: '/admin/broker-onboarding', labelEn: 'Onboarding Review', labelAr: 'مراجعة التسجيل' },
  { key: 'report', path: '/admin/brokers/report', labelEn: 'Report', labelAr: 'التقرير' },
] as const;

export default function AdminBrokersHub() {
  const [location, navigate] = useLocation();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const activeTab = location.includes('broker-onboarding')
    ? 'onboarding'
    : location.includes('brokers/report') || location.includes('reports/brokers')
      ? 'report'
      : 'manage';

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {tabs.map((t, i) => (
          <div key={t.key} className="flex items-center gap-2">
            {i > 0 && <div className="hidden h-6 w-px bg-slate-300 md:block" />}
            <button
              onClick={() => navigate(t.path)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/60 text-slate-600 hover:bg-white/80'
              } max-w-full whitespace-normal text-center`}
            >
              {isAr ? t.labelAr : t.labelEn}
            </button>
          </div>
        ))}
      </div>

      {activeTab === 'manage' && <AdminBrokersContent />}
      {activeTab === 'onboarding' && <AdminBrokerOnboardingContent />}
      {activeTab === 'report' && <AdminBrokerReportContent />}
    </DashboardLayout>
  );
}
