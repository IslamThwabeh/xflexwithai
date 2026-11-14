import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../backend/services/interface-announcement.service", () => ({
  getInterfaceAnnouncementStatus: vi.fn(),
  recordInterfaceAnnouncementAction: vi.fn(),
}));
vi.mock("../backend/db", async () => ({
  ...(await vi.importActual<typeof import("../backend/db")>("../backend/db")),
  getUserTermsAcceptanceStatus: vi.fn(),
}));
import { appRouter } from "../backend/routers";
import * as service from "../backend/services/interface-announcement.service";
import * as db from "../backend/db";
function caller(id: number | null, isStaff = false) {
  return appRouter.createCaller({
    req: { headers: {} },
    user:
      id === null
        ? null
        : {
            id,
            email: "qa@example.invalid",
            lastSignedIn: "server-login",
            isStaff,
          },
    setCookie() {},
    clearCookie() {},
  } as any);
}
describe("announcement account authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getUserTermsAcceptanceStatus).mockResolvedValue({
      requiresAcceptance: false,
    } as any);
  });
  it.each([
    { id: 17, staff: false },
    { id: 18, staff: true },
    { id: -17, staff: false },
  ])(
    "uses trusted server identity and sign-in for $id",
    async ({ id, staff }) => {
      await caller(id, staff).interfaceAnnouncements.status({
        accountId: id,
        loginAt: "spoofed-login",
      });
      expect(service.getInterfaceAnnouncementStatus).toHaveBeenCalledWith(
        id,
        "server-login"
      );
      await caller(id, staff).interfaceAnnouncements.respond({
        accountId: id,
        action: "later",
      });
      expect(service.recordInterfaceAnnouncementAction).toHaveBeenCalledWith(
        id,
        "server-login",
        "later"
      );
    }
  );
  it("rejects anonymous and cross-account reads/writes", async () => {
    await expect(
      caller(null).interfaceAnnouncements.status({
        accountId: 17,
        loginAt: "one",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(18).interfaceAnnouncements.status({
        accountId: 17,
        loginAt: "one",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller(-17).interfaceAnnouncements.respond({
        accountId: 17,
        action: "dismiss",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(service.getInterfaceAnnouncementStatus).not.toHaveBeenCalled();
    expect(service.recordInterfaceAnnouncementAction).not.toHaveBeenCalled();
  });
  it("retains the customer terms gate and rejects unknown actions", async () => {
    vi.mocked(db.getUserTermsAcceptanceStatus).mockResolvedValue({
      requiresAcceptance: true,
    } as any);
    await expect(
      caller(17).interfaceAnnouncements.status({
        accountId: 17,
        loginAt: "one",
      })
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(
      caller(-17).interfaceAnnouncements.respond({
        accountId: -17,
        action: "reset" as any,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(service.recordInterfaceAnnouncementAction).not.toHaveBeenCalled();
  });
});
