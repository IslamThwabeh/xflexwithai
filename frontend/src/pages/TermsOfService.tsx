import { Link } from 'wouter';
import { ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export default function TermsOfService() {
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
            <Shield className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-extrabold">{isRtl ? 'شروط الخدمة' : 'Terms of Service'}</h1>
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
              <h2 className="text-xl font-bold text-gray-900">1. مقدمة</h2>
              <p>مرحبًا بك في أكاديمية XFlex للتداول. باستخدام موقعنا وخدماتنا، فإنك توافق على الالتزام بهذه الشروط والأحكام. يُرجى قراءتها بعناية قبل استخدام المنصة.</p>

              <h2 className="text-xl font-bold text-gray-900">2. الخدمات المقدمة</h2>
              <p>تقدم أكاديمية XFlex دورات تعليمية في مجال التداول والفوركس، تشمل فيديوهات تعليمية، ملفات PDF، توصيات تداول، وأداة الذكاء الاصطناعي LexAI. الخدمات متاحة فقط للمستخدمين المسجلين والمشتركين.</p>

              <h2 className="text-xl font-bold text-gray-900">3. التسجيل والحساب</h2>
              <p>يتحمل المستخدم مسؤولية الحفاظ على سرية بيانات تسجيل الدخول. يجب أن تكون المعلومات المقدمة عند التسجيل صحيحة ومحدثة. يحق لنا تعليق أو إنهاء أي حساب ينتهك هذه الشروط.</p>

              <h2 className="text-xl font-bold text-gray-900">4. الاشتراكات والدفع</h2>
              <p>جميع الأسعار معروضة بالدولار الأمريكي وتشمل ضريبة القيمة المضافة (16%). يتم الدفع عبر PayPal أو التحويل البنكي. الاشتراكات المدفوعة غير قابلة للاسترداد إلا في حالات استثنائية وفقًا لتقدير الإدارة.</p>

              <h2 className="text-xl font-bold text-gray-900">5. حقوق الملكية الفكرية</h2>
              <p>جميع المحتويات (فيديوهات، نصوص، صور، ملفات PDF) هي ملكية حصرية لأكاديمية XFlex. يُحظر نسخ أو توزيع أو إعادة نشر أي محتوى بدون إذن كتابي مسبق.</p>

              <h2 className="text-xl font-bold text-gray-900">6. إخلاء المسؤولية</h2>
              <p>المحتوى التعليمي المقدم هو لأغراض تعليمية فقط ولا يُعتبر نصيحة مالية أو استثمارية. التداول في الأسواق المالية ينطوي على مخاطر عالية وقد يؤدي إلى خسارة رأس المال. الأكاديمية غير مسؤولة عن أي خسائر مالية ناتجة عن قرارات التداول.</p>

              <h2 className="text-xl font-bold text-gray-900">7. التعديلات</h2>
              <p>نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطار المستخدمين بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار على المنصة.</p>

              <h2 className="text-xl font-bold text-gray-900">8. التواصل</h2>
              <p>للاستفسارات حول شروط الخدمة، يُرجى التواصل معنا عبر: support@xflexacademy.com</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900">1. Introduction</h2>
              <p>Welcome to XFlex Trading Academy. By using our website and services, you agree to comply with these terms and conditions. Please read them carefully before using the platform.</p>

              <h2 className="text-xl font-bold text-gray-900">2. Services Provided</h2>
              <p>XFlex Academy provides educational courses in trading and forex, including video lessons, PDF materials, trading recommendations, and the LexAI artificial intelligence tool. Services are available only to registered and subscribed users.</p>

              <h2 className="text-xl font-bold text-gray-900">3. Registration and Account</h2>
              <p>Users are responsible for maintaining the confidentiality of their login credentials. Information provided during registration must be accurate and up-to-date. We reserve the right to suspend or terminate any account that violates these terms.</p>

              <h2 className="text-xl font-bold text-gray-900">4. Subscriptions and Payment</h2>
              <p>All prices are displayed in USD and include 16% VAT. Payment is accepted via PayPal or bank transfer. Paid subscriptions are non-refundable except in exceptional circumstances at the discretion of management.</p>

              <h2 className="text-xl font-bold text-gray-900">5. Intellectual Property</h2>
              <p>All content (videos, text, images, PDF files) is the exclusive property of XFlex Academy. Copying, distributing, or republishing any content without prior written permission is prohibited.</p>

              <h2 className="text-xl font-bold text-gray-900">6. Disclaimer</h2>
              <p>Educational content provided is for educational purposes only and does not constitute financial or investment advice. Trading in financial markets involves high risk and may result in loss of capital. The Academy is not responsible for any financial losses resulting from trading decisions.</p>

              <h2 className="text-xl font-bold text-gray-900">7. Modifications</h2>
              <p>We reserve the right to modify these terms at any time. Users will be notified of any material changes via email or platform notification.</p>

              <h2 className="text-xl font-bold text-gray-900">8. Contact</h2>
              <p>For inquiries about these Terms of Service, please contact us at: support@xflexacademy.com</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
