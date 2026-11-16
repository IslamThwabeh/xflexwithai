import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createLocalD1Database } from '../backend/_core/localD1';
import { enqueueEmailOutbox, getDb, getOrderKeyDelivery, retryOrderKeyDelivery, claimEmailOutboxBatch } from '../backend/db';
import type { D1Database } from '@cloudflare/workers-types';

let database: D1Database;
beforeAll(async () => {
  database = await createLocalD1Database(':memory:');
  await database.exec(`CREATE TABLE email_outbox (
    id INTEGER PRIMARY KEY, dedupeKey TEXT NOT NULL UNIQUE, batchId TEXT, recipientUserId INTEGER,
    recipientEmail TEXT NOT NULL, eventType TEXT NOT NULL, deliveryClass TEXT NOT NULL, templateId TEXT,
    emailCategory TEXT, subject TEXT NOT NULL, bodyText TEXT NOT NULL, bodyHtml TEXT, metadataJson TEXT,
    status TEXT NOT NULL, attempts INTEGER NOT NULL, nextAttemptAt TEXT NOT NULL, lockedAt TEXT,
    provider TEXT, attemptedProviders TEXT, errorCategory TEXT, errorMessage TEXT, sentAt TEXT,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE INDEX idx_email_outbox_status_next_attempt ON email_outbox(status,nextAttemptAt);`);
  await getDb({ DB: database });
});
beforeEach(async () => { await database.exec('DELETE FROM email_outbox'); });

async function queue(orderId: number) {
  return enqueueEmailOutbox({ dedupeKey: `order_key_delivery:${orderId}`, recipientEmail: 'student@example.invalid',
    eventType: 'payment_received', emailCategory: 'transactional', subject: 'Key', bodyText: 'Existing key' });
}

describe('actual SQL for order email delivery', () => {
  it('deduplicates concurrent approval queue writes through the unique index', async () => {
    const results = await Promise.all([queue(42), queue(42)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await database.prepare('SELECT count(*) AS n FROM email_outbox').first<any>()).n).toBe(1);
    const row = await getOrderKeyDelivery(42);
    expect(row).toMatchObject({ status: 'pending', recipientEmail: 'student@example.invalid' });
    const plan = await database.prepare('EXPLAIN QUERY PLAN SELECT id FROM email_outbox WHERE dedupeKey = ?').bind('order_key_delivery:42').all<any>();
    expect(plan.results.every((item: any) => !item.detail.includes('SCAN'))).toBe(true);
  });

  it('claims only the requested order rather than another client’s email', async () => {
    await queue(41); await queue(42);
    const target = (await getOrderKeyDelivery(42))!;
    const rows = await claimEmailOutboxBatch(1, { ids: [target.id], eventTypes: ['payment_received'] });
    expect(rows.map(row => row.id)).toEqual([target.id]);
    expect((await getOrderKeyDelivery(41))!.status).toBe('pending');
    expect(await claimEmailOutboxBatch(1, { ids: [target.id] })).toEqual([]);
  });

  it.each(['sent', 'failed', 'dead_letter'])('requeues a %s row once without changing its credential payload', async status => {
    await queue(42);
    await database.prepare("UPDATE email_outbox SET status=?, attempts=6, updatedAt='2026-01-01T00:00:00Z'").bind(status).run();
    const row = (await getOrderKeyDelivery(42))!;
    const results = await Promise.all([retryOrderKeyDelivery(row), retryOrderKeyDelivery(row)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await database.prepare('SELECT status,attempts,bodyText FROM email_outbox').first()).toEqual({ status: 'pending', attempts: 0, bodyText: 'Existing key' });
  });

  it.each(['pending', 'processing', 'skipped_suppressed'])('does not requeue %s rows', async status => {
    await queue(42);
    await database.prepare("UPDATE email_outbox SET status=?, updatedAt='2026-01-01T00:00:00Z'").bind(status).run();
    expect(await retryOrderKeyDelivery((await getOrderKeyDelivery(42))!)).toBe(false);
  });

  it('enforces the resend cooldown and rejects stale operator state', async () => {
    await queue(42);
    await database.exec("UPDATE email_outbox SET status='sent'");
    const recent = (await getOrderKeyDelivery(42))!;
    expect(await retryOrderKeyDelivery(recent)).toBe(false);
    await database.exec("UPDATE email_outbox SET updatedAt='2026-01-01T00:00:00Z'");
    expect(await retryOrderKeyDelivery(recent)).toBe(false);
    expect(await retryOrderKeyDelivery((await getOrderKeyDelivery(42))!)).toBe(true);
  });
});
