import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../backend/_core/email", () => ({
  sendAdminNotificationEmail: vi.fn().mockResolvedValue({
    provider: "zeptomail",
    attemptedProviders: ["zeptomail"],
    providerRequestId: null,
    sentUserIds: [],
    skippedUserIds: [],
    recipientCount: 0,
    deliveryMode: "none",
  }),
  sendEmail: vi.fn().mockResolvedValue({ provider: "zeptomail", attemptedProviders: ["zeptomail"] }),
}));

vi.mock("../backend/services/recommendation-delivery.service", () => ({
  RECOMMENDATION_DELIVERY_BATCH_SIZE: 10,
  drainRecommendationDeliveryQueue: vi.fn().mockResolvedValue({
    claimed: 0,
    sent: 0,
    failed: 0,
    skippedMissingPayload: 0,
  }),
}));

vi.mock("../backend/db", async () => {
  const actual = await vi.importActual<typeof import("../backend/db")>("../backend/db");

  return {
    ...actual,
    getAdminByEmail: vi.fn().mockResolvedValue(null),
    getUserRecommendationsAccess: vi.fn(),
    hasAnyRole: vi.fn(),
    createRecommendationAlert: vi.fn(),
    getRecommendationSubscriberDetails: vi.fn(),
    getRecommendationDeliveryFunnel: vi.fn(),
    sendBulkNotification: vi.fn().mockResolvedValue(undefined),
    markNotificationEmailSent: vi.fn().mockResolvedValue(undefined),
    markNotificationEmailsSent: vi.fn().mockResolvedValue(undefined),
    prepareRecommendationDeliveries: vi.fn().mockResolvedValue({ inserted: 0, skippedDuplicate: 0 }),
    insertSkippedRecommendationDeliveries: vi.fn().mockResolvedValue(undefined),
    markRecommendationDeliverySent: vi.fn().mockResolvedValue(undefined),
    markRecommendationDeliveryFailed: vi.fn().mockResolvedValue(undefined),
    enqueueEmailOutbox: vi.fn().mockResolvedValue(true),
    getConfiguredAdminNotificationEmails: vi.fn().mockResolvedValue([]),
    getMutedRecommendationUserIdsForThread: vi.fn().mockResolvedValue([]),
    getRecommendationPublishState: vi.fn(),
    findSimilarOpenRecommendationForAnalyst: vi.fn(),
    createRecommendationMessage: vi.fn(),
    extendRecommendationAlertActivity: vi.fn().mockResolvedValue(undefined),
    getRecommendationMessageById: vi.fn(),
    hasRecommendationResultChild: vi.fn(),
    closeRecommendationThread: vi.fn().mockResolvedValue(undefined),
    cancelRecommendationAlert: vi.fn().mockResolvedValue(undefined),
    clearUserInteraction: vi.fn().mockResolvedValue(undefined),
    listActiveRecommendationAlerts: vi.fn(),
    getOpenRecommendationMessagesFeed: vi.fn(),
    getRecommendationMessagesFeed: vi.fn().mockResolvedValue([]),
    getRecommendationThreadSummary: vi.fn().mockResolvedValue({ total: 0 }),
    getRecommendationThreadMessagesFeed: vi.fn(),
    getRecommendationMonthlyTradeReport: vi.fn(),
    getRecommendationAnalystComparisonReport: vi.fn(),
    getUnreadStaffNotificationBadges: vi.fn(),
    saveRecommendationTradeResultOverride: vi.fn(),
  };
});

import { sendEmail } from "../backend/_core/email";
import { appRouter } from "../backend/routers";
import * as db from "../backend/db";
import { drainRecommendationDeliveryQueue } from "../backend/services/recommendation-delivery.service";

function createAuthedCaller(contextOverrides: Record<string, unknown> = {}) {
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
    ...contextOverrides,
  } as any);
}

describe("recommendations workflow", () => {
  const getUserRecommendationsAccess = vi.mocked(db.getUserRecommendationsAccess);
  const hasAnyRole = vi.mocked(db.hasAnyRole);
  const createRecommendationAlert = vi.mocked(db.createRecommendationAlert);
  const getRecommendationSubscriberDetails = vi.mocked(db.getRecommendationSubscriberDetails);
  const getRecommendationDeliveryFunnel = vi.mocked(db.getRecommendationDeliveryFunnel);
  const sendBulkNotification = vi.mocked(db.sendBulkNotification);
  const markRecommendationDeliverySent = vi.mocked(db.markRecommendationDeliverySent);
  const prepareRecommendationDeliveries = vi.mocked(db.prepareRecommendationDeliveries);
  const getMutedRecommendationUserIdsForThread = vi.mocked(db.getMutedRecommendationUserIdsForThread);
  const getRecommendationPublishState = vi.mocked(db.getRecommendationPublishState);
  const findSimilarOpenRecommendationForAnalyst = vi.mocked(db.findSimilarOpenRecommendationForAnalyst);
  const createRecommendationMessage = vi.mocked(db.createRecommendationMessage);
  const extendRecommendationAlertActivity = vi.mocked(db.extendRecommendationAlertActivity);
  const getRecommendationMessageById = vi.mocked(db.getRecommendationMessageById);
  const hasRecommendationResultChild = vi.mocked(db.hasRecommendationResultChild);
  const closeRecommendationThread = vi.mocked(db.closeRecommendationThread);
  const clearUserInteraction = vi.mocked(db.clearUserInteraction);
  const listActiveRecommendationAlerts = vi.mocked(db.listActiveRecommendationAlerts);
  const getOpenRecommendationMessagesFeed = vi.mocked(db.getOpenRecommendationMessagesFeed);
  const getRecommendationThreadMessagesFeed = vi.mocked(db.getRecommendationThreadMessagesFeed);
  const getRecommendationMonthlyTradeReport = vi.mocked(db.getRecommendationMonthlyTradeReport);
  const getRecommendationAnalystComparisonReport = vi.mocked(db.getRecommendationAnalystComparisonReport);
  const getUnreadStaffNotificationBadges = vi.mocked(db.getUnreadStaffNotificationBadges);
  const saveRecommendationTradeResultOverride = vi.mocked(db.saveRecommendationTradeResultOverride);
  const mockedSendEmail = vi.mocked(sendEmail);
  const mockedDrainRecommendationDeliveryQueue = vi.mocked(drainRecommendationDeliveryQueue);

  const emptyDiagnostics = {
    totalSubs: 0, activeSubs: 0, pending: 0, paused: 0, expired: 0,
    optedOut: 0, staffExcluded: 0, malformedPrefs: 0, missingEmail: 0,
    accountUnavailable: 0, accountDisabled: 0, notificationsDisabled: 0, eligibleCount: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    hasAnyRole.mockResolvedValue(false);

    getUserRecommendationsAccess.mockResolvedValue({
      hasSubscription: true,
      canPublish: true,
      subscription: null,
      isFrozen: false,
      frozenUntil: null,
      frozenReason: null,
      hasDuplicateGuard: false,
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
    getRecommendationDeliveryFunnel.mockResolvedValue({ eligible: [], diagnostics: { ...emptyDiagnostics } } as any);
    getRecommendationPublishState.mockResolvedValue({
      activeAlert: null,
      canNotify: true,
      canPostMessages: false,
      secondsUntilUnlock: 0,
      secondsUntilExpiry: 0,
    } as any);
    listActiveRecommendationAlerts.mockResolvedValue([] as any);
    getOpenRecommendationMessagesFeed.mockResolvedValue([] as any);
    getRecommendationThreadMessagesFeed.mockResolvedValue({ messages: [], total: 0, limit: 50, offset: 0 } as any);
    createRecommendationMessage.mockResolvedValue(901);
    findSimilarOpenRecommendationForAnalyst.mockResolvedValue(null);
    getRecommendationMessageById.mockResolvedValue({
      id: 901,
      userId: 123,
      type: "recommendation",
      content: "Buy XAUUSD on the pullback.",
      symbol: "XAUUSD",
      side: "BUY",
      entryPrice: "2320",
      stopLoss: "2314",
      takeProfit1: "2328",
      takeProfit2: "2336",
      parentId: null,
      threadStatus: "open",
    } as any);
    hasRecommendationResultChild.mockResolvedValue(true);
    getRecommendationMonthlyTradeReport.mockResolvedValue({
      month: "2026-05",
      trades: [],
      unresolved: [],
      summary: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPipsWon: 0,
        totalPipsLost: 0,
        netPips: 0,
        lotEquivalent: {
          lot001: 0,
          lot005: 0,
          lot010: 0,
          lot100: 0,
        },
      },
      coverage: {
        candidates: 0,
        finalized: 0,
        unresolved: 0,
      },
    });
    getRecommendationAnalystComparisonReport.mockResolvedValue({
      month: "2026-05",
      analysts: [],
    } as any);
    getUnreadStaffNotificationBadges.mockResolvedValue({ total: 0, byRoute: {} } as any);
    saveRecommendationTradeResultOverride.mockResolvedValue({
      id: 902,
      parentId: 901,
      type: "result",
      resultOutcome: "win",
      resultPips: 25,
    } as any);
  });

  it("returns monthly trade report for recommendation channel managers", async () => {
    const caller = createAuthedCaller();

    const result = await caller.recommendations.monthlyTradeReport({ month: "2026-05" });

    expect(getRecommendationMonthlyTradeReport).toHaveBeenCalledWith("2026-05", 123);
    expect(result).toMatchObject({ month: "2026-05" });
  });

  it("scopes analyst management feeds to the signed-in analyst", async () => {
    const caller = createAuthedCaller();

    await caller.recommendations.activeAlerts();
    await caller.recommendations.openThreads();
    await caller.recommendations.threadMessages({ status: "closed", limit: 20, offset: 0 });
    await caller.recommendations.feed({ limit: 20 });
    await caller.recommendations.threadSummary();

    expect(listActiveRecommendationAlerts).toHaveBeenCalledWith(123);
    expect(getOpenRecommendationMessagesFeed).toHaveBeenCalledWith(123, 123);
    expect(getRecommendationThreadMessagesFeed).toHaveBeenCalledWith(123, expect.objectContaining({
      status: "closed",
      analystUserId: 123,
    }));
    expect(db.getRecommendationMessagesFeed).toHaveBeenCalledWith(123, 20, 123);
    expect(db.getRecommendationThreadSummary).toHaveBeenCalledWith(123);
  });

  const attributedMessage = {
    id: 1, userId: 456, authorName: "Other Analyst", authorEmail: "other@example.com",
    isAnalyst: true, closedByUserId: -1, deliveryDiagnosticsJson: '{"staffExcluded":2}',
    content: "Recommendation text", parentId: null, type: "recommendation",
  };

  it.each(["analyst", "subscriber"])("keeps author details out of all %s feed responses", async (viewer) => {
    getUserRecommendationsAccess.mockResolvedValue({ hasSubscription: true, canPublish: viewer === "analyst" } as any);
    vi.mocked(db.getRecommendationMessagesFeed).mockResolvedValue([attributedMessage] as any);
    getOpenRecommendationMessagesFeed.mockResolvedValue([attributedMessage] as any);
    getRecommendationThreadMessagesFeed.mockResolvedValue({ messages: [attributedMessage], total: 1 } as any);
    const caller = createAuthedCaller();
    const feeds = [
      await caller.recommendations.feed(),
      await caller.recommendations.openThreads(),
      (await caller.recommendations.threadMessages()).messages,
    ];
    for (const messages of feeds) {
      expect(messages[0]).toMatchObject({
        userId: 0, authorName: "XFlex", authorEmail: null, isAnalyst: false,
        closedByUserId: null, deliveryDiagnosticsJson: null, content: "Recommendation text",
      });
    }
  });

  it("returns per-post author attribution to full admins", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValueOnce({ id: 1 } as any)
      .mockResolvedValueOnce({ id: 1 } as any).mockResolvedValueOnce({ id: 1 } as any);
    vi.mocked(db.getRecommendationMessagesFeed).mockResolvedValue([attributedMessage] as any);
    getOpenRecommendationMessagesFeed.mockResolvedValue([attributedMessage] as any);
    getRecommendationThreadMessagesFeed.mockResolvedValue({ messages: [attributedMessage], total: 1 } as any);
    const caller = createAuthedCaller();
    expect((await caller.recommendations.feed())[0]).toEqual(attributedMessage);
    expect((await caller.recommendations.openThreads())[0]).toEqual(attributedMessage);
    expect((await caller.recommendations.threadMessages()).messages[0]).toEqual(attributedMessage);
  });

  it("blocks analysts from the admin analyst directory and comparison", async () => {
    const caller = createAuthedCaller();
    await expect(caller.recommendationAdmin.listAnalysts()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.recommendationAdmin.analystComparisonReport()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows analyst staff to read staff notification badge counts", async () => {
    const caller = createAuthedCaller();
    hasAnyRole.mockImplementation(async (_userId, roles) => roles.includes("analyst"));

    const result = await caller.staffNotifications.badgeCounts();

    expect(hasAnyRole).toHaveBeenCalledWith(
      123,
      expect.arrayContaining(["analyst", "analyst_duplicate_guard"])
    );
    expect(getUnreadStaffNotificationBadges).toHaveBeenCalledWith(123);
    expect(result).toMatchObject({ total: 0, byRoute: {} });
  });

  it("keeps full-admin recommendation management feeds global", async () => {
    vi.mocked(db.getAdminByEmail)
      .mockResolvedValueOnce({
        id: 1,
        email: "owner@example.com",
        name: "Owner",
      } as any)
      .mockResolvedValueOnce({
        id: 1,
        email: "owner@example.com",
        name: "Owner",
      } as any)
      .mockResolvedValueOnce({
        id: 1,
        email: "owner@example.com",
        name: "Owner",
      } as any)
      .mockResolvedValueOnce({
      id: 1,
      email: "owner@example.com",
      name: "Owner",
    } as any);
    const caller = createAuthedCaller({
      user: {
        id: 999,
        email: "owner@example.com",
        passwordHash: "",
        name: "Owner",
        phone: null,
        emailVerified: true,
        createdAt: "",
        updatedAt: "",
        lastSignedIn: "",
      },
    });

    await caller.recommendations.activeAlerts();
    await caller.recommendations.openThreads();
    await caller.recommendations.threadMessages({ status: "all", limit: 20, offset: 0 });
    await caller.recommendations.monthlyTradeReport({ month: "2026-05" });

    expect(listActiveRecommendationAlerts).toHaveBeenCalledWith(undefined);
    expect(getOpenRecommendationMessagesFeed).toHaveBeenCalledWith(999, undefined);
    expect(getRecommendationThreadMessagesFeed).toHaveBeenCalledWith(999, expect.objectContaining({
      status: "all",
      analystUserId: undefined,
    }));
    expect(getRecommendationMonthlyTradeReport).toHaveBeenCalledWith("2026-05", undefined);
  });

  it("returns admin-only analyst comparison report", async () => {
    vi.mocked(db.getAdminByEmail).mockResolvedValueOnce({
      id: 1,
      email: "owner@example.com",
      name: "Owner",
    } as any);
    const caller = createAuthedCaller({
      user: {
        id: 999,
        email: "owner@example.com",
        passwordHash: "",
        name: "Owner",
        phone: null,
        emailVerified: true,
        createdAt: "",
        updatedAt: "",
        lastSignedIn: "",
      },
    });

    const result = await caller.recommendationAdmin.analystComparisonReport({ month: "2026-05" });

    expect(getRecommendationAnalystComparisonReport).toHaveBeenCalledWith("2026-05");
    expect(result).toMatchObject({ month: "2026-05", analysts: [] });
  });

  it("saves manual trade result overrides", async () => {
    const caller = createAuthedCaller();

    const result = await caller.recommendations.saveTradeResult({
      messageId: 902,
      outcome: "win",
      pips: 25,
    });

    expect(saveRecommendationTradeResultOverride).toHaveBeenCalledWith({
      messageId: 902,
      outcome: "win",
      pips: 25,
      analystUserId: 123,
      isAdmin: false,
    });
    expect(result).toMatchObject({ success: true });
  });

  it("queues recommendation alert email deliveries for every eligible recipient", async () => {
    const deferredTasks: Promise<unknown>[] = [];
    const caller = createAuthedCaller({
      defer: (task: Promise<unknown>) => deferredTasks.push(task),
    });

    const eligible = [
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
        userId: 4,
        email: "english@example.com",
        notificationPrefs: JSON.stringify({ language: "en" }),
        lastInteractiveAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
    ];
    getRecommendationDeliveryFunnel.mockResolvedValue({
      eligible: eligible as any,
      diagnostics: { ...emptyDiagnostics, totalSubs: 4, activeSubs: 4, optedOut: 1, eligibleCount: 3 },
    } as any);

    const result = await caller.recommendations.notifyClients({});

    expect(result).toMatchObject({ success: true, recipientCount: 3, emailCount: 0, emailsQueued: 3 });
    expect(sendBulkNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [1, 2, 4],
        actionUrl: "/recommendations",
      })
    );
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(markRecommendationDeliverySent).not.toHaveBeenCalled();
    expect(mockedDrainRecommendationDeliveryQueue).toHaveBeenCalledWith({
      limit: 10,
      eventKey: "rec_alert:55",
      source: "publish",
    });
    expect(deferredTasks).toHaveLength(1);
    expect(prepareRecommendationDeliveries).toHaveBeenCalledWith(expect.objectContaining({
      recipients: expect.arrayContaining([
        expect.objectContaining({
          userId: 1,
          subject: "تنبيه التوصيات: جهّز تطبيق التداول، توصية جديدة قريبة",
          bodyText: expect.stringContaining("افتح القناة الآن"),
          bodyHtml: expect.stringContaining("افتح القناة الآن"),
        }),
      ]),
    }));
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

  it("keeps new recommendations locked during the one-minute wait window", async () => {
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
        type: "recommendation",
        content: "Buy XAUUSD on the pullback.",
        symbol: "XAUUSD",
        side: "BUY",
        entryPrice: "2320",
        stopLoss: "2310",
        takeProfit1: "2330",
        takeProfit2: "2340",
        takeProfit3: "2350",
        riskPercent: "1%",
      })
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Wait 25 more seconds before sending the next channel message.",
    } satisfies Partial<TRPCError>);
    expect(createRecommendationMessage).not.toHaveBeenCalled();
    expect(prepareRecommendationDeliveries).not.toHaveBeenCalled();
    expect(sendBulkNotification).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
  });

  it("allows silent follow-ups on older open recommendations without alerting clients", async () => {
    const caller = createAuthedCaller();

    const result = await caller.recommendations.postMessage({
      type: "update",
      content: "Secure part of the trade.",
      parentId: 901,
      symbol: "XAUUSD",
    });

    expect(result).toMatchObject({ success: true, messageId: 901 });
    expect(createRecommendationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "update",
        parentId: 901,
        symbol: "XAUUSD",
        deliveryDiagnosticsJson: null,
      })
    );
    expect(getRecommendationDeliveryFunnel).not.toHaveBeenCalled();
    expect(prepareRecommendationDeliveries).not.toHaveBeenCalled();
    expect(sendBulkNotification).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(extendRecommendationAlertActivity).not.toHaveBeenCalled();
  });

  it("publishes the recommendation once the alert window is unlocked", async () => {
    const deferredTasks: Promise<unknown>[] = [];
    const caller = createAuthedCaller({
      defer: (task: Promise<unknown>) => deferredTasks.push(task),
    });

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
    getRecommendationDeliveryFunnel.mockResolvedValue({
      eligible: [
        {
          userId: 1,
          email: "subscriber@example.com",
          notificationPrefs: null,
          lastInteractiveAt: null,
        },
      ] as any,
      diagnostics: { ...emptyDiagnostics, totalSubs: 1, activeSubs: 1, eligibleCount: 1 },
    } as any);

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
    expect(findSimilarOpenRecommendationForAnalyst).not.toHaveBeenCalled();
    expect(extendRecommendationAlertActivity).toHaveBeenCalledWith(55, 123);
    expect(sendBulkNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [1],
        batchId: "rec_live_901",
      })
    );
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(prepareRecommendationDeliveries).toHaveBeenCalledWith(expect.objectContaining({
      recipients: expect.arrayContaining([
        expect.objectContaining({
          userId: 1,
          subject: expect.stringContaining("التوصية الآن"),
          bodyText: expect.stringContaining("XAUUSD"),
          bodyHtml: expect.stringContaining("XAUUSD"),
        }),
      ]),
    }));
    expect(markRecommendationDeliverySent).not.toHaveBeenCalled();
    expect(mockedDrainRecommendationDeliveryQueue).toHaveBeenCalledWith({
      limit: 10,
      eventKey: "rec_msg:901",
      source: "publish",
    });
    expect(deferredTasks).toHaveLength(1);
  });

  it("allows same-trade updates while the active window is open and emails offline clients", async () => {
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
    getRecommendationDeliveryFunnel.mockResolvedValue({
      eligible: [
        {
          userId: 1,
          email: "offline-update@example.com",
          notificationPrefs: JSON.stringify({ language: "en" }),
          lastInteractiveAt: null,
        },
        {
          userId: 2,
          email: "online-update@example.com",
          notificationPrefs: null,
          lastInteractiveAt: new Date().toISOString(),
        },
      ] as any,
      diagnostics: { ...emptyDiagnostics, totalSubs: 2, activeSubs: 2, eligibleCount: 2 },
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
    expect(sendBulkNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [1, 2],
        titleEn: "Trade Update — XAUUSD",
        batchId: "rec_live_901",
      })
    );
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(prepareRecommendationDeliveries).toHaveBeenCalledWith(expect.objectContaining({
      eventKind: "update",
      recipients: expect.arrayContaining([
        expect.objectContaining({
          userId: 1,
          subject: "Trade update: XAUUSD",
          bodyHtml: expect.stringContaining("Latest update"),
        }),
      ]),
    }));
    expect(markRecommendationDeliverySent).not.toHaveBeenCalled();
  });

  it("emails offline clients when a result is posted", async () => {
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
    getRecommendationDeliveryFunnel.mockResolvedValue({
      eligible: [
        {
          userId: 1,
          email: "offline-result@example.com",
          notificationPrefs: null,
          lastInteractiveAt: null,
        },
      ] as any,
      diagnostics: { ...emptyDiagnostics, totalSubs: 1, activeSubs: 1, eligibleCount: 1 },
    } as any);

    const result = await caller.recommendations.postMessage({
      type: "result",
      content: "TP1 hit and the trade is closed in profit.",
      parentId: 901,
    });

    expect(result).toMatchObject({ success: true, messageId: 901 });
    expect(sendBulkNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [1],
        titleAr: "نتيجة الصفقة — XAUUSD",
        batchId: "rec_live_901",
      })
    );
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(prepareRecommendationDeliveries).toHaveBeenCalledWith(expect.objectContaining({
      eventKind: "result",
      recipients: expect.arrayContaining([
        expect.objectContaining({
          userId: 1,
          subject: "نتيجة الصفقة: XAUUSD",
          bodyHtml: expect.stringContaining("النتيجة الجديدة"),
        }),
      ]),
    }));
    expect(markRecommendationDeliverySent).not.toHaveBeenCalled();
  });

  it("requires a fresh alert for new recommendations after 15 minutes of analyst silence", async () => {
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
        type: "recommendation",
        content: "Gold looks ready for a new breakout.",
        symbol: "XAUUSD",
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
    expect(closeRecommendationThread).toHaveBeenCalledWith(901, 123, false);
  });

  it("blocks guarded analysts from publishing a similar open recommendation", async () => {
    const caller = createAuthedCaller();

    getUserRecommendationsAccess.mockResolvedValue({
      hasSubscription: true,
      canPublish: true,
      subscription: null,
      isFrozen: false,
      frozenUntil: null,
      frozenReason: null,
      hasDuplicateGuard: true,
    } as any);
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
    getRecommendationDeliveryFunnel.mockResolvedValue({
      eligible: [{ userId: 1, email: "subscriber@example.com", notificationPrefs: null }] as any,
      diagnostics: { ...emptyDiagnostics, totalSubs: 1, activeSubs: 1, eligibleCount: 1 },
    } as any);
    findSimilarOpenRecommendationForAnalyst.mockResolvedValue({
      id: 777,
      userId: 456,
      content: "Buy XAUUSD on the pullback.",
    } as any);

    await expect(
      caller.recommendations.postMessage({
        type: "recommendation",
        content: "Buy XAUUSD on the pullback.",
        symbol: "XAUUSD",
      })
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "A similar recommendation already exists for this client.",
    } satisfies Partial<TRPCError>);

    expect(createRecommendationMessage).not.toHaveBeenCalled();
  });

  it("clears the recommendation interaction marker on logout", async () => {
    const clearCookie = vi.fn();
    const caller = appRouter.createCaller({
      req: {
        headers: {},
        method: "POST",
        path: "/api/trpc/auth.logout",
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
      clearCookie,
    } as any);

    const result = await caller.auth.logout();

    expect(result).toMatchObject({ success: true });
    expect(clearUserInteraction).toHaveBeenCalledWith(123);
    expect(clearCookie).toHaveBeenCalled();
  });
});
