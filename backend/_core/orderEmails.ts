import { sendEmail } from "./email";
import { ENV } from "./env";
import { logger } from "./logger";

const BRAND = "XFlex Trading Academy";

function wrapHtml(body: string) {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
  <div style="background:linear-gradient(135deg,#059669,#0d9488);padding:28px 24px;text-align:center;">
    <h1 style="margin:0;color:#fff;font-size:22px;">${BRAND}</h1>
  </div>
  <div style="padding:28px 24px;">
    ${body}
  </div>
  <div style="padding:16px 24px;background:#f9fafb;text-align:center;font-size:12px;color:#9ca3af;">
    &copy; ${new Date().getFullYear()} ${BRAND}. All rights reserved.
  </div>
</div>
</body></html>`;
}

/** Send a branded HTML email with plain-text fallback */
function sendBrandedEmail(to: string, subject: string, bodyHtml: string) {
  const html = wrapHtml(bodyHtml);
  const text = html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s{2,}/g, '\n').trim();
  return sendEmail({ to, subject, text, html });
}

/** Sent when a new order is created */
export async function sendOrderConfirmationEmail(to: string, data: {
  orderId: number;
  packageName: string;
  totalUsd: number;
  paymentMethod: string;
}) {
  const paymentLabel = data.paymentMethod === 'paypal' ? 'PayPal' : 'تحويل بنكي / Bank Transfer';
  const subject = `[${BRAND}] تأكيد الطلب #${data.orderId} | Order Confirmation`;
  const body = `
    <h2 style="margin:0 0 12px;color:#111;">شكراً لطلبك! Thank you for your order!</h2>
    <p style="color:#555;line-height:1.7;">
      تم استلام طلبك بنجاح. تفاصيل الطلب:<br/>
      Your order has been received. Order details:
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#888;">رقم الطلب / Order #</td><td style="padding:8px 0;font-weight:bold;text-align:left;">${data.orderId}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">الباقة / Package</td><td style="padding:8px 0;font-weight:bold;text-align:left;">${data.packageName}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">المبلغ / Total</td><td style="padding:8px 0;font-weight:bold;text-align:left;">$${data.totalUsd.toFixed(2)}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">طريقة الدفع / Payment</td><td style="padding:8px 0;text-align:left;">${paymentLabel}</td></tr>
    </table>
    ${data.paymentMethod === 'bank_transfer' ? `
    <div style="background:#fef9c3;border:1px solid #fde68a;border-radius:8px;padding:14px;margin:16px 0;">
      <p style="margin:0;color:#854d0e;font-size:14px;">
        ⏳ يرجى تحويل المبلغ ورفع إثبات الدفع من صفحة الطلب.<br/>
        Please transfer the amount and upload payment proof from the order page.
      </p>
    </div>` : ''}
    <div style="text-align:center;margin-top:24px;">
      <a href="https://xflexacademy.com/orders/${data.orderId}" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        عرض الطلب / View Order
      </a>
    </div>`;
  
  try {
    await sendBrandedEmail(to, subject, body);
  } catch (e) {
    logger.warn("[ORDER_EMAIL] Failed to send confirmation", { orderId: data.orderId, error: String(e) });
  }
}

/** Sent when admin marks order as completed / paid */
export async function sendPaymentReceivedEmail(to: string, data: {
  orderId: number;
  packageName: string;
}) {
  const subject = `[${BRAND}] ✅ تم تفعيل الاشتراك | Subscription Activated - Order #${data.orderId}`;
  const body = `
    <h2 style="margin:0 0 12px;color:#059669;">🎉 مبروك! تم تفعيل اشتراكك</h2>
    <h3 style="margin:0 0 12px;color:#059669;">Congratulations! Your subscription is now active</h3>
    <p style="color:#555;line-height:1.7;">
      تم تأكيد دفعك وتفعيل باقة <strong>${data.packageName}</strong> بنجاح.<br/>
      Your payment for <strong>${data.packageName}</strong> has been confirmed and your subscription is now active.
    </p>
    <p style="color:#555;line-height:1.7;">
      يمكنك الآن الوصول لجميع محتويات الباقة.<br/>
      You can now access all package content.
    </p>
    <div style="text-align:center;margin-top:24px;">
      <a href="https://xflexacademy.com/courses" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        ابدأ التعلم / Start Learning
      </a>
    </div>`;
  
  try {
    await sendBrandedEmail(to, subject, body);
  } catch (e) {
    logger.warn("[ORDER_EMAIL] Failed to send payment received", { orderId: data.orderId, error: String(e) });
  }
}

/** Notify admin of new order placed */
export async function sendAdminNewOrderNotification(data: {
  orderId: number;
  userEmail: string;
  packageName: string;
  totalUsd: number;
  paymentMethod: string;
}) {
  const adminEmail = ENV.emailFrom || 'admin@xflexacademy.com';
  const subject = `[ADMIN] طلب جديد #${data.orderId} - ${data.userEmail}`;
  const body = `
    <h2 style="margin:0 0 12px;color:#111;">طلب جديد! New Order</h2>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#888;">Order #</td><td style="padding:8px 0;font-weight:bold;">${data.orderId}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">User</td><td style="padding:8px 0;">${data.userEmail}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Package</td><td style="padding:8px 0;font-weight:bold;">${data.packageName}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Total</td><td style="padding:8px 0;font-weight:bold;">$${data.totalUsd.toFixed(2)}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Payment</td><td style="padding:8px 0;">${data.paymentMethod}</td></tr>
    </table>
    <div style="text-align:center;margin-top:24px;">
      <a href="https://xflexacademy.com/admin/orders" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        إدارة الطلبات / Manage Orders
      </a>
    </div>`;
  
  try {
    await sendBrandedEmail(adminEmail, subject, body);
  } catch (e) {
    logger.warn("[ORDER_EMAIL] Failed to notify admin", { orderId: data.orderId, error: String(e) });
  }
}

/** Notify user that their timed freeze has expired and subscriptions are now active again */
export async function sendFreezeExpiredEmail(to: string, name?: string | null) {
  const subject = `تم رفع تجميد اشتراكاتك / Your subscriptions have been unfrozen`;
  const firstName = name?.split(' ')[0] || '';
  const body = `
    <h2 style="margin:0 0 12px;color:#111;">مرحباً ${firstName} 👋</h2>
    <p style="color:#374151;line-height:1.7;">
      نود إعلامك بأن فترة التجميد المؤقت لاشتراكاتك قد انتهت وتم استئنافها تلقائياً.
    </p>
    <p style="color:#374151;line-height:1.7;">
      Hi ${firstName}, your temporary freeze period has ended and your subscriptions have been automatically resumed.
      You now have full access again.
    </p>
    <div style="text-align:center;margin-top:28px;">
      <a href="https://xflexacademy.com/dashboard" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        الدخول إلى حسابي / Go to Dashboard
      </a>
    </div>`;
  try {
    await sendBrandedEmail(to, subject, body);
  } catch (e) {
    logger.warn("[ORDER_EMAIL] Failed to send freeze-expired notification", { to, error: String(e) });
  }
}

export async function sendExpiryAlertEmail(to: string, name: string | null, daysLeft: number, packageName: string) {
  const firstName = name?.split(' ')[0] || '';
  const subject = daysLeft === 0
    ? `اشتراكك انتهى اليوم / Your subscription has expired today`
    : `تنبيه: اشتراكك ينتهي خلال ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'} / ${daysLeft} day${daysLeft === 1 ? '' : 's'} until expiry`;

  const urgencyColor = daysLeft <= 1 ? '#dc2626' : daysLeft <= 3 ? '#f59e0b' : '#059669';
  const body = `
    <h2 style="margin:0 0 12px;color:#111;">مرحباً ${firstName} 👋</h2>
    <div style="background:${urgencyColor}10;border-left:4px solid ${urgencyColor};padding:16px;border-radius:8px;margin:16px 0;">
      <p style="color:${urgencyColor};font-weight:bold;margin:0;">
        ${daysLeft === 0
          ? '⚠️ انتهى اشتراكك اليوم / Your subscription has expired today'
          : `⏰ متبقي ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'} على انتهاء اشتراكك / ${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
      </p>
      <p style="color:#374151;margin:8px 0 0;">
        ${packageName}
      </p>
    </div>
    <p style="color:#374151;line-height:1.7;">
      للاستمرار في الوصول إلى LexAI والتوصيات الحية، يرجى تجديد اشتراكك عن طريق تفعيل مفتاح تجديد جديد.
    </p>
    <p style="color:#374151;line-height:1.7;">
      To continue accessing LexAI and live recommendations, please renew your subscription by activating a new renewal key.
    </p>
    <div style="text-align:center;margin-top:28px;">
      <a href="https://xflexacademy.com/activate-key" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        تجديد الاشتراك / Renew Subscription
      </a>
    </div>`;
  try {
    await sendBrandedEmail(to, subject, body);
  } catch (e) {
    logger.warn("[ORDER_EMAIL] Failed to send expiry alert", { to, daysLeft, error: String(e) });
  }
}

/** Sent after a package key is activated (first-time or upgrade) */
export async function sendWelcomeEmail(to: string, data: {
  name?: string | null;
  packageName: string;
  packageNameAr: string;
  isRenewal?: boolean;
  includesLexai?: boolean;
}) {
  const firstName = data.name?.split(' ')[0] || '';

  // Different subject for renewal vs new activation
  const subject = data.isRenewal
    ? `[${BRAND}] تم تجديد اشتراكك بنجاح | Subscription Renewed`
    : `[${BRAND}] أهلاً وسهلاً! مرحباً بك في أكاديمية XFlex | Welcome!`;

  const stepsHtml = data.isRenewal ? '' : `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px;margin:20px 0;">
      <h3 style="margin:0 0 12px;color:#065f46;">خطواتك القادمة / Your Next Steps:</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 4px;vertical-align:top;color:#059669;font-weight:bold;width:30px;">1.</td>
          <td style="padding:8px 4px;color:#374151;">
            ابدأ كورس التداول — شاهد الحلقات وأكمل الكورس<br/>
            <span style="color:#6b7280;font-size:13px;">Start the Trading Course — watch episodes and complete the course</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 4px;vertical-align:top;color:#059669;font-weight:bold;">2.</td>
          <td style="padding:8px 4px;color:#374151;">
            افتح حساب وسيط حقيقي وأودع $10 على الأقل<br/>
            <span style="color:#6b7280;font-size:13px;">Open a real broker account and deposit at least $10</span>
          </td>
        </tr>
        ${data.includesLexai ? `
        <tr>
          <td style="padding:8px 4px;vertical-align:top;color:#059669;font-weight:bold;">3.</td>
          <td style="padding:8px 4px;color:#374151;">
            استمتع بـ LexAI والتوصيات بعد إكمال الخطوات<br/>
            <span style="color:#6b7280;font-size:13px;">Enjoy LexAI &amp; Recommendations after completing all steps</span>
          </td>
        </tr>` : ''}
      </table>
    </div>`;

  const body = `
    <h2 style="margin:0 0 12px;color:#065f46;">
      ${data.isRenewal ? `مرحباً ${firstName}! تم تجديد اشتراكك` : `مرحباً ${firstName}! 🎉`}
    </h2>
    <h3 style="margin:0 0 16px;color:#065f46;">
      ${data.isRenewal ? `Welcome back! Your subscription has been renewed` : `Welcome to XFlex Trading Academy!`}
    </h3>
    <p style="color:#374151;line-height:1.7;">
      ${data.isRenewal
        ? `تم تجديد باقة <strong>${data.packageNameAr}</strong> بنجاح. يمكنك متابعة التعلم والتداول.<br/>
           Your <strong>${data.packageName}</strong> subscription has been renewed successfully.`
        : `تم تفعيل باقة <strong>${data.packageNameAr}</strong> بنجاح! مرحباً بك في رحلة التداول.<br/>
           Your <strong>${data.packageName}</strong> package has been activated. Welcome to your trading journey!`
      }
    </p>
    ${stepsHtml}
    <div style="text-align:center;margin-top:24px;">
      <a href="https://xflexacademy.com/courses" style="display:inline-block;background:#059669;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        ${data.isRenewal ? 'متابعة التعلم / Continue Learning' : 'ابدأ التعلم الآن / Start Learning Now'}
      </a>
    </div>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;text-align:center;">
      إذا واجهت أي مشكلة، تواصل معنا عبر الدعم الفني داخل المنصة.<br/>
      If you need help, reach out via the support chat inside the platform.
    </p>`;

  try {
    await sendBrandedEmail(to, subject, body);
  } catch (e) {
    logger.warn("[WELCOME_EMAIL] Failed to send", { to, error: String(e) });
  }
}

// ============================================================================
// Drip Emails — time-based engagement (day 5, 10, 20, 30)
// ============================================================================

const DRIP_CONTENT: Record<number, {
  subjectAr: string; subjectEn: string;
  headingAr: string; headingEn: string;
  bodyAr: string; bodyEn: string;
  ctaAr: string; ctaEn: string;
  ctaUrl: string;
}> = {
  5: {
    subjectAr: 'كيف تسير رحلتك؟',
    subjectEn: "How's your journey going?",
    headingAr: 'مرحباً! مرّت 5 أيام على بدايتك 🚀',
    headingEn: "5 days in — you're on your way!",
    bodyAr: 'نأمل أنك استمتعت بالحلقات الأولى. تذكّر أن المراجعة المستمرة تعزز الفهم. لا تتردد في إعادة مشاهدة أي حلقة.',
    bodyEn: "We hope you're enjoying the first episodes. Remember, consistent review strengthens understanding. Feel free to re-watch any episode.",
    ctaAr: 'تابع الكورس', ctaEn: 'Continue Course',
    ctaUrl: 'https://xflexacademy.com/courses',
  },
  10: {
    subjectAr: 'أنت تتقدم بثبات!',
    subjectEn: 'Steady progress!',
    headingAr: '10 أيام وأنت على الطريق الصحيح 💪',
    headingEn: '10 days in — great momentum!',
    bodyAr: 'لقد أكملت أكثر من أسبوع. هل جربت الكويزات؟ اختبر معرفتك بعد كل مجموعة حلقات لتثبيت المعلومات.',
    bodyEn: "You've completed over a week. Have you tried the quizzes? Test your knowledge after each episode group to reinforce learning.",
    ctaAr: 'جرّب الكويزات', ctaEn: 'Try Quizzes',
    ctaUrl: 'https://xflexacademy.com/quizzes',
  },
  20: {
    subjectAr: 'قاربت على الوصول!',
    subjectEn: "You're almost there!",
    headingAr: '20 يوم — لقد قطعت شوطاً كبيراً 🎯',
    headingEn: '20 days — great progress!',
    bodyAr: 'أنت على وشك إنهاء الكورس. إذا لم تكن قد فتحت حساب وسيط بعد، ابدأ الآن حتى تتمكن من استخدام LexAI والتوصيات فوراً بعد الإنهاء.',
    bodyEn: "You're close to finishing the course. If you haven't opened a broker account yet, start now so you can use LexAI and Recommendations right after completion.",
    ctaAr: 'فتح حساب وسيط', ctaEn: 'Open Broker Account',
    ctaUrl: 'https://xflexacademy.com/broker-onboarding',
  },
  30: {
    subjectAr: 'الشهر الأول — ملخص رحلتك',
    subjectEn: 'Your first month — journey recap',
    headingAr: 'مبروك على إتمام شهرك الأول! 🎉',
    headingEn: 'Congratulations on your first month!',
    bodyAr: 'لقد مضى شهر منذ انضمامك. نأمل أنك حققت تقدماً رائعاً. إذا لم تكمل الكورس بعد، لا تقلق — خذ وقتك وأنهِ ما تبقى.',
    bodyEn: "It's been a month since you joined. We hope you've made great progress. If you haven't finished the course yet, take your time and finish strong.",
    ctaAr: 'لوحة التحكم', ctaEn: 'My Dashboard',
    ctaUrl: 'https://xflexacademy.com/dashboard',
  },
};

export async function sendDripEmail(to: string, dayNumber: number, data: {
  name?: string | null;
  packageName: string;
  packageNameAr: string;
}) {
  const content = DRIP_CONTENT[dayNumber];
  if (!content) return;
  const firstName = data.name?.split(' ')[0] || '';

  const subject = `[${BRAND}] ${content.subjectAr} | ${content.subjectEn}`;
  const body = `
    <h2 style="margin:0 0 8px;color:#065f46;">${content.headingAr}</h2>
    <h3 style="margin:0 0 16px;color:#065f46;">${content.headingEn}</h3>
    <p style="color:#374151;line-height:1.7;">
      ${firstName ? `مرحباً ${firstName}،` : 'مرحباً،'}<br/>
      ${content.bodyAr}
    </p>
    <p style="color:#6b7280;line-height:1.7;font-size:14px;">
      ${content.bodyEn}
    </p>
    <div style="text-align:center;margin-top:20px;">
      <a href="${content.ctaUrl}" style="display:inline-block;background:#059669;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        ${content.ctaAr} / ${content.ctaEn}
      </a>
    </div>`;

  try {
    await sendBrandedEmail(to, subject, body);
  } catch (e) {
    logger.warn(`[DRIP_EMAIL] Day ${dayNumber} failed`, { to, error: String(e) });
  }
}

// ============================================================================
// Milestone Emails — episode completion milestones (10, 14, 27, 39)
// ============================================================================

const MILESTONE_CONTENT: Record<number, {
  subjectAr: string; subjectEn: string;
  headingAr: string; headingEn: string;
  bodyAr: string; bodyEn: string;
}> = {
  10: {
    subjectAr: 'أكملت 10 حلقات!',
    subjectEn: '10 episodes completed!',
    headingAr: 'أحسنت! أكملت 10 حلقات 🔥',
    headingEn: 'Great job — 10 episodes done!',
    bodyAr: 'بداية رائعة! استمر بنفس الوتيرة وستصل إلى هدفك.',
    bodyEn: "Amazing start! Keep up the pace and you'll reach your goal.",
  },
  14: {
    subjectAr: 'نصف الطريق — 14 حلقة!',
    subjectEn: 'Halfway — 14 episodes!',
    headingAr: 'وصلت لمنتصف الطريق! 🎯',
    headingEn: "You're halfway through!",
    bodyAr: 'أكملت 14 حلقة. أنت في منتصف رحلة التعلم. لا تتوقف الآن!',
    bodyEn: "14 episodes completed. You're halfway through the learning journey. Don't stop now!",
  },
  27: {
    subjectAr: '27 حلقة — قاربت!',
    subjectEn: '27 episodes — almost there!',
    headingAr: 'أنت على وشك الانتهاء! 💪',
    headingEn: "You're almost there!",
    bodyAr: 'بقي القليل لإنهاء الكورس. أكمل الحلقات الأخيرة وابدأ فتح حساب الوسيط.',
    bodyEn: 'Just a few episodes left. Finish the course and start your broker onboarding.',
  },
  39: {
    subjectAr: '39 حلقة — الخطوة الأخيرة!',
    subjectEn: '39 episodes — final stretch!',
    headingAr: 'كورس التداول على وشك الاكتمال! 🏆',
    headingEn: 'Course nearly complete!',
    bodyAr: 'أكملت 39 حلقة! أنهِ الحلقات المتبقية لفتح LexAI والتوصيات.',
    bodyEn: 'You completed 39 episodes! Finish the remaining ones to unlock LexAI and Recommendations.',
  },
};

export async function sendMilestoneEmail(to: string, milestone: number, data: {
  name?: string | null;
  completedCount: number;
}) {
  const content = MILESTONE_CONTENT[milestone];
  if (!content) return;
  const firstName = data.name?.split(' ')[0] || '';

  const subject = `[${BRAND}] ${content.subjectAr} | ${content.subjectEn}`;
  const body = `
    <h2 style="margin:0 0 8px;color:#065f46;">${content.headingAr}</h2>
    <h3 style="margin:0 0 16px;color:#065f46;">${content.headingEn}</h3>
    <p style="color:#374151;line-height:1.7;">
      ${firstName ? `مرحباً ${firstName}،` : 'مرحباً،'}<br/>
      ${content.bodyAr}
    </p>
    <p style="color:#6b7280;line-height:1.7;font-size:14px;">
      ${content.bodyEn}
    </p>
    <div style="text-align:center;margin:20px 0;">
      <div style="background:#f0fdf4;display:inline-block;padding:16px 32px;border-radius:10px;border:1px solid #bbf7d0;">
        <span style="font-size:28px;font-weight:bold;color:#059669;">${data.completedCount}</span>
        <span style="color:#065f46;font-size:14px;display:block;">حلقة مكتملة / episodes completed</span>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;">
      <a href="https://xflexacademy.com/courses" style="display:inline-block;background:#059669;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        تابع التعلم / Continue Learning
      </a>
    </div>`;

  try {
    await sendBrandedEmail(to, subject, body);
  } catch (e) {
    logger.warn(`[MILESTONE_EMAIL] ${milestone} failed`, { to, error: String(e) });
  }
}

// ============================================================================
// Inactivity Emails — re-engagement (7 days, 14 days)
// ============================================================================

export async function sendInactivityEmail(to: string, inactiveDays: number, data: {
  name?: string | null;
}) {
  const firstName = data.name?.split(' ')[0] || '';
  const is14 = inactiveDays >= 14;

  const subject = is14
    ? `[${BRAND}] مرّ أسبوعان — هل تحتاج مساعدة؟ | It's been 2 weeks`
    : `[${BRAND}] نفتقدك! | We miss you!`;

  const body = `
    <h2 style="margin:0 0 8px;color:#065f46;">
      ${is14 ? 'مرحباً! مرّ أسبوعان منذ آخر زيارة 😔' : 'نفتقدك! مرّ أسبوع 👋'}
    </h2>
    <h3 style="margin:0 0 16px;color:#065f46;">
      ${is14 ? "It's been 2 weeks — need help?" : "We miss you! It's been a week"}
    </h3>
    <p style="color:#374151;line-height:1.7;">
      ${firstName ? `مرحباً ${firstName}،` : 'مرحباً،'}<br/>
      ${is14
        ? 'لم نرك منذ أسبوعين. إذا واجهت أي صعوبة أو تحتاج مساعدة، فريق الدعم موجود لمساعدتك. عُد وأكمل رحلتك!'
        : 'مرّ أسبوع منذ آخر زيارة لك. رحلة التداول تحتاج استمرارية. عُد وأكمل من حيث توقفت!'}
    </p>
    <p style="color:#6b7280;line-height:1.7;font-size:14px;">
      ${is14
        ? "We haven't seen you in 2 weeks. If you're stuck or need help, our support team is here for you. Come back and continue your journey!"
        : "It's been a week since your last visit. Trading education needs consistency. Pick up where you left off!"}
    </p>
    <div style="text-align:center;margin-top:20px;">
      <a href="https://xflexacademy.com/dashboard" style="display:inline-block;background:#059669;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        عُد الآن / Come Back
      </a>
    </div>
    ${is14 ? `
    <p style="color:#9ca3af;font-size:12px;margin-top:20px;text-align:center;">
      تحتاج مساعدة؟ تواصل مع الدعم عبر المنصة أو واتساب.<br/>
      Need help? Reach out via platform support or WhatsApp.
    </p>` : ''}`;

  try {
    await sendBrandedEmail(to, subject, body);
  } catch (e) {
    logger.warn(`[INACTIVITY_EMAIL] ${inactiveDays}d failed`, { to, error: String(e) });
  }
}

// ============================================================================
// Onboarding Stalled Email — reminder when proof pending for 3+ days
// ============================================================================

export async function sendOnboardingStalledEmail(to: string, data: {
  name?: string | null;
  step: string;
  daysPending: number;
}) {
  const firstName = data.name?.split(' ')[0] || '';

  const stepLabels: Record<string, { ar: string; en: string }> = {
    open_account: { ar: 'فتح وتوثيق حساب الوسيط', en: 'Open & Verify Broker Account' },
    deposit: { ar: 'إيداع المبلغ', en: 'Make a Deposit' },
  };
  const label = stepLabels[data.step] || { ar: data.step, en: data.step };

  const subject = `[${BRAND}] خطوة الوسيط بانتظارك | Broker step awaiting review`;
  const body = `
    <h2 style="margin:0 0 8px;color:#065f46;">خطوتك بانتظار المراجعة ⏳</h2>
    <h3 style="margin:0 0 16px;color:#065f46;">Your broker step is awaiting review</h3>
    <p style="color:#374151;line-height:1.7;">
      ${firstName ? `مرحباً ${firstName}،` : 'مرحباً،'}<br/>
      خطوة "<strong>${label.ar}</strong>" قيد المراجعة منذ ${data.daysPending} أيام. فريقنا يعمل على مراجعتها. إذا كنت بحاجة لمساعدة، تواصل معنا عبر الدعم.
    </p>
    <p style="color:#6b7280;line-height:1.7;font-size:14px;">
      Your "<strong>${label.en}</strong>" step has been pending review for ${data.daysPending} days. Our team is working on it. If you need help, contact support.
    </p>
    <div style="text-align:center;margin-top:20px;">
      <a href="https://xflexacademy.com/broker-onboarding" style="display:inline-block;background:#059669;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        تحقق من حالة التقدم / Check Progress
      </a>
    </div>`;

  try {
    await sendBrandedEmail(to, subject, body);
  } catch (e) {
    logger.warn("[ONBOARDING_STALLED_EMAIL] Failed", { to, error: String(e) });
  }
}

// ============================================================================
// Post-Quiz Feedback Email — sent after quiz completion
// ============================================================================

export async function sendQuizFeedbackEmail(to: string, data: {
  name?: string | null;
  quizLevel: number;
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
}) {
  const firstName = data.name?.split(' ')[0] || '';
  const pct = data.score;

  const subject = data.passed
    ? `[${BRAND}] أحسنت! اجتزت المستوى ${data.quizLevel} | Quiz Level ${data.quizLevel} Passed!`
    : `[${BRAND}] نتيجة اختبار المستوى ${data.quizLevel} | Quiz Level ${data.quizLevel} Result`;

  const resultColor = data.passed ? '#059669' : '#dc2626';
  const resultIconAr = data.passed ? '🎉 مبروك!' : '💪 حاول مجدداً';
  const resultIconEn = data.passed ? 'Congratulations!' : 'Keep trying!';

  const body = `
    <h2 style="margin:0 0 8px;color:${resultColor};">${resultIconAr}</h2>
    <h3 style="margin:0 0 16px;color:${resultColor};">${resultIconEn}</h3>
    <p style="color:#374151;line-height:1.7;">
      ${firstName ? `مرحباً ${firstName}،` : 'مرحباً،'}<br/>
      ${data.passed
        ? `لقد اجتزت اختبار المستوى ${data.quizLevel} بنجاح! أحسنت.`
        : `لم تجتز اختبار المستوى ${data.quizLevel} هذه المرة. لا تقلق — يمكنك المحاولة مرة أخرى.`}
    </p>
    <p style="color:#6b7280;line-height:1.7;font-size:14px;">
      ${data.passed
        ? `You passed Quiz Level ${data.quizLevel}! Great job.`
        : `You didn't pass Quiz Level ${data.quizLevel} this time. Don't worry — you can try again!`}
    </p>
    <div style="text-align:center;margin:20px 0;">
      <div style="background:${data.passed ? '#f0fdf4' : '#fef2f2'};display:inline-block;padding:20px 40px;border-radius:10px;border:1px solid ${data.passed ? '#bbf7d0' : '#fecaca'};">
        <span style="font-size:36px;font-weight:bold;color:${resultColor};">${pct}%</span>
        <span style="color:#374151;font-size:14px;display:block;margin-top:4px;">${data.correctCount}/${data.totalQuestions} إجابة صحيحة / correct answers</span>
      </div>
    </div>
    <div style="text-align:center;margin-top:16px;">
      <a href="https://xflexacademy.com/quizzes" style="display:inline-block;background:${data.passed ? '#059669' : '#dc2626'};color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;">
        ${data.passed ? 'المستوى التالي / Next Level' : 'أعد المحاولة / Try Again'}
      </a>
    </div>`;

  try {
    await sendBrandedEmail(to, subject, body);
  } catch (e) {
    logger.warn("[QUIZ_FEEDBACK_EMAIL] Failed", { to, error: String(e) });
  }
}

// ============================================================================
// Staff Alert Email — sent to admin/staff for important events
// ============================================================================

const EVENT_EMOJI: Record<string, string> = {
  new_support_message: '💬',
  human_escalation: '🚨',
  new_order: '🛒',
  key_activated: '🔑',
  offer_agreement: '📝',
  plan_progress_update: '📊',
  broker_proof_submitted: '📎',
  subscription_expiring: '⏰',
  course_completion: '🎓',
  student_inactivity: '💤',
};

export async function sendStaffAlertEmail(data: {
  to: string;
  eventType: string;
  titleEn: string;
  contentEn: string;
  actionUrl: string;
}) {
  const emoji = EVENT_EMOJI[data.eventType] || '🔔';
  const subject = `[XFlex Staff] ${emoji} ${data.titleEn}`;
  const fullUrl = data.actionUrl.startsWith('http') ? data.actionUrl : `https://xflexacademy.com${data.actionUrl}`;
  const body = `
    <h2 style="margin:0 0 12px;color:#111;">${emoji} ${data.titleEn}</h2>
    <p style="color:#555;line-height:1.7;font-size:15px;">
      ${data.contentEn}
    </p>
    <div style="text-align:center;margin-top:24px;">
      <a href="${fullUrl}" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        View in Dashboard
      </a>
    </div>`;

  try {
    await sendBrandedEmail(data.to, subject, body);
  } catch (e) {
    logger.warn("[STAFF_ALERT_EMAIL] Failed", { to: data.to, eventType: data.eventType, error: String(e) });
  }
}

/** Send branded HTML announcement email to a student */
export async function sendAnnouncementEmail(to: string, data: {
  subject: string;
  titleAr: string;
  contentAr: string;
  titleEn?: string;
  contentEn?: string;
  actionUrl?: string;
  actionLabel?: string;
}) {
  const body = `
    <h2 style="margin:0 0 16px;color:#111;font-size:20px;text-align:right;">${data.titleAr}</h2>
    <div style="color:#555;line-height:1.8;font-size:15px;text-align:right;white-space:pre-line;">${data.contentAr}</div>
    ${data.titleEn ? `
    <hr style="margin:24px 0;border:none;border-top:1px solid #e5e7eb;" />
    <h2 style="margin:0 0 16px;color:#111;font-size:20px;">${data.titleEn}</h2>
    <div style="color:#555;line-height:1.8;font-size:15px;white-space:pre-line;">${data.contentEn || ''}</div>
    ` : ''}
    ${data.actionUrl ? `
    <div style="text-align:center;margin-top:28px;">
      <a href="${data.actionUrl.startsWith('http') ? data.actionUrl : `https://xflexacademy.com${data.actionUrl}`}" style="display:inline-block;background:#059669;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        ${data.actionLabel || 'زيارة الموقع'}
      </a>
    </div>` : ''}`;

  try {
    await sendBrandedEmail(to, data.subject, body);
  } catch (e) {
    logger.warn("[ANNOUNCEMENT_EMAIL] Failed", { to, error: String(e) });
  }
}
