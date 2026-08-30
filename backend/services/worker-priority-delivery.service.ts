export type PriorityDeliveryLane = "recommendation" | "support";

type PriorityDeliveryDependencies = {
  drainRecommendations: () => Promise<{ providerRequests: number }>;
  drainSupportReplies: () => Promise<unknown>;
  recommendationFailureProviderRequests?: number;
  onError: (lane: PriorityDeliveryLane, error: unknown) => void;
};

/**
 * Run the two time-sensitive delivery lanes before lower-priority cron work.
 *
 * Workers Free allows only 10 ms of CPU per scheduled invocation. Keep these
 * lanes isolated so a failure in one lane, or later maintenance exhausting the
 * CPU budget, cannot prevent the other priority lane from being attempted.
 */
export async function runPriorityDeliveryLanes(
  dependencies: PriorityDeliveryDependencies
): Promise<{ recommendationProviderRequests: number }> {
  let recommendationProviderRequests = 0;

  try {
    const recommendationDrain = await dependencies.drainRecommendations();
    recommendationProviderRequests = Math.max(
      0,
      recommendationDrain.providerRequests
    );
  } catch (error) {
    // The provider may have accepted a request before an unexpected failure.
    // Reserve the caller-supplied ceiling instead of granting that uncertain
    // capacity to lower-priority survey/community/generic lanes.
    recommendationProviderRequests = Math.max(
      0,
      dependencies.recommendationFailureProviderRequests ?? 0
    );
    dependencies.onError("recommendation", error);
  }

  try {
    await dependencies.drainSupportReplies();
  } catch (error) {
    dependencies.onError("support", error);
  }

  return { recommendationProviderRequests };
}
