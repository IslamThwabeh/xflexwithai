import { describe, expect, it } from "vitest";

import { isLikelyValidEmail, normalizeEmailAddress } from "../shared/emailValidation";

describe("emailValidation", () => {
  it("normalizes casing and whitespace", () => {
    expect(normalizeEmailAddress("  Islam.Thwabeh@Gmail.Com  ")).toBe("islam.thwabeh@gmail.com");
  });

  it("accepts common valid email addresses", () => {
    expect(isLikelyValidEmail("student@gmail.com")).toBe(true);
    expect(isLikelyValidEmail("student.name+ref@subdomain.example.co.uk")).toBe(true);
  });

  it("rejects invalid top level domains like .comm", () => {
    expect(isLikelyValidEmail("smoke-test.invalid-email@xflexacademy.comm")).toBe(false);
  });

  it("rejects malformed domain labels", () => {
    expect(isLikelyValidEmail("student@-example.com")).toBe(false);
    expect(isLikelyValidEmail("student@example-.com")).toBe(false);
    expect(isLikelyValidEmail("student@example..com")).toBe(false);
  });
});