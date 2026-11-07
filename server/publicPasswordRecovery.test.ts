import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => ({
  ...await vi.importActual<typeof import("../backend/db")>("../backend/db"),
  getAdminByEmail: vi.fn(), getUserByEmail: vi.fn(), getUserById: vi.fn(),
  getLatestEmailOtp: vi.fn(), createEmailOtp: vi.fn(), deleteEmailOtpsForEmail: vi.fn(),
  deleteExpiredEmailOtps: vi.fn(), countEmailOtpsSentSince: vi.fn(),
  completePasswordRecovery: vi.fn(), incrementEmailOtpAttempts: vi.fn(), logAdminAction: vi.fn(),
}));
vi.mock("../backend/_core/email", async () => ({
  ...await vi.importActual<typeof import("../backend/_core/email")>("../backend/_core/email"),
  sendLoginCodeEmail: vi.fn(),
}));
import { appRouter } from "../backend/routers";
import * as db from "../backend/db";
import { sendLoginCodeEmail } from "../backend/_core/email";
import { sha256Base64 } from "../backend/_core/otp";
import { verifyPassword } from "../backend/_core/auth";

const customer = { id: 25, email: "client@example.com", isStaff: false, loginBlockedAt: null };
const admin = { id: -1, email: "owner@example.com" };
function caller(user: any = null) {
  return appRouter.createCaller({ user, req: { headers: {}, method: "POST" }, setCookie: vi.fn(), clearCookie: vi.fn() } as any);
}
const otpInput = { email: customer.email, code: "123456", newPassword: "RecoveredPass1" };

describe("login-page password recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(db.getAdminByEmail).mockImplementation(async email => email === admin.email ? { id: 1, email } as any : null);
    vi.mocked(db.getUserByEmail).mockResolvedValue(customer as any);
    vi.mocked(db.getUserById).mockResolvedValue(customer as any);
    vi.mocked(db.countEmailOtpsSentSince).mockResolvedValue(0);
    vi.mocked(db.completePasswordRecovery).mockResolvedValue(true);
    vi.mocked(db.incrementEmailOtpAttempts).mockResolvedValue(10);
  });

  it("sends a reset code before login and keeps unknown/blocked account responses neutral", async () => {
    await expect(caller().auth.requestPasswordResetCode({ email: " CLIENT@example.com " })).resolves.toEqual({ success: true });
    expect(db.createEmailOtp).toHaveBeenCalledWith(expect.objectContaining({ email: customer.email, purpose: "password_reset" }));
    expect(sendLoginCodeEmail).toHaveBeenCalled();
    vi.mocked(db.createEmailOtp).mockClear();
    vi.mocked(db.getUserByEmail).mockResolvedValue(null);
    await expect(caller().auth.requestPasswordResetCode({ email: customer.email })).resolves.toEqual({ success: true });
    vi.mocked(db.getUserByEmail).mockResolvedValue({ ...customer, loginBlockedAt: "blocked" } as any);
    await expect(caller().auth.requestPasswordResetCode({ email: customer.email })).resolves.toEqual({ success: true });
    expect(db.createEmailOtp).not.toHaveBeenCalled();
  });

  it("honors resend limits", async () => {
    vi.mocked(db.countEmailOtpsSentSince).mockResolvedValue(1);
    await caller().auth.requestPasswordResetCode({ email: customer.email });
    expect(db.createEmailOtp).not.toHaveBeenCalled();
  });

  it("rejects exhausted reset codes and atomically rejected/reused credentials", async () => {
    vi.mocked(db.getLatestEmailOtp).mockResolvedValue({ attempts: 10, expiresAtMs: Date.now() + 60_000 } as any);
    await expect(caller().auth.resetPasswordWithOtp(otpInput)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.completePasswordRecovery).not.toHaveBeenCalled();
    vi.mocked(db.getLatestEmailOtp).mockResolvedValue({ attempts: 0, salt: "salt", codeHash: await sha256Base64("salt:123456"), expiresAtMs: Date.now() + 60_000 } as any);
    vi.mocked(db.completePasswordRecovery).mockResolvedValue(false);
    await expect(caller().auth.resetPasswordWithOtp(otpInput)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("lets only admins issue a high-entropy recovery link after identity verification", async () => {
    await expect(caller().auth.createSupportPasswordReset({ userId: 25, identityVerified: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(customer).auth.createSupportPasswordReset({ userId: 25, identityVerified: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller(admin).auth.createSupportPasswordReset({ userId: 25, identityVerified: false } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const result = await caller(admin).auth.createSupportPasswordReset({ userId: 25, identityVerified: true });
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.expiresAtMs - Date.now()).toBeGreaterThan(29 * 60_000);
    expect(db.createEmailOtp).toHaveBeenCalledWith(expect.objectContaining({ purpose: "support_reset", codeHash: await sha256Base64(result.token) }));
    expect(db.logAdminAction).toHaveBeenCalledWith(1, 25, "issue_password_recovery", expect.objectContaining({ identityVerified: true }));
    expect(JSON.stringify(vi.mocked(db.logAdminAction).mock.calls)).not.toContain(result.token);
  });

  it("resets with a support link without email delivery, then rejects expiry and reuse", async () => {
    const token = "a".repeat(43);
    vi.mocked(db.getLatestEmailOtp).mockResolvedValue({ codeHash: await sha256Base64(token), expiresAtMs: Date.now() + 60_000 } as any);
    const input = { email: customer.email, token, newPassword: "RecoveredPass1" };
    await expect(caller().auth.resetPasswordWithSupportToken(input)).resolves.toEqual({ success: true });
    expect(await verifyPassword(input.newPassword, vi.mocked(db.completePasswordRecovery).mock.calls[0][0].passwordHash)).toBe(true);
    expect(sendLoginCodeEmail).not.toHaveBeenCalled();
    vi.mocked(db.completePasswordRecovery).mockResolvedValue(false);
    await expect(caller().auth.resetPasswordWithSupportToken(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    vi.mocked(db.getLatestEmailOtp).mockResolvedValue({ codeHash: await sha256Base64(token), expiresAtMs: Date.now() - 1 } as any);
    await expect(caller().auth.resetPasswordWithSupportToken(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("never uses support recovery to bypass restrictions or reset staff accounts", async () => {
    for (const user of [{ ...customer, loginBlockedAt: "blocked" }, { ...customer, isStaff: true }]) {
      vi.mocked(db.getUserById).mockResolvedValue(user as any);
      vi.mocked(db.getUserByEmail).mockResolvedValue(user as any);
      await expect(caller(admin).auth.createSupportPasswordReset({ userId: 25, identityVerified: true })).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(caller().auth.resetPasswordWithSupportToken({ email: user.email, token: "a".repeat(43), newPassword: "RecoveredPass1" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(db.completePasswordRecovery).not.toHaveBeenCalled();
  });
});
