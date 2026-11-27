import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../backend/db", async () => ({
  ...(await vi.importActual<typeof import("../backend/db")>("../backend/db")),
  getAdminByEmail: vi.fn(),
  getUserById: vi.fn(),
  getUserRoles: vi.fn(),
  hasStaffTrainingEnrollment: vi.fn(),
}));
import { appRouter } from "../backend/routers";
import * as db from "../backend/db";
const caller = (user: any = { id: -1, email: "admin@example.test" }) =>
  appRouter.createCaller({
    user,
    req: {
      headers: {},
      method: "GET",
      path: "/api/trpc/roles.getStaffAccessPreview",
    },
    setCookie() {},
    clearCookie() {},
  } as any);
describe("read-only staff access review route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.test",
    } as any);
    vi.mocked(db.getUserById).mockImplementation(
      async id =>
        ({
          id,
          email: `staff-${id}@example.test`,
          name: "Synthetic staff",
          isStaff: true,
          lastSignedIn: "2026-11-20T08:00:00Z",
          passwordHash: "never-return-this",
          loginBlockedAt: null,
        }) as any
    );
    vi.mocked(db.getUserRoles).mockResolvedValue([{ role: "support" }] as any);
    vi.mocked(db.hasStaffTrainingEnrollment).mockResolvedValue(true);
  });
  it("returns only the requested account with the actual last-login field and training presence", async () => {
    const result = await caller().roles.getStaffAccessPreview({ userId: 42 });
    expect(result).toMatchObject({
      userId: 42,
      lastSignIn: "2026-11-20T08:00:00Z",
      hasEmployeeTraining: true,
      roles: ["support"],
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(db.hasStaffTrainingEnrollment).toHaveBeenCalledWith(42);
    expect(db.getUserRoles).toHaveBeenCalledWith(42);
  });
  it("rejects anonymous and non-admin staff before reading another employee", async () => {
    await expect(
      caller(null).roles.getStaffAccessPreview({ userId: 42 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    await expect(
      caller({
        id: 5,
        email: "staff@example.test",
        isStaff: true,
      }).roles.getStaffAccessPreview({ userId: 42 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getUserById).not.toHaveBeenCalled();
    expect(db.hasStaffTrainingEnrollment).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5])("rejects invalid target %s", async userId => {
    await expect(
      caller().roles.getStaffAccessPreview({ userId })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.getUserById).not.toHaveBeenCalled();
  });
  it("does not fabricate training or login availability for a removed account", async () => {
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 42,
      isStaff: false,
      loginBlockedAt: "2026-11-20T08:00:00Z",
      lastSignedIn: null,
    } as any);
    expect(
      await caller().roles.getStaffAccessPreview({ userId: 42 })
    ).toMatchObject({
      hasEmployeeTraining: false,
      loginBlockedAt: "2026-11-20T08:00:00Z",
    });
    expect(db.hasStaffTrainingEnrollment).not.toHaveBeenCalled();
    vi.mocked(db.getUserById).mockResolvedValue(undefined);
    await expect(
      caller().roles.getStaffAccessPreview({ userId: 42 })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
