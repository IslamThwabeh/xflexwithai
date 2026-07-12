import { describe, expect, it } from "vitest";
import {
  LOYALTY_REWARDS_FEATURE_FLAG,
  isLoyaltyRewardsEnabled,
} from "../backend/services/loyalty-rewards.service";

describe("loyalty rewards feature flag", () => {
  it("uses a dedicated disabled-by-default flag name", () => {
    expect(LOYALTY_REWARDS_FEATURE_FLAG).toBe("loyalty_rewards_enabled");
  });

  it("only enables rewards for explicit true", () => {
    expect(isLoyaltyRewardsEnabled(null)).toBe(false);
    expect(isLoyaltyRewardsEnabled("false")).toBe(false);
    expect(isLoyaltyRewardsEnabled("1")).toBe(false);
    expect(isLoyaltyRewardsEnabled(" TRUE ")).toBe(true);
  });
});
