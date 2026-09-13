import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(
    new URL("../frontend/src/pages/AdminRecommendations.tsx", import.meta.url),
  ),
  "utf8",
);

describe("Admin recommendation subscription freeze controls", () => {
  it("keeps unfreeze available when a frozen subscription's original end date has passed", () => {
    expect(source).toContain(
      "const canToggleFreeze = subscription.isPaused || (!isInactive && !isExpired)",
    );
    expect(source).toContain(
      "resumeSubscriptionMutation.mutate({ subscriptionId: subscription.id })",
    );
  });
});
