import { useState } from 'react';
import { Bell, Mail, MoreVertical, Share, Smartphone, PlusSquare, ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { HOME_SCREEN_NOTICE_AR, HOME_SCREEN_NOTICE_EN } from '@shared/studentWelcome';

/** Browser menus cannot be captured by a web page. These are labelled illustrations. */
function PhoneIllustration({ android, step }: { android: boolean; step: number }) {
  return (
    <div dir="ltr" aria-hidden="true" className="mx-auto w-full max-w-[250px] overflow-hidden rounded-[1.8rem] border-[5px] border-slate-800 bg-slate-100 text-slate-800 shadow-sm">
      <div className="flex justify-between bg-white px-4 py-2 text-[10px] font-semibold"><span>9:41</span><span>● ▰</span></div>
      <div className="flex items-center gap-2 border-b bg-white px-3 py-3">
        <div className="min-w-0 flex-1 rounded-full bg-slate-100 p-2 text-[10px]">xflexacademy.com</div>
        {android && <MoreVertical className={`h-6 w-6 shrink-0 ${step === 1 ? 'rounded bg-amber-200 ring-4 ring-amber-200' : ''}`} />}
      </div>
      <div className="relative flex h-48 items-center justify-center bg-emerald-50">
        {step === 3 ? (
          <div className="text-center"><img src="/android-chrome-192x192.png" alt="" width={56} height={56} className="mx-auto rounded-xl bg-white shadow" /><p className="mt-2 text-xs">XFlex Academy</p></div>
        ) : step === 2 ? (
          <div className="w-[90%] rounded-xl bg-white p-4 shadow-lg">
            <p className="text-xs font-semibold">{android ? 'Create shortcut' : 'Add to Home Screen'}</p>
            <p className="my-4 border-b pb-2 text-xs">XFlex Academy</p>
            <div className="text-end"><span className="rounded-lg bg-amber-100 px-3 py-1 text-sm font-bold text-blue-700 ring-2 ring-amber-400">Add</span></div>
          </div>
        ) : step === 1 ? (
          <div className="w-[92%] space-y-3 rounded-xl bg-white p-4 text-xs shadow-lg">
            <p className="text-slate-400">{android ? 'Chrome menu' : 'Share'}</p>
            <div className="flex items-center gap-2 rounded-lg bg-amber-100 p-2 font-semibold ring-2 ring-amber-400">
              <PlusSquare className="h-4 w-4 shrink-0" /><span>{android ? 'Install and create shortcut' : 'Add to Home Screen'}</span>
            </div>
            {android && <p className="rounded bg-emerald-50 p-2 font-semibold">→ Create shortcut</p>}
          </div>
        ) : (
          <div className="text-center"><img src="/android-chrome-192x192.png" alt="" width={52} height={52} className="mx-auto rounded-xl" /><p className="mt-2 text-sm font-semibold">XFlex Academy</p><p className="mt-1 text-[10px] text-emerald-700">xflexacademy.com</p></div>
        )}
      </div>
      <div className="flex h-12 items-center justify-around bg-white text-slate-500"><ArrowLeft className="h-4 w-4" />{android ? <span className="text-xs">Chrome</span> : <Share className={`h-5 w-5 ${step === 0 ? 'rounded bg-amber-200 text-blue-700 ring-4 ring-amber-200' : ''}`} />}<ArrowRight className="h-4 w-4" /></div>
    </div>
  );
}

export default function HomeScreenGuide() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [device, setDevice] = useState<'iphone' | 'android'>('iphone');
  const android = device === 'android';
  const steps = android ? [
    { title: ar ? 'افتح الموقع في Chrome' : 'Open the site in Chrome', body: ar ? 'افتح Google Chrome على هاتف أندرويد وادخل على xflexacademy.com. إذا فتحت الرابط من واتساب أو إنستغرام، افتحه أولاً في Chrome.' : 'On your Android phone, open Google Chrome and visit xflexacademy.com. If you opened the link inside WhatsApp or Instagram, open it in Chrome first.' },
    { title: ar ? 'افتح قائمة الثلاث نقاط ⋮' : 'Open the three-dot menu ⋮', body: ar ? 'بجانب شريط العنوان، اضغط ⋮ ثم «التثبيت وإنشاء اختصار» (Install and create shortcut)، ثم «إنشاء اختصار» (Create shortcut). في بعض الإصدارات يظهر «إضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق» مباشرة.' : 'Next to the address bar, tap ⋮, then “Install and create shortcut” → “Create shortcut”. Some versions show “Add to Home screen” or “Install app” directly.' },
    { title: ar ? 'سمِّ الاختصار وأضفه' : 'Name and add the shortcut', body: ar ? 'اكتب XFlex Academy واضغط «إضافة» (Add). إذا ظهر «تثبيت» (Install) بدلاً منها، أكّد الخيار، ثم أكّد الإضافة للشاشة الرئيسية إذا طلب هاتفك ذلك.' : 'Enter XFlex Academy and tap “Add”. If “Install” appears instead, confirm it, then confirm adding it to the home screen if your phone asks.' },
    { title: ar ? 'افتح حسابك من الأيقونة' : 'Open your account from the icon', body: ar ? 'ستظهر أيقونة XFlex Academy على الشاشة الرئيسية. اضغط عليها للوصول للموقع وسجّل الدخول إذا طُلب منك.' : 'The XFlex Academy icon appears on your home screen. Tap it to open the website and sign in if asked.' },
  ] : [
    { title: ar ? 'افتح الموقع في Safari ثم المشاركة' : 'Open the site in Safari, then Share', body: ar ? 'افتح Safari على الآيفون وادخل على xflexacademy.com. اضغط زر المشاركة (مربع وسهم للأعلى). إذا لم يظهر، افتح قائمة الصفحة أو «المزيد» ثم «مشاركة».' : 'Open Safari on your iPhone and visit xflexacademy.com. Tap Share (a square with an upward arrow). If it is hidden, open the page menu or More, then Share.' },
    { title: ar ? 'اختر إضافة إلى الشاشة الرئيسية' : 'Choose Add to Home Screen', body: ar ? 'انزل في قائمة المشاركة واختر «إضافة إلى الشاشة الرئيسية» (Add to Home Screen). قد تحتاج لتمرير القائمة لأسفل للوصول إليها.' : 'Scroll down the share menu and choose “Add to Home Screen”. You may need to scroll further down the list to find it.' },
    { title: ar ? 'سمِّ الاختصار واضغط إضافة' : 'Name the shortcut and tap Add', body: ar ? 'اكتب XFlex Academy كاسم للأيقونة، ثم اضغط «إضافة» (Add) أعلى الشاشة.' : 'Enter XFlex Academy as the icon name, then tap “Add” at the top of the screen.' },
    { title: ar ? 'افتح حسابك من الأيقونة' : 'Open your account from the icon', body: ar ? 'ستظهر أيقونة XFlex Academy على الشاشة الرئيسية، مثل المثال. اضغط عليها للدخول للموقع وسجّل الدخول إذا طُلب منك.' : 'The XFlex Academy icon appears on your home screen, as illustrated. Tap it to open the website and sign in if asked.' },
  ];
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="space-y-6">
      <div className="rounded-2xl border border-emerald-200 bg-white p-5 sm:p-7">
        <Smartphone className="mb-3 h-8 w-8 text-emerald-700" />
        <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">{ar ? 'الأكاديمية على شاشتك الرئيسية' : 'Academy on your home screen'}</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{ar ? 'وصول أسرع لحسابك ومحادثة الدعم، بخطوات بسيطة من متصفح هاتفك.' : 'Reach your account and support chat faster with a few steps in your phone browser.'}</p>
      </div>
      <aside className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950" aria-label={ar ? 'تنبيه الإشعارات' : 'Notification notice'}>
        <h2 className="flex items-center gap-2 font-bold"><Bell className="h-5 w-5 shrink-0" />{ar ? 'اختصار للموقع — بدون عدّاد إشعارات على الأيقونة' : 'Website shortcut — no notification count on the icon'}</h2>
        <p className="mt-3 text-sm leading-7">{ar ? HOME_SCREEN_NOTICE_AR : HOME_SCREEN_NOTICE_EN}</p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold"><Link href="/notifications" className="rounded-lg border border-amber-300 bg-white px-3 py-2 underline">{ar ? 'الإشعارات داخل حسابك' : 'Your account notifications'}</Link><Link href="/support" className="rounded-lg border border-amber-300 bg-white px-3 py-2 underline">{ar ? 'افتح محادثة الدعم' : 'Open support chat'}</Link></div>
        <p className="mt-3 flex items-center gap-2 text-xs leading-6"><Mail className="h-4 w-4 shrink-0" />{ar ? 'تفقد أيضاً مجلد البريد غير المرغوب فيه إذا لم تجد رسائلنا.' : 'Also check your spam folder if you cannot find our emails.'}</p>
      </aside>
      <div role="group" aria-label={ar ? 'نوع الهاتف' : 'Phone type'} className="flex flex-wrap gap-3">
        {(['iphone', 'android'] as const).map(id => <button key={id} type="button" aria-pressed={device === id} onClick={() => setDevice(id)} className={`rounded-xl border px-5 py-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 ${device === id ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>{id === 'iphone' ? 'iPhone · Safari' : 'Android · Chrome'}</button>)}
      </div>
      <p className="text-xs leading-6 text-slate-500">{ar ? 'الصور التالية رسومات توضيحية للخطوات، وليست لقطات فعلية من هاتفك. شكل القوائم ومكان الأزرار قد يختلف حسب إصدار النظام والمتصفح ولغة الجهاز.' : 'The images below are instructional illustrations, not actual phone screenshots. Menus and button positions can vary by operating system, browser version and device language.'}</p>
      <ol className="grid gap-5 sm:grid-cols-2">
        {steps.map((step, index) => <li key={`${device}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-800">{index + 1}</span><h2 className="font-bold text-slate-950">{step.title}</h2></div>
          <p className="mb-5 text-sm leading-7 text-slate-600">{step.body}</p><PhoneIllustration android={android} step={index} />
        </li>)}
      </ol>
      <div className="rounded-2xl bg-emerald-50 p-5 text-sm leading-7 text-emerald-950"><p>{ar ? 'دوام فريق المتابعة: الأحد–الخميس، ٣–٧ مساءً بتوقيت الأردن. ابعت أسئلتك وموعدك المقترح لمكالمة Zoom داخل محادثة الدعم فقط.' : 'Support hours: Sunday–Thursday, 3–7 PM Jordan time. Send questions and your proposed Zoom call time in the website support chat only.'}</p><Link href="/support" className="mt-2 inline-block font-bold underline">{ar ? 'العودة لمحادثة الدعم' : 'Back to support chat'}</Link></div>
      <p className="text-xs leading-6 text-slate-500">{ar ? 'تعليمات المتصفح الرسمية: ' : 'Official browser instructions: '}<a href="https://support.apple.com/en-eg/guide/iphone/iphea86e5236/ios" target="_blank" rel="noreferrer" className="underline">Apple Safari</a>{' · '}<a href="https://support.google.com/chrome/answer/15085120?co=GENIE.Platform%3DAndroid&hl=en" target="_blank" rel="noreferrer" className="underline">Google Chrome</a></p>
    </div>
  );
}
