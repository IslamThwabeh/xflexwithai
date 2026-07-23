import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STAFF_NOTIFICATION_EVENTS } from "../shared/const";

const dbSource = readFileSync(
  new URL("../backend/db.ts", import.meta.url),
  "utf8",
);

const communityEmailEvents = [
  "community_post_created",
  "community_comment_created",
  "community_content_reported",
  "community_content_blocked",
  "community_high_risk_violation",
  "community_repeat_violation",
  "community_moderation_failure",
] as const;

describe("student community email notification policy", () => {
  it("targets every Phase 5A event to authorized community moderators", () => {
    for (const eventType of communityEmailEvents) {
      expect(STAFF_NOTIFICATION_EVENTS[eventType]).toMatchObject({
        roles: ["student_community_moderator"],
        actionUrl: "/admin/community",
      });
    }
  });

  it("delivers community events through the private BCC staff email path", () => {
    const bccPolicy = dbSource.slice(
      dbSource.indexOf("const SUPPORT_STAFF_BCC_EMAIL_EVENTS"),
      dbSource.indexOf("const PORTAL_ONLY_STAFF_NOTIFICATION_EVENTS"),
    );
    for (const eventType of communityEmailEvents) {
      expect(bccPolicy).toContain(`'${eventType}'`);
    }
  });

  it("emails reports and throttles noisy community events", () => {
    const portalOnlyPolicy = dbSource.slice(
      dbSource.indexOf("const PORTAL_ONLY_STAFF_NOTIFICATION_EVENTS"),
      dbSource.indexOf("const STAFF_NOTIFICATION_EMAIL_THROTTLE_MINUTES"),
    );
    expect(portalOnlyPolicy).not.toContain("'community_content_reported'");

    expect(dbSource).toContain("community_comment_created: 5");
    expect(dbSource).toContain("community_content_blocked: 5");
    expect(dbSource).toContain("community_repeat_violation: 60");
    expect(dbSource).toContain("community_moderation_failure: 60");
  });
});
