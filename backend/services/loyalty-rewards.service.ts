export const LOYALTY_REWARDS_FEATURE_FLAG = "loyalty_rewards_enabled";

export const LOYALTY_REWARD_REDEMPTION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "fulfilled",
] as const;

export type LoyaltyRewardRedemptionStatus = typeof LOYALTY_REWARD_REDEMPTION_STATUSES[number];

export function isLoyaltyRewardsEnabled(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "true";
}
