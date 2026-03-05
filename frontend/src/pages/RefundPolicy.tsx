import { Link } from 'wouter';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

export default function RefundPolicy() {
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
            <RotateCcw className="w-8 h-8 text-amber-400" />
            <h1 className="text-3xl font-extrabold">{isRtl ? 'سياسة الاشتراك والاسترجاع' : 'Subscription & Refund Policy'}</h1>
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
              {/* 1 - Scope */}
              <h2 className="text-xl font-bold text-gray-900">أولًا: نطاق السياسة</h2>
              <p>تسري هذه السياسة على جميع الاشتراكات والخدمات التعليمية المقدمة من أكاديمية XFlex، سواء كانت:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>اشتراكات شهرية أو دورية</li>
                <li>باقات تعليمية</li>
                <li>قنوات توصيات</li>
                <li>أدوات تحليل أو ذكاء اصطناعي (مثل Lex AI)</li>
              </ul>
              <p>تُعد هذه السياسة جزءًا لا يتجزأ من الشروط والأحكام العامة للأكاديمية.</p>

              {/* 2 - Subscription Policy */}
              <h2 className="text-xl font-bold text-gray-900">ثانيًا: سياسة الاشتراك</h2>
              <ol className="list-decimal ps-6 space-y-2">
                <li>يتم الاشتراك في خدمات الأكاديمية بناءً على رغبة المستخدم الكاملة وبعد اطلاعه على وصف الخدمة ومحتواها.</li>
                <li>يتحمّل المستخدم مسؤولية اختيار الباقة المناسبة له قبل إتمام عملية الدفع.</li>
                <li>يُعد الاشتراك مفعلًا رسميًا فور:
                  <ul className="list-disc ps-6 mt-1">
                    <li>إتمام عملية الدفع بنجاح، و/أو</li>
                    <li>منح المستخدم حق الوصول إلى المحتوى أو القنوات أو الأدوات.</li>
                  </ul>
                </li>
                <li>جميع الاشتراكات شخصية وغير قابلة للتحويل إلى طرف آخر.</li>
                <li>يمنع مشاركة بيانات الدخول أو المحتوى مع أي شخص آخر.</li>
              </ol>

              {/* 3 - No Refund */}
              <h2 className="text-xl font-bold text-gray-900">ثالثًا: سياسة الاسترجاع (عدم الاسترداد)</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-semibold text-red-800 mb-2">⚠️ جميع الاشتراكات غير قابلة للاسترجاع بعد التفعيل، وذلك وفقًا لما يلي:</p>
                <ul className="list-disc ps-6 space-y-1">
                  <li>طبيعة الخدمات الرقمية والتعليمية.</li>
                  <li>إتاحة الوصول الفوري للمحتوى.</li>
                </ul>
              </div>
              <p className="font-semibold mt-3">يقرّ المستخدم علمه وموافقته على أن:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>الأكاديمية تقدم محتوى رقميًا غير ملموس.</li>
                <li>بدء استخدام الخدمة أو الوصول إليها يسقط حق المطالبة بالاسترجاع.</li>
              </ul>
              <p className="font-semibold mt-3">لا يتم استرجاع أي مبالغ في الحالات التالية:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>عدم تحقيق أرباح أو تكبد خسائر.</li>
                <li>عدم التزام المستخدم بالخطة أو التعليمات.</li>
                <li>تغيير المستخدم لرأيه بعد الاشتراك.</li>
                <li>عدم التفرغ أو ضعف المتابعة.</li>
                <li>سوء استخدام التوصيات أو الأدوات.</li>
                <li>عدم توافق الخدمة مع توقعات المستخدم الشخصية.</li>
              </ul>

              {/* 4 - Exceptions */}
              <h2 className="text-xl font-bold text-gray-900">رابعًا: الحالات الاستثنائية</h2>
              <p>يجوز للأكاديمية، وفق تقديرها المطلق فقط، النظر في حالات استثنائية مثل:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>خلل تقني جسيم يمنع الوصول للخدمة بشكل كامل ولم يتم إصلاحه خلال مدة معقولة.</li>
              </ul>
              <p className="mt-2">في حال الموافقة على الاستثناء:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>يكون القرار نهائيًا وغير قابل للطعن.</li>
                <li>يتم الاسترجاع – إن وُجد – بنفس وسيلة الدفع المستخدمة.</li>
                <li>لا يُعد الاستثناء حقًا مكتسبًا ولا يُقاس عليه.</li>
              </ul>

              {/* 5 - Termination */}
              <h2 className="text-xl font-bold text-gray-900">خامسًا: إيقاف أو إنهاء الاشتراك</h2>
              <p className="font-semibold">يحق للأكاديمية إيقاف أو إنهاء اشتراك المستخدم دون استرجاع أي مبالغ في حال:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>مخالفة الشروط والأحكام.</li>
                <li>إساءة استخدام المحتوى.</li>
                <li>مشاركة المحتوى أو التوصيات مع أطراف أخرى.</li>
                <li>الإساءة للأكاديمية أو فريقها أو سمعتها.</li>
              </ul>
              <p>لا يترتب على الإيقاف أي التزام مالي على الأكاديمية.</p>

              {/* 6 - Service Changes */}
              <h2 className="text-xl font-bold text-gray-900">سادسًا: توقف الخدمة أو التعديلات</h2>
              <p>قد تتوقف بعض الخدمات مؤقتًا بسبب:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>الصيانة.</li>
                <li>التحديثات.</li>
                <li>ظروف قاهرة خارجة عن الإرادة.</li>
              </ul>
              <p>لا يترتب على ذلك أي حق في الاسترجاع أو التعويض.</p>
              <p>تحتفظ الأكاديمية بحق تعديل محتوى الخدمات وتحديث آلية تقديمها دون أن يؤثر ذلك على صلاحية الاشتراك.</p>

              {/* 7 - Financial Liability */}
              <h2 className="text-xl font-bold text-gray-900">سابعًا: حدود المسؤولية المالية</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>أقصى مسؤولية مالية محتملة على الأكاديمية – إن وُجدت – لا تتجاوز قيمة الاشتراك المدفوع فقط.</li>
                <li>لا تتحمل الأكاديمية أي مسؤولية عن خسائر التداول، قرارات المستخدم، أو أعطال منصات أو وسطاء خارجيين.</li>
              </ul>

              {/* 8 - Acknowledgment */}
              <h2 className="text-xl font-bold text-gray-900">ثامنًا: الإقرار والموافقة</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-semibold">بإتمام عملية الاشتراك، يقرّ المستخدم بما يلي:</p>
                <ul className="list-disc ps-6 space-y-1 mt-2">
                  <li>أنه قرأ سياسة الاشتراك والاسترجاع كاملة.</li>
                  <li>أنه فهم مضمونها وآثارها القانونية.</li>
                  <li>أنه وافق عليها دون أي تحفظ.</li>
                </ul>
              </div>

              {/* 9 - Governing Law */}
              <h2 className="text-xl font-bold text-gray-900">تاسعًا: القانون الناظم</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>تخضع هذه السياسة وتُفسّر وفقًا لأحكام القوانين المعمول بها في دولة فلسطين.</li>
                <li>أي نزاع يتم حله وديًا، وفي حال تعذّر ذلك تكون المحاكم الفلسطينية المختصة هي المرجع القانوني.</li>
              </ul>

              <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
                <p className="text-gray-600">للاطلاع على الشروط والأحكام العامة:</p>
                <Link href="/terms">
                  <span className="text-blue-600 hover:underline cursor-pointer font-medium">الشروط والأحكام ←</span>
                </Link>
              </div>
            </>
          ) : (
            <>
              {/* 1 - Scope */}
              <h2 className="text-xl font-bold text-gray-900">1. Scope of Policy</h2>
              <p>This policy applies to all subscriptions and educational services provided by XFlex Academy, including:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>Monthly or periodic subscriptions</li>
                <li>Educational packages</li>
                <li>Recommendation channels</li>
                <li>Analysis or AI tools (such as Lex AI)</li>
              </ul>
              <p>This policy is an integral part of the Academy's general Terms and Conditions.</p>

              {/* 2 - Subscription */}
              <h2 className="text-xl font-bold text-gray-900">2. Subscription Policy</h2>
              <ol className="list-decimal ps-6 space-y-2">
                <li>Subscription to Academy services is based on the user's full will and after reviewing the service description and content.</li>
                <li>The user is responsible for choosing the appropriate plan before completing payment.</li>
                <li>A subscription is considered officially activated upon:
                  <ul className="list-disc ps-6 mt-1">
                    <li>Successful completion of payment, and/or</li>
                    <li>Granting the user access to content, channels, or tools.</li>
                  </ul>
                </li>
                <li>All subscriptions are personal and non-transferable to another party.</li>
                <li>Sharing login credentials or content with any other person is prohibited.</li>
              </ol>

              {/* 3 - No Refund */}
              <h2 className="text-xl font-bold text-gray-900">3. Refund Policy (No Refunds)</h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="font-semibold text-red-800 mb-2">⚠️ All subscriptions are non-refundable after activation, based on:</p>
                <ul className="list-disc ps-6 space-y-1">
                  <li>The nature of digital and educational services.</li>
                  <li>Immediate access to content upon activation.</li>
                </ul>
              </div>
              <p className="font-semibold mt-3">The user acknowledges and agrees that:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>The Academy provides intangible digital content.</li>
                <li>Beginning to use or access the service waives the right to claim a refund.</li>
              </ul>
              <p className="font-semibold mt-3">No refunds are issued in the following cases:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>Failure to achieve profits or incurring losses.</li>
                <li>User's failure to follow the plan or instructions.</li>
                <li>User changing their mind after subscribing.</li>
                <li>Lack of time or poor follow-through.</li>
                <li>Misuse of recommendations or tools.</li>
                <li>Service not meeting the user's personal expectations.</li>
              </ul>

              {/* 4 - Exceptions */}
              <h2 className="text-xl font-bold text-gray-900">4. Exceptional Cases</h2>
              <p>The Academy may, at its sole discretion, consider exceptional cases such as:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>A severe technical malfunction that completely prevents access to the service and was not resolved within a reasonable timeframe.</li>
              </ul>
              <p className="mt-2">If an exception is approved:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>The decision is final and not subject to appeal.</li>
                <li>Refunds, if any, are made through the same payment method used.</li>
                <li>The exception does not establish a precedent or acquired right.</li>
              </ul>

              {/* 5 - Termination */}
              <h2 className="text-xl font-bold text-gray-900">5. Subscription Suspension or Termination</h2>
              <p className="font-semibold">The Academy reserves the right to suspend or terminate a user's subscription without refund in the event of:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>Violation of terms and conditions.</li>
                <li>Misuse of content.</li>
                <li>Sharing content or recommendations with other parties.</li>
                <li>Abuse towards the Academy, its team, or its reputation.</li>
              </ul>
              <p>No financial obligation on the Academy arises from such termination.</p>

              {/* 6 - Service Changes */}
              <h2 className="text-xl font-bold text-gray-900">6. Service Interruptions & Modifications</h2>
              <p>Some services may be temporarily interrupted due to:</p>
              <ul className="list-disc ps-6 space-y-1">
                <li>Maintenance.</li>
                <li>Updates.</li>
                <li>Force majeure circumstances.</li>
              </ul>
              <p>This does not entitle the user to any refund or compensation.</p>
              <p>The Academy reserves the right to modify service content and update delivery mechanisms without affecting subscription validity.</p>

              {/* 7 - Financial Liability */}
              <h2 className="text-xl font-bold text-gray-900">7. Financial Liability Limits</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>The maximum financial liability of the Academy, if any, shall not exceed the value of the subscription paid.</li>
                <li>The Academy bears no responsibility for trading losses, user decisions, or failures of external platforms or brokers.</li>
              </ul>

              {/* 8 - Acknowledgment */}
              <h2 className="text-xl font-bold text-gray-900">8. Acknowledgment & Consent</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="font-semibold">By completing the subscription process, the user acknowledges:</p>
                <ul className="list-disc ps-6 space-y-1 mt-2">
                  <li>Having read the subscription and refund policy in full.</li>
                  <li>Understanding its content and legal implications.</li>
                  <li>Agreeing to it without any reservation.</li>
                </ul>
              </div>

              {/* 9 - Governing Law */}
              <h2 className="text-xl font-bold text-gray-900">9. Governing Law</h2>
              <ul className="list-disc ps-6 space-y-1">
                <li>This policy is governed and interpreted in accordance with the applicable laws of Palestine.</li>
                <li>Any dispute shall be resolved amicably; failing that, the competent Palestinian courts shall be the legal reference.</li>
              </ul>

              <div className="mt-8 p-4 bg-gray-50 rounded-lg border">
                <p className="text-gray-600">To view the general Terms and Conditions:</p>
                <Link href="/terms">
                  <span className="text-blue-600 hover:underline cursor-pointer font-medium">Terms & Conditions →</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
