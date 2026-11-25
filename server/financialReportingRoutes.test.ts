import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../backend/db', async () => {
  const actual = await vi.importActual<typeof import('../backend/db')>('../backend/db');
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    resolveFinanceActor: vi.fn(),
    getFinancialManagementDashboard: vi.fn(),
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
    req: { headers: {}, method: 'GET', path: '/api/trpc/financialReports.dashboard' },
    user,
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

const actor = (access: FinanceActor['access']): FinanceActor => ({ actorType: 'staff', actorId: 20, access });
const dashboardResult = {
  basis: 'cash' as const,
  currency: 'ILS' as const,
  from: '2026-01-01',
  to: '2026-12-31',
  grouping: 'month' as const,
  generatedAt: '2026-09-11T00:00:00.000Z',
  periods: [],
  totals: { confirmedIncomeMinor: 0, newSalesMinor: 0, renewalsMinor: 0, upgradesMinor: 0, refundsMinor: 0, netRevenueMinor: 0, expensesMinor: 0, netAdjustmentsMinor: 0, operatingProfitLossMinor: 0 },
  categories: [],
  ledger: [],
  ledgerTruncated: false,
};

describe('financial reporting route authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null as any);
    vi.mocked(db.getFinancialManagementDashboard).mockResolvedValue(dashboardResult as any);
  });

  it('denies generic admins and finance clerks', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(null);
    await expect(caller().financialReports.dashboard({
      from: '2026-01-01', to: '2026-12-31', grouping: 'month',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });

    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('clerk'));
    await expect(caller().financialReports.dashboard({
      from: '2026-01-01', to: '2026-12-31', grouping: 'month',
    })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.getFinancialManagementDashboard).not.toHaveBeenCalled();
  });

  it('allows viewers to see approved summary reports without ledger rows', async () => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('viewer'));
    const result = await caller().financialReports.dashboard({
      from: '2026-01-01', to: '2026-12-31', grouping: 'year',
    });
    expect(result.access).toBe('viewer');
    expect(result.canViewLedger).toBe(false);
    expect(db.getFinancialManagementDashboard).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-12-31',
      grouping: 'year',
      includeLedger: false,
      ledgerLimit: 100,
    });
  });

  it.each(['owner', 'manager'] as const)('allows %s access with bounded ledger detail', async access => {
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor(access));
    const result = await caller().financialReports.dashboard({
      from: '2026-07-01', to: '2026-07-31', grouping: 'month',
    });
    expect(result.canViewLedger).toBe(true);
    expect(db.getFinancialManagementDashboard).toHaveBeenCalledWith(expect.objectContaining({
      includeLedger: true,
      ledgerLimit: 100,
    }));
  });

  it('partitions the new summary by verified identity and access without returning ledger details',async()=>{
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('viewer'));
    const input={from:'2026-11-01',to:'2026-11-25',grouping:'month' as const,viewerId:20,access:'viewer' as const};
    await expect(caller().financialReports.summary({...input,viewerId:21})).rejects.toMatchObject({code:'FORBIDDEN'});
    await expect(caller().financialReports.summary({...input,access:'owner'})).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(db.getFinancialManagementDashboard).not.toHaveBeenCalled();
    const result=await caller().financialReports.summary(input);
    expect(result).not.toHaveProperty('ledger');expect(result).not.toHaveProperty('categories');
    expect(db.getFinancialManagementDashboard).toHaveBeenCalledWith(expect.objectContaining({includeLedger:false,from:'2026-11-01'}));
  });
  it('reports own access only and never grants report access to a clerk',async()=>{
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('clerk'));
    expect(await caller().financialReports.access({viewerId:20})).toEqual({viewerId:20,access:null});
    await expect(caller().financialReports.access({viewerId:21})).rejects.toMatchObject({code:'FORBIDDEN'});
  });
  it('rejects stale role keys on the detailed report before reading money',async()=>{
    vi.mocked(db.resolveFinanceActor).mockResolvedValue(actor('viewer'));
    await expect(caller().financialReports.dashboard({from:'2026-11-01',to:'2026-11-25',grouping:'month',viewerId:20,access:'owner'})).rejects.toMatchObject({code:'FORBIDDEN'});
    expect(db.getFinancialManagementDashboard).not.toHaveBeenCalled();
  });
});
