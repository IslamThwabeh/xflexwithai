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
  skippedSuppressed: number;
  skippedIneligible: number;
  providerRequests: number;
  batches: number;
};

function getNotificationBatchId(
  rows: Array<{ metadataJson: string | null }>,
): string | null {
  const batchIds = new Set<string>();

  for (const row of rows) {
    if (!row.metadataJson) return null;
    try {
      const metadata = JSON.parse(row.metadataJson) as { batchId?: unknown };
      if (
        typeof metadata.batchId !== "string"
        || !/^rec_(?:live|alert)_[A-Za-z0-9_-]+$/.test(metadata.batchId)
      ) {
        return null;
      }
      batchIds.add(metadata.batchId);
    } catch {
      return null;
    }
  }

  return batchIds.size === 1 ? [...batchIds][0] : null;
}

export function getRemainingGenericEmailBudget(
  recommendationProviderRequests: number,
  totalBudget: number = EMAIL_PROVIDER_REQUEST_BUDGET,
): number {
  return Math.max(0, totalBudget - Math.max(0, recommendationProviderRequests));
}

export async function drainRecommendationDeliveryQueue(input: {
  limit?: number;
  maxBatches?: number;
  eventKey?: string;
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
    skippedSuppressed: 0,
    skippedIneligible: 0,
    providerRequests: 0,
    batches: 0,
  };

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
    const claimedRows = await db.claimNextRecommendationDeliveryBatch(limit, input.eventKey);
    if (!claimedRows.length) break;
    result.claimed += claimedRows.length;
    result.batches += 1;

    let rows = claimedRows;
    try {
      const eligibility = await db.partitionRecommendationDeliveriesByEligibility(claimedRows);
      if (eligibility.ineligible.length) {
        await db.markRecommendationDeliveryBatchSkipped({
          items: eligibility.ineligible.map(({ delivery, reason }) => ({ id: delivery.id, reason })),
        });
        result.skippedIneligible += eligibility.ineligible.length;
      }
      rows = eligibility.eligible;
    } catch (error) {
      const firstClaimed = claimedRows[0];
      const claimedIds = claimedRows.map((row) => row.id);
      await db.markRecommendationDeliveryBatchFailed({
        ids: claimedIds,
        errorCategory: "eligibility_check",
        errorMessage: error instanceof Error ? error.message : String(error),
        providerBatchKey: [
          firstClaimed.eventKey,
          firstClaimed.language,
          claimedIds[0],
          claimedIds[claimedIds.length - 1],
          firstClaimed.attempts + 1,
        ].join(":"),
      });
      result.failed += claimedRows.length;
      continue;
    }
    if (!rows.length) continue;

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
      const eventType = first.eventKind === "alert"
        ? "recommendation_alert"
        : `recommendation_${first.eventKind}`;
      result.providerRequests += 1;
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
      if (!emailResult.provider) result.providerRequests -= 1;

      const sentUserIds = new Set(emailResult.sentUserIds);
      const skippedUserIds = new Set(emailResult.skippedUserIds);
      const sentIds = rows.filter((row) => sentUserIds.has(row.userId)).map((row) => row.id);
      const acceptedUserIds = rows.filter((row) => sentUserIds.has(row.userId)).map((row) => row.userId);
      const skippedIds = rows.filter((row) => skippedUserIds.has(row.userId)).map((row) => row.id);

      await Promise.all([
        db.markRecommendationDeliveryBatchSent({
          ids: sentIds,
          provider: emailResult.provider,
          attemptedProviders: emailResult.attemptedProviders,
          providerRequestId: emailResult.providerRequestId,
          providerBatchKey,
        }),
        db.markRecommendationDeliveryBatchSuppressed({
          ids: skippedIds,
          reason: "Recipient is permanently suppressed",
          providerBatchKey,
        }),
      ]);
      result.sent += sentIds.length;
      result.skippedSuppressed += skippedIds.length;

      // Keep the legacy in-app notification indicator aligned with the
      // authoritative recommendation outbox. This is reporting-only: if the
      // compatibility update fails after the provider accepted the email, do
      // not mark the delivery failed or retry it (which could duplicate mail).
      const notificationBatchId = getNotificationBatchId(rows);
      if (notificationBatchId && acceptedUserIds.length) {
        try {
          await db.markNotificationEmailsSent(notificationBatchId, acceptedUserIds);
        } catch (error) {
          logger.warn("[RECOMMENDATION DELIVERY] Could not sync notification email indicator", {
            source: input.source,
            eventKey: first.eventKey,
            notificationBatchId,
            acceptedCount: acceptedUserIds.length,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
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
