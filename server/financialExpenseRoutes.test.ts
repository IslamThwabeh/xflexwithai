import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', async () => {
  const actual = await vi.importActual<typeof import('../backend/db')>('../backend/db');
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    resolveFinanceActor: vi.fn(),
    listFinancialExpenses: vi.fn(),
    createFinancialExpenseDraft: vi.fn(),
    updateFinancialExpenseDraft: vi.fn(),
    submitFinancialExpense: vi.fn(),
    reviewFinancialExpense: vi.fn(),
  };
});

import { appRouter } from '../backend/routers';
import * as db from '../backend/db';
import type { FinanceActor } from '../backend/services/financial-expense.service';

const user = {
  id: 20,
  email: 'finance@example.com',
  name: 'Finance',
  isStaff: true,
} as any;

function caller() {
  return appRouter.createCaller({
    req: { headers: {}, method: 'POST', path: '/api/trpc/test' },
    user,
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

const actor = (access: FinanceActor['access']): FinanceActor => ({ actorType: 'staff', actorId: 20, access });

describe('financial expense route authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    vi.mocked(db.listFinancialExpenses).mockResolvedValue([] as any);
    vi.mocked(db.createFinancialExpenseDraft).mockResolvedValue({ id: 1 } as any);
    vi.mocked(db.reviewFinancialExpense).mockResolvedValue({ expense: { id: 1 }, idempotent: false } as any);
  });

  it('denies generic admins and read-only viewers from the raw expense workflow', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(null);
    await expect(caller().financeExpenses.access()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('viewer'));
    await expect(caller().financeExpenses.list({ limit: 10 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('allows a clerk to create and list work but not review payments', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('clerk'));
    await expect(caller().financeExpenses.createDraft({
      paidAt: '2026-09-10',
      category: 'other',
      amountMinor: 1000,
      paymentMethod: 'cash',
    })).resolves.toEqual({ id: 1 });
    await expect(caller().financeExpenses.review({
      expenseId: 1,
      decision: 'approved',
      reason: 'Receipt verified',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.reviewFinancialExpense).not.toHaveBeenCalled();
  });

  it('allows an owner or manager to send an independent review decision', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('manager'));
    await caller().financeExpenses.review({ expenseId: 1, decision: 'approved', reason: 'Receipt verified' });
    expect(db.reviewFinancialExpense).toHaveBeenCalledWith({
      actor: actor('manager'),
      expenseId: 1,
      decision: 'approved',
      reason: 'Receipt verified',
    });
  });
});
