import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', () => ({
  getOrderById: vi.fn(), getOrderActivationKeys: vi.fn(), getUserById: vi.fn(), getOrderItems: vi.fn(),
  getOrderPaymentConfirmation: vi.fn(), getOrderKeyDelivery: vi.fn(), retryOrderKeyDelivery: vi.fn(),
  getPackageById: vi.fn(), getUserByEmail: vi.fn(), enqueueEmailOutbox: vi.fn(), createNotification: vi.fn(),
  getOrderKeyDeliveryDiagnostics: vi.fn(),
}));
vi.mock('../backend/_core/orderEmails', () => ({ buildPaymentReceivedEmail: vi.fn() }));
import * as db from '../backend/db';
import { buildPaymentReceivedEmail } from '../backend/_core/orderEmails';
import { getOrderKeyDeliveryBlockReason, getOrderKeyDeliveryDetails, queueOrderKeyDelivery } from '../backend/services/order-key-delivery.service';

const order = { id: 42, userId: 7, status: 'completed', transactionPurpose: 'new_sale' };
const key = { id: 8, packageId: 1, keyCode: 'XFLEX-EXISTING', email: 'student@example.com', issuanceType: 'order', transactionPurpose: 'new_sale', isActive: true, activatedAt: null, expiresAt: null };
const delivery = { id: 10, recipientEmail: key.email, status: 'sent', updatedAt: '2026-01-01T00:00:00Z', sentAt: '2026-01-01T00:00:00Z', nextAttemptAt: '2026-01-01T00:00:00Z' };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.getOrderById).mockResolvedValue({ ...order } as any);
  vi.mocked(db.getOrderActivationKeys).mockResolvedValue([{ ...key }] as any);
  vi.mocked(db.getUserById).mockResolvedValue({ email: key.email } as any);
  vi.mocked(db.getOrderItems).mockResolvedValue([{ itemType: 'package', packageId: 1 }] as any);
  vi.mocked(db.getOrderPaymentConfirmation).mockResolvedValue({ id: 3 } as any);
  vi.mocked(db.getOrderKeyDelivery).mockResolvedValue(null);
  vi.mocked(db.getOrderKeyDeliveryDiagnostics).mockResolvedValue({ job: null, email: null });
  vi.mocked(db.getPackageById).mockResolvedValue({ nameEn: 'Basic' } as any);
  vi.mocked(db.getUserByEmail).mockResolvedValue({ id: 7 } as any);
  vi.mocked(buildPaymentReceivedEmail).mockResolvedValue({ subject: 'Confirmed', text: 'Key', html: '<p>Key</p>' });
  vi.mocked(db.enqueueEmailOutbox).mockResolvedValue(true);
  vi.mocked(db.createNotification).mockResolvedValue({ id: 12 } as any);
});

describe('durable delivery of existing order keys', () => {
  it('queues the assigned key once in the critical transactional lane', async () => {
    vi.mocked(db.getOrderKeyDelivery).mockResolvedValueOnce(null).mockResolvedValueOnce(delivery);
    expect(await queueOrderKeyDelivery(42)).toEqual({ id: 10, created: true });
    expect(buildPaymentReceivedEmail).toHaveBeenCalledWith(key.email, { orderId: 42, packageName: 'Basic', activationKeys: ['XFLEX-EXISTING'] });
    expect(db.enqueueEmailOutbox).toHaveBeenCalledWith(expect.objectContaining({
      dedupeKey: 'order_key_delivery:42', recipientEmail: key.email, deliveryClass: 'critical', emailCategory: 'transactional',
      metadata: { orderId: 42, orderKeyDelivery: true, keyIds: [8] },
    }));
    expect(db.createNotification).toHaveBeenCalledTimes(1);
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({ actionUrl: '/orders/42' }));
  });

  it('repeated approval reuses the delivery without resetting it or duplicating notifications', async () => {
    vi.mocked(db.getOrderKeyDelivery).mockResolvedValue(delivery);
    await queueOrderKeyDelivery(42);
    expect(db.enqueueEmailOutbox).not.toHaveBeenCalled();
    expect(db.retryOrderKeyDelivery).not.toHaveBeenCalled();
    expect(db.createNotification).not.toHaveBeenCalled();
  });

  it('resends using the existing row and key with a guarded explicit retry', async () => {
    vi.mocked(db.getOrderKeyDelivery).mockResolvedValue(delivery);
    vi.mocked(db.retryOrderKeyDelivery).mockResolvedValue(true);
    await queueOrderKeyDelivery(42, true);
    expect(db.retryOrderKeyDelivery).toHaveBeenCalledWith(delivery);
    expect(db.enqueueEmailOutbox).not.toHaveBeenCalled();
    expect(buildPaymentReceivedEmail).not.toHaveBeenCalled();
  });

  it('rejects concurrent/recent/in-flight retries without another email', async () => {
    vi.mocked(db.getOrderKeyDelivery).mockResolvedValue(delivery);
    vi.mocked(db.retryOrderKeyDelivery).mockResolvedValue(false);
    await expect(queueOrderKeyDelivery(42, true)).rejects.toThrow('attempted recently');
    expect(db.enqueueEmailOutbox).not.toHaveBeenCalled();
  });

  it('sends gifts only to the assigned recipient', async () => {
    vi.mocked(db.getOrderById).mockResolvedValue({ ...order, isGift: true, giftEmail: ' Gift@Example.com ' } as any);
    vi.mocked(db.getOrderActivationKeys).mockResolvedValue([{ ...key, email: 'gift@example.com' }] as any);
    vi.mocked(db.getOrderKeyDelivery).mockResolvedValueOnce(null).mockResolvedValueOnce({ ...delivery, recipientEmail: 'gift@example.com' });
    await queueOrderKeyDelivery(42);
    expect(db.enqueueEmailOutbox).toHaveBeenCalledWith(expect.objectContaining({ recipientEmail: 'gift@example.com' }));
    expect(db.getUserById).not.toHaveBeenCalled();
    expect(db.createNotification).toHaveBeenCalledWith(expect.objectContaining({ actionUrl: '/activate-key' }));
  });

  it.each([
    { isActive: false }, { activatedAt: '2026-01-01T00:00:00Z' }, { expiresAt: '2026-01-01T00:00:00Z' },
    { expiresAt: 'invalid' }, { email: 'another@example.invalid' }, { issuanceType: 'manual' }, { transactionPurpose: 'renewal' },
  ])('refuses invalid credential state %j', async change => {
    vi.mocked(db.getOrderActivationKeys).mockResolvedValue([{ ...key, ...change }] as any);
    await expect(queueOrderKeyDelivery(42, true)).rejects.toThrow();
    expect(db.enqueueEmailOutbox).not.toHaveBeenCalled();
    expect(db.retryOrderKeyDelivery).not.toHaveBeenCalled();
  });

  it.each(['cancelled', 'refunded', 'awaiting_confirmation'])('does not send keys for %s orders', async status => {
    vi.mocked(db.getOrderById).mockResolvedValue({ ...order, status } as any);
    await expect(queueOrderKeyDelivery(42)).rejects.toThrow('Payment confirmation');
  });

  it('does not send historical unconfirmed or partially issued orders', async () => {
    vi.mocked(db.getOrderPaymentConfirmation).mockResolvedValueOnce(undefined);
    await expect(queueOrderKeyDelivery(42)).rejects.toThrow('Payment confirmation');
    vi.mocked(db.getOrderItems).mockResolvedValue([{ itemType: 'package', packageId: 1 }, { itemType: 'package', packageId: 2 }] as any);
    await expect(queueOrderKeyDelivery(42)).rejects.toThrow('issuance');
  });

  it('shows unavailable delivery status without sending on read', async () => {
    const result = await getOrderKeyDeliveryDetails(42);
    expect(result).toMatchObject({ delivery: null, canResend: true, keys: [{ keyCode: key.keyCode }] });
    expect(db.enqueueEmailOutbox).not.toHaveBeenCalled();
  });

  it('surfaces queue persistence failure for recovery on the same order', async () => {
    vi.mocked(db.enqueueEmailOutbox).mockResolvedValue(false);
    await expect(queueOrderKeyDelivery(42)).rejects.toThrow('could not be queued');
    expect(db.createNotification).not.toHaveBeenCalled();
  });

  it('rechecks assignment and redemption at send time', async () => {
    const row = { eventType: 'payment_received', recipientEmail: key.email, metadataJson: JSON.stringify({ orderKeyDelivery: true, orderId: 42, keyIds: [8] }) };
    expect(await getOrderKeyDeliveryBlockReason(row)).toBeNull();
    expect(await getOrderKeyDeliveryBlockReason({ ...row, recipientEmail: 'other@example.invalid' })).toContain('changed');
    vi.mocked(db.getOrderActivationKeys).mockResolvedValue([{ ...key, activatedAt: '2026-01-01' }] as any);
    expect(await getOrderKeyDeliveryBlockReason(row)).toContain('unused');
    expect(await getOrderKeyDeliveryBlockReason({ ...row, metadataJson: '{' })).toContain('Invalid');
    expect(await getOrderKeyDeliveryBlockReason({ ...row, metadataJson: '{}' })).toBeNull();
  });
});
