import * as db from '../db';
import { buildPaymentReceivedEmail } from '../_core/orderEmails';
import { isLikelyValidEmail, normalizeEmailAddress } from '../../shared/emailValidation';

export async function getOrderKeyDeliveryContext(orderId: number) {
  const order = await db.getOrderById(orderId);
  if (!order) throw new Error('Order not found.');
  const keys = await db.getOrderActivationKeys(orderId);
  const recipientEmail = normalizeEmailAddress(order.isGift && order.giftEmail
    ? order.giftEmail : (await db.getUserById(order.userId))?.email ?? '');
  const items = await db.getOrderItems(orderId);
  const packageIds = [...new Set(items.filter(item => item.itemType === 'package' && item.packageId).map(item => Number(item.packageId)))];
  const confirmation = order.status === 'completed' ? await db.getOrderPaymentConfirmation(orderId) : null;
  let blockReason: string | null = null;
  if (order.status !== 'completed' || !confirmation) blockReason = 'Payment confirmation is required before sending a key.';
  else if (!packageIds.length || packageIds.some(id => !keys.some(key => key.packageId === id))) blockReason = 'Key issuance must be completed first.';
  else if (keys.some(key => key.issuanceType !== 'order' || !packageIds.includes(Number(key.packageId))
    || (key.transactionPurpose && key.transactionPurpose !== order.transactionPurpose))) blockReason = 'The key source needs review.';
  else if (!isLikelyValidEmail(recipientEmail) || keys.some(key => normalizeEmailAddress(key.email ?? '') !== recipientEmail)) blockReason = 'The key recipient needs review.';
  else if (keys.some(key => !key.isActive || key.activatedAt || (key.expiresAt && !(Date.parse(key.expiresAt) > Date.now())))) blockReason = 'Only active, unused keys within their redemption deadline can be sent.';
  return { order, keys, recipientEmail, blockReason };
}

export async function getOrderKeyDeliveryDetails(orderId: number) {
  const context = await getOrderKeyDeliveryContext(orderId);
  const delivery = await db.getOrderKeyDelivery(orderId);
  const blockReason = context.blockReason ?? (delivery && normalizeEmailAddress(delivery.recipientEmail) !== context.recipientEmail
    ? 'The delivery recipient needs review.' : null);
  const canResend = !blockReason && (!delivery || (
    ['sent', 'failed', 'dead_letter'].includes(delivery.status)
    && Date.parse(delivery.updatedAt) <= Date.now() - 60_000
  ));
  return {
    keys: context.keys.map(key => ({ id: key.id, keyCode: key.keyCode, activatedAt: key.activatedAt, isActive: key.isActive, expiresAt: key.expiresAt })),
    recipientEmail: delivery?.recipientEmail ?? context.recipientEmail,
    delivery: delivery ? { status: delivery.status, sentAt: delivery.sentAt, nextAttemptAt: delivery.nextAttemptAt } : null,
    canResend, blockReason,
  };
}

/** Reuses the order's existing credentials; this service cannot create keys or cash. */
export async function queueOrderKeyDelivery(orderId: number, resend = false) {
  const context = await getOrderKeyDeliveryContext(orderId);
  if (context.blockReason) throw new Error(context.blockReason);
  const existing = await db.getOrderKeyDelivery(orderId);
  if (existing) {
    if (normalizeEmailAddress(existing.recipientEmail) !== context.recipientEmail) throw new Error('The delivery recipient needs review.');
    if (resend && !await db.retryOrderKeyDelivery(existing)) {
      throw new Error('Delivery is queued, blocked, or was attempted recently. Refresh its status before retrying.');
    }
    return { id: existing.id, created: false };
  }
  const packageNames = await Promise.all([...new Set(context.keys.map(key => key.packageId))].map(async id => {
    const pkg = id ? await db.getPackageById(id) : null;
    return pkg?.nameEn || pkg?.nameAr || 'Package';
  }));
  const email = await buildPaymentReceivedEmail(context.recipientEmail, {
    orderId, packageName: packageNames.join(' / '), activationKeys: context.keys.map(key => key.keyCode),
  });
  const user = await db.getUserByEmail(context.recipientEmail);
  const created = await db.enqueueEmailOutbox({
    dedupeKey: `order_key_delivery:${orderId}`, recipientEmail: context.recipientEmail,
    recipientUserId: user?.id ?? null, eventType: 'payment_received', templateId: 'payment_received',
    deliveryClass: 'critical', emailCategory: 'transactional',
    subject: email.subject, bodyText: email.text, bodyHtml: email.html,
    metadata: { orderId, orderKeyDelivery: true, keyIds: context.keys.map(key => key.id) },
  });
  const queued = await db.getOrderKeyDelivery(orderId);
  if (!queued) throw new Error('Key ready, but email could not be queued. Use Send key from this order to retry.');
  if (created && user) await db.createNotification({
    userId: user.id, type: 'success',
    titleAr: 'تم تأكيد الدفع — مفتاح التفعيل جاهز', titleEn: 'Payment confirmed — activation key ready',
    contentAr: context.order.isGift
      ? 'مفتاح هديتك جاهز وتمت جدولة إرساله إلى بريدك. استخدم المفتاح من البريد في صفحة التفعيل.'
      : 'مفتاحك جاهز وتمت جدولة إرساله إلى بريدك. افتح الطلب لنسخ المفتاح وبدء التفعيل.',
    contentEn: context.order.isGift
      ? 'Your gift key is ready and its email is queued. Use the emailed key on the activation page.'
      : 'Your key is ready and its email is queued. Open your order to copy the key and start activation.',
    actionUrl: context.order.isGift ? '/activate-key' : `/orders/${orderId}`,
  }).catch(() => {});
  return { id: queued.id, created };
}

/** Recheck eligibility at send time: a queued credential may have been closed or redeemed. */
export async function getOrderKeyDeliveryBlockReason(row: { eventType: string; metadataJson: string | null; recipientEmail: string }) {
  if (row.eventType !== 'payment_received') return null;
  let metadata: { orderId?: number; orderKeyDelivery?: boolean; keyIds?: number[] };
  try { metadata = JSON.parse(row.metadataJson ?? '{}'); } catch { return 'Invalid payment email metadata'; }
  if (!metadata.orderKeyDelivery) return null; // Preserve older, separately authorized recovery emails.
  if (!Number.isSafeInteger(metadata.orderId) || !metadata.orderId) return 'Missing order reference';
  const context = await getOrderKeyDeliveryContext(metadata.orderId);
  if (context.blockReason) return context.blockReason;
  if (context.recipientEmail !== normalizeEmailAddress(row.recipientEmail)
    || !Array.isArray(metadata.keyIds) || metadata.keyIds.length !== context.keys.length
    || context.keys.some(key => !metadata.keyIds!.includes(key.id))) return 'Key assignment changed; review delivery';
  return null;
}
