import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/_core/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn().mockResolvedValue(null),
    getUserRecommendationsAccess: vi.fn(),
    createRecommendationAlert: vi.fn(),
    getRecommendationSubscriberDetails: vi.fn(),
    sendBulkNotification: vi.fn().mockResolvedValue(undefined),
    markNotificationEmailSent: vi.fn().mockResolvedValue(undefined),
    getRecommendationPublishState: vi.fn(),
    createRecommendationMessage: vi.fn(),
    extendRecommendationAlertActivity: vi.fn().mockResolvedValue(undefined),
    getRecommendationMessageById: vi.fn(),
    hasRecommendationResultChild: vi.fn(),
    closeRecommendationThread: vi.fn().mockResolvedValue(undefined),
    cancelRecommendationAlert: vi.fn().mockResolvedValue(undefined),
  };
});

import { sendEmail } from "../backend/_core/email";
import { appRouter } from "../backend/routers";
import * as db from "../backend/db";

function createAuthedCaller() {
  return appRouter.createCaller({
    req: {
      headers: {},
      method: "POST",
      path: "/api/trpc/recommendations.postMessage",
    },
    user: {
      id: 123,
      email: "analyst@example.com",
      passwordHash: "",
      name: "Analyst User",
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

describe("recommendations workflow", () => {
  const getUserRecommendationsAccess = vi.mocked(db.getUserRecommendationsAccess);
  const createRecommendationAlert = vi.mocked(db.createRecommendationAlert);
  const getRecommendationSubscriberDetails = vi.mocked(db.getRecommendationSubscriberDetails);
  const sendBulkNotification = vi.mocked(db.sendBulkNotification);
  const markNotificationEmailSent = vi.mocked(db.markNotificationEmailSent);
  const getRecommendationPublishState = vi.mocked(db.getRecommendationPublishState);
  const createRecommendationMessage = vi.mocked(db.createRecommendationMessage);
  const extendRecommendationAlertActivity = vi.mocked(db.extendRecommendationAlertActivity);
  const getRecommendationMessageById = vi.mocked(db.getRecommendationMessageById);
  const hasRecommendationResultChild = vi.mocked(db.hasRecommendationResultChild);
  const closeRecommendationThread = vi.mocked(db.closeRecommendationThread);
  const mockedSendEmail = vi.mocked(sendEmail);

  beforeEach(() => {
    vi.clearAllMocks();

    getUserRecommendationsAccess.mockResolvedValue({
      hasSubscription: true,
      canPublish: true,
      subscription: null,
      isFrozen: false,
      frozenUntil: null,
      frozenReason: null,
    } as any);

    createRecommendationAlert.mockResolvedValue({
      id: 55,
      analystUserId: 123,
      note: null,
      notifiedAt: new Date().toISOString(),
      unlockAt: new Date(Date.now() + 60_000).toISOString(),
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      status: "pending",
    } as any);

    getRecommendationSubscriberDetails.mockResolvedValue([] as any);
    getRecommendationPublishState.mockResolvedValue({
      activeAlert: null,
      canNotify: true,
      canPostMessages: false,
      secondsUntilUnlock: 0,
      secondsUntilExpiry: 0,
    } as any);
    createRecommendationMessage.mockResolvedValue(901);
    getRecommendationMessageById.mockResolvedValue({
      id: 901,
      type: "recommendation",
      symbol: "XAUUSD",
      parentId: null,
      threadStatus: "open",
    } as any);
    hasRecommendationResultChild.mockResolvedValue(true);
  });

  it("emails only inactive recommendation recipients during notify", async () => {
    const caller = createAuthedCaller();

    getRecommendationSubscriberDetails.mockResolvedValue([
      {
        userId: 1,
        email: "inactive@example.com",
        notificationPrefs: null,
        lastInteractiveAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      },
      {
        userId: 2,
        email: "active@example.com",
        notificationPrefs: null,
        lastInteractiveAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      },
      {
        userId: 3,
        email: "muted@example.com",
        notificationPrefs: JSON.stringify({ recommendations: false }),
        lastInteractiveAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        userId: 4,
        email: "english@example.com",
        notificationPrefs: JSON.stringify({ language: "en" }),
        lastInteractiveAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
    ] as any);

    const result = await caller.recommendations.notifyClients({});

    expect(result).toMatchObject({ success: true, recipientCount: 3, emailCount: 2 });
    expect(sendBulkNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [1, 2, 4],
        actionUrl: "/recommendations",
      })
    );
    expect(mockedSendEmail).toHaveBeenCalledTimes(2);
    expect(mockedSendEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "inactive@example.com",
        subject: "تنبيه التوصيات: جهّز تطبيق التداول، توصية جديدة قريبة",
        html: expect.stringContaining("افتح القناة الآن"),
      })
    );
    expect(mockedSendEmail).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: "english@example.com",
        subject: "Recommendations alert: be ready, a new recommendation is coming",
        html: expect.stringContaining("Open Channel Now"),
      })
    );
    expect(markNotificationEmailSent).toHaveBeenCalledWith(expect.any(String), 1);
    expect(markNotificationEmailSent).toHaveBeenCalledWith(expect.any(String), 4);
  });

  it("blocks a new recommendation until clients have been notified", async () => {
    const caller = createAuthedCaller();

    await expect(
      caller.recommendations.postMessage({
        type: "recommendation",
        content: "Gold looks ready for a breakout.",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Notify clients first, then wait one minute before sending in the recommendations channel.",
    } satisfies Partial<TRPCError>);
  });

  it("keeps all channel messages locked during the one-minute wait window", async () => {
    const caller = createAuthedCaller();

    getRecommendationPublishState.mockResolvedValue({
      activeAlert: {
        id: 55,
        analystUserId: 123,
        status: "pending",
        notifiedAt: new Date().toISOString(),
        unlockAt: new Date(Date.now() + 25_000).toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
      canNotify: false,
      canPostMessages: false,
      secondsUntilUnlock: 25,
      secondsUntilExpiry: 600,
    } as any);

    await expect(
      caller.recommendations.postMessage({
        type: "update",
        content: "Secure part of the trade.",
        parentId: 901,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Wait 25 more seconds before sending the next channel message.",
    } satisfies Partial<TRPCError>);
  });

  it("publishes the recommendation once the alert window is unlocked", async () => {
    const caller = createAuthedCaller();

    getRecommendationPublishState.mockResolvedValue({
      activeAlert: {
        id: 55,
        analystUserId: 123,
        status: "pending",
        notifiedAt: new Date().toISOString(),
        unlockAt: new Date(Date.now() - 5_000).toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
      canNotify: false,
      canPostMessages: true,
      secondsUntilUnlock: 0,
      secondsUntilExpiry: 600,
    } as any);
    getRecommendationSubscriberDetails.mockResolvedValue([
      {
        userId: 1,
        email: "subscriber@example.com",
        notificationPrefs: null,
        lastInteractiveAt: null,
      },
    ] as any);

    const result = await caller.recommendations.postMessage({
      type: "recommendation",
      content: "Buy XAUUSD on the pullback.",
      symbol: "XAUUSD",
      side: "BUY",
      entryPrice: "2320",
    });

    expect(result).toMatchObject({ success: true, messageId: 901 });
    expect(createRecommendationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "recommendation",
        symbol: "XAUUSD",
        parentId: null,
      })
    );
    expect(extendRecommendationAlertActivity).toHaveBeenCalledWith(55, 123);
    expect(sendBulkNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [1],
        batchId: "rec_live_901",
      })
    );
  });

  it("allows same-trade updates while the active window is open", async () => {
    const caller = createAuthedCaller();

    getRecommendationPublishState.mockResolvedValue({
      activeAlert: {
        id: 55,
        analystUserId: 123,
        status: "pending",
        notifiedAt: new Date().toISOString(),
        unlockAt: new Date(Date.now() - 5_000).toISOString(),
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      },
      canNotify: false,
      canPostMessages: true,
      secondsUntilUnlock: 0,
      secondsUntilExpiry: 600,
    } as any);

    const result = await caller.recommendations.postMessage({
      type: "update",
      content: "Buy now on market execution.",
      parentId: 901,
      symbol: "XAUUSD",
    });

    expect(result).toMatchObject({ success: true, messageId: 901 });
    expect(getRecommendationPublishState).toHaveBeenCalledWith(123);
    expect(createRecommendationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "update",
        parentId: 901,
        symbol: "XAUUSD",
      })
    );
    expect(extendRecommendationAlertActivity).toHaveBeenCalledWith(55, 123);
  });

  it("requires a fresh alert after 15 minutes of analyst silence", async () => {
    const caller = createAuthedCaller();

    getRecommendationPublishState.mockResolvedValue({
      activeAlert: {
        id: 55,
        analystUserId: 123,
        status: "pending",
        notifiedAt: new Date(Date.now() - 20 * 60_000).toISOString(),
        unlockAt: new Date(Date.now() - 19 * 60_000).toISOString(),
        expiresAt: new Date(Date.now() - 5_000).toISOString(),
      },
      canNotify: false,
      canPostMessages: false,
      secondsUntilUnlock: 0,
      secondsUntilExpiry: 0,
    } as any);

    await expect(
      caller.recommendations.postMessage({
        type: "update",
        content: "TP1 hit.",
        parentId: 901,
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "The chat paused after 15 minutes of analyst silence. Notify clients again before sending a new message.",
    } satisfies Partial<TRPCError>);
  });

  it("requires a result before closing a recommendation thread", async () => {
    const caller = createAuthedCaller();

    hasRecommendationResultChild.mockResolvedValue(false);

    await expect(
      caller.recommendations.closeThread({ messageId: 901 })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Add a result before closing this recommendation thread.",
    } satisfies Partial<TRPCError>);
  });

  it("closes a recommendation thread after a result exists", async () => {
    const caller = createAuthedCaller();

    const result = await caller.recommendations.closeThread({ messageId: 901 });

    expect(result).toMatchObject({ success: true });
    expect(hasRecommendationResultChild).toHaveBeenCalledWith(901);
    expect(closeRecommendationThread).toHaveBeenCalledWith(901, 123);
  });
});