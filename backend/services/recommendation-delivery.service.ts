import { sendEmail } from "../_core/email";
import { logger } from "../_core/logger";
import * as db from "../db";

export const RECOMMENDATION_DELIVERY_BATCH_SIZE = 10;

export type RecommendationDrainSource = "scheduled" | "publish" | "daily";

export type RecommendationDrainResult = {
  claimed: number;
  sent: number;
  failed: number;
  skippedMissingPayload: number;
};

export function getRemainingGenericEmailBudget(
  recommendationClaimed: number,
  totalBudget: number = RECOMMENDATION_DELIVERY_BATCH_SIZE,
): number {
  return Math.max(0, totalBudget - Math.max(0, recommendationClaimed));
}

export async function drainRecommendationDeliveryQueue(input: {
  limit?: number;
  source: RecommendationDrainSource;
}): Promise<RecommendationDrainResult> {
  const limit = Math.max(
    1,
    Math.min(RECOMMENDATION_DELIVERY_BATCH_SIZE, input.limit ?? RECOMMENDATION_DELIVERY_BATCH_SIZE),
  );

  const stale = await db.reconcileStaleRecommendationDeliveries();
  if (stale.total > 0) {
    logger.warn("[RECOMMENDATION DELIVERY] Suppressed stale queued emails", {
      source: input.source,
      ...stale,
    });
  }

  const rows = await db.listPendingRecommendationDeliveriesForRetry(limit);
  const result: RecommendationDrainResult = {
    claimed: rows.length,
    sent: 0,
    failed: 0,
    skippedMissingPayload: 0,
  };

  for (const row of rows) {
    if (!row.subject || !row.bodyText) {
      await db.markRecommendationDeliveryFailed({
        eventKey: row.eventKey,
        userId: row.userId,
        errorCategory: "missing_payload",
        errorMessage: "Stored recommendation delivery is missing subject or body",
      });
      result.skippedMissingPayload += 1;
      continue;
    }

    try {
      const emailResult = await sendEmail({
        to: row.recipientEmail,
        subject: row.subject,
        text: row.bodyText,
        html: row.bodyHtml ?? undefined,
        audit: {
          eventType: row.eventKind === "alert" ? "recommendation_alert" : `recommendation_${row.eventKind}`,
          templateId: row.eventKind === "alert" ? "recommendation_alert" : `recommendation_${row.eventKind}`,
          recipientUserId: row.userId,
          metadata: {
            source: input.source,
            eventKey: row.eventKey,
            refId: row.refId,
          },
        },
      });
      await db.markRecommendationDeliverySent({
        eventKey: row.eventKey,
        userId: row.userId,
        provider: emailResult.provider,
        attemptedProviders: emailResult.attemptedProviders,
      });
      result.sent += 1;
    } catch (error) {
      await db.markRecommendationDeliveryFailed({
        eventKey: row.eventKey,
        userId: row.userId,
        errorCategory: (error as { category?: string })?.category ?? "unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
        attemptedProviders: (error as { attemptedProviders?: string[] })?.attemptedProviders,
      });
      result.failed += 1;
    }
  }

  return result;
}
