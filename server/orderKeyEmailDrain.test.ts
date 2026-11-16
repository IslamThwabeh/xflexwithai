import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', () => ({
  claimEmailOutboxBatch: vi.fn(), markEmailOutboxSent: vi.fn(), markEmailOutboxFailed: vi.fn(), markEmailOutboxSkipped: vi.fn(),
  getEmailOutboxRecipientBlockReason: vi.fn(), getOrderById: vi.fn(), getOrderItems: vi.fn(),
  getOrderActivationKeys: vi.fn(), getUserById: vi.fn(), getOrderPaymentConfirmation: vi.fn(),
}));
vi.mock('../backend/_core/email', () => ({ sendEmail: vi.fn(), sendAdminNotificationEmail: vi.fn() }));
import * as db from '../backend/db';
import { sendEmail } from '../backend/_core/email';
import { drainGenericEmailOutbox } from '../backend/services/email-outbox.service';

const key = { id: 8, packageId: 1, email: 'student@example.com', issuanceType: 'order', isActive: true, activatedAt: null, expiresAt: null };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.claimEmailOutboxBatch).mockResolvedValue([{ id: 10, eventType: 'payment_received', recipientEmail: key.email,
    subject: 'Confirmed', bodyText: 'Existing key', bodyHtml: null, emailCategory: 'transactional',
    metadataJson: JSON.stringify({ orderKeyDelivery: true, orderId: 42, keyIds: [8] }),
  }] as any);
  vi.mocked(db.getEmailOutboxRecipientBlockReason).mockResolvedValue(null);
  vi.mocked(db.getOrderById).mockResolvedValue({ id: 42, userId: 7, status: 'completed' } as any);
  vi.mocked(db.getOrderItems).mockResolvedValue([{ itemType: 'package', packageId: 1 }] as any);
  vi.mocked(db.getOrderActivationKeys).mockResolvedValue([{ ...key }] as any);
  vi.mocked(db.getUserById).mockResolvedValue({ email: key.email } as any);
  vi.mocked(db.getOrderPaymentConfirmation).mockResolvedValue({ id: 3 } as any);
  vi.mocked(sendEmail).mockResolvedValue({ provider: 'zeptomail', attemptedProviders: ['zeptomail'] } as any);
});

describe('queued key email provider delivery', () => {
  it('sends only the selected row and records provider acceptance', async () => {
    expect(await drainGenericEmailOutbox({ limit: 1, ids: [10], eventTypes: ['payment_received'] })).toMatchObject({ sent: 1 });
    expect(db.claimEmailOutboxBatch).toHaveBeenCalledWith(1, { ids: [10], eventTypes: ['payment_received'] });
    expect(db.markEmailOutboxSent).toHaveBeenCalledWith({ id: 10, provider: 'zeptomail', attemptedProviders: ['zeptomail'] });
  });
  it('persists a retryable failure instead of treating provider rejection as success', async () => {
    vi.mocked(sendEmail).mockRejectedValue(new Error('Provider outage'));
    expect(await drainGenericEmailOutbox({ limit: 1 })).toMatchObject({ failed: 1, sent: 0 });
    expect(db.markEmailOutboxFailed).toHaveBeenCalledWith(expect.objectContaining({ id: 10, errorMessage: 'Provider outage' }));
    expect(db.markEmailOutboxSent).not.toHaveBeenCalled();
  });
  it('stops an email when the key was redeemed after enqueue', async () => {
    vi.mocked(db.getOrderActivationKeys).mockResolvedValue([{ ...key, activatedAt: '2026-11-16' }] as any);
    expect(await drainGenericEmailOutbox({ limit: 1 })).toMatchObject({ skipped: 1, sent: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.markEmailOutboxSkipped).toHaveBeenCalledWith(10, expect.stringContaining('unused'), 'skipped_suppressed');
  });
  it('preserves provider suppression and does not announce successful delivery', async () => {
    vi.mocked(sendEmail).mockResolvedValue({ skipped: 'suppressed' } as any);
    expect(await drainGenericEmailOutbox({ limit: 1 })).toMatchObject({ skipped: 1, sent: 0 });
    expect(db.markEmailOutboxSent).not.toHaveBeenCalled();
  });
});
