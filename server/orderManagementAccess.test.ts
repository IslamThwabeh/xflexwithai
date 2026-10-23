import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLE_PAGE_ACCESS } from '../shared/const';

vi.mock('../backend/db', async () => ({
  ...await vi.importActual<typeof import('../backend/db')>('../backend/db'),
  getAdminByEmail: vi.fn(), hasAnyRole: vi.fn(), getAllOrders: vi.fn(),
  getOrderPackageConfigurationSummaries: vi.fn(), getOrderById: vi.fn(),
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

  it('denies unrelated staff order access', async () => {
    roles = ['analyst'];
    await expect(caller().orders.adminList()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.getAllOrders).not.toHaveBeenCalled();
  });

  it.each(['completed', 'cancelled'] as const)('does not let support change orders to %s', async status => {
    await expect(caller().orders.adminUpdateStatus({ orderId: 135, status })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.updateOrderStatus).not.toHaveBeenCalled();
    expect(db.confirmOrderPayment).not.toHaveBeenCalled();
    expect(db.createOrderActivationKeys).not.toHaveBeenCalled();
  });
});
