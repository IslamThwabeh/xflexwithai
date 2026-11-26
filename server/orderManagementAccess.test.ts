import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE_PAGE_ACCESS } from '../shared/const';

vi.mock('../backend/db', async () => ({
  ...await vi.importActual<typeof import('../backend/db')>('../backend/db'),
  getAdminByEmail: vi.fn(), hasAnyRole: vi.fn(), getAllOrders: vi.fn(),
  getOrderPackageConfigurationSummaries: vi.fn(), getOrderById: vi.fn(),
  getOrderKeyFulfillmentRows: vi.fn(), getRelatedCompletedOrdersForReview: vi.fn(),
  updateOrderStatus: vi.fn(), confirmOrderPayment: vi.fn(), createOrderActivationKeys: vi.fn(),
}));
import { appRouter } from '../backend/routers';
import * as db from '../backend/db';

let roles: string[];
const caller = () => appRouter.createCaller({
  user: { id: 130, email: 'support@example.test', name: 'Support', isStaff: true },
  req: { headers: {}, method: 'GET', path: '/api/trpc/orders.adminList' },
  setCookie() {}, clearCookie() {},
} as any);

beforeEach(() => {
  vi.resetAllMocks();
  roles = ['support'];
  vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
  vi.mocked(db.hasAnyRole).mockImplementation(async (_id, requested) => requested.some(role => roles.includes(role)));
  vi.mocked(db.getOrderPackageConfigurationSummaries).mockResolvedValue([] as any);
  vi.mocked(db.getOrderKeyFulfillmentRows).mockResolvedValue([]);
  vi.mocked(db.getAllOrders).mockResolvedValue([{
    id: 135, userId: 42, status: 'awaiting_confirmation', totalAmount: 200000, currency: 'ILS',
    subtotal: 172414, vatAmount: 27586, discountAmount: 0,
    termsAcceptedIpAddress: '203.0.113.10', termsAcceptedUserAgent: 'Private device details',
    paymentProofUrl: null,
  }] as any);
});

describe('read-only support order access', () => {
  it('allows support to find the recorded order and preserves its actual amount', async () => {
    expect(ROLE_PAGE_ACCESS.support).toContain('/admin/orders');
    const orders = await caller().orders.adminList();
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ id: 135, displayTotalIls: 2000, paymentProofUrl: null, termsAcceptedIpAddress: null, termsAcceptedUserAgent: null });
  });

  it('preserves request evidence for key managers', async () => {
    roles = ['key_manager'];
    const orders = await caller().orders.adminList({ status: 'awaiting_confirmation' });
    expect(db.getAllOrders).toHaveBeenCalledWith('awaiting_confirmation');
    expect(orders[0].termsAcceptedIpAddress).toBe('203.0.113.10');
  });

  it('passes the outstanding queue through the same protected, privacy-preserving read', async () => {
    const orders = await caller().orders.adminList({ status: 'outstanding' });
    expect(db.getAllOrders).toHaveBeenCalledWith('outstanding');
    expect(orders[0]).toMatchObject({ id: 135, termsAcceptedIpAddress: null, termsAcceptedUserAgent: null });
    expect(db.updateOrderStatus).not.toHaveBeenCalled();
    expect(db.confirmOrderPayment).not.toHaveBeenCalled();
  });

  it('loads a bounded related-order projection for support without payment or browser evidence', async () => {
    vi.mocked(db.getRelatedCompletedOrdersForReview).mockResolvedValue({ hasMore: true, orders: [{ id: 194, userId: 42, createdAt: '2026-11-23 10:00:00', completedAt: '2026-11-23 12:00:00', transactionPurpose: 'new_sale', isGift: false, giftEmail: null, paymentProofUrl: 'private-proof', termsAcceptedUserAgent: 'private-device' }] } as any);
    const result = await caller().orders.adminRelatedCompleted({ orderId: 201 });
    expect(db.getRelatedCompletedOrdersForReview).toHaveBeenCalledWith(201);
    expect(db.getOrderPackageConfigurationSummaries).toHaveBeenCalledWith([194]);
    expect(result).toEqual({ hasMore: true, orders: [{ id: 194, createdAt: '2026-11-23 10:00:00', completedAt: '2026-11-23 12:00:00', transactionPurpose: 'new_sale', isGift: false, giftEmail: null, packages: [] }] });
  });

  it('denies unrelated staff the related-order context and returns missing records explicitly', async () => {
    roles = ['analyst'];
    await expect(caller().orders.adminRelatedCompleted({ orderId: 201 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.getRelatedCompletedOrdersForReview).not.toHaveBeenCalled();
    roles = ['support'];
    vi.mocked(db.getRelatedCompletedOrdersForReview).mockResolvedValue(null);
    await expect(caller().orders.adminRelatedCompleted({ orderId: 999 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('does not expose related orders to customers or anonymous requests', async () => {
    roles = [];
    const context = { req: { headers: {}, method: 'GET' }, setCookie() {}, clearCookie() {} };
    const student = appRouter.createCaller({ ...context, user: { id: 42, email: 'synthetic@example.test', isStaff: false } } as any);
    const anonymous = appRouter.createCaller({ ...context, user: null } as any);
    await expect(student.orders.adminRelatedCompleted({ orderId: 201 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(anonymous.orders.adminRelatedCompleted({ orderId: 201 })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(db.getRelatedCompletedOrdersForReview).not.toHaveBeenCalled();
  });

  it('denies unrelated staff order access', async () => {
    roles = ['analyst'];
    await expect(caller().orders.adminList()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.getAllOrders).not.toHaveBeenCalled();
  });

  it('keeps support-only staff from viewing credentials or sending key emails', async () => {
    await expect(caller().orders.adminKeyDelivery({ orderId: 135 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller().orders.adminResendKey({ orderId: 135 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller().orders.adminRecoverKeyDelivery({ orderId: 135 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.getOrderById).not.toHaveBeenCalled();
  });

  it.each(['completed', 'cancelled'] as const)('does not let support change orders to %s', async status => {
    await expect(caller().orders.adminUpdateStatus({ orderId: 135, status })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.updateOrderStatus).not.toHaveBeenCalled();
    expect(db.confirmOrderPayment).not.toHaveBeenCalled();
    expect(db.createOrderActivationKeys).not.toHaveBeenCalled();
  });
  it('does not let support retire paid orders or read parser diagnostics', async () => {
    await expect(caller().orders.adminRetireLiveOrder({ orderId: 154, replacementOrderId: 166, paidIlsMinor: 200000, reason: 'Customer changed packages' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller().recommendations.parserDiagnostics()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
