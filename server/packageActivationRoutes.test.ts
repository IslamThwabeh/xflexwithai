import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', async () => {
  const actual = await vi.importActual<typeof import('../backend/db')>('../backend/db');
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    getOrderById: vi.fn(),
    createOrderActivationKeys: vi.fn(),
    updateOrderStatus: vi.fn(),
    logOrderStatusHistory: vi.fn(),
    getOrderItems: vi.fn(),
    getPackageById: vi.fn(),
    getUserById: vi.fn(),
    getUserByEmail: vi.fn(),
    createNotification: vi.fn(),
    deactivateUnusedOrderActivationKeys: vi.fn(),
    fulfillPackageEntitlements: vi.fn(),
    activatePackageKey: vi.fn(),
    activateReferral: vi.fn(),
    createPackageKey: vi.fn(),
    assignPackageKey: vi.fn(),
  };
});

vi.mock('../backend/_core/orderEmails', async () => {
  const actual = await vi.importActual<typeof import('../backend/_core/orderEmails')>('../backend/_core/orderEmails');
  return {
    ...actual,
    sendPaymentReceivedEmail: vi.fn(),
  };
});

import { appRouter } from '../backend/routers';
import * as db from '../backend/db';
import { sendPaymentReceivedEmail } from '../backend/_core/orderEmails';

const user = {
  id: 96,
  email: 'student@example.com',
  passwordHash: '',
  name: 'Student',
  phone: null,
  emailVerified: true,
  createdAt: '',
  updatedAt: '',
  lastSignedIn: '',
  isStaff: false,
};

function createCaller(currentUser = user) {
  return appRouter.createCaller({
    req: {
      headers: {
        'cf-connecting-ip': '203.0.113.10',
        'user-agent': 'Activation Route Test',
      },
      method: 'POST',
      path: '/api/trpc/test',
    },
    user: currentUser,
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe('package activation routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 11, email: user.email, name: 'Admin' } as any);
  });

  it('approves payment by issuing an assigned key without granting entitlements', async () => {
    const order = {
      id: 23,
      userId: user.id,
      status: 'awaiting_confirmation',
      isGift: false,
      giftEmail: null,
      isUpgrade: false,
      currency: 'USD',
      paymentMethod: 'bank_transfer',
      paymentProofUrl: 'https://videos.xflexacademy.com/payment-proofs/test-proof.jpg',
    } as any;
    vi.mocked(db.getOrderById).mockResolvedValue(order);
    vi.mocked(db.createOrderActivationKeys).mockResolvedValue([
      { id: 116, keyCode: 'XFLEX-TEST1-TEST2-TEST3', packageId: 1 },
    ]);
    vi.mocked(db.updateOrderStatus).mockResolvedValue({ ...order, status: 'completed' });
    vi.mocked(db.getOrderItems).mockResolvedValue([{ itemType: 'package', packageId: 1 }] as any);
    vi.mocked(db.getPackageById).mockResolvedValue({ id: 1, nameEn: 'Basic Package' } as any);
    vi.mocked(db.getUserById).mockResolvedValue(user as any);
    vi.mocked(db.getUserByEmail).mockResolvedValue(user as any);
    vi.mocked(db.createNotification).mockResolvedValue({ id: 1 } as any);

    const result = await createCaller().orders.adminUpdateStatus({ orderId: 23, status: 'completed' });

    expect(result.activationKeys).toHaveLength(1);
    expect(db.createOrderActivationKeys).toHaveBeenCalledWith({ order, actorType: 'admin', actorId: 11 });
    expect(db.fulfillPackageEntitlements).not.toHaveBeenCalled();
    expect(db.logOrderStatusHistory).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 23,
      previousStatus: 'awaiting_confirmation',
      newStatus: 'completed',
      actorType: 'admin',
      actorId: 11,
    }));
    expect(sendPaymentReceivedEmail).toHaveBeenCalledWith(user.email, expect.objectContaining({
      activationKeys: ['XFLEX-TEST1-TEST2-TEST3'],
    }));
  });

  it('passes request evidence into activation auditing', async () => {
    vi.mocked(db.activatePackageKey).mockResolvedValue({ success: false, message: 'Blocked' } as any);

    await createCaller().packageKeys.activateKey({ keyCode: 'XFLEX-TEST1-TEST2-TEST3' });

    expect(db.activatePackageKey).toHaveBeenCalledWith(
      'XFLEX-TEST1-TEST2-TEST3',
      user.email,
      user.id,
      { ipAddress: '203.0.113.10', userAgent: 'Activation Route Test' },
    );
  });

  it('requires a customer email for manually generated keys', async () => {
    await expect(createCaller().packageKeys.generateKey({ packageId: 1 } as any)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
  });

  it('rejects manual fresh keys so new sales must use an approved order', async () => {
    await expect(createCaller().packageKeys.generateKey({
      packageId: 1,
      email: user.email,
      isRenewal: false,
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.createPackageKey).not.toHaveBeenCalled();
  });

  it('rejects bank-transfer approval until payment evidence exists', async () => {
    const order = {
      id: 24,
      userId: user.id,
      status: 'pending',
      isGift: false,
      giftEmail: null,
      isUpgrade: false,
      currency: 'USD',
      paymentMethod: 'bank_transfer',
      paymentProofUrl: null,
    } as any;
    vi.mocked(db.getOrderById).mockResolvedValue(order);

    await expect(createCaller().orders.adminUpdateStatus({
      orderId: order.id,
      status: 'completed',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.createOrderActivationKeys).not.toHaveBeenCalled();
  });

  it('records the assigning actor when inventory is bound to a customer', async () => {
    vi.mocked(db.assignPackageKey).mockResolvedValue({ id: 200, email: user.email } as any);

    await createCaller().packageKeys.assignKey({ id: 200, email: user.email });

    expect(db.assignPackageKey).toHaveBeenCalledWith({
      keyId: 200,
      email: user.email,
      assignedByType: 'admin',
      assignedById: 11,
    });
  });
});
