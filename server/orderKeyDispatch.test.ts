import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { orderDeliveryDatabase } from './fixtures/orderKeyDeliveryDatabase';
import { getOrderDeliveryJob } from '../backend/services/order-key-delivery-jobs.service';
vi.mock('../backend/db', () => ({ getDb: vi.fn(), getUserById: vi.fn(), getUserByEmail: vi.fn(), notifyStaffByEvent: vi.fn() }));
vi.mock('../backend/services/order-key-delivery.service', () => ({ getOrderKeyDeliveryContext: vi.fn(), queueOrderKeyDelivery: vi.fn() }));
import * as db from '../backend/db';
import { getOrderKeyDeliveryContext, queueOrderKeyDelivery } from '../backend/services/order-key-delivery.service';
import { dispatchOrderKey, recoverOrderKeyDeliveries } from '../backend/services/order-key-dispatch.service';

let database: D1Database;
beforeEach(async () => {
  vi.resetAllMocks();
  database = await orderDeliveryDatabase();
  vi.mocked(db.getDb).mockResolvedValue({ $client: database } as any);
  vi.mocked(db.getUserByEmail).mockResolvedValue({ id: 7, email: 'student@example.com' } as any);
  vi.mocked(db.getUserById).mockResolvedValue({ id: 7, email: 'student@example.com' } as any);
  vi.mocked(db.notifyStaffByEvent).mockResolvedValue(undefined);
  vi.mocked(getOrderKeyDeliveryContext).mockResolvedValue({ order: { id: 42, userId: 7 },
    keys: [{ id: 8, keyCode: 'XFLEX-AAAAA-BBBBB-CCCCC' }], recipientEmail: 'student@example.com', blockReason: null } as any);
  vi.mocked(queueOrderKeyDelivery).mockResolvedValue({ id: 10, created: true });
});
afterEach(() => { vi.restoreAllMocks(); (database as D1Database & { close(): void }).close(); });

describe('independent email/support delivery and automatic recovery', () => {
  it('recovers the key-trigger job without a surviving approval request', async () => {
    expect(await recoverOrderKeyDeliveries()).toEqual({ inspected: 1 });
    expect(await getOrderDeliveryJob(database, 42)).toMatchObject({ status: 'completed', support_status: 'delivered' });
    expect(queueOrderKeyDelivery).toHaveBeenCalledWith(42, false);
    expect(await recoverOrderKeyDeliveries()).toEqual({ inspected: 0 });
  });

  it('preserves support delivery when email persistence fails, without leaking credentials to logs', async () => {
    const logs = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(queueOrderKeyDelivery).mockRejectedValue(new Error('provider failed XFLEX-AAAAA-BBBBB-CCCCC student@example.com'));
    expect(await dispatchOrderKey(42)).toMatchObject({ emailId: null, supportStatus: 'delivered' });
    expect(await getOrderDeliveryJob(database, 42)).toMatchObject({ status: 'failed', last_error_code: 'email_queue_failed', support_status: 'delivered' });
    expect(logs.mock.calls.flat().join()).not.toMatch(/XFLEX-AAAAA|student@example.com/);
    vi.mocked(queueOrderKeyDelivery).mockResolvedValue({ id: 10, created: true });
    await dispatchOrderKey(42, { explicit: true });
    expect(await database.prepare('SELECT count(*) AS n FROM supportMessages').first<number>('n')).toBe(1);
    expect((await getOrderDeliveryJob(database, 42))!.status).toBe('completed');
  });

  it('still queues email when the support transaction fails, then repairs support without forcing email resend', async () => {
    await database.exec("CREATE TRIGGER fail_support BEFORE INSERT ON supportMessages BEGIN SELECT RAISE(ABORT,'unavailable'); END");
    expect(await dispatchOrderKey(42)).toMatchObject({ emailId: 10, supportStatus: 'pending' });
    expect(await getOrderDeliveryJob(database, 42)).toMatchObject({ status: 'failed', last_error_code: 'support_write_failed' });
    await database.exec('DROP TRIGGER fail_support');
    await dispatchOrderKey(42, { explicit: true });
    expect(queueOrderKeyDelivery).toHaveBeenLastCalledWith(42, false);
    expect((await getOrderDeliveryJob(database, 42))!.support_status).toBe('delivered');
  });

  it('keeps retries safe under concurrency', async () => {
    const results = await Promise.all([dispatchOrderKey(42), dispatchOrderKey(42)]);
    expect(results.filter(result => !result.busy)).toHaveLength(1);
    expect(queueOrderKeyDelivery).toHaveBeenCalledTimes(1);
    expect(await database.prepare('SELECT count(*) AS n FROM supportMessages').first<number>('n')).toBe(1);
  });

  it('reclaims an expired explicit recovery even when an earlier backoff is still in the future', async () => {
    await database.exec("UPDATE order_key_delivery_jobs SET status='processing',locked_at='2026-01-01',next_attempt_at='2099-01-01',claim_token='expired'");
    expect(await recoverOrderKeyDeliveries()).toEqual({ inspected: 1 });
    expect((await getOrderDeliveryJob(database, 42))!.support_status).toBe('delivered');
  });

  it('uses the owning account for a normal order with historical mixed-case email', async () => {
    await database.exec("UPDATE users SET email='Student@Example.com'");
    vi.mocked(db.getUserById).mockResolvedValue({ id: 7, email: 'Student@Example.com' } as any);
    vi.mocked(db.getUserByEmail).mockResolvedValue(undefined);
    expect(await dispatchOrderKey(42)).toMatchObject({ supportStatus: 'delivered' });
    expect(db.getUserByEmail).not.toHaveBeenCalled();
  });

  it('alerts staff once when recovery reaches its retry limit', async () => {
    await database.exec('UPDATE order_key_delivery_jobs SET attempts=5');
    vi.mocked(queueOrderKeyDelivery).mockRejectedValue(new Error('Queue unavailable'));
    await dispatchOrderKey(42);
    expect((await getOrderDeliveryJob(database, 42))!.status).toBe('dead_letter');
    expect(db.notifyStaffByEvent).toHaveBeenCalledTimes(1);
    expect(db.notifyStaffByEvent).toHaveBeenCalledWith('email_delivery_anomaly', expect.objectContaining({
      metadata: { orderId: 42, diagnosticCode: 'email_queue_failed', actionUrl: '/admin/orders?orderId=42' },
    }));
    await recoverOrderKeyDeliveries();
    expect(db.notifyStaffByEvent).toHaveBeenCalledTimes(1);
  });

  it('records an unregistered gift recipient explicitly and never sends its key to the purchaser chat', async () => {
    vi.mocked(getOrderKeyDeliveryContext).mockResolvedValue({ order: { id: 42, userId: 7, isGift: true },
      keys: [{ id: 8, keyCode: 'XFLEX-AAAAA-BBBBB-CCCCC' }], recipientEmail: 'gift@example.com', blockReason: null } as any);
    vi.mocked(db.getUserByEmail).mockResolvedValue(undefined);
    expect(await dispatchOrderKey(42)).toMatchObject({ emailId: 10, supportStatus: 'recipient_unregistered' });
    expect(await database.prepare('SELECT count(*) AS n FROM supportMessages').first<number>('n')).toBe(0);
    expect((await getOrderDeliveryJob(database, 42))!.status).toBe('completed');
  });

  it.each([
    ['Key issuance must be completed first.', 'failed', 'issuance_incomplete'],
    ['Only active, unused keys within their redemption deadline can be sent.', 'blocked', 'eligibility_blocked'],
  ])('does not publish unsafe keys: %s', async (blockReason, status, code) => {
    vi.mocked(getOrderKeyDeliveryContext).mockResolvedValue({ blockReason } as any);
    await dispatchOrderKey(42);
    expect(await getOrderDeliveryJob(database, 42)).toMatchObject({ status, last_error_code: code });
    expect(queueOrderKeyDelivery).not.toHaveBeenCalled();
    expect(await database.prepare('SELECT count(*) AS n FROM supportMessages').first<number>('n')).toBe(0);
  });
});
