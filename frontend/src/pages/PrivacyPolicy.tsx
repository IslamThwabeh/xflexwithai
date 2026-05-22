import { Link } from 'wouter';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import CinematicPublicLayout from '@/components/public/CinematicPublicLayout';

export default function PrivacyPolicy() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <CinematicPublicLayout>
      <div className="min-h-screen bg-[#050505] py-16 text-white md:py-20" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="container mx-auto max-w-5xl px-4 md:px-8">
          <div className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm md:p-8">
            <Link href="/">
              <Button variant="ghost" size="sm" className="mb-4 text-white/70 hover:bg-white/[0.06] hover:text-white">
                <ArrowLeft className={`h-4 w-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
                {isRtl ? 'الرئيسية' : 'Home'}
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#00C176]/24 bg-[#00C176]/10">
                <Lock className="h-7 w-7 text-[#00C176]" />
              </div>
              <div>
                <h1 className="text-3xl font-extrabold tracking-[-0.4px]">{isRtl ? 'سياسة الخصوصية' : 'Privacy Policy'}</h1>
                <p className="mt-2 text-sm text-white/42">
                  {isRtl ? 'آخر تحديث: يناير 2025' : 'Last updated: January 2025'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#F6F3EC] p-6 text-zinc-900 shadow-[0_20px_60px_rgba(0,0,0,0.24)] md:p-10">
            <div className="prose prose-zinc max-w-none space-y-6 text-sm leading-relaxed prose-headings:text-zinc-900 prose-p:text-zinc-700 prose-li:text-zinc-700 prose-strong:text-zinc-900">
              {isRtl ? (
            <>
              <h2 className="text-xl font-bold text-gray-900">1. المعلومات التي نجمعها</h2>
              <p>نقوم بجمع المعلومات التالية: الاسم، عنوان البريد الإلكتروني، رقم الهاتف (اختياري)، معلومات الدفع، وبيانات استخدام المنصة (مثل الدورات المشاهدة ونتائج الاختبارات).</p>

              <h2 className="text-xl font-bold text-gray-900">2. كيف نستخدم معلوماتك</h2>
              <p>نستخدم المعلومات المجمعة من أجل: توفير الخدمات التعليمية، معالجة المدفوعات، إرسال تحديثات حول الدورات والفعاليات، تحسين تجربة المستخدم، والتواصل معك بشأن حسابك.</p>

              <h2 className="text-xl font-bold text-gray-900">3. حماية البيانات</h2>
              <p>نستخدم تقنيات تشفير متقدمة لحماية بياناتك الشخصية. كلمات المرور يتم تخزينها بشكل مشفر (hashed) ولا يمكن الوصول إليها. نستخدم بروتوكول HTTPS لتأمين جميع الاتصالات.</p>

              <h2 className="text-xl font-bold text-gray-900">4. مشاركة البيانات</h2>
              <p>لا نبيع أو نشارك بياناتك الشخصية مع أطراف ثالثة إلا في الحالات التالية: عند الضرورة لمعالجة المدفوعات والتحقق من إيصالات الحوالات البنكية، للامتثال للمتطلبات القانونية، أو بموافقتك الصريحة.</p>

              <h2 className="text-xl font-bold text-gray-900">5. ملفات تعريف الارتباط (Cookies)</h2>
              <p>نستخدم ملفات تعريف الارتباط لتحسين تجربتك على المنصة، بما في ذلك تذكر تسجيل الدخول وتفضيلات اللغة. يمكنك التحكم في إعدادات ملفات تعريف الارتباط من خلال متصفحك.</p>

              <h2 className="text-xl font-bold text-gray-900">6. حقوقك</h2>
              <p>يحق لك: الوصول إلى بياناتك الشخصية، طلب تصحيح أو حذف بياناتك، إلغاء الاشتراك في الرسائل التسويقية، وطلب نسخة من بياناتك المخزنة.</p>

              <h2 className="text-xl font-bold text-gray-900">7. التعديلات</h2>
              <p>قد نقوم بتحديث سياسة الخصوصية هذه من وقت لآخر. سيتم نشر أي تغييرات على هذه الصفحة مع تحديث تاريخ "آخر تحديث".</p>

              <h2 className="text-xl font-bold text-gray-900">8. التواصل</h2>
              <p>إذا كانت لديك أي أسئلة حول سياسة الخصوصية، يُرجى التواصل معنا عبر: support@xflexacademy.com</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900">1. Information We Collect</h2>
              <p>We collect the following information: name, email address, phone number (optional), payment information, and platform usage data (such as courses viewed and quiz results).</p>

              <h2 className="text-xl font-bold text-gray-900">2. How We Use Your Information</h2>
              <p>We use the collected information to: provide educational services, process payments, send updates about courses and events, improve user experience, and communicate with you about your account.</p>

              <h2 className="text-xl font-bold text-gray-900">3. Data Protection</h2>
              <p>We use advanced encryption technologies to protect your personal data. Passwords are stored in hashed form and cannot be accessed. We use HTTPS protocol to secure all communications.</p>

              <h2 className="text-xl font-bold text-gray-900">4. Data Sharing</h2>
              <p>We do not sell or share your personal data with third parties except in the following cases: when necessary to process payments and verify bank transfer receipts, to comply with legal requirements, or with your explicit consent.</p>

              <h2 className="text-xl font-bold text-gray-900">5. Cookies</h2>
              <p>We use cookies to improve your experience on the platform, including remembering your login and language preferences. You can control cookie settings through your browser.</p>

              <h2 className="text-xl font-bold text-gray-900">6. Your Rights</h2>
              <p>You have the right to: access your personal data, request correction or deletion of your data, unsubscribe from marketing communications, and request a copy of your stored data.</p>

              <h2 className="text-xl font-bold text-gray-900">7. Modifications</h2>
              <p>We may update this privacy policy from time to time. Any changes will be posted on this page with an updated "Last updated" date.</p>

              <h2 className="text-xl font-bold text-gray-900">8. Contact</h2>
              <p>If you have any questions about this Privacy Policy, please contact us at: support@xflexacademy.com</p>
            </>
          )}
            </div>
          </div>
        </div>
      </div>
    </CinematicPublicLayout>
  );
}
