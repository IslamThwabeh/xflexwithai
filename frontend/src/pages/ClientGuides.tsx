import ClientLayout from '@/components/ClientLayout';
import ClientGuideLibrary from '@/components/ClientGuideLibrary';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseClientGuideFilter } from '@shared/clientGuides';
import { Link } from 'wouter';
import { HOME_SCREEN_GUIDE_PATH } from '@shared/studentWelcome';

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
          <Link href={HOME_SCREEN_GUIDE_PATH} className="block rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 hover:bg-emerald-100">
            <h2 className="font-bold">{ar ? 'إضافة الأكاديمية للشاشة الرئيسية' : 'Add the academy to your home screen'}</h2>
            <p className="mt-2 text-sm leading-7">{ar ? 'دليل مصوّر للآيفون والأندرويد، مع توضيح طريقة متابعة الإشعارات والردود.' : 'An illustrated iPhone and Android guide, including how to follow notifications and replies.'}</p>
          </Link>
          <ClientGuideLibrary initialTopic={initialTopic} />
        </main>
      </div>
    </ClientLayout>
  );
}
