import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', async () => {
  const actual = await vi.importActual<typeof import('../backend/db')>('../backend/db');
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    isFinanceOwnerAdmin: vi.fn(),
    hasAnyRole: vi.fn(),
    getOrderById: vi.fn(),
    getOrderActivationKeys: vi.fn(),
    updatePendingOrderActivationRecipient: vi.fn(),
    logAdminAction: vi.fn(),
    createOrder: vi.fn(),
    createOrderActivationKeys: vi.fn(),
    confirmOrderPayment: vi.fn(),
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
    getUnusedMatchingPackageKey: vi.fn(),
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
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: user.email, name: 'Owner Admin' } as any);
    vi.mocked(db.isFinanceOwnerAdmin).mockResolvedValue(true);
    vi.mocked(db.getUnusedMatchingPackageKey).mockResolvedValue(undefined);
  });

  it('rejects a malformed gift recipient before an order is created', async () => {
    await expect(createCaller().orders.create({
      items: [{ itemType: 'package', packageId: 1 }],
      paymentMethod: 'bank_transfer',
      isGift: true,
      giftEmail: '1',
      termsAcceptedAt: '2026-08-18T08:00:00.000Z',
      termsAcceptedVersion: 'v2',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(db.createOrder).not.toHaveBeenCalled();
  });

  it('corrects a pending non-gift recipient and records the audit details', async () => {
    const order = {
      id: 52,
      userId: user.id,
      status: 'awaiting_confirmation',
      isGift: true,
      giftEmail: '1',
    } as any;
    vi.mocked(db.getOrderById).mockResolvedValue(order);
    vi.mocked(db.getOrderActivationKeys).mockResolvedValue([] as any);
    vi.mocked(db.updatePendingOrderActivationRecipient).mockResolvedValue({
      ...order,
      isGift: false,
      giftEmail: null,
    });
    vi.mocked(db.logAdminAction).mockResolvedValue(undefined as any);

    const result = await createCaller().orders.adminCorrectActivationRecipient({
      orderId: 52,
      isGift: false,
      giftEmail: null,
      reason: 'Customer selected gift by mistake',
    });

    expect(result).toMatchObject({ id: 52, isGift: false, giftEmail: null });
    expect(db.updatePendingOrderActivationRecipient).toHaveBeenCalledWith({
      orderId: 52,
      isGift: false,
      giftEmail: null,
    });
    expect(db.logAdminAction).toHaveBeenCalledWith(1, user.id, 'correct_order_activation_recipient', expect.objectContaining({
      orderId: 52,
      actorType: 'admin',
      previous: { isGift: true, giftEmail: '1' },
      next: { isGift: false, giftEmail: null },
      reason: 'Customer selected gift by mistake',
    }));
  });

  it('refuses recipient correction after an activation key exists', async () => {
    vi.mocked(db.getOrderById).mockResolvedValue({
      id: 53,
      userId: user.id,
      status: 'paid',
      isGift: false,
      giftEmail: null,
    } as any);
    vi.mocked(db.getOrderActivationKeys).mockResolvedValue([{ id: 900 }] as any);

    await expect(createCaller().orders.adminCorrectActivationRecipient({
      orderId: 53,
      isGift: false,
      giftEmail: null,
      reason: 'Requested recipient correction',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    expect(db.updatePendingOrderActivationRecipient).not.toHaveBeenCalled();
    expect(db.logAdminAction).not.toHaveBeenCalled();
  });

  it('approves payment by issuing an assigned key without granting entitlements', async () => {
    const order = {
      id: 23,
      userId: user.id,
      status: 'awaiting_confirmation',
      isGift: false,
      giftEmail: null,
      isUpgrade: false,
      currency: 'ILS',
      totalAmount: 70000,
      paymentMethod: 'bank_transfer',
      paymentProofUrl: 'https://videos.xflexacademy.com/payment-proofs/test-proof.jpg',
      termsAcceptedAt: '2026-07-18T08:00:00.000Z',
      termsAcceptedVersion: 'v2',
    } as any;
    vi.mocked(db.getOrderById).mockResolvedValue(order);
    vi.mocked(db.createOrderActivationKeys).mockResolvedValue([
      { id: 116, keyCode: 'XFLEX-TEST1-TEST2-TEST3', packageId: 1 },
    ]);
    vi.mocked(db.confirmOrderPayment).mockResolvedValue({ confirmation: { id: 1, orderId: order.id }, idempotent: false } as any);
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
      financialPayment: {
        paidAt: '2026-07-18T08:00:00.000Z',
        baseAmountIlsMinor: 70000,
        rationale: 'Transfer matched to the receipt.',
      },
    });

    expect(result.activationKeys).toHaveLength(1);
    expect(db.createOrderActivationKeys).toHaveBeenCalledWith({
      order,
      actorType: 'admin',
      actorId: 1,
      configurations: keyConfigurations,
    });
    expect(db.confirmOrderPayment).toHaveBeenCalledWith(expect.objectContaining({
      order,
      actorType: 'admin',
      actorId: 1,
      paidAt: '2026-07-18T08:00:00.000Z',
      baseAmountIlsMinor: 70000,
    }));
    expect(db.fulfillPackageEntitlements).not.toHaveBeenCalled();
    expect(db.logOrderStatusHistory).toHaveBeenCalledWith(expect.objectContaining({
      orderId: 23,
      previousStatus: 'awaiting_confirmation',
      newStatus: 'completed',
      actorType: 'admin',
      actorId: 1,
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

  it('allows a full admin to generate an unassigned key without weakening activation gates', async () => {
    vi.mocked(db.createPackageKey).mockResolvedValue({ id: 200, keyCode: 'XFLEX-UNASSIGNED' } as any);

    await createCaller().packageKeys.generateKey({
      packageId: 1,
      keyKind: 'fresh',
      purpose: 'commercial',
    });

    expect(db.createPackageKey).toHaveBeenCalledWith(expect.objectContaining({
      packageId: 1,
      email: null,
      assignedAt: null,
      assignedByType: null,
      assignedById: null,
      activationPolicy: 'order_required',
    }));
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
      authorizedById: 1,
    }));
  });

  it('refuses to issue a duplicate unused key for the same customer, package, and type', async () => {
    vi.mocked(db.getUnusedMatchingPackageKey).mockResolvedValue({ id: 145, orderId: 55 } as any);

    await expect(createCaller().packageKeys.generateKey({
      packageId: 1,
      email: user.email,
      keyKind: 'fresh',
      purpose: 'commercial',
    })).rejects.toMatchObject({ code: 'CONFLICT' });

    expect(db.createPackageKey).not.toHaveBeenCalled();
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
      authorizedById: 1,
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
      currency: 'ILS',
      totalAmount: 70000,
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
      financialPayment: {
        paidAt: '2026-07-18T08:00:00.000Z',
        baseAmountIlsMinor: 70000,
        rationale: 'Transfer matched to the receipt.',
      },
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.createOrderActivationKeys).not.toHaveBeenCalled();
  });

  it('accepts a legacy USD-marked order as the canonical ILS amount without exchange-rate input', async () => {
    const order = {
      id: 29,
      userId: user.id,
      status: 'awaiting_confirmation',
      isGift: false,
      giftEmail: null,
      isUpgrade: false,
      currency: 'USD',
      totalAmount: 20000,
      paymentMethod: 'bank_transfer',
      paymentProofUrl: 'https://videos.xflexacademy.com/payment-proofs/test-proof.jpg',
      termsAcceptedAt: '2026-07-18T08:00:00.000Z',
      termsAcceptedVersion: 'v2',
    } as any;
    vi.mocked(db.getOrderById).mockResolvedValue(order);
    vi.mocked(db.getOrderItems).mockResolvedValue([{ itemType: 'package', packageId: 1 }] as any);
    vi.mocked(db.getPackageById).mockResolvedValue({ id: 1, slug: 'basic', nameEn: 'Basic Package' } as any);
    vi.mocked(db.createOrderActivationKeys).mockResolvedValue([
      { id: 290, keyCode: 'XFLEX-LEGACY-ILS-TEST', packageId: 1 },
    ]);
    vi.mocked(db.confirmOrderPayment).mockResolvedValue({ confirmation: { id: 29, orderId: order.id }, idempotent: false } as any);

    await expect(createCaller().orders.adminUpdateStatus({
      orderId: order.id,
      status: 'completed',
      keyConfigurations: [{ packageId: 1, entitlementDays: 30 }],
      financialPayment: {
        paidAt: '2026-07-18T08:00:00.000Z',
        baseAmountIlsMinor: 70000,
        rationale: 'Transfer matched to the receipt.',
      },
    })).resolves.toMatchObject({ activationKeys: [{ id: 290 }] });

    expect(db.createOrderActivationKeys).toHaveBeenCalledOnce();
    expect(db.confirmOrderPayment).toHaveBeenCalledWith(expect.objectContaining({
      order,
      baseAmountIlsMinor: 70000,
    }));
  });

  it('does not let a key manager with the finance_clerk role recognize cash', async () => {
    const staffUser = { ...user, id: 4, email: 'keys@example.com', isStaff: true };
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    vi.mocked(db.hasAnyRole).mockImplementation(async (_userId, roles) => (
      roles.includes('key_manager') || roles.includes('finance_clerk')
    ));
    vi.mocked(db.getOrderById).mockResolvedValue({
      id: 31, userId: user.id, status: 'awaiting_confirmation', totalAmount: 12500,
      currency: 'ILS', paymentMethod: 'bank_transfer', paymentProofUrl: 'https://videos.xflexacademy.com/payment-proofs/31.jpg',
      termsAcceptedAt: '2026-07-18T08:00:00.000Z', termsAcceptedVersion: 'v2',
    } as any);

    await expect(createCaller(staffUser).orders.adminUpdateStatus({
      orderId: 31,
      status: 'completed',
      keyConfigurations: [{ packageId: 1, entitlementDays: 30 }],
      financialPayment: {
        paidAt: '2026-07-18T08:00:00.000Z', baseAmountIlsMinor: 12500,
        rationale: 'Transfer matched to the receipt.',
      },
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.createOrderActivationKeys).not.toHaveBeenCalled();
    expect(db.confirmOrderPayment).not.toHaveBeenCalled();
  });

  it('does not treat a generic admin as the finance owner', async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 2, email: user.email, name: 'Generic Admin' } as any);
    vi.mocked(db.isFinanceOwnerAdmin).mockResolvedValue(false);
    vi.mocked(db.hasAnyRole).mockResolvedValue(false);
    vi.mocked(db.getOrderById).mockResolvedValue({
      id: 33, userId: user.id, status: 'awaiting_confirmation', totalAmount: 70000,
      currency: 'ILS', paymentMethod: 'bank_transfer', paymentProofUrl: 'https://videos.xflexacademy.com/payment-proofs/33.jpg',
      termsAcceptedAt: '2026-07-18T08:00:00.000Z', termsAcceptedVersion: 'v2',
    } as any);

    await expect(createCaller().orders.adminUpdateStatus({
      orderId: 33,
      status: 'completed',
      keyConfigurations: [{ packageId: 1, entitlementDays: 30 }],
      financialPayment: {
        paidAt: '2026-07-18T08:00:00.000Z', baseAmountIlsMinor: 70000,
        rationale: 'Transfer matched to the receipt.',
      },
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(db.createOrderActivationKeys).not.toHaveBeenCalled();
    expect(db.confirmOrderPayment).not.toHaveBeenCalled();
  });

  it('lets a finance manager confirm payment without granting key-manager status powers', async () => {
    const financeManager = { ...user, id: 8, email: 'finance@example.com', isStaff: true };
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    vi.mocked(db.hasAnyRole).mockImplementation(async (_userId, roles) => roles.includes('finance_manager'));
    const order = {
      id: 34, userId: user.id, status: 'awaiting_confirmation', totalAmount: 70000,
      currency: 'ILS', isUpgrade: false, paymentMethod: 'bank_transfer',
      paymentProofUrl: 'https://videos.xflexacademy.com/payment-proofs/34.jpg',
      termsAcceptedAt: '2026-07-18T08:00:00.000Z', termsAcceptedVersion: 'v2',
    } as any;
    vi.mocked(db.getOrderById).mockResolvedValue(order);
    vi.mocked(db.getOrderItems).mockResolvedValue([{ itemType: 'package', packageId: 1 }] as any);
    vi.mocked(db.getPackageById).mockResolvedValue({ id: 1, nameEn: 'Basic Package' } as any);
    vi.mocked(db.createOrderActivationKeys).mockResolvedValue([{ id: 340, keyCode: 'XFLEX-FINANCE-MANAGER', packageId: 1 }]);
    vi.mocked(db.confirmOrderPayment).mockResolvedValue({ confirmation: { id: 34 }, idempotent: false } as any);
    vi.mocked(db.getUserById).mockResolvedValue(user as any);
    vi.mocked(db.getUserByEmail).mockResolvedValue(user as any);

    await expect(createCaller(financeManager).orders.adminUpdateStatus({
      orderId: order.id,
      status: 'completed',
      keyConfigurations: [{ packageId: 1, entitlementDays: 30 }],
      financialPayment: {
        paidAt: '2026-07-18T08:00:00.000Z', baseAmountIlsMinor: 70000,
        rationale: 'Transfer matched to the receipt.',
      },
    })).resolves.toMatchObject({ activationKeys: [{ id: 340 }] });

    expect(db.confirmOrderPayment).toHaveBeenCalledWith(expect.objectContaining({
      actorType: 'staff',
      actorId: financeManager.id,
    }));

    await expect(createCaller(financeManager).orders.adminUpdateStatus({
      orderId: order.id,
      status: 'cancelled',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not re-recognize a legacy completed order as a new cash event', async () => {
    vi.mocked(db.getOrderById).mockResolvedValue({ id: 32, userId: user.id, status: 'completed' } as any);
    await expect(createCaller().orders.adminUpdateStatus({
      orderId: 32,
      status: 'completed',
      financialPayment: {
        paidAt: '2026-07-18T08:00:00.000Z', baseAmountIlsMinor: 12500,
        rationale: 'Transfer matched to the receipt.',
      },
    })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.confirmOrderPayment).not.toHaveBeenCalled();
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
      actorId: 1,
    });
  });

  it('records the assigning actor when inventory is bound to a customer', async () => {
    vi.mocked(db.assignPackageKey).mockResolvedValue({ id: 200, email: user.email } as any);

    await createCaller().packageKeys.assignKey({ id: 200, email: user.email });

    expect(db.assignPackageKey).toHaveBeenCalledWith({
      keyId: 200,
      email: user.email,
      assignedByType: 'admin',
      assignedById: 1,
    });
  });
});
