import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../backend/db", async () => ({
  ...(await vi.importActual<typeof import("../backend/db")>("../backend/db")),
  getAdminByEmail: vi.fn(),
  hasAnyRole: vi.fn(),
  getUserRoles: vi.fn(),
  logStaffAction: vi.fn(),
  getCustomerReport: vi.fn(),
  getStudentDirectory: vi.fn(),
  updateUser: vi.fn(),
}));
import { appRouter } from "../backend/routers";
import * as db from "../backend/db";
import { CustomerReportError } from "../backend/services/customer-report.service";
let roles: string[] = [];
const caller = (
  user: any = { id: 9, email: "staff@example.invalid", isStaff: true }
) =>
  appRouter.createCaller({
    req: { headers: {}, method: "GET", path: "/api/trpc/reports.customers" },
    user,
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
const input = { viewerId: 9, accessVersion: "payments" as const };
beforeEach(() => {
  vi.resetAllMocks();
  roles = ["support"];
  vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
  vi.mocked(db.hasAnyRole).mockImplementation(async (_id, requested) =>
    requested.some(role => roles.includes(role))
  );
  vi.mocked(db.getUserRoles).mockImplementation(
    async () => roles.map(role => ({ role })) as any
  );
  vi.mocked(db.getCustomerReport).mockResolvedValue({
    items: [],
    viewerId: 9,
    accessVersion: "payments",
    canViewClientPayments: true,
  } as any);
});
describe("viewer-bound customer report and location writes", () => {
  it.each([
    "support",
    "key_manager",
    "client_lookup",
    "finance_manager",
    "finance_viewer",
  ])(
    "preserves %s payment read access without finance mutations",
    async role => {
      roles = [role];
      expect(
        await caller().reports.customerAccess({ viewerId: 9 })
      ).toMatchObject({
        canViewClientPayments: true,
        accessVersion: "payments",
      });
      await caller().reports.customers({ ...input, includePayments: true });
      expect(db.getCustomerReport).toHaveBeenCalledWith(
        expect.objectContaining({ canViewClientPayments: true }),
        expect.objectContaining({
          includePayments: true,
          pageSize: 20,
          exportAll: false,
        })
      );
    }
  );
  it("preserves operational-only access, even for empty pages, without trusting requested finance fields", async () => {
    roles = ["view_progress"];
    expect(
      await caller().reports.customerAccess({ viewerId: 9 })
    ).toMatchObject({
      canViewClientPayments: false,
      accessVersion: "operations",
    });
    await caller().reports.customers({
      viewerId: 9,
      accessVersion: "operations",
    });
    expect(db.getCustomerReport).toHaveBeenCalledWith(
      expect.objectContaining({ canViewClientPayments: false }),
      expect.objectContaining({ includePayments: false })
    );
    vi.mocked(db.getCustomerReport).mockClear();
    for (const request of [
      { ...input },
      { ...input, accessVersion: "operations" as const, includePayments: true },
    ])
      await expect(caller().reports.customers(request)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    expect(db.getCustomerReport).not.toHaveBeenCalled();
  });
  it("denies cross-viewer reads, role downgrades, customers, clerks and anonymous callers before report reads", async () => {
    await expect(
      caller().reports.customers({ ...input, viewerId: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller().reports.customerAccess({ viewerId: 10 })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    for (const role of ["", "finance_clerk", "lexai_support"]) {
      roles = role ? [role] : [];
      await expect(caller().reports.customers(input)).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    }
    await expect(caller(null).reports.customers(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(db.getCustomerReport).not.toHaveBeenCalled();
  });
  it("allows negative-ID full-admin sessions without requiring a customer account", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 1,
      email: "admin@example.invalid",
    } as any);
    expect(
      await caller({
        id: -1,
        email: "admin@example.invalid",
      }).reports.customerAccess({ viewerId: -1 })
    ).toMatchObject({ viewerId: -1, canViewClientPayments: true });
  });
  it.each([
    { pageSize: 5000 },
    { page: -1 },
    { search: "x".repeat(201) },
    { sort: "price" },
    { includeLegacyMoney: true },
  ])("rejects unbounded or unknown report input %j", async extra => {
    await expect(
      caller().reports.customers({ ...input, ...extra } as any)
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.getCustomerReport).not.toHaveBeenCalled();
  });
  it("returns deliberate source-limit errors safely", async () => {
    vi.mocked(db.getCustomerReport).mockRejectedValue(
      new CustomerReportError("Source limit exceeded; narrow filters")
    );
    await expect(caller().reports.customers(input)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Source limit exceeded; narrow filters",
    });
  });
  it("normalizes an explicitly saved country and trims city, while preserving omitted historical fields", async () => {
    await caller().users.updateProfile({ name: "Updated name" });
    expect(db.updateUser).toHaveBeenLastCalledWith(9, {
      name: "Updated name",
      phone: undefined,
    });
    await caller().users.updateProfile({ city: " نابلس ", country: "فلسطين" });
    expect(db.updateUser).toHaveBeenLastCalledWith(9, {
      name: undefined,
      phone: undefined,
      city: "نابلس",
      country: "PS",
    });
  });
  it.each([
    { country: "Nablus" },
    { city: "https://spam.invalid" },
    { city: "x".repeat(101) },
    { country: "" },
  ])(
    "rejects invalid new location values before profile writes %j",
    async location => {
      await expect(
        caller().users.updateProfile(location)
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      expect(db.updateUser).not.toHaveBeenCalled();
    }
  );
  it("rejects city text in registration country before attempting account creation", async () => {
    await expect(
      caller(null).auth.register({
        name: "Synthetic account",
        email: "qa@example.invalid",
        password: "TestPassword1",
        country: "Nablus",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("bounded student-directory authority", () => {
  it("preserves existing operational and payment roles with explicit viewer metadata", async () => {
    vi.mocked(db.getStudentDirectory).mockResolvedValue({
      items: [],
      viewerId: 9,
      accessVersion: "payments",
      canViewClientPayments: true,
    } as any);
    await caller().reports.studentsPage({
      ...input,
      includePayments: true,
      packageFilter: "active",
      sort: "lastSignIn",
      page: 2,
      pageSize: 25,
    });
    expect(db.getStudentDirectory).toHaveBeenCalledWith(
      expect.objectContaining({ canViewClientPayments: true }),
      expect.objectContaining({
        sort: "registered",
        page: 2,
        pageSize: 25,
        directory: {
          packageFilter: "active",
          sort: "lastSignIn",
          includePaymentTotal: true,
        },
      })
    );
    roles = ["view_progress"];
    await caller().reports.studentsPage({
      viewerId: 9,
      accessVersion: "operations",
    });
    expect(db.getStudentDirectory).toHaveBeenLastCalledWith(
      expect.objectContaining({ canViewClientPayments: false }),
      expect.objectContaining({ includePayments: false })
    );
  });
  it("rejects cross-account, obsolete finance scope and unauthorized financial fields before directory reads", async () => {
    roles = ["view_progress"];
    for (const request of [
      { viewerId: 99, accessVersion: "operations" as const },
      { viewerId: 9, accessVersion: "payments" as const },
      {
        viewerId: 9,
        accessVersion: "operations" as const,
        includePayments: true,
      },
    ])
      await expect(
        caller().reports.studentsPage(request)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.getStudentDirectory).not.toHaveBeenCalled();
  });
});
