import { TRPCError } from "@trpc/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn().mockResolvedValue(null),
  };
});

import { appRouter } from "../backend/routers";

function createAuthedCaller() {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/bugReports.submit",
    },
    user: {
      id: 123,
      email: "tester@example.com",
      passwordHash: "",
      name: "Test User",
      phone: null,
      emailVerified: false,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("bugReports.submit validation", () => {
  it("rejects an empty payload as a bad request", async () => {
    const caller = createAuthedCaller();

    await expect(caller.bugReports.submit({} as any)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    } satisfies Partial<TRPCError>);
  });

  it("rejects whitespace-only descriptions without an image", async () => {
    const caller = createAuthedCaller();

    await expect(
      caller.bugReports.submit({
        description: "   ",
      })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    } satisfies Partial<TRPCError>);
  });
});