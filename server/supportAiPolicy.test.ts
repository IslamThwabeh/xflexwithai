import { describe, expect, it } from "vitest";
import { getSensitiveSupportReview, isAcademyAccountRecoveryRequest } from "../backend/services/support-ai-policy.service";

describe("support AI account policy", () => {
  it.each([
    "حسابي القديم حذفت البريد الالكتروني وصعب ارجعوا هس هذا حسابي لجديد وانا مسجل بالدورة الأساسية",
    "بدي أغير الإيميل المسجل بحسابي",
    "I lost my old email and created a new academy account",
    "How can I recover my account?",
  ])("recognizes academy recovery: %s", (text) => {
    expect(isAcademyAccountRecoveryRequest(text)).toBe(true);
  });
  it.each([
    "I am not receiving email notifications",
    "كيف أفتح حساب جديد في VT Markets؟",
    "بدي اغير الايميل بحساب VT Markets",
    "Where do I enter the VT Markets referral code?",
  ])("does not mistake normal notifications or broker requests for academy recovery: %s", (text) => {
    expect(isAcademyAccountRecoveryRequest(text)).toBe(false);
  });
  it.each(["account_change", "security", "billing_or_refund"])("has an approved review response for %s", (intent) => {
    expect(getSensitiveSupportReview(intent, true)?.escalationReason).toBe(intent);
    expect(getSensitiveSupportReview(intent, false)?.answer).toContain("support team");
  });
  it("does not force routine technical help into a sensitive workflow", () => {
    expect(getSensitiveSupportReview("technical_issue", true)).toBeNull();
  });
});
