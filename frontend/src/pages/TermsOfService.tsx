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
            <h1 className="text-3xl font-extrabold">{isRtl ? 'الشروط والأحكام' : 'Terms & Conditions'}</h1>
          </div>
          <p className="text-sm text-gray-400 mt-2">
            {isRtl ? 'آخر تحديث: مارس 2026' : 'Last updated: March 2026'}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="prose prose-gray max-w-none leading-relaxed space-y-6 text-sm text-gray-700">
          {isRtl ? (
            <>
              <h2 className="text-xl font-bold text-gray-900">1. التعريفات</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li><strong>الأكاديمية:</strong> XFlex Academy وتشمل جميع المنصات التابعة لها (موقع إلكتروني، تليجرام، واتساب، منصات تعليمية، أدوات ذكاء اصطناعي مثل Lex AI).</li>
                <li><strong>المستخدم / المشترك:</strong> أي شخص يقوم بالتسجيل أو الاشتراك أو استخدام أي من خدمات الأكاديمية.</li>
                <li><strong>المحتوى:</strong> يشمل المواد التعليمية، الفيديوهات، التوصيات، التحليلات، الأدوات، الرسائل، والنشرات.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">2. طبيعة الخدمات المقدمة</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>جميع الخدمات المقدمة هي تعليمية وتثقيفية فقط.</li>
                <li>الأكاديمية لا تقدم استشارات استثمارية شخصية ولا إدارة محافظ مالية.</li>
                <li>أي توصيات أو تحليلات هي آراء تعليمية عامة وليست توجيهًا مباشرًا للشراء أو البيع.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">3. إخلاء المسؤولية عن التداول والخسائر</h2>
              <p>التداول في الأسواق المالية ينطوي على مخاطر عالية وقد يؤدي إلى خسارة جزئية أو كاملة لرأس المال.</p>
              <p className="font-semibold">المستخدم يقرّ ويوافق على أن:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>جميع قرارات التداول التي يتخذها هي مسؤوليته الشخصية بالكامل.</li>
                <li>الأكاديمية، فريقها، مدربيها، أو أدواتها (بما فيها Lex AI) غير مسؤولة عن أي خسائر مالية.</li>
              </ul>
              <p className="font-semibold">لا تتحمل الأكاديمية أي مسؤولية عن:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>خسائر ناتجة عن سوء إدارة رأس المال.</li>
                <li>استخدام خاطئ للتوصيات.</li>
                <li>التداول أثناء الأخبار أو ظروف السوق غير الطبيعية.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">4. أداة Lex AI (الذكاء الاصطناعي)</h2>
              <p>Lex AI هي أداة تحليل مساعدة وليست نظام تداول آلي أو ضمان ربح.</p>
              <p className="font-semibold">النتائج الصادرة عن Lex AI:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>تعتمد على بيانات تاريخية وخوارزميات تحليل.</li>
                <li>لا تضمن الدقة الكاملة أو النجاح.</li>
              </ul>
              <p>استخدام Lex AI يتم على مسؤولية المستخدم وحده.</p>

              <h2 className="text-xl font-bold text-gray-900">5. عدم ضمان الأرباح</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>الأكاديمية لا تضمن أي أرباح.</li>
                <li>أي أرقام، أمثلة، أو نتائج سابقة تُعرض لأغراض تعليمية فقط ولا تعني تحقيق نفس النتائج مستقبلًا.</li>
                <li>الأداء السابق لا يعكس بالضرورة الأداء المستقبلي.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">6. الالتزام الشخصي للمستخدم</h2>
              <p className="font-semibold">المستخدم مسؤول عن:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>التأكد من ملاءمة التداول لوضعه المالي.</li>
                <li>عدم التداول بأموال لا يستطيع تحمل خسارتها.</li>
                <li>الالتزام بإدارة المخاطر الموصى بها.</li>
              </ul>
              <p>يمنع استخدام خدمات الأكاديمية لأي أغراض غير قانونية.</p>

              <h2 className="text-xl font-bold text-gray-900">7. الملكية الفكرية</h2>
              <p>جميع المحتويات المقدمة هي ملكية فكرية حصرية لأكاديمية XFlex.</p>
              <p className="font-semibold">يُمنع:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>نسخ المحتوى.</li>
                <li>إعادة نشره.</li>
                <li>بيعه أو مشاركته مع أطراف ثالثة.</li>
              </ul>
              <p>أي مخالفة تعرّض صاحبها للمساءلة القانونية.</p>

              <h2 className="text-xl font-bold text-gray-900">8. سياسة الاشتراكات والدفع</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>جميع الاشتراكات غير قابلة للاسترداد بعد التفعيل.</li>
                <li>المستخدم مسؤول عن اختيار الباقة المناسبة له قبل الدفع.</li>
                <li>أي توقف مؤقت للخدمات بسبب صيانة تقنية، تحديثات، أو ظروف قاهرة لا يُعد سببًا للمطالبة باسترجاع مالي.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">9. إيقاف أو إنهاء الحساب</h2>
              <p className="font-semibold">يحق للأكاديمية تعليق أو إلغاء اشتراك أي مستخدم دون إشعار مسبق في حال:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>إساءة استخدام المحتوى.</li>
                <li>نشر معلومات مضللة.</li>
                <li>الإساءة للأكاديمية أو فريقها.</li>
              </ul>
              <p>لا يترتب على الإيقاف أي التزام مالي تجاه المستخدم.</p>

              <h2 className="text-xl font-bold text-gray-900">10. حدود المسؤولية القانونية</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>أقصى مسؤولية محتملة على الأكاديمية (إن وجدت) لا تتجاوز قيمة الاشتراك المدفوع فقط.</li>
                <li>الأكاديمية غير مسؤولة عن أعطال الإنترنت، مشاكل المنصات الخارجية (وسيط – منصة تداول – بنوك – محافظ رقمية)، أو قرارات أطراف ثالثة.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">11. السرية وحماية البيانات</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>تلتزم الأكاديمية بالحفاظ على سرية بيانات المستخدمين.</li>
                <li>لا يتم مشاركة البيانات مع أي طرف ثالث إلا إذا طُلب قانونيًا أو بموافقة المستخدم.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">12. التعديلات على الشروط</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>تحتفظ الأكاديمية بحق تعديل الشروط والأحكام في أي وقت.</li>
                <li>استمرار استخدام الخدمات بعد التعديل يعني موافقة ضمنية على الشروط الجديدة.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">13. القانون الناظم</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>تخضع هذه الشروط لأحكام القوانين المعمول بها في فلسطين.</li>
                <li>أي نزاع يتم حله وديًا، وفي حال تعذّر ذلك يتم اللجوء للجهات القضائية المختصة.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">14. الموافقة</h2>
              <p className="font-semibold">باستخدامك لأي من خدمات XFlex Academy، فإنك:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>تقرّ بقراءة الشروط.</li>
                <li>تفهمها بالكامل.</li>
                <li>توافق عليها دون أي تحفظ.</li>
              </ul>

              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-gray-900">📋 سياسة الاشتراك والاسترجاع</p>
                <p>للاطلاع على سياسة الاشتراك والاسترجاع الكاملة، يرجى زيارة:</p>
                <Link href="/refund-policy">
                  <span className="text-blue-600 hover:underline cursor-pointer font-medium">سياسة الاسترجاع ←</span>
                </Link>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900">1. Definitions</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li><strong>The Academy:</strong> XFlex Academy, including all affiliated platforms (website, Telegram, WhatsApp, educational platforms, AI tools such as Lex AI).</li>
                <li><strong>User / Subscriber:</strong> Any person who registers, subscribes, or uses any of the Academy's services.</li>
                <li><strong>Content:</strong> Includes educational materials, videos, recommendations, analyses, tools, messages, and newsletters.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">2. Nature of Services Provided</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>All services provided are educational and informational only.</li>
                <li>The Academy does not provide personal investment advice or portfolio management.</li>
                <li>Any recommendations or analyses are general educational opinions and not direct instructions to buy or sell.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">3. Trading & Loss Disclaimer</h2>
              <p>Trading in financial markets involves high risk and may result in partial or total loss of capital.</p>
              <p className="font-semibold">The user acknowledges and agrees that:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>All trading decisions made are entirely their personal responsibility.</li>
                <li>The Academy, its team, trainers, or tools (including Lex AI) are not responsible for any financial losses.</li>
              </ul>
              <p className="font-semibold">The Academy bears no responsibility for:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>Losses resulting from poor capital management.</li>
                <li>Incorrect use of recommendations.</li>
                <li>Trading during news events or abnormal market conditions.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">4. Lex AI (Artificial Intelligence Tool)</h2>
              <p>Lex AI is an assistive analysis tool and not an automated trading system or profit guarantee.</p>
              <p className="font-semibold">Results generated by Lex AI:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>Are based on historical data and analytical algorithms.</li>
                <li>Do not guarantee complete accuracy or success.</li>
              </ul>
              <p>Use of Lex AI is solely at the user's own risk.</p>

              <h2 className="text-xl font-bold text-gray-900">5. No Profit Guarantee</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>The Academy does not guarantee any profits.</li>
                <li>Any figures, examples, or past results are displayed for educational purposes only and do not imply the same results will be achieved in the future.</li>
                <li>Past performance does not necessarily reflect future performance.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">6. User's Personal Commitment</h2>
              <p className="font-semibold">The user is responsible for:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>Ensuring trading is suitable for their financial situation.</li>
                <li>Not trading with funds they cannot afford to lose.</li>
                <li>Adhering to the recommended risk management practices.</li>
              </ul>
              <p>Using the Academy's services for any illegal purposes is prohibited.</p>

              <h2 className="text-xl font-bold text-gray-900">7. Intellectual Property</h2>
              <p>All content provided is the exclusive intellectual property of XFlex Academy.</p>
              <p className="font-semibold">It is prohibited to:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>Copy the content.</li>
                <li>Republish it.</li>
                <li>Sell or share it with third parties.</li>
              </ul>
              <p>Any violation exposes the offender to legal accountability.</p>

              <h2 className="text-xl font-bold text-gray-900">8. Subscription & Payment Policy</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>All subscriptions are non-refundable after activation.</li>
                <li>The user is responsible for choosing the appropriate plan before payment.</li>
                <li>Any temporary service interruption due to technical maintenance, updates, or force majeure does not constitute grounds for a refund claim.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">9. Account Suspension or Termination</h2>
              <p className="font-semibold">The Academy reserves the right to suspend or cancel any user's subscription without prior notice in the event of:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>Misuse of content.</li>
                <li>Spreading misleading information.</li>
                <li>Abuse towards the Academy or its team.</li>
              </ul>
              <p>No financial obligation towards the user arises from such suspension.</p>

              <h2 className="text-xl font-bold text-gray-900">10. Limitation of Legal Liability</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>The maximum potential liability of the Academy (if any) shall not exceed the value of the subscription paid.</li>
                <li>The Academy is not responsible for internet outages, issues with external platforms (broker, trading platform, banks, digital wallets), or decisions of third parties.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">11. Confidentiality & Data Protection</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>The Academy is committed to maintaining the confidentiality of user data.</li>
                <li>Data is not shared with any third party unless legally required or with the user's consent.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">12. Amendments to Terms</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>The Academy reserves the right to modify the terms and conditions at any time.</li>
                <li>Continued use of services after modification constitutes implicit acceptance of the new terms.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">13. Governing Law</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>These terms are governed by the applicable laws of Palestine.</li>
                <li>Any dispute shall be resolved amicably; failing that, it shall be referred to the competent judicial authorities.</li>
              </ul>

              <h2 className="text-xl font-bold text-gray-900">14. Acceptance</h2>
              <p className="font-semibold">By using any of XFlex Academy's services, you:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>Acknowledge that you have read these terms.</li>
                <li>Fully understand them.</li>
                <li>Agree to them without reservation.</li>
              </ul>

              <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-gray-900">📋 Subscription & Refund Policy</p>
                <p>To view the full subscription and refund policy, please visit:</p>
                <Link href="/refund-policy">
                  <span className="text-blue-600 hover:underline cursor-pointer font-medium">Refund Policy →</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
