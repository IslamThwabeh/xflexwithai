export const HOME_SCREEN_GUIDE_PATH = '/guides/home-screen';
export const HOME_SCREEN_GUIDE_URL = `https://xflexacademy.com${HOME_SCREEN_GUIDE_PATH}`;

export const HOME_SCREEN_NOTICE_AR = 'إضافة الموقع للشاشة الرئيسية بتسهّل الدخول لحسابك، وما بتحوّله لتطبيق جوال مستقل. ما رح يظهر عدد الرسائل أو الإشعارات على أيقونة الاختصار. تابع ردود الفريق من بريدك الإلكتروني والإشعارات داخل حسابك بالموقع، وافتح محادثة الدعم للرد علينا.';
export const HOME_SCREEN_NOTICE_EN = 'Adding the website to your home screen makes your account easier to open; it does not turn it into a separate mobile app. The shortcut icon will not show unread message or notification counts. Check your email and notifications inside your website account, and reply in the support chat.';

export const STUDENT_WELCOME_AR = [
  'نورت أكاديمية XFlex! 👋',
  'بالبداية خلينا نحدد موعد لمكالمة على Zoom، نشرحلك فيها الخطة والخدمات وكيف تستفيد منها. ابعتلنا هون بالمحادثة اليوم والوقت اللي بناسبك، والفريق رح يتابع معك لتأكيد الموعد. إرسال الوقت المقترح ما بيعتبر حجز مؤكد.',
  '🕒 دوام فريق المتابعة: من الأحد للخميس، من الساعة ٣ للساعة ٧ مساءً بتوقيت الأردن. إذا بعتت خارج الدوام، رح نتابع معك خلال ساعات العمل.',
  '💬 متابعتك معنا بتكون هون فقط، داخل محادثة الدعم بموقع الأكاديمية. يرجى عدم إرسال أسئلتك أو نفس الرسائل على واتساب أو السوشال ميديا؛ ما رح تتم الإجابة أو المتابعة معك على القنوات الثانية.',
  `📱 لتسهيل الدخول لحسابك ومتابعة الدعم، أضف الموقع للشاشة الرئيسية لجوالك. دليل مصوّر للآيفون والأندرويد:\n${HOME_SCREEN_GUIDE_URL}`,
  `🔔 تنبيه مهم: ${HOME_SCREEN_NOTICE_AR}`,
].join('\n\n');

/** The team's published schedule, in Jordan local time. End time is exclusive. */
export function isSupportWorkingHours(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Amman', weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(now);
  const day = parts.find(part => part.type === 'weekday')?.value;
  const hour = Number(parts.find(part => part.type === 'hour')?.value);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'].includes(day ?? '') && hour >= 15 && hour < 19;
}
