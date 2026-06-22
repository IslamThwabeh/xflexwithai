import { sendRecommendationBccBatch } from "../_core/email";
import { logger } from "../_core/logger";
import * as db from "../db";

export const RECOMMENDATION_DELIVERY_BATCH_SIZE = 50;
export const RECOMMENDATION_PROVIDER_BATCH_LIMIT = 4;
export const EMAIL_PROVIDER_REQUEST_BUDGET = 10;

export type RecommendationDrainSource = "scheduled" | "publish" | "daily";

export type RecommendationDrainResult = {
  claimed: number;
  sent: number;
  failed: number;
  skippedMissingPayload: number;
  providerRequests: number;
  batches: number;
};

export function getRemainingGenericEmailBudget(
  recommendationProviderRequests: number,
  totalBudget: number = EMAIL_PROVIDER_REQUEST_BUDGET,
): number {
  return Math.max(0, totalBudget - Math.max(0, recommendationProviderRequests));
}

export async function drainRecommendationDeliveryQueue(input: {
  limit?: number;
  maxBatches?: number;
  source: RecommendationDrainSource;
}): Promise<RecommendationDrainResult> {
  const limit = Math.max(
    1,
    Math.min(RECOMMENDATION_DELIVERY_BATCH_SIZE, input.limit ?? RECOMMENDATION_DELIVERY_BATCH_SIZE),
  );
  const maxBatches = Math.max(
    1,
    Math.min(RECOMMENDATION_PROVIDER_BATCH_LIMIT, input.maxBatches ?? RECOMMENDATION_PROVIDER_BATCH_LIMIT),
  );

  const stale = await db.reconcileStaleRecommendationDeliveries();
  if (stale.total > 0) {
    logger.warn("[RECOMMENDATION DELIVERY] Suppressed stale queued emails", {
      source: input.source,
      ...stale,
    });
  }

  const result: RecommendationDrainResult = {
    claimed: 0,
    sent: 0,
    failed: 0,
    skippedMissingPayload: 0,
    providerRequests: 0,
    batches: 0,
  };

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const rows = await db.claimNextRecommendationDeliveryBatch(limit);
    if (!rows.length) break;
    result.claimed += rows.length;
    result.batches += 1;

    const first = rows[0];
    const batchIds = rows.map((row) => row.id);
    const providerBatchKey = [
      first.eventKey,
      first.language,
      batchIds[0],
      batchIds[batchIds.length - 1],
      first.attempts + 1,
    ].join(":");
    const hasInvalidPayload = !first.subject || !first.bodyText || rows.some((row) =>
      !row.subject
      || !row.bodyText
      || row.subject !== first.subject
      || row.bodyText !== first.bodyText
      || row.bodyHtml !== first.bodyHtml
    );
    if (hasInvalidPayload) {
      await db.markRecommendationDeliveryBatchFailed({
        ids: batchIds,
        errorCategory: "missing_payload",
        errorMessage: "Stored recommendation batch has missing or non-identical content",
        providerBatchKey,
      });
      result.skippedMissingPayload += rows.length;
      continue;
    }

    try {
      result.providerRequests += 1;
      const eventType = first.eventKind === "alert"
        ? "recommendation_alert"
        : `recommendation_${first.eventKind}`;
      const emailResult = await sendRecommendationBccBatch({
        recipients: rows.map((row) => ({
          email: row.recipientEmail,
          userId: row.userId,
        })),
        subject: first.subject!,
        text: first.bodyText!,
        html: first.bodyHtml ?? undefined,
        eventType,
        templateId: eventType,
        providerBatchKey,
        metadata: {
          source: input.source,
          eventKey: first.eventKey,
          refId: first.refId,
          language: first.language,
        },
      });
      await db.markRecommendationDeliveryBatchSent({
        ids: batchIds,
        provider: emailResult.provider,
        attemptedProviders: emailResult.attemptedProviders,
        providerRequestId: emailResult.providerRequestId,
        providerBatchKey,
      });
      result.sent += rows.length;
    } catch (error) {
      await db.markRecommendationDeliveryBatchFailed({
        ids: batchIds,
        errorCategory: (error as { category?: string })?.category ?? "unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
        attemptedProviders: (error as { attemptedProviders?: string[] })?.attemptedProviders,
        providerBatchKey,
      });
      result.failed += rows.length;
    }
  }

  return result;
}
