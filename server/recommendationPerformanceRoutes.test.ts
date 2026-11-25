import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../backend/db', async () => ({
  ...(await vi.importActual<typeof import('../backend/db')>('../backend/db')),
  hasAnyRole: vi.fn(), getRecommendationCustomerPerformance: vi.fn(),
  getUserTermsAcceptanceStatus: vi.fn(), getUserRecommendationsAccess: vi.fn(), getAdminByEmail: vi.fn(),
}));
import { appRouter } from '../backend/routers';
import * as db from '../backend/db';
const customer = { id: 801, email: 'customer@example.test', isStaff: false };
const caller = (user: any = customer, scope = crypto.randomUUID()) => appRouter.createCaller({ user,
  req: { headers: {}, url: `https://${scope}.example.test/api/trpc`, method: 'GET' }, setCookie() {}, clearCookie() {} } as any);
const input = { month: '2026-11', viewerId: 801 };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.hasAnyRole).mockResolvedValue(false);
  vi.mocked(db.getUserTermsAcceptanceStatus).mockResolvedValue({ requiresAcceptance: false } as any);
  vi.mocked(db.getUserRecommendationsAccess).mockResolvedValue({ canPublish: false, hasSubscription: false } as any);
  vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
  vi.mocked(db.getRecommendationCustomerPerformance).mockResolvedValue({ month: '2026-11', basis: 'reported_cumulative_progress', calculatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 300_000).toISOString(), summary: { netPips: 100 } } as any);
});
describe('customer report authorization', () => {
  it('allows a customer with no subscription without querying subscription eligibility', async () => {
    await expect(caller().recommendations.customerPerformance(input)).resolves.toMatchObject({ summary: { netPips: 100 } });
    expect(db.getUserRecommendationsAccess).not.toHaveBeenCalled();
  });
  it('checks authentication before even serving a populated shared cache', async () => {
    const scope = crypto.randomUUID();
    await caller(customer, scope).recommendations.customerPerformance(input);
    vi.mocked(db.getRecommendationCustomerPerformance).mockClear();
    await expect(caller(null, scope).recommendations.customerPerformance(input)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(db.getRecommendationCustomerPerformance).not.toHaveBeenCalled();
  });
  it('keeps terms gates and checks viewer identity', async () => {
    await expect(caller().recommendations.customerPerformance({ ...input, viewerId: 802 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    vi.mocked(db.getUserTermsAcceptanceStatus).mockResolvedValue({ requiresAcceptance: true } as any);
    await expect(caller().recommendations.customerPerformance(input)).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
    expect(db.getRecommendationCustomerPerformance).not.toHaveBeenCalled();
  });
  it('denies staff and analyst roles including inconsistent non-staff flags', async () => {
    await expect(caller({ ...customer, isStaff: true }).recommendations.customerPerformance(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    vi.mocked(db.hasAnyRole).mockResolvedValue(true);
    await expect(caller().recommendations.customerPerformance(input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.getRecommendationCustomerPerformance).not.toHaveBeenCalled();
  });
  it('allows full admin preview but preserves denial of the existing detailed report to customers', async () => {
    await expect(caller({ id: -1 }).recommendations.customerPerformance({ ...input, viewerId: -1 })).resolves.toBeDefined();
    await expect(caller().recommendations.monthlyTradeReport({ month: input.month })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it.each([{ ...input, analystUserId: 1 }, { ...input, month: '2099-01' }, { ...input, month: "2026-11'" }])('rejects unsupported dates and scope selectors %#', async value => {
    await expect(caller().recommendations.customerPerformance(value as any)).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(db.getRecommendationCustomerPerformance).not.toHaveBeenCalled();
  });
});
