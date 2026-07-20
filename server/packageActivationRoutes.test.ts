import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', async () => {
  const actual = await vi.importActual<typeof import('../backend/db')>('../backend/db');
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    hasAnyRole: vi.fn(),
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
    updateUnusedPackageKeyConfiguration: vi.fn(),
    getPackageKeyConfigurationHistory: vi.fn(),
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
      termsAcceptedAt: '2026-07-18T08:00:00.000Z',
      termsAcceptedVersion: 'v2',
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

    const keyConfigurations = [{
      packageId: 1,
      entitlementDays: 45,
      expiresAt: '2026-08-18T23:59:59.999Z',
      configurationNotes: 'Special 45-day entitlement',
    }];
    const result = await createCaller().orders.adminUpdateStatus({
      orderId: 23,
      status: 'completed',
      keyConfigurations,
    });

    expect(result.activationKeys).toHaveLength(1);
    expect(db.createOrderActivationKeys).toHaveBeenCalledWith({
      order,
      actorType: 'admin',
      actorId: 11,
      configurations: keyConfigurations,
    });
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

  it('allows a full admin to prepare a commercial fresh key that still requires an order', async () => {
    vi.mocked(db.createPackageKey).mockResolvedValue({ id: 201, keyCode: 'XFLEX-ADMIN-FRESH' } as any);

    await createCaller().packageKeys.generateKey({
      packageId: 1,
      email: user.email,
      keyKind: 'fresh',
      purpose: 'commercial',
    });

    expect(db.createPackageKey).toHaveBeenCalledWith(expect.objectContaining({
      packageId: 1,
      email: user.email,
      isRenewal: false,
      isUpgrade: false,
      issuancePurpose: 'commercial',
      activationPolicy: 'order_required',
      authorizedByType: 'admin',
      authorizedById: 11,
    }));
  });

  it('allows a full admin to authorize an internal employee renewal without an order', async () => {
    vi.mocked(db.createPackageKey).mockResolvedValue({ id: 202, keyCode: 'XFLEX-EMPLOYEE-RENEWAL' } as any);

    await createCaller().packageKeys.generateKey({
      packageId: 2,
      email: 'batoulbahnag2005@gmail.com',
      keyKind: 'renewal',
      purpose: 'internal',
      authorizationReason: 'Employee package renewal for Batool',
      entitlementDays: 30,
    });

    expect(db.createPackageKey).toHaveBeenCalledWith(expect.objectContaining({
      packageId: 2,
      isRenewal: true,
      isUpgrade: false,
      issuancePurpose: 'internal',
      activationPolicy: 'internal_authorized',
      authorizationReason: 'Employee package renewal for Batool',
      authorizedByType: 'admin',
      authorizedById: 11,
    }));
  });

  it('keeps staff Key Managers renewal-only', async () => {
    const staffUser = { ...user, id: 4, email: 'keys@example.com', isStaff: true };
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    vi.mocked(db.hasAnyRole).mockResolvedValue(true);

    await expect(createCaller(staffUser).packageKeys.generateKey({
      packageId: 1,
      email: user.email,
      keyKind: 'fresh',
      purpose: 'commercial',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.createPackageKey).not.toHaveBeenCalled();
  });

  it('requires an authorization reason for internal and compensation keys', async () => {
    await expect(createCaller().packageKeys.generateKey({
      packageId: 2,
      email: user.email,
      keyKind: 'renewal',
      purpose: 'internal',
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
      termsAcceptedAt: '2026-07-18T08:00:00.000Z',
      termsAcceptedVersion: 'v2',
    } as any;
    vi.mocked(db.getOrderById).mockResolvedValue(order);

    await expect(createCaller().orders.adminUpdateStatus({
      orderId: order.id,
      status: 'completed',
      keyConfigurations: [{ packageId: 1, entitlementDays: 30 }],
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.createOrderActivationKeys).not.toHaveBeenCalled();
  });

  it('requires the key manager to select a duration before issuing an order key', async () => {
    vi.mocked(db.getOrderById).mockResolvedValue({
      id: 25,
      userId: user.id,
      status: 'awaiting_confirmation',
      termsAcceptedAt: '2026-07-18T08:00:00.000Z',
      termsAcceptedVersion: 'v2',
      paymentMethod: 'bank_transfer',
      paymentProofUrl: 'https://videos.xflexacademy.com/payment-proofs/test-proof.jpg',
    } as any);

    await expect(createCaller().orders.adminUpdateStatus({
      orderId: 25,
      status: 'completed',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.createOrderActivationKeys).not.toHaveBeenCalled();
  });

  it('allows key managers to edit only the safe configuration fields through the audited route', async () => {
    vi.mocked(db.updateUnusedPackageKeyConfiguration).mockResolvedValue({ id: 116, entitlementDays: 60 } as any);

    await createCaller().packageKeys.updateUnusedKey({
      id: 116,
      entitlementDays: 60,
      expiresAt: null,
      configurationNotes: 'Extended before activation',
    });

    expect(db.updateUnusedPackageKeyConfiguration).toHaveBeenCalledWith({
      keyId: 116,
      entitlementDays: 60,
      expiresAt: null,
      configurationNotes: 'Extended before activation',
      actorType: 'admin',
      actorId: 11,
    });
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
