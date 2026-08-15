import { sendAdminNotificationEmail, sendEmail } from "../_core/email";
import * as db from "../db";

export const SUPPORT_REPLY_EMAIL_DRAIN_LIMIT = 5;
export const SUPPORT_REPLY_IMMEDIATE_DRAIN_LIMIT = 3;
export const GENERIC_EMAIL_OUTBOX_DRAIN_LIMIT = 10;
export const STUDENT_SURVEY_EMAIL_BCC_LIMIT = 50;
export const STUDENT_SURVEY_PROVIDER_REQUEST_LIMIT = 2;
const STUDENT_SURVEY_EMAIL_EVENTS = ["student_survey_assigned", "student_survey_reminder"];
export const STUDENT_COMMUNITY_EMAIL_BCC_LIMIT = 50;
export const STUDENT_COMMUNITY_PROVIDER_REQUEST_LIMIT = 2;
export const STUDENT_COMMUNITY_POST_EMAIL_EVENT = "student_community_post_published";
const PRIVACY_BCC_EMAIL_EVENTS = [
  ...STUDENT_SURVEY_EMAIL_EVENTS,
  STUDENT_COMMUNITY_POST_EMAIL_EVENT,
];

export async function drainGenericEmailOutbox(input: {
  limit: number;
  eventTypes?: string[];
}): Promise<{ claimed: number; sent: number; failed: number; skipped: number }> {
  const rows = await db.claimEmailOutboxBatch(
    input.limit,
    input.eventTypes
      ? { eventTypes: input.eventTypes }
      : { excludedEventTypes: PRIVACY_BCC_EMAIL_EVENTS },
  );
  const result = { claimed: rows.length, sent: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    try {
      const accountBlockReason = await db.getEmailOutboxRecipientBlockReason(row);
      if (accountBlockReason) {
        await db.markEmailOutboxSkipped(row.id, accountBlockReason, "skipped_suppressed");
        result.skipped += 1;
        continue;
      }
      let metadata: Record<string, unknown> | undefined;
      if (row.metadataJson) {
        try {
          metadata = JSON.parse(row.metadataJson);
        } catch {
          metadata = { malformedMetadata: true };
        }
      }
      const sendResult = await sendEmail({
        to: row.recipientEmail,
        subject: row.subject,
        text: row.bodyText,
        html: row.bodyHtml ?? undefined,
        audit: {
          eventType: row.eventType,
          templateId: row.templateId ?? undefined,
          recipientUserId: row.recipientUserId ?? undefined,
          category: (row.emailCategory as any) ?? undefined,
          metadata,
        },
      });
      if (sendResult.skipped) {
        const skipReason = sendResult.skipped === "suppressed"
          ? "Recipient is permanently suppressed"
          : "Recipient unsubscribed from this email category";
        await db.markEmailOutboxSkipped(
          row.id,
          skipReason,
          sendResult.skipped === "suppressed" ? "skipped_suppressed" : "skipped_unsubscribed",
        );
        result.skipped += 1;
        continue;
      }
      await db.markEmailOutboxSent({
        id: row.id,
        provider: sendResult.provider,
        attemptedProviders: sendResult.attemptedProviders,
      });
      result.sent += 1;
    } catch (error) {
      await db.markEmailOutboxFailed({
        id: row.id,
        errorCategory: (error as { category?: string })?.category ?? "unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
        attemptedProviders: (error as { attemptedProviders?: string[] })?.attemptedProviders,
      });
      result.failed += 1;
    }
  }

  return result;
}

type PrivacyBccEmailOutboxRow = Awaited<ReturnType<typeof db.claimEmailOutboxBatch>>[number];

async function drainPrivacyBccEmailOutbox(input: {
  eventTypes: string[];
  templateId: string;
  providerBatchPrefix: string;
  recipientLimit: number;
  providerRequestLimit: number;
  additionalBlockReason: (row: PrivacyBccEmailOutboxRow) => Promise<string | null>;
}): Promise<{ claimed: number; sent: number; failed: number; skipped: number; providerRequests: number }> {
  const rows = await db.claimEmailOutboxBatch(input.recipientLimit, { eventTypes: input.eventTypes });
  const result = { claimed: rows.length, sent: 0, failed: 0, skipped: 0, providerRequests: 0 };
  const deliverable = [] as typeof rows;

  for (const row of rows) {
    const reason = await db.getEmailOutboxRecipientBlockReason(row)
      ?? await input.additionalBlockReason(row);
    if (reason) {
      await db.markEmailOutboxSkipped(row.id, reason, "skipped_suppressed");
      result.skipped += 1;
    } else {
      deliverable.push(row);
    }
  }

  const groups = new Map<string, typeof rows>();
  for (const row of deliverable) {
    const key = JSON.stringify([row.batchId, row.subject, row.bodyText, row.bodyHtml]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const selectedGroups = [...groups.values()].slice(0, input.providerRequestLimit);
  const selectedIds = new Set(selectedGroups.flatMap((group) => group.map((row) => row.id)));
  const deferredIds = deliverable.filter((row) => !selectedIds.has(row.id)).map((row) => row.id);
  if (deferredIds.length) await db.releaseEmailOutboxClaims(deferredIds);

  for (const group of selectedGroups) {
    const first = group[0];
    if (!first) continue;
    result.providerRequests += 1;
    try {
      const delivery = await sendAdminNotificationEmail({
        recipients: group.flatMap((row) => row.recipientUserId
          ? [{ userId: row.recipientUserId, email: row.recipientEmail }]
          : []),
        subject: first.subject,
        text: first.bodyText,
        html: first.bodyHtml ?? undefined,
        eventType: first.eventType,
        templateId: first.templateId ?? input.templateId,
        providerBatchKey: first.batchId ?? `${input.providerBatchPrefix}:${first.id}`,
        metadata: { deliveryMode: "privacy_bcc", outboxIds: group.map((row) => row.id) },
      });
      const sentIds = new Set(delivery.sentUserIds);
      for (const row of group) {
        if (row.recipientUserId && sentIds.has(row.recipientUserId)) {
          await db.markEmailOutboxSent({
            id: row.id,
            provider: delivery.provider,
            attemptedProviders: delivery.attemptedProviders,
          });
          result.sent += 1;
        } else {
          await db.markEmailOutboxSkipped(row.id, "Recipient suppressed or unsubscribed", "skipped_unsubscribed");
          result.skipped += 1;
        }
      }
    } catch (error) {
      for (const row of group) {
        await db.markEmailOutboxFailed({
          id: row.id,
          errorCategory: (error as { category?: string })?.category ?? "unknown",
          errorMessage: error instanceof Error ? error.message : String(error),
          attemptedProviders: (error as { attemptedProviders?: string[] })?.attemptedProviders,
        });
        result.failed += 1;
      }
    }
  }
  return result;
}

export async function drainStudentSurveyEmailOutbox(input?: {
  recipientLimit?: number;
  providerRequestLimit?: number;
}): Promise<{ claimed: number; sent: number; failed: number; skipped: number; providerRequests: number }> {
  const providerRequestLimit = Math.min(
    Math.max(input?.providerRequestLimit ?? STUDENT_SURVEY_PROVIDER_REQUEST_LIMIT, 1),
    STUDENT_SURVEY_PROVIDER_REQUEST_LIMIT,
  );
  return drainPrivacyBccEmailOutbox({
    eventTypes: STUDENT_SURVEY_EMAIL_EVENTS,
    templateId: "student_survey_notification",
    providerBatchPrefix: "student-survey-outbox",
    recipientLimit: Math.min(
      Math.max(input?.recipientLimit ?? STUDENT_SURVEY_EMAIL_BCC_LIMIT, 1),
      STUDENT_SURVEY_EMAIL_BCC_LIMIT,
    ),
    providerRequestLimit,
    additionalBlockReason: db.getStudentSurveyEmailOutboxBlockReason,
  });
}

export async function drainStudentCommunityPostEmailOutbox(input?: {
  recipientLimit?: number;
  providerRequestLimit?: number;
}): Promise<{ claimed: number; sent: number; failed: number; skipped: number; providerRequests: number }> {
  const providerRequestLimit = Math.min(
    Math.max(input?.providerRequestLimit ?? STUDENT_COMMUNITY_PROVIDER_REQUEST_LIMIT, 1),
    STUDENT_COMMUNITY_PROVIDER_REQUEST_LIMIT,
  );
  return drainPrivacyBccEmailOutbox({
    eventTypes: [STUDENT_COMMUNITY_POST_EMAIL_EVENT],
    templateId: "student_community_post_published",
    providerBatchPrefix: "student-community-post-outbox",
    recipientLimit: Math.min(
      Math.max(input?.recipientLimit ?? STUDENT_COMMUNITY_EMAIL_BCC_LIMIT, 1),
      STUDENT_COMMUNITY_EMAIL_BCC_LIMIT,
    ),
    providerRequestLimit,
    additionalBlockReason: db.getStudentCommunityPostEmailOutboxBlockReason,
  });
}

export async function drainDueEmailOutbox(input?: {
  supportReplyLimit?: number;
  genericLimit?: number;
}): Promise<{
  supportReplies: { claimed: number; sent: number; failed: number; skipped: number };
  generic: { claimed: number; sent: number; failed: number; skipped: number };
  total: { claimed: number; sent: number; failed: number; skipped: number };
}> {
  const supportReplies = await drainGenericEmailOutbox({
    limit: input?.supportReplyLimit ?? SUPPORT_REPLY_EMAIL_DRAIN_LIMIT,
    eventTypes: ["support_client_reply"],
  });
  const generic = await drainGenericEmailOutbox({
    limit: input?.genericLimit ?? GENERIC_EMAIL_OUTBOX_DRAIN_LIMIT,
  });

  return {
    supportReplies,
    generic,
    total: {
      claimed: supportReplies.claimed + generic.claimed,
      sent: supportReplies.sent + generic.sent,
      failed: supportReplies.failed + generic.failed,
      skipped: supportReplies.skipped + generic.skipped,
    },
  };
}
