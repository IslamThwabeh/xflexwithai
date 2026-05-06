import { describe, expect, it } from "vitest";

import { getSessionCookieOptions } from "../backend/_core/cookies";

describe("getSessionCookieOptions", () => {
  it("keeps first-party academy traffic on SameSite=Lax", () => {
    expect(
      getSessionCookieOptions({
        url: "https://api.xflexacademy.com/api/trpc/auth.verifyLoginCode",
        headers: {
          origin: "https://xflexacademy.com",
        },
      }).sameSite
    ).toBe("lax");
  });

  it("uses SameSite=None for cross-site preview origins", () => {
    expect(
      getSessionCookieOptions({
        url: "https://api.xflexacademy.com/api/trpc/auth.verifyLoginCode",
        headers: {
          origin: "https://74e9898d.xflexwithai.pages.dev",
        },
      }).sameSite
    ).toBe("none");
  });
});