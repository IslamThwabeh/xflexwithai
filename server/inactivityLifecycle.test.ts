import { describe, expect, it } from "vitest";

import {
  buildInactivityEmailContent,
  type InactivityEmailService,
} from "../backend/_core/orderEmails";
import { buildInactivityDigestNotification } from "../backend/_core/inactivityDigest";

const activeLexai: InactivityEmailService = {
  serviceType: "lexai",
  serviceName: "LexAI",
  status: "active",
  endDate: "2026-08-15T00:00:00.000Z",
  daysLeft: 16,
};

const expiredRecommendations: InactivityEmailService = {
  serviceType: "recommendations",
  serviceName: "Recommendations",
  status: "expired",
  endDate: "2026-07-20T00:00:00.000Z",
  daysLeft: 0,
};

describe("timed-service inactivity lifecycle", () => {
  it("encourages login when the client has only active timed services", () => {
    const email = buildInactivityEmailContent(7, {
      name: "Maya Saleh",
      services: [activeLexai],
    });

    expect(email.subject).toContain("Use your subscription before it expires");
    expect(email.body).toContain("LexAI");
    expect(email.body).toContain("Active — 16 days left");
    expect(email.body).toContain("https://xflexacademy.com/dashboard");
    expect(email.body).not.toContain(
      "https://xflexacademy.com/my-packages?focus=renewal"
    );
    expect(email.body).not.toContain("https://xflexacademy.com/courses");
  });

  it("shows login and renewal actions for mixed timed-service states", () => {
    const email = buildInactivityEmailContent(14, {
      name: "<Admin>",
      services: [activeLexai, expiredRecommendations],
    });

    expect(email.subject).toContain("Renew your timed services");
    expect(email.body).toContain("&lt;Admin&gt;");
    expect(email.body).toContain("Active — 16 days left");
    expect(email.body).toContain("Expired — renewal required");
    expect(email.body).toContain("https://xflexacademy.com/dashboard");
    expect(email.body).toContain(
      "https://xflexacademy.com/my-packages?focus=renewal"
    );
  });

  it("builds one staff digest with delivery outcomes for all clients", () => {
    const digest = buildInactivityDigestNotification([
      {
        userId: 1,
        email: "maya@example.com",
        name: "Maya",
        inactiveDays: 7,
        services: [activeLexai],
        deliveryStatus: "sent",
      },
      {
        userId: 2,
        email: "omar@example.com",
        name: "Omar",
        inactiveDays: 14,
        services: [expiredRecommendations],
        deliveryStatus: "failed",
      },
    ]);

    expect(digest?.titleEn).toBe("Inactivity outreach: 2 clients");
    expect(digest?.contentEn).toContain(
      "1 sent with admin BCC, 0 skipped, 1 failed"
    );
    expect(digest?.emailContentHtmlEn).toContain("Maya");
    expect(digest?.emailContentHtmlEn).toContain("Omar");
    expect(digest?.emailContentHtmlEn).toContain("Failed — will retry");
    expect(digest?.metadata.totalClients).toBe(2);
  });
});
