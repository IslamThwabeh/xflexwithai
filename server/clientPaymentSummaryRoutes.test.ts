import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../backend/db', async () => ({
  ...await vi.importActual<typeof import('../backend/db')>('../backend/db'),
  getAdminByEmail: vi.fn(), hasAnyRole: vi.fn(), getUserRoles: vi.fn(), logStaffAction: vi.fn(),
  resolveFinanceActor: vi.fn(), getSubscribersReport: vi.fn(), getAdminClientProfile: vi.fn(),
}));
import { appRouter } from '../backend/routers';
import * as db from '../backend/db';
import { unavailableClientPaymentSummary } from '../shared/clientPaymentSummary';

let roles: string[] = [];
const row = { id: 50, name: 'Client', totalSpentIls: 700, grossSpentIls: 700, refundedIls: 0,
  paymentSummary: unavailableClientPaymentSummary() };
const caller = (user: any = { id: 9, email: 'staff@example.com', isStaff: true }) => appRouter.createCaller({
  req: { headers: {}, method: 'GET', path: '/api/trpc/reports.subscribers' }, user,
  setCookie: () => {}, clearCookie: () => {},
} as any);
beforeEach(() => {
  vi.clearAllMocks(); roles = [];
  vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
  vi.mocked(db.hasAnyRole).mockImplementation(async (_id, requested) => requested.some(role => roles.includes(role)));
  vi.mocked(db.getUserRoles).mockImplementation(async () => roles.map(role => ({ role })) as any);
  vi.mocked(db.resolveFinanceActor).mockResolvedValue(null);
  vi.mocked(db.getSubscribersReport).mockResolvedValue([row]);
  vi.mocked(db.getAdminClientProfile).mockResolvedValue({ paymentSummary: row.paymentSummary,
    accountManagement: { sales: [{ grossIls: 700 }], refunds: [{ amountIls: 100 }], accessAudit: [] } } as any);
});
describe('client payment summary server permissions', () => {
  it.each(['support', 'key_manager', 'client_lookup', 'finance_manager', 'finance_viewer'])('allows %s to read a client summary without finance mutations', async role => {
    roles = [role];
    expect((await caller().reports.subscribers())[0].canViewClientPayments).toBe(true);
    expect(db.getSubscribersReport).toHaveBeenCalledWith({ includePayments: true });
    const profile = await caller().clientProfiles.getProfile({ userId: 50 });
    expect(profile.permissions.canViewClientPayments).toBe(true);
    expect(profile.permissions.canRecordFinancialRefund).toBe(false);
  });
  it('allows an admin summary without granting finance-owner authority', async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({ id: 1, email: 'admin@example.com' } as any);
    expect((await caller().reports.subscribers())[0].canViewClientPayments).toBe(true);
    const profile = await caller().clientProfiles.getProfile({ userId: 50 });
    expect(profile.permissions.canRecordFinancialRefund).toBe(false);
  });
  it.each(['view_progress', 'view_subscriptions', 'lexai_support'])('removes monetary profile fields for %s', async role => {
    roles = [role];
    const profile = await caller().clientProfiles.getProfile({ userId: 50 });
    expect(profile.paymentSummary).toBeUndefined();
    expect(profile.accountManagement.sales).toEqual([]);
    expect(profile.accountManagement.refunds).toEqual([]);
    expect(db.getAdminClientProfile).toHaveBeenCalledWith(50, expect.objectContaining({ includePayments: false }));
  });
  it('removes legacy and new monetary fields from operational-only report responses', async () => {
    roles = ['view_progress'];
    expect((await caller().reports.subscribers())[0]).toEqual({ id: 50, name: 'Client', canViewClientPayments: false });
    expect(db.getSubscribersReport).toHaveBeenCalledWith({ includePayments: false });
  });
  it('rejects customers, clerks without lookup authority and anonymous requests', async () => {
    for (const role of ['', 'finance_clerk']) {
      roles = role ? [role] : [];
      await expect(caller().reports.subscribers()).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(caller().clientProfiles.getProfile({ userId: 50 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    await expect(caller(null).reports.subscribers()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(db.getSubscribersReport).not.toHaveBeenCalled();
  });
});
