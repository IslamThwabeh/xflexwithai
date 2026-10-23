import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => ({
  ...await vi.importActual<typeof import("../backend/db")>("../backend/db"),
  getUserByEmail: vi.fn(),
  getLatestEmailOtp: vi.fn(),
  updateUserPassword: vi.fn(),
  deleteEmailOtpsForEmail: vi.fn(),
  incrementEmailOtpAttempts: vi.fn(),
  updateUser: vi.fn(),
}));

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";
import { verifyPassword } from "../backend/_core/auth";
import { sha256Base64 } from "../backend/_core/otp";

const supportUser = { id: 19, email: "lena@example.com", name: "Lena", isStaff: true };
const resetInput = { email: supportUser.email, code: "123456", newPassword: "RecoveredPass1" };

function caller(user: typeof supportUser | null = supportUser) {
  return appRouter.createCaller({
    req: { headers: {}, method: "POST", path: "/api/trpc" },
    user,
    setCookie: vi.fn(),
    clearCookie: vi.fn(),
  } as any);
}

describe("personal profile and password recovery for support staff", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(db.getUserByEmail).mockResolvedValue(supportUser as any);
    vi.mocked(db.getLatestEmailOtp).mockResolvedValue({
      id: 3,
      salt: "test-salt",
      codeHash: await sha256Base64("test-salt:123456"),
      expiresAtMs: Date.now() + 60_000,
      attempts: 0,
    } as any);
  });

  it("lets support reset their own password with a reset code without the forgotten password", async () => {
    await expect(caller().auth.resetPasswordWithOtp(resetInput)).resolves.toEqual({ success: true });
    const [userId, hash] = vi.mocked(db.updateUserPassword).mock.calls[0];
    expect(userId).toBe(supportUser.id);
    expect(await verifyPassword(resetInput.newPassword, hash)).toBe(true);
    expect(db.getLatestEmailOtp).toHaveBeenCalledWith(supportUser.email, "password_reset");
    expect(db.deleteEmailOtpsForEmail).toHaveBeenCalledWith(supportUser.email, "password_reset");
  });

  it("rejects another account's reset even when signed in as support", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({ ...supportUser, id: 21 } as any);
    await expect(caller().auth.resetPasswordWithOtp(resetInput)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.getLatestEmailOtp).not.toHaveBeenCalled();
    expect(db.updateUserPassword).not.toHaveBeenCalled();
  });

  it("rejects expired and incorrect reset codes", async () => {
    await expect(caller().auth.resetPasswordWithOtp({ ...resetInput, code: "654321" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.incrementEmailOtpAttempts).toHaveBeenCalledWith(3);
    vi.mocked(db.getLatestEmailOtp).mockResolvedValue({ expiresAtMs: Date.now() - 1000 } as any);
    await expect(caller().auth.resetPasswordWithOtp(resetInput)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.updateUserPassword).not.toHaveBeenCalled();
  });

  it("saves personal details and login preferences against the signed-in support account", async () => {
    await caller().users.updateProfile({ name: "Lena Support", phone: "+962700000000" });
    expect(db.updateUser).toHaveBeenCalledWith(supportUser.id, { name: "Lena Support", phone: "+962700000000" });
    await caller().users.updateLoginSecurity({ loginSecurityMode: "password_plus_otp" });
    expect(db.updateUser).toHaveBeenCalledWith(supportUser.id, { loginSecurityMode: "password_plus_otp" });
  });

  it("requires authentication for personal settings and password recovery", async () => {
    await expect(caller(null).users.updateProfile({ name: "Test" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).auth.resetPasswordWithOtp(resetInput)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(db.updateUser).not.toHaveBeenCalled();
    expect(db.updateUserPassword).not.toHaveBeenCalled();
  });
});
