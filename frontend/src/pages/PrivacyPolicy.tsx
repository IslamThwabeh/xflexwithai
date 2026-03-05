import { Link } from 'wouter';
import { ArrowLeft, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export default function PrivacyPolicy() {
  const { language } = useLanguage();
  const isRtl = language === 'ar';

  return (
    <div className="min-h-screen bg-white" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white py-12">
        <div className="container mx-auto px-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white mb-4">
              <ArrowLeft className={`w-4 h-4 ${isRtl ? 'ms-2 rotate-180' : 'me-2'}`} />
              {isRtl ? 'الرئيسية' : 'Home'}
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Lock className="w-8 h-8 text-green-400" />
            <h1 className="text-3xl font-extrabold">{isRtl ? 'سياسة الخصوصية' : 'Privacy Policy'}</h1>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            {isRtl ? 'آخر تحديث: يناير 2025' : 'Last updated: January 2025'}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="prose prose-gray max-w-none leading-relaxed space-y-6 text-sm text-gray-700">
          {isRtl ? (
            <>
              <h2 className="text-xl font-bold text-gray-900">1. المعلومات التي نجمعها</h2>
              <p>نقوم بجمع المعلومات التالية: الاسم، عنوان البريد الإلكتروني، رقم الهاتف (اختياري)، معلومات الدفع، وبيانات استخدام المنصة (مثل الدورات المشاهدة ونتائج الاختبارات).</p>

              <h2 className="text-xl font-bold text-gray-900">2. كيف نستخدم معلوماتك</h2>
              <p>نستخدم المعلومات المجمعة من أجل: توفير الخدمات التعليمية، معالجة المدفوعات، إرسال تحديثات حول الدورات والفعاليات، تحسين تجربة المستخدم، والتواصل معك بشأن حسابك.</p>

              <h2 className="text-xl font-bold text-gray-900">3. حماية البيانات</h2>
              <p>نستخدم تقنيات تشفير متقدمة لحماية بياناتك الشخصية. كلمات المرور يتم تخزينها بشكل مشفر (hashed) ولا يمكن الوصول إليها. نستخدم بروتوكول HTTPS لتأمين جميع الاتصالات.</p>

              <h2 className="text-xl font-bold text-gray-900">4. مشاركة البيانات</h2>
              <p>لا نبيع أو نشارك بياناتك الشخصية مع أطراف ثالثة إلا في الحالات التالية: عند الضرورة لمعالجة المدفوعات (مثل PayPal)، للامتثال للمتطلبات القانونية، أو بموافقتك الصريحة.</p>

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
              <p>We do not sell or share your personal data with third parties except in the following cases: when necessary for payment processing (such as PayPal), to comply with legal requirements, or with your explicit consent.</p>

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
  );
}
