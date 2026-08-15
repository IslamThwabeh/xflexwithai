import { beforeEach, describe, expect, it, vi } from "vitest";
import { SEO_OWNER_INTAKE_REQUIRED_IDS } from "../shared/seoOwnerIntake";

vi.mock("../backend/db", async () => {
  const actual =
    await vi.importActual<typeof import("../backend/db")>("../backend/db");
  return {
    ...actual,
    getAdminByEmail: vi.fn(),
    getSeoOwnerIntake: vi.fn(),
    saveSeoOwnerIntakeAnswers: vi.fn(),
    submitSeoOwnerIntake: vi.fn(),
    logAdminAction: vi.fn(),
  };
});

import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createCaller(email = "owner@example.com") {
  return appRouter.createCaller({
    req: { headers: {}, method: "POST", path: "/api/trpc/seoOwnerIntake" },
    user: {
      id: 1,
      email,
      passwordHash: "",
      name: "Owner",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
      isStaff: false,
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any).seoOwnerIntake;
}

describe("SEO owner intake routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getAdminByEmail).mockResolvedValue({
      id: 7,
      email: "owner@example.com",
      name: "Business Owner",
    } as any);
    vi.mocked(db.getSeoOwnerIntake).mockResolvedValue({
      status: "draft",
      submittedAt: null,
      updatedAt: null,
      answers: {},
    });
    vi.mocked(db.saveSeoOwnerIntakeAnswers).mockResolvedValue({
      savedAt: "2026-08-15T12:00:00.000Z",
      savedCount: 1,
    });
    vi.mocked(db.submitSeoOwnerIntake).mockResolvedValue({
      submittedAt: "2026-08-15T12:10:00.000Z",
    });
  });

  it("restricts the shared answers to full admins", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValue(null);
    await expect(
      createCaller("student@example.com").get()
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("autosaves only recognized question patches", async () => {
    await expect(
      createCaller().save({ answers: { q01: "XFlex Academy" } })
    ).resolves.toMatchObject({ savedCount: 1 });
    expect(db.saveSeoOwnerIntakeAnswers).toHaveBeenCalledWith(
      { q01: "XFlex Academy" },
      7
    );

    await expect(
      createCaller().save({ answers: { made_up: "No" } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires the first-article facts before explicit submission", async () => {
    await expect(
      createCaller().submit({ answers: { q01: "XFlex" } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.submitSeoOwnerIntake).not.toHaveBeenCalled();

    const completeAnswers = Object.fromEntries(
      SEO_OWNER_INTAKE_REQUIRED_IDS.map(questionId => [
        questionId,
        `Answer ${questionId}`,
      ])
    );
    await expect(
      createCaller().submit({ answers: completeAnswers })
    ).resolves.toEqual({ submittedAt: "2026-08-15T12:10:00.000Z" });
    expect(db.saveSeoOwnerIntakeAnswers).toHaveBeenCalledWith(
      completeAnswers,
      7
    );
    expect(db.submitSeoOwnerIntake).toHaveBeenCalledWith(7);
    expect(db.logAdminAction).toHaveBeenCalledWith(
      7,
      7,
      "submit_seo_owner_intake",
      { answeredCount: SEO_OWNER_INTAKE_REQUIRED_IDS.length }
    );
  });
});
