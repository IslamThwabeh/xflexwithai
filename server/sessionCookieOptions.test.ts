import { describe, expect, it } from "vitest";

import {
  getSessionCookieOptions,
  toExpressCookieOptions,
} from "../backend/_core/cookies";

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

  it("supports the relative URLs supplied by the local Express server", () => {
    const options = getSessionCookieOptions({
        protocol: "http",
        hostname: "localhost",
        url: "/api/trpc/auth.adminLogin",
        headers: {
          host: "localhost:3000",
        },
      }, "admin");

    expect(options).toMatchObject({
      domain: undefined,
      maxAge: 2 * 60 * 60,
      sameSite: "lax",
      secure: false,
    });
    expect(toExpressCookieOptions(options).maxAge).toBe(2 * 60 * 60 * 1000);
  });
});
