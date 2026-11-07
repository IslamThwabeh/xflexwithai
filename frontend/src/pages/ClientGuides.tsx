import ClientLayout from '@/components/ClientLayout';
import ClientGuideLibrary from '@/components/ClientGuideLibrary';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseClientGuideFilter } from '@shared/clientGuides';

export default function ClientGuides() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const initialTopic = parseClientGuideFilter(new URLSearchParams(window.location.search).get('topic'));
  return (
    <ClientLayout>
      <div className="min-h-[calc(100vh-64px)] bg-[var(--color-xf-cream)]" dir={isRTL ? 'rtl' : 'ltr'}>
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-950">{ar ? 'دليل الاستخدام' : 'How-to guides'}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">{ar ? 'ستة شروحات عملية تساعدك على البدء واستخدام التوصيات وLexAI خطوة بخطوة. اختر القسم الذي تحتاجه وشاهد الشرح في وقتك.' : 'Six practical Arabic walkthroughs for getting started, Recommendations and LexAI. Choose a topic and learn at your own pace.'}</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">{ar ? 'الشروحات متاحة من حسابك قبل تفعيل الخدمات. مشاهدة الشرح لا تفعّل الاشتراك ولا تغيّر مدة الخدمة.' : 'You can watch before activating your services. Watching a guide does not activate a subscription or change its duration.'}</p>
          </div>
          <ClientGuideLibrary initialTopic={initialTopic} />
        </main>
      </div>
    </ClientLayout>
  );
}
