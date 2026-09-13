import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', async () => {
  const actual = await vi.importActual<typeof import('../backend/db')>('../backend/db');
  return {
    ...actual,
    getAdminByEmail: vi.fn(), resolveFinanceActor: vi.fn(), getUserRoles: vi.fn(),
    createLegacyCustomerMigrationDraft: vi.fn(), listLegacyCustomerMigrations: vi.fn(),
    reviewLegacyCustomerMigration: vi.fn(), getPaidRenewalQuote: vi.fn(), createPaidRenewalOrder: vi.fn(),
  };
});

import { appRouter } from '../backend/routers';
import * as db from '../backend/db';

const user = { id: 20, email: 'staff@example.com', name: 'Staff', isStaff: true } as any;
const caller = () => appRouter.createCaller({ req: { headers: {}, method: 'POST', path: '/api/trpc/test' }, user, setCookie: () => {}, clearCookie: () => {} } as any);

describe('legacy migration and paid-renewal route controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    vi.mocked(db.getUserRoles).mockResolvedValue([] as any);
    vi.mocked(db.listLegacyCustomerMigrations).mockResolvedValue([] as any);
    vi.mocked(db.createLegacyCustomerMigrationDraft).mockResolvedValue({ id: 1, financialImpact: 'none' } as any);
    vi.mocked(db.reviewLegacyCustomerMigration).mockResolvedValue({ id: 1, status: 'approved' } as any);
  });

  it('denies finance viewers and unrelated staff from legacy evidence', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue({ actorType: 'staff', actorId: 20, access: 'viewer' });
    await expect(caller().legacyMigrations.access()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets a clerk prepare only creator-scoped zero-impact migration work', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue({ actorType: 'staff', actorId: 20, access: 'clerk' });
    await caller().legacyMigrations.createDraft({ userId: 7, packageId: 2, reason: 'Verified historic receipt' });
    expect(db.createLegacyCustomerMigrationDraft).toHaveBeenCalledWith({
      actor: { actorType: 'staff', actorId: 20, canReviewAll: false },
      values: expect.objectContaining({ userId: 7, packageId: 2 }),
    });
  });

  it('lets a finance manager see the review queue but not approve migration', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue({ actorType: 'staff', actorId: 20, access: 'manager' });
    await caller().legacyMigrations.list({ status: 'pending_approval', limit: 100 });
    expect(db.listLegacyCustomerMigrations).toHaveBeenCalledWith(expect.objectContaining({ actor: expect.objectContaining({ canReviewAll: true }) }));
    await expect(caller().legacyMigrations.review({ migrationId: 1, decision: 'approved', reason: 'Receipt is verified' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('requires the explicit finance-owner admin for final migration approval', async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: user.email } as any);
    vi.mocked(db.resolveFinanceActor).mockResolvedValue({ actorType: 'admin', actorId: 1, access: 'owner' });
    await caller().legacyMigrations.review({ migrationId: 1, decision: 'approved', reason: 'Receipt is verified' });
    expect(db.reviewLegacyCustomerMigration).toHaveBeenCalledWith({ owner: { actorType: 'admin', actorId: 1, access: 'owner' }, migrationId: 1, decision: 'approved', reason: 'Receipt is verified' });
  });

  it('creates a real renewal order while leaving revenue recognition to later payment confirmation', async () => {
    vi.mocked(db.createPaidRenewalOrder).mockResolvedValue({ order: { id: 55, transactionPurpose: 'renewal', status: 'pending' }, detail: {}, idempotent: false } as any);
    const result = await caller().renewals.createOrder({ paymentMethod: 'bank_transfer', termsAcceptedAt: '2026-09-12T00:00:00.000Z', termsAcceptedVersion: 'v2' });
    expect(result.order).toMatchObject({ transactionPurpose: 'renewal', status: 'pending' });
    expect(db.createPaidRenewalOrder).toHaveBeenCalledWith(expect.objectContaining({ userId: 20, paymentMethod: 'bank_transfer', termsAcceptedVersion: 'v2' }));
  });
});
