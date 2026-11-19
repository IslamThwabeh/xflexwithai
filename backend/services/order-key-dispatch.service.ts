import * as db from '../db';
import { logger } from '../_core/logger';
import { getOrderKeyDeliveryContext, queueOrderKeyDelivery } from './order-key-delivery.service';
import { claimOrderDeliveryJob, ensureOrderDeliveryJob, finishOrderDeliveryJob, getOrderDeliveryJob,
  saveOrderKeySupportMessage } from './order-key-delivery-jobs.service';
import { buildOrderKeySupportMessage } from '../../shared/orderKeySupport';
import type { D1Database } from '@cloudflare/workers-types';
import type { OrderKeyDeliveryJob } from './order-key-delivery-jobs.service';

async function finishAndAlert(database: D1Database, job: OrderKeyDeliveryJob, code: string | null, blocked = false) {
  const status = await finishOrderDeliveryJob(database, job, code, blocked);
  if (status !== 'dead_letter' || job.attempts !== 6) return;
  const orderId = job.order_id;
  await db.notifyStaffByEvent('email_delivery_anomaly', {
    titleEn: `Order #${orderId} key delivery needs attention`,
    titleAr: `تسليم مفتاح الطلب #${orderId} يحتاج متابعة`,
    contentEn: 'Automatic delivery recovery stopped after six attempts. Review email and support status in the order.',
    contentAr: 'توقفت استعادة التسليم التلقائية بعد ست محاولات. راجع حالة البريد والدعم داخل الطلب.',
    metadata: { orderId, diagnosticCode: code, actionUrl: `/admin/orders?orderId=${orderId}` },
  }).catch(() => logger.warn('[ORDER_DELIVERY] Staff alert unavailable', { orderId, code: 'staff_alert_failed' }));
}

/** Delivery recovery cannot recognize cash, issue a key or grant access. */
export async function dispatchOrderKey(orderId: number, options: { explicit?: boolean } = {}) {
  const database = (await db.getDb())?.$client;
  if (!database) throw new Error('Database not available');
  if (options.explicit) await ensureOrderDeliveryJob(database, orderId);
  const job = await claimOrderDeliveryJob(database, orderId, !!options.explicit);
  if (!job) return { emailId: null, supportStatus: (await getOrderDeliveryJob(database, orderId))?.support_status ?? 'pending', busy: true };

  let emailId: number | null = null;
  let supportStatus = job.support_status;
  let supportFailed = false;
  let emailFailed = false;
  try {
    const context = await getOrderKeyDeliveryContext(orderId);
    if (context.blockReason) {
      const incomplete = context.blockReason === 'Key issuance must be completed first.';
      await finishAndAlert(database, job, incomplete ? 'issuance_incomplete' : 'eligibility_blocked', !incomplete);
      logger.warn('[ORDER_DELIVERY] Eligibility review required', { orderId, jobAttempt: job.attempts,
        stage: 'validation', code: incomplete ? 'issuance_incomplete' : 'eligibility_blocked' });
      return { emailId, supportStatus, busy: false };
    }
    // Commit support independently: provider/queue failure cannot hide this copy.
    if (!job.support_delivered_at) {
      try {
        const recipient = context.order.isGift
          ? await db.getUserByEmail(context.recipientEmail)
          : await db.getUserById(context.order.userId);
        if (recipient) {
          await saveOrderKeySupportMessage(database, { job, recipientUserId: recipient.id,
            recipientEmail: context.recipientEmail, keyIds: context.keys.map(key => key.id),
            content: buildOrderKeySupportMessage(orderId, context.keys.map(key => key.keyCode)) });
          supportStatus = 'delivered';
        } else {
          // Gifts without an account have no private support destination. Never
          // put the recipient's credential in the purchaser's conversation.
          await database.prepare(`UPDATE order_key_delivery_jobs SET support_status='recipient_unregistered'
            WHERE order_id=? AND claim_token=?`).bind(orderId, job.claim_token).run();
          supportStatus = 'recipient_unregistered';
        }
      } catch {
        supportFailed = true;
        logger.error('[ORDER_DELIVERY] Support copy failed', { orderId, jobAttempt: job.attempts, stage: 'support', code: 'support_write_failed' });
      }
    }
    try {
      const email = await queueOrderKeyDelivery(orderId, false);
      emailId = email.id;
    } catch {
      emailFailed = true;
      logger.error('[ORDER_DELIVERY] Email queue failed', { orderId, jobAttempt: job.attempts, stage: 'email_queue', code: 'email_queue_failed' });
    }
    const code = supportFailed && emailFailed ? 'both_channels_failed' : supportFailed ? 'support_write_failed' : emailFailed ? 'email_queue_failed' : null;
    await finishAndAlert(database, job, code);
    return { emailId, supportStatus, busy: false };
  } catch {
    await finishAndAlert(database, job, 'delivery_context_failed');
    logger.error('[ORDER_DELIVERY] Delivery recovery failed', { orderId, jobAttempt: job.attempts, stage: 'context', code: 'delivery_context_failed' });
    return { emailId, supportStatus, busy: false };
  }
}

/** Existing five-minute repair invocation; queues customer email, bounded/indexed. */
export async function recoverOrderKeyDeliveries(limit = 5) {
  const database = (await db.getDb())?.$client;
  if (!database) throw new Error('Database not available');
  const now = new Date();
  const due = await database.prepare(`SELECT order_id FROM order_key_delivery_jobs
    WHERE status='processing' AND locked_at<=?
    UNION ALL SELECT order_id FROM order_key_delivery_jobs
    WHERE status IN ('pending','failed') AND next_attempt_at<=?
    LIMIT ?`).bind(new Date(now.getTime() - 5 * 60_000).toISOString(), now.toISOString(),
      Math.min(Math.max(limit, 1), 5)).all<{ order_id: number }>();
  for (const job of due.results) await dispatchOrderKey(job.order_id);
  return { inspected: due.results.length };
}
