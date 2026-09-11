import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', async () => {
  const actual = await vi.importActual<typeof import('../backend/db')>('../backend/db');
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    resolveFinanceActor: vi.fn(),
    previewFinancialReconciliation: vi.fn(),
    getFinancialReconciliationDashboard: vi.fn(),
    prepareFinancialReconciliationQueue: vi.fn(),
    updateFinancialReconciliationDraft: vi.fn(),
    resolveFinancialReconciliationItem: vi.fn(),
  };
});

import { appRouter } from '../backend/routers';
import * as db from '../backend/db';
import type { FinanceActor } from '../backend/services/financial-expense.service';

const user = { id: 20, email: 'finance@example.com', name: 'Finance', isStaff: true } as any;
const actor = (access: FinanceActor['access']): FinanceActor => ({ actorType: access === 'owner' ? 'admin' : 'staff', actorId: access === 'owner' ? 1 : 20, access });
const caller = () => appRouter.createCaller({ req: { headers: {}, method: 'POST', path: '/api/trpc/financialReconciliation' }, user, setCookie: () => {}, clearCookie: () => {} } as any);

describe('financial reconciliation route authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    vi.mocked(db.previewFinancialReconciliation).mockResolvedValue({ readOnly: true, counts: {}, totalCandidates: 0, safeToMaterialize: true, perTypeSafetyLimit: 250, generatedAt: '' } as any);
    vi.mocked(db.getFinancialReconciliationDashboard).mockResolvedValue({ items: [], counts: {}, recognized: {} } as any);
    vi.mocked(db.prepareFinancialReconciliationQueue).mockResolvedValue({ itemsAdded: 0 } as any);
    vi.mocked(db.updateFinancialReconciliationDraft).mockResolvedValue({ id: 1 } as any);
    vi.mocked(db.resolveFinancialReconciliationItem).mockResolvedValue({ item: { id: 1 }, ledgerEntry: null, idempotent: false } as any);
  });

  it.each([null, 'clerk', 'viewer'] as const)('denies reconciliation access to %s authority', async access => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(access ? actor(access) : null);
    await expect(caller().financialReconciliation.preview()).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows a manager to manage reconciliation drafts but denies final decisions', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('manager'));
    await expect(caller().financialReconciliation.preview()).resolves.toMatchObject({ access: 'manager', canMaterialize: true, canResolve: false });
    await expect(caller().financialReconciliation.workspace({ status: 'unresolved' })).resolves.toMatchObject({ access: 'manager', canManageDrafts: true });
    await expect(caller().financialReconciliation.materializeQueue()).resolves.toBeTruthy();
    await expect(caller().financialReconciliation.updateDraft({ itemId: 1, proposedTreatment: 'requires_owner_evidence', proposedAmountIlsMinor: null, notes: 'Need owner statement' })).resolves.toBeTruthy();
    await expect(caller().financialReconciliation.resolveItem({ itemId: 1, decision: 'excluded', reason: 'No evidence' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows the explicit owner to build and resolve the queue', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('owner'));
    await caller().financialReconciliation.materializeQueue();
    await caller().financialReconciliation.resolveItem({ itemId: 1, decision: 'approved_adjustment', reason: 'Statement verified', effectiveDate: '2026-09-01', amountIlsMinor: 10000 });
    expect(db.prepareFinancialReconciliationQueue).toHaveBeenCalledWith(actor('owner'));
    expect(db.resolveFinancialReconciliationItem).toHaveBeenCalledWith({ actor: actor('owner'), itemId: 1, decision: 'approved_adjustment', reason: 'Statement verified', effectiveDate: '2026-09-01', amountIlsMinor: 10000 });
  });
});
