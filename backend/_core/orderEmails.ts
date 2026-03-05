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
  <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:28px 24px;text-align:center;">
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
      <a href="https://xflexacademy.com/orders/${data.orderId}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">
        عرض الطلب / View Order
      </a>
    </div>`;
  
  try {
    await sendEmail({ to, subject, text: wrapHtml(body) });
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
    await sendEmail({ to, subject, text: wrapHtml(body) });
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
    await sendEmail({ to: adminEmail, subject, text: wrapHtml(body) });
  } catch (e) {
    logger.warn("[ORDER_EMAIL] Failed to notify admin", { orderId: data.orderId, error: String(e) });
  }
}
