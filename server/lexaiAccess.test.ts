import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../backend/_core/lexai", () => ({
  analyzeLexai: vi.fn().mockResolvedValue({
    id: "analysis-1",
    text: "Analysis complete",
  }),
}));

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn().mockResolvedValue(null),
    getActiveLexaiSubscription: vi.fn(),
    getFrozenLexaiSubscription: vi.fn().mockResolvedValue(undefined),
    updateLexaiSubscription: vi.fn().mockResolvedValue(undefined),
    createLexaiMessage: vi.fn().mockResolvedValue(undefined),
    incrementLexaiMessageCount: vi.fn().mockResolvedValue(undefined),
  };
});

import { appRouter } from "../backend/routers";
import { analyzeLexai } from "../backend/_core/lexai";
import * as db from "../backend/db";

function createAuthedCaller() {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/lexai.analyzeSingle",
    },
    user: {
      id: 123,
      email: "student@example.com",
      passwordHash: "",
      name: "Student User",
      phone: null,
      emailVerified: true,
      createdAt: "",
      updatedAt: "",
      lastSignedIn: "",
    },
    setCookie: () => {},
    clearCookie: () => {},
  } as any);
}

describe("lexai access enforcement", () => {
  const getActiveLexaiSubscription = vi.mocked(db.getActiveLexaiSubscription);
  const getFrozenLexaiSubscription = vi.mocked(db.getFrozenLexaiSubscription);
  const updateLexaiSubscription = vi.mocked(db.updateLexaiSubscription);
  const createLexaiMessage = vi.mocked(db.createLexaiMessage);
  const incrementLexaiMessageCount = vi.mocked(db.incrementLexaiMessageCount);
  const mockedAnalyzeLexai = vi.mocked(analyzeLexai);

  beforeEach(() => {
    vi.clearAllMocks();

    getActiveLexaiSubscription.mockResolvedValue({
      id: 77,
      userId: 123,
      isActive: true,
      isPaused: false,
      isPendingActivation: false,
      paymentStatus: "completed",
      messagesUsed: 0,
      messagesLimit: 100,
      startDate: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() - 60 * 1000).toISOString(),
      createdAt: "",
      updatedAt: "",
    } as any);
  });

  it("returns null for expired subscriptions without writing on read", async () => {
    const caller = createAuthedCaller();

    await expect(caller.lexai.getSubscription()).resolves.toBeNull();
    expect(updateLexaiSubscription).not.toHaveBeenCalled();
  });

  it("returns a tagged frozen subscription when access is paused", async () => {
    const caller = createAuthedCaller();

    getActiveLexaiSubscription.mockResolvedValueOnce(null as any);
    getFrozenLexaiSubscription.mockResolvedValueOnce({
      frozenUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      pausedReason: "Manual freeze",
    } as any);

    await expect(caller.lexai.getSubscription()).resolves.toMatchObject({
      kind: "frozen",
      isFrozen: true,
      frozenReason: "Manual freeze",
    });
  });

  it("blocks analyze requests for expired subscriptions even when no messages were used", async () => {
    const caller = createAuthedCaller();

    await expect(
      caller.lexai.analyzeSingle({
        imageUrl: "https://example.com/chart.png",
        language: "en",
        timeframe: "M15",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "LexAI subscription expired",
    });

    expect(mockedAnalyzeLexai).not.toHaveBeenCalled();
    expect(createLexaiMessage).not.toHaveBeenCalled();
    expect(incrementLexaiMessageCount).not.toHaveBeenCalled();
  });
});