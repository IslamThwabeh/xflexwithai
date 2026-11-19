import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { orderDeliveryDatabase, orderDeliveryMigration } from './fixtures/orderKeyDeliveryDatabase';
import { claimOrderDeliveryJob, ensureOrderDeliveryJob, finishOrderDeliveryJob, getOrderDeliveryJob, saveOrderKeySupportMessage } from '../backend/services/order-key-delivery-jobs.service';
import { buildOrderKeySupportMessage, redactActivationKeys } from '../shared/orderKeySupport';

let database: D1Database;
beforeEach(async () => { database = await orderDeliveryDatabase(); });
afterEach(() => (database as D1Database & { close(): void }).close());
const count = (table: string) => database.prepare(`SELECT count(*) AS n FROM ${table}`).first<number>('n');
async function save(job = null as Awaited<ReturnType<typeof claimOrderDeliveryJob>>) {
  job ??= await claimOrderDeliveryJob(database, 42);
  return saveOrderKeySupportMessage(database, { job: job!, recipientUserId: 7, recipientEmail: 'student@example.com',
    keyIds: [8], content: buildOrderKeySupportMessage(42, ['XFLEX-AAAAA-BBBBB-CCCCC']) });
}

describe('durable order-key delivery and private support copy', () => {
  it('creates a job in the key transaction and reapplying migration does not backfill history', async () => {
    expect(await getOrderDeliveryJob(database, 42)).toMatchObject({ status: 'pending', attempts: 0 });
    await database.exec('DELETE FROM order_key_delivery_jobs');
    await database.exec(orderDeliveryMigration);
    expect(await count('order_key_delivery_jobs')).toBe(0);
    await ensureOrderDeliveryJob(database, 42);
    expect(await count('order_key_delivery_jobs')).toBe(1);
  });

  it('rolls back both the linked key and its job if its surrounding transaction fails', async () => {
    await database.exec('DELETE FROM order_key_delivery_jobs; DELETE FROM registrationKeys');
    await expect(database.batch([
      database.prepare(`INSERT INTO registrationKeys(id,orderId,packageId,email,issuanceType) VALUES(8,42,1,'student@example.com','order')`),
      database.prepare('INSERT INTO nonexistent_table VALUES(1)'),
    ])).rejects.toThrow();
    expect(await count('registrationKeys')).toBe(0);
    expect(await count('order_key_delivery_jobs')).toBe(0);
  });

  it('also journals linking an existing manual key, without new keys or cash', async () => {
    await database.exec(`DELETE FROM order_key_delivery_jobs; UPDATE registrationKeys SET orderId=NULL,issuanceType='manual';
      UPDATE registrationKeys SET orderId=42,issuanceType='order' WHERE id=8`);
    expect(await count('order_key_delivery_jobs')).toBe(1);
    expect(await count('registrationKeys')).toBe(1);
    expect(await count('order_payment_confirmations')).toBe(1);
  });

  it('claims once under concurrency and saves one message/notification across retries', async () => {
    const jobs = (await Promise.all([claimOrderDeliveryJob(database, 42), claimOrderDeliveryJob(database, 42)])).filter(Boolean);
    expect(jobs).toHaveLength(1);
    await Promise.all([save(jobs[0]), save(jobs[0])]);
    await finishOrderDeliveryJob(database, jobs[0]!, null);
    await save((await claimOrderDeliveryJob(database, 42, true))!);
    expect(await count('supportConversations')).toBe(1);
    expect(await count('supportMessages')).toBe(1);
    expect(await count('user_notifications')).toBe(1);
    expect(await getOrderDeliveryJob(database, 42)).toMatchObject({ support_status: 'delivered', support_recipient_user_id: 7, support_message_id: 1 });
  });

  it('reopens the existing conversation and preserves staff assignment and human handoff', async () => {
    await database.exec(`INSERT INTO supportConversations(id,userId,status,needsHuman,assignedTo,closedAt)
      VALUES(9,7,'closed',1,24,'2026-01-01')`);
    await save();
    expect(await database.prepare('SELECT status,needsHuman,assignedTo,closedAt FROM supportConversations').first())
      .toEqual({ status: 'open', needsHuman: 1, assignedTo: 24, closedAt: null });
  });

  it('updates only the claimed order receipt when another customer has a delivery job', async () => {
    await database.exec(`INSERT INTO users VALUES(11,'other@example.com','Other Student');
      INSERT INTO orders VALUES(43,11,'completed',0,NULL,'new_sale');
      INSERT INTO order_payment_confirmations VALUES(4,43);
      INSERT INTO orderItems VALUES(2,43,'package',1);
      INSERT INTO registrationKeys(id,orderId,packageId,email,keyCode,issuanceType,transactionPurpose)
        VALUES(9,43,1,'other@example.com','XFLEX-OTHER-OTHER-OTHER','order','new_sale')`);
    const untouched = await getOrderDeliveryJob(database, 43);
    await save();
    expect(await getOrderDeliveryJob(database, 43)).toEqual(untouched);
    expect(await getOrderDeliveryJob(database, 42)).toMatchObject({ support_status: 'delivered', support_recipient_user_id: 7 });
    expect(await database.prepare('SELECT userId FROM supportConversations').first<number>('userId')).toBe(7);
    const job = (await claimOrderDeliveryJob(database, 43, true))!;
    await saveOrderKeySupportMessage(database, { job, recipientUserId: 11, recipientEmail: 'other@example.com', keyIds: [9], content: 'Other customer key' });
    expect(await getOrderDeliveryJob(database, 43)).toMatchObject({ support_status: 'delivered', support_recipient_user_id: 11 });
    expect((await getOrderDeliveryJob(database, 42))!.support_recipient_user_id).toBe(7);
    expect(await count('supportMessages')).toBe(2);
  });

  it('rolls back support and notification together, then recovers safely', async () => {
    await database.exec(`CREATE TRIGGER fail_notice BEFORE INSERT ON user_notifications BEGIN SELECT RAISE(ABORT,'unavailable'); END`);
    const job = (await claimOrderDeliveryJob(database, 42))!;
    await expect(save(job)).rejects.toThrow();
    expect(await count('supportMessages')).toBe(0);
    expect(await count('supportConversations')).toBe(0);
    expect((await getOrderDeliveryJob(database, 42))!.support_delivered_at).toBeNull();
    await database.exec('DROP TRIGGER fail_notice');
    await save(job);
    expect(await count('supportMessages')).toBe(1);
  });

  it.each([
    "UPDATE orders SET status='cancelled'", "UPDATE orders SET status='refunded'",
    'DELETE FROM order_payment_confirmations', "UPDATE registrationKeys SET email='other@example.com'",
    "UPDATE registrationKeys SET activatedAt='2026-01-01'", 'UPDATE registrationKeys SET isActive=0',
    "UPDATE registrationKeys SET expiresAt='invalid'", "UPDATE registrationKeys SET expiresAt='2026-01-01'",
    "UPDATE registrationKeys SET issuanceType='manual'", "UPDATE registrationKeys SET transactionPurpose='renewal'",
    'UPDATE registrationKeys SET issuanceType=NULL',
    "INSERT INTO orderItems VALUES(2,42,'package',2)", "UPDATE users SET email='changed@example.com'",
  ])('rejects an eligibility change at write time: %s', async mutation => {
    const job = (await claimOrderDeliveryJob(database, 42))!;
    await database.exec(mutation);
    await expect(save(job)).rejects.toThrow('not_persisted');
    expect(await count('supportMessages')).toBe(0);
    expect(await count('user_notifications')).toBe(0);
  });

  it('keeps gifts exclusively in the intended recipient’s account', async () => {
    await database.exec(`INSERT INTO users VALUES(11,'gift@example.com','Recipient');
      UPDATE orders SET isGift=1,giftEmail='gift@example.com'; UPDATE registrationKeys SET email='gift@example.com'`);
    const job = (await claimOrderDeliveryJob(database, 42))!;
    await expect(save(job)).rejects.toThrow();
    await saveOrderKeySupportMessage(database, { job, recipientUserId: 11, recipientEmail: 'gift@example.com', keyIds: [8], content: 'Gift key' });
    expect(await database.prepare('SELECT userId FROM supportConversations').first<number>('userId')).toBe(11);
  });

  it('fences expired workers and limits automatic retries', async () => {
    const stale = (await claimOrderDeliveryJob(database, 42))!;
    await database.exec("UPDATE order_key_delivery_jobs SET locked_at='2026-01-01',next_attempt_at='2026-01-01'");
    const fresh = (await claimOrderDeliveryJob(database, 42))!;
    await expect(save(stale)).rejects.toThrow();
    await finishOrderDeliveryJob(database, stale, null);
    expect((await getOrderDeliveryJob(database, 42))!.claim_token).toBe(fresh.claim_token);
    await save(fresh);
    await finishOrderDeliveryJob(database, { ...fresh, attempts: 6 }, 'email_queue_failed');
    expect((await getOrderDeliveryJob(database, 42))!.status).toBe('dead_letter');
    expect(await claimOrderDeliveryJob(database, 42)).toBeNull();
    expect(await claimOrderDeliveryJob(database, 42, true)).not.toBeNull();
  });

  it('uses the due index instead of scanning history', async () => {
    const plan = await database.prepare("EXPLAIN QUERY PLAN SELECT order_id FROM order_key_delivery_jobs WHERE status IN ('pending','failed') AND next_attempt_at<=? LIMIT 5")
      .bind(new Date().toISOString()).all<{ detail: string }>();
    expect(plan.results.some(row => row.detail.includes('idx_order_key_delivery_jobs_due'))).toBe(true);
    expect(plan.results.some(row => row.detail.includes('SCAN'))).toBe(false);
  });

  it('keeps activation credentials out of AI context', () => {
    const message = buildOrderKeySupportMessage(42, ['XFLEX-AAAAA-BBBBB-CCCCC']);
    expect(redactActivationKeys(message)).not.toContain('XFLEX-AAAAA');
    expect(redactActivationKeys('My key is xflex-11111-22222-33333')).toContain('[activation key hidden]');
    expect(message).toContain('/activate-key');
  });
});
