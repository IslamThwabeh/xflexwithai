import { useState } from 'react';
import { Building2, FileCheck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { AdminBrokersContent } from './AdminBrokers';
import { AdminBrokerOnboardingContent } from './AdminBrokerOnboarding';

type Tab = 'brokers' | 'onboarding';

export default function AdminBrokersHub() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>(
    location.includes('broker-onboarding') ? 'onboarding' : 'brokers'
  );

  const tabs: { key: Tab; icon: React.ElementType; labelAr: string; labelEn: string }[] = [
    { key: 'brokers', icon: Building2, labelAr: 'إدارة الوسطاء', labelEn: 'Manage Brokers' },
    { key: 'onboarding', icon: FileCheck, labelAr: 'تسجيل الوسطاء', labelEn: 'Onboarding Review' },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-7 h-7 text-emerald-600" />
          <h1 className="text-2xl font-bold">{isRtl ? 'الوسطاء' : 'Brokers'}</h1>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-6">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {isRtl ? t.labelAr : t.labelEn}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'brokers' && <AdminBrokersContent />}
        {activeTab === 'onboarding' && <AdminBrokerOnboardingContent />}
      </div>
    </DashboardLayout>
  );
}
