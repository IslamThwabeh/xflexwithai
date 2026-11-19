import type { D1Database } from '@cloudflare/workers-types';

export type OrderKeyDeliveryJob = {
  order_id: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'blocked' | 'dead_letter';
  attempts: number;
  next_attempt_at: string;
  locked_at: string | null;
  claim_token: string | null;
  last_error_code: string | null;
  support_status: 'pending' | 'delivered' | 'recipient_unregistered';
  support_recipient_user_id: number | null;
  support_conversation_id: number | null;
  support_message_id: number | null;
  support_delivered_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getOrderDeliveryJob(database: D1Database, orderId: number) {
  return database.prepare('SELECT * FROM order_key_delivery_jobs WHERE order_id = ?').bind(orderId).first<OrderKeyDeliveryJob>();
}

/** Explicit same-order recovery only; migration never backfills old customers. */
export async function ensureOrderDeliveryJob(database: D1Database, orderId: number) {
  const now = new Date().toISOString();
  await database.prepare(`INSERT OR IGNORE INTO order_key_delivery_jobs(order_id,next_attempt_at,created_at,updated_at)
    SELECT id,?,?,? FROM orders WHERE id=? AND status='completed'
      AND EXISTS(SELECT 1 FROM order_payment_confirmations WHERE order_id=orders.id)
      AND EXISTS(SELECT 1 FROM registrationKeys WHERE orderId=orders.id AND packageId IS NOT NULL)`)
    .bind(now, now, now, orderId).run();
}

export async function claimOrderDeliveryJob(database: D1Database, orderId: number, explicit = false) {
  const now = new Date();
  const token = crypto.randomUUID();
  // A unique token fences a worker that resumes after its lease was reclaimed.
  return database.prepare(`UPDATE order_key_delivery_jobs SET status='processing',locked_at=?,claim_token=?,
      attempts=attempts+1,updated_at=? WHERE order_id=? AND (
        (status IN ('pending','failed') AND (?=1 OR next_attempt_at<=?))
        OR (status='processing' AND locked_at<=?)
        OR (?=1 AND status IN ('completed','blocked','dead_letter'))
      ) RETURNING *`)
    .bind(now.toISOString(), token, now.toISOString(), orderId, Number(explicit), now.toISOString(),
      new Date(now.getTime() - 5 * 60_000).toISOString(), Number(explicit)).first<OrderKeyDeliveryJob>();
}

export async function finishOrderDeliveryJob(database: D1Database, job: OrderKeyDeliveryJob,
  errorCode: string | null, blocked = false) {
  const now = new Date();
  const status = !errorCode ? 'completed' : blocked ? 'blocked' : job.attempts >= 6 ? 'dead_letter' : 'failed';
  const result = await database.prepare(`UPDATE order_key_delivery_jobs SET status=?,last_error_code=?,locked_at=NULL,
    claim_token=NULL,next_attempt_at=?,updated_at=? WHERE order_id=? AND claim_token=? AND status='processing'`)
    .bind(status, errorCode, new Date(now.getTime() + Math.min(60, 2 ** Math.min(job.attempts, 6)) * 60_000).toISOString(),
      now.toISOString(), job.order_id, job.claim_token).run();
  return result.meta.changes > 0 ? status : 'superseded';
}

/** Never sends another email: the website copy is an independent delivery channel. */
export async function saveOrderKeySupportMessage(database: D1Database, input: {
  job: OrderKeyDeliveryJob; recipientUserId: number; recipientEmail: string; keyIds: number[]; content: string;
}) {
  const { job } = input;
  const now = new Date().toISOString();
  // Recheck ownership, payment, complete issuance and every key INSIDE the write
  // transaction; a cancellation/reassignment between the read and write loses.
  const eligible = `EXISTS(SELECT 1 FROM orders o JOIN order_payment_confirmations p ON p.order_id=o.id
    JOIN users u ON u.id=? WHERE o.id=? AND o.status='completed' AND lower(trim(u.email))=?
      AND ((coalesce(o.isGift,0)=0 AND o.userId=u.id) OR (o.isGift=1 AND lower(trim(o.giftEmail))=lower(trim(u.email))))
      AND (SELECT count(*) FROM registrationKeys k WHERE k.orderId=o.id)=json_array_length(?)
      AND NOT EXISTS(SELECT 1 FROM registrationKeys k WHERE k.orderId=o.id AND (
        k.id NOT IN (SELECT value FROM json_each(?)) OR k.packageId IS NULL OR coalesce(k.issuanceType,'')<>'order'
        OR (k.transactionPurpose IS NOT NULL AND k.transactionPurpose<>o.transactionPurpose)
        OR lower(trim(coalesce(k.email,'')))<>? OR coalesce(k.isActive,0)<>1 OR k.activatedAt IS NOT NULL
        OR (k.expiresAt IS NOT NULL AND (julianday(k.expiresAt) IS NULL OR julianday(k.expiresAt)<=julianday(?)))
        OR NOT EXISTS(SELECT 1 FROM orderItems i WHERE i.orderId=o.id AND i.itemType='package' AND i.packageId=k.packageId)))
      AND EXISTS(SELECT 1 FROM orderItems i WHERE i.orderId=o.id AND i.itemType='package' AND i.packageId IS NOT NULL)
      AND NOT EXISTS(SELECT 1 FROM orderItems i WHERE i.orderId=o.id AND i.itemType='package' AND i.packageId IS NOT NULL
        AND NOT EXISTS(SELECT 1 FROM registrationKeys k WHERE k.orderId=o.id AND k.packageId=i.packageId)))`;
  const guard = `EXISTS(SELECT 1 FROM order_key_delivery_jobs WHERE order_id=? AND claim_token=?
    AND status='processing' AND support_delivered_at IS NULL) AND ${eligible}`;
  const args = [job.order_id, job.claim_token, input.recipientUserId, job.order_id, input.recipientEmail,
    JSON.stringify(input.keyIds), JSON.stringify(input.keyIds), input.recipientEmail, now];
  const conversation = '(SELECT MAX(id) FROM supportConversations WHERE userId=?)';
  const results = await database.batch([
    database.prepare(`INSERT INTO supportConversations(userId,status,createdAt,updatedAt)
      SELECT ?,'open',?,? WHERE ${guard} AND NOT EXISTS(SELECT 1 FROM supportConversations WHERE userId=?)`)
      .bind(input.recipientUserId, now, now, ...args, input.recipientUserId),
    database.prepare(`INSERT INTO supportMessages(conversationId,senderId,senderType,senderDisplayName,content,isRead,createdAt)
      SELECT ${conversation},0,'support','فريق XFlex — مفتاح الطلب',?,0,? WHERE ${guard}`)
      .bind(input.recipientUserId, input.content, now, ...args),
    database.prepare(`UPDATE supportConversations SET status='open',closedAt=NULL,updatedAt=?
      WHERE id=${conversation} AND ${guard}`).bind(now, input.recipientUserId, ...args),
    database.prepare(`INSERT OR IGNORE INTO user_notifications
      (user_id,type,title_en,title_ar,content_en,content_ar,action_url,dedupe_key,created_at)
      SELECT ?,'success','Your activation key is saved in Support','مفتاح التفعيل محفوظ في الدعم',
      'Open your private support conversation to copy your key and activate your package.',
      'افتح محادثة الدعم الخاصة بك لنسخ المفتاح وتفعيل باقتك.','/support',?,? WHERE ${guard}`)
      .bind(input.recipientUserId, `order_key_support:${job.order_id}`, now, ...args),
    // The message is the only supportMessages insert in this transaction.
    database.prepare(`UPDATE order_key_delivery_jobs SET support_status='delivered',support_recipient_user_id=?,
      support_conversation_id=${conversation},support_message_id=(SELECT MAX(id) FROM supportMessages WHERE conversationId=${conversation}),
      support_delivered_at=?,updated_at=? WHERE order_id=? AND ${guard}`)
      .bind(input.recipientUserId, input.recipientUserId, input.recipientUserId, now, now, job.order_id, ...args),
  ]);
  const current = await getOrderDeliveryJob(database, job.order_id);
  if (!current?.support_delivered_at) throw new Error('support_delivery_not_persisted');
  return results[1].meta.changes > 0;
}
