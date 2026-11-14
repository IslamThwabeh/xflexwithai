import { describe, expect, it } from "vitest";
import { opensRegistration } from "../frontend/src/lib/authEntryMode";

describe("public authentication entry mode", () => {
  it("opens registration for every supported signup route in either language", () => {
    for (const prefix of ["", "/en", "/ar"]) {
      for (const path of ["/register", "/signup"]) {
        expect(opensRegistration(`${prefix}${path}`, "")).toBe(true);
      }
      expect(opensRegistration(`${prefix}/auth`, "")).toBe(false);
    }
  });

  it("preserves explicit mode choices when switching language or following referrals", () => {
    expect(
      opensRegistration("/en/auth", "?mode=register&next=%2Fsupport")
    ).toBe(true);
    expect(opensRegistration("/ar/auth", "?mode=register&ref=ABC123")).toBe(
      true
    );
    expect(opensRegistration("/en/register", "?mode=login&ref=ABC123")).toBe(
      false
    );
    expect(opensRegistration("/ar/auth", "?ref=ABC123")).toBe(true);
  });
});
