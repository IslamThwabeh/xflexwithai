import { describe, expect, it } from "vitest";

import { buildSubscriptionExpiryDigestNotification } from "../backend/_core/subscriptionExpiryDigest";

describe("subscription expiry digest", () => {
  it("returns null when there are no subscriptions to report", () => {
    expect(buildSubscriptionExpiryDigestNotification([])).toBeNull();
  });

  it("builds one digest containing all expiring subscriptions", () => {
    const digest = buildSubscriptionExpiryDigestNotification([
      {
        userId: 2,
        email: "maya@example.com",
        name: "Maya Saleh",
        daysLeft: 7,
        stage: "t-7",
        serviceType: "recommendations",
        serviceName: "Recommendations",
        packageName: "Pro Package",
        endDate: "2026-07-09T00:00:00.000Z",
      },
      {
        userId: 1,
        email: "omar@example.com",
        name: "Omar Haddad",
        daysLeft: 0,
        stage: "d0",
        serviceType: "lexai",
        serviceName: "LexAI",
        packageName: "Elite Package",
        endDate: "2026-07-02T00:00:00.000Z",
      },
      {
        userId: 3,
        email: "lana@example.com",
        name: null,
        daysLeft: -3,
        stage: "d+3",
        serviceType: "lexai",
        serviceName: "LexAI",
        packageName: "Starter Package",
        endDate: "2026-06-29T00:00:00.000Z",
      },
    ]);

    expect(digest).not.toBeNull();
    expect(digest?.titleEn).toBe("3 subscription renewals need attention");
    expect(digest?.contentEn).toContain("1 expired, 1 expire today, 1 upcoming");
    expect(digest?.contentEn).toContain("lana@example.com (lana@example.com) - LexAI");
    expect(digest?.contentEn).toContain("Omar Haddad (omar@example.com) - LexAI");
    expect(digest?.contentEn).toContain("Maya Saleh (maya@example.com) - Recommendations");
    expect(digest?.metadata.subscriptions.map((item) => item.userId)).toEqual([3, 1, 2]);
  });
});
