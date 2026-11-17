import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../backend/db', async () => ({
  ...await vi.importActual<typeof import('../backend/db')>('../backend/db'),
  getAdminByEmail: vi.fn(), hasAnyRole: vi.fn(), isFinanceOwnerAdmin: vi.fn(), getOrderById: vi.fn(),
  getOrderPaymentConfirmation: vi.fn(), getOrderItems: vi.fn(), getPackageById: vi.fn(),
  assertRenewalKeyIssuanceReady: vi.fn(), confirmOrderPayment: vi.fn(), createOrderActivationKeys: vi.fn(), logOrderStatusHistory: vi.fn(),
}));
vi.mock('../backend/services/live-order-retirement.service', async () => ({ ...await vi.importActual('../backend/services/live-order-retirement.service'), findRetiredOrder: vi.fn(async () => null) }));
vi.mock('../backend/services/order-key-delivery.service', () => ({ queueOrderKeyDelivery: vi.fn(async () => ({ id: 1 })) }));
vi.mock('../backend/services/email-outbox.service', async () => ({ ...await vi.importActual('../backend/services/email-outbox.service'), drainGenericEmailOutbox: vi.fn() }));
import { appRouter } from '../backend/routers';
import * as db from '../backend/db';
const order = { id: 42, userId: 7, status: 'awaiting_confirmation', currency: 'ILS', totalAmount: 35000,
  paymentMethod: 'bank_transfer', paymentProofUrl: null, termsAcceptedAt: '2026-11-01T00:00:00Z', termsAcceptedVersion: 'v2', transactionPurpose: 'upgrade', isUpgrade: true };
let roles: string[];
const caller = () => appRouter.createCaller({ user: { id: 130, email: 'staff@example.test', isStaff: true }, req: { headers: {} }, setCookie() {}, clearCookie() {} } as any);
const input = { orderId: 42, status: 'completed' as const, financialPayment: { paidAt: '2026-11-17T15:34:00.000Z', baseAmountIlsMinor: 35000, rationale: 'Payment verified directly by owner.' } };
beforeEach(() => {
  vi.resetAllMocks(); roles = ['finance_manager'];
  vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
  vi.mocked(db.hasAnyRole).mockImplementation(async (_id, requested) => requested.some(r => roles.includes(r)));
  vi.mocked(db.getOrderById).mockResolvedValue(order as any);
  vi.mocked(db.getOrderPaymentConfirmation).mockResolvedValue(undefined);
  vi.mocked(db.getOrderItems).mockResolvedValue([{ itemType: 'package', packageId: 3 }] as any);
  vi.mocked(db.getPackageById).mockResolvedValue({ id: 3, packageType: 'live', slug: 'live-package' } as any);
  vi.mocked(db.createOrderActivationKeys).mockResolvedValue([{ id: 8, packageId: 3, keyCode: 'SYNTHETIC' }]);
});
describe('optional receipt in admin financial approval', () => {
  it('allows an authorized finance approver without an image and preserves financial inputs', async () => {
    const result = await caller().orders.adminUpdateStatus(input);
    expect(result.activationKeys).toHaveLength(1);
    expect(db.confirmOrderPayment).toHaveBeenCalledWith(expect.objectContaining({ actorType: 'staff', actorId: 130, ...input.financialPayment, order }));
  });
  it('still requires terms, exact amount, and finance permission', async () => {
    await expect(caller().orders.adminUpdateStatus({ ...input, financialPayment: { ...input.financialPayment, baseAmountIlsMinor: 1 } })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    vi.mocked(db.getOrderById).mockResolvedValue({ ...order, termsAcceptedAt: null } as any);
    await expect(caller().orders.adminUpdateStatus(input)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    roles = ['key_manager'];
    await expect(caller().orders.adminUpdateStatus(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.confirmOrderPayment).not.toHaveBeenCalled();
  });
  it('rejects an untrusted attachment instead of treating it as absent', async () => {
    vi.mocked(db.getOrderById).mockResolvedValue({ ...order, paymentProofUrl: 'https://example.test/fake.jpg' } as any);
    await expect(caller().orders.adminUpdateStatus(input)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.confirmOrderPayment).not.toHaveBeenCalled();
  });
  it('accepts an existing trusted upload', async () => {
    vi.mocked(db.getOrderById).mockResolvedValue({ ...order, paymentProofUrl: 'https://videos.xflexacademy.com/payment-proofs/42/real.jpg' } as any);
    await caller().orders.adminUpdateStatus(input);
    expect(db.confirmOrderPayment).toHaveBeenCalledTimes(1);
  });
});
