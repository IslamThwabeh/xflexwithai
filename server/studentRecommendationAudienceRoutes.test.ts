import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => ({
  ...(await vi.importActual<typeof import("../backend/db")>("../backend/db")),
  getAdminByEmail: vi.fn(),
  hasAnyRole: vi.fn(),
  getRecommendationAudienceSummary: vi.fn(),
}));
import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

const caller = (
  user: unknown = { id: 9, email: "staff@example.test", isStaff: true }
) =>
  appRouter.createCaller({
    req: {
      headers: {},
      method: "GET",
      path: "/api/trpc/reports.recommendationAudience",
    },
    user,
    setCookie() {},
    clearCookie() {},
  } as any);

describe("Students recommendation audience route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    vi.mocked(db.hasAnyRole).mockResolvedValue(true);
    vi.mocked(db.getRecommendationAudienceSummary).mockResolvedValue({
      totalSubs: 95,
      eligibleCount: 11,
    } as any);
  });
  it("allows the staff who can access the Students report", async () => {
    await expect(caller().reports.recommendationAudience()).resolves.toEqual({
      totalSubs: 95,
      eligibleCount: 11,
    });
    expect(db.getRecommendationAudienceSummary).toHaveBeenCalledOnce();
  });
  it("rejects client access before reading the audience", async () => {
    vi.mocked(db.hasAnyRole).mockResolvedValue(false);
    await expect(
      caller().reports.recommendationAudience()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getRecommendationAudienceSummary).not.toHaveBeenCalled();
  });
  it("rejects anonymous access", async () => {
    await expect(
      caller(null).reports.recommendationAudience()
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(db.getRecommendationAudienceSummary).not.toHaveBeenCalled();
  });
});
