import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', async () => ({
  ...await vi.importActual<typeof import('../backend/db')>('../backend/db'),
  checkUpgradeEligibility: vi.fn(), createUpgradeOrderWithItem: vi.fn(),
  getOrderById: vi.fn(), notifyStaffByEvent: vi.fn(),
  getUserTermsAcceptanceStatus: vi.fn(),
}));
vi.mock('../backend/_core/orderEmails', async () => ({
  ...await vi.importActual<typeof import('../backend/_core/orderEmails')>('../backend/_core/orderEmails'),
  sendOrderConfirmationEmail: vi.fn(), sendAdminNewOrderNotification: vi.fn(),
}));

import { appRouter } from '../backend/routers';
import * as db from '../backend/db';
import { sendOrderConfirmationEmail } from '../backend/_core/orderEmails';
import { CURRENT_TERMS_VERSION } from '../shared/legal';

const user = { id: 42, email: 'student@example.com', name: 'Student', isStaff: false };
const caller = (currentUser: typeof user | null = user) => appRouter.createCaller({
  user: currentUser,
  req: { headers: { 'cf-connecting-ip': '203.0.113.10', 'user-agent': 'Upgrade test' }, method: 'POST', path: '/api/trpc/test' },
  setCookie() {}, clearCookie() {},
} as any);
const input = () => ({ targetPackageId: 2, paymentMethod: 'bank_transfer' as const, termsAcceptedAt: '2000-01-01', termsAcceptedVersion: CURRENT_TERMS_VERSION });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.notifyStaffByEvent).mockResolvedValue(undefined);
  vi.mocked(db.getUserTermsAcceptanceStatus).mockResolvedValue({ requiresAcceptance: false } as any);
  vi.mocked(db.checkUpgradeEligibility).mockResolvedValue({
    eligible: true, currentPackageId: 1, currentPackageSlug: 'basic', currentPackageName: 'Basic',
    targetPackageId: 2, targetPackageName: 'Comprehensive', upgradePrice: 30000, pendingOrderId: null,
  } as any);
  vi.mocked(db.createUpgradeOrderWithItem).mockResolvedValue({ id: 99, userId: 42, status: 'pending' } as any);
});

describe('customer upgrade routes', () => {
  it('resolves the default target on the server for the authenticated account', async () => {
    await caller().upgrade.checkEligibility();
    expect(db.checkUpgradeEligibility).toHaveBeenCalledWith(42, undefined);
  });

  it('requires authentication and current explicit terms acceptance', async () => {
    await expect(caller(null).upgrade.createOrder(input())).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    await expect(caller().upgrade.createOrder({ ...input(), termsAcceptedVersion: 'old' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.createUpgradeOrderWithItem).not.toHaveBeenCalled();
  });

  it('rechecks ownership before persisting a server-priced order', async () => {
    vi.mocked(db.checkUpgradeEligibility).mockResolvedValue(null);
    await expect(caller().upgrade.createOrder(input())).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.createUpgradeOrderWithItem).not.toHaveBeenCalled();
  });

  it('uses the authenticated owner and server acceptance time', async () => {
    await expect(caller().upgrade.createOrder(input())).resolves.toMatchObject({ id: 99 });
    expect(db.createUpgradeOrderWithItem).toHaveBeenCalledWith(expect.objectContaining({
      userId: 42, status: 'pending', totalAmount: 30000, isUpgrade: true,
      upgradeFromPackageId: 1, transactionPurpose: 'upgrade',
      termsAcceptedAt: expect.not.stringContaining('2000'),
      termsAcceptedIpAddress: '203.0.113.10', termsAcceptedUserAgent: 'Upgrade test',
    }), 2);
  });

  it('resumes an existing order without creating or notifying again', async () => {
    vi.mocked(db.checkUpgradeEligibility).mockResolvedValue({ pendingOrderId: 88 } as any);
    vi.mocked(db.getOrderById).mockResolvedValue({ id: 88, userId: 42 } as any);
    await expect(caller().upgrade.createOrder(input())).resolves.toMatchObject({ id: 88 });
    expect(db.createUpgradeOrderWithItem).not.toHaveBeenCalled();
    expect(db.notifyStaffByEvent).not.toHaveBeenCalled();
  });

  it('returns the saved order even if email and staff notification delivery fail', async () => {
    vi.mocked(sendOrderConfirmationEmail).mockRejectedValue(new Error('Provider unavailable'));
    vi.mocked(db.notifyStaffByEvent).mockRejectedValue(new Error('Notification unavailable'));
    await expect(caller().upgrade.createOrder(input())).resolves.toMatchObject({ id: 99 });
  });
});
