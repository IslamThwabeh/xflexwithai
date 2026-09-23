import { describe, expect, it } from "vitest";
import { shouldApplyProviderDeliveryEvent } from "../shared/emailDeliveryLifecycle";

const later = "2026-09-22T10:01:00.000Z";
const earlier = "2026-09-22T10:00:00.000Z";

describe("provider email delivery lifecycle", () => {
  it("allows a successful retry after a transient event", () => {
    expect(shouldApplyProviderDeliveryEvent({
      currentStatus: "bounced_soft",
      currentEventAt: earlier,
      nextStatus: "delivered",
      nextEventAt: later,
    })).toBe(true);
  });

  it("does not let older events replace newer projections", () => {
    expect(shouldApplyProviderDeliveryEvent({
      currentStatus: "deferred",
      currentEventAt: later,
      nextStatus: "bounced_soft",
      nextEventAt: earlier,
    })).toBe(false);
  });

  it("keeps terminal outcomes except for a later complaint", () => {
    expect(shouldApplyProviderDeliveryEvent({
      currentStatus: "delivered",
      currentEventAt: earlier,
      nextStatus: "bounced_hard",
      nextEventAt: later,
    })).toBe(false);
    expect(shouldApplyProviderDeliveryEvent({
      currentStatus: "delivered",
      currentEventAt: earlier,
      nextStatus: "complained",
      nextEventAt: later,
    })).toBe(true);
  });

  it("uses status precedence when timestamps are equal", () => {
    expect(shouldApplyProviderDeliveryEvent({
      currentStatus: "deferred",
      currentEventAt: earlier,
      nextStatus: "bounced_soft",
      nextEventAt: earlier,
    })).toBe(true);
    expect(shouldApplyProviderDeliveryEvent({
      currentStatus: "bounced_soft",
      currentEventAt: earlier,
      nextStatus: "deferred",
      nextEventAt: earlier,
    })).toBe(false);
  });
});
