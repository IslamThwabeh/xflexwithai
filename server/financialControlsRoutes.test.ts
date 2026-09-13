import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', async () => {
  const actual = await vi.importActual<typeof import('../backend/db')>('../backend/db');
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    resolveFinanceActor: vi.fn(),
    getFinancialControlWorkspace: vi.fn(),
    createFinancialAdjustmentDraft: vi.fn(),
    updateFinancialAdjustmentDraft: vi.fn(),
    submitFinancialAdjustment: vi.fn(),
    reviewFinancialAdjustment: vi.fn(),
    setFinancialPeriodLock: vi.fn(),
    reverseFinancialLedgerEntry: vi.fn(),
    reclassifyFinancialPaymentPurpose: vi.fn(),
  };
});

import { appRouter } from '../backend/routers';
import * as db from '../backend/db';
import type { FinanceActor } from '../backend/services/financial-expense.service';

const user = { id: 20, email: 'finance@example.com', name: 'Finance', isStaff: true } as any;
const actor = (access: FinanceActor['access']): FinanceActor => ({
  actorType: access === 'owner' ? 'admin' : 'staff',
  actorId: access === 'owner' ? 1 : 20,
  access,
});
function caller() {
  return appRouter.createCaller({
    req: { headers: {}, method: 'POST', path: '/api/trpc/financialControls' },
    user,
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe('financial control route authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    vi.mocked(db.getFinancialControlWorkspace).mockResolvedValue({ adjustments: [], locks: [], reversibleEntries: [] } as any);
    vi.mocked(db.reviewFinancialAdjustment).mockResolvedValue({ adjustment: { id: 1 }, idempotent: false } as any);
    vi.mocked(db.setFinancialPeriodLock).mockResolvedValue({ lock: null, idempotent: false } as any);
    vi.mocked(db.reverseFinancialLedgerEntry).mockResolvedValue({ reversal: { id: 2 }, replacement: null, idempotent: false } as any);
    vi.mocked(db.reclassifyFinancialPaymentPurpose).mockResolvedValue({ entries: [{ id: 2 }, { id: 3 }], idempotent: false } as any);
  });

  it.each([null, 'clerk', 'viewer'] as const)('denies workspace access to %s authority', async access => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(access ? actor(access) : null);
    await expect(caller().financialControls.workspace()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows a manager to prepare and independently review, but not lock or reverse', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('manager'));
    await expect(caller().financialControls.workspace()).resolves.toMatchObject({
      access: 'manager', canReverse: false, canManageLocks: false,
    });
    await caller().financialControls.reviewAdjustment({ adjustmentId: 1, decision: 'approved', reason: 'Reviewed independently' });
    expect(db.reviewFinancialAdjustment).toHaveBeenCalledWith({
      actor: actor('manager'), adjustmentId: 1, decision: 'approved', reason: 'Reviewed independently',
    });
    await expect(caller().financialControls.setPeriodLock({ month: '2026-07', action: 'locked', reason: 'Monthly close' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller().financialControls.reverseEntry({ entryId: 1, effectiveDate: '2026-09-11', reason: 'Correction needed' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(caller().financialControls.reclassifyPayment({ entryId: 1, nextPurpose: 'renewal', reason: 'Verified renewal' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.setFinancialPeriodLock).not.toHaveBeenCalled();
    expect(db.reverseFinancialLedgerEntry).not.toHaveBeenCalled();
  });

  it('allows only the explicit owner to lock periods and append reversals', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('owner'));
    await caller().financialControls.setPeriodLock({ month: '2026-07', action: 'locked', reason: 'Monthly close' });
    await caller().financialControls.reverseEntry({
      entryId: 1,
      effectiveDate: '2026-09-11',
      reason: 'Owner-approved correction',
      replacementAmountIlsMinor: 9000,
      replacementDescription: 'Corrected entry',
    });
    await caller().financialControls.reclassifyPayment({ entryId: 1, nextPurpose: 'renewal', reason: 'Verified renewal' });
    expect(db.setFinancialPeriodLock).toHaveBeenCalledWith({ actor: actor('owner'), month: '2026-07', action: 'locked', reason: 'Monthly close' });
    expect(db.reverseFinancialLedgerEntry).toHaveBeenCalledWith({
      actor: actor('owner'),
      entryId: 1,
      effectiveDate: '2026-09-11',
      reason: 'Owner-approved correction',
      replacementAmountIlsMinor: 9000,
      replacementDescription: 'Corrected entry',
    });
    expect(db.reclassifyFinancialPaymentPurpose).toHaveBeenCalledWith({
      actor: actor('owner'), entryId: 1, nextPurpose: 'renewal', reason: 'Verified renewal',
    });
  });
});
