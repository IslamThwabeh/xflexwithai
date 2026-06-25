import { sendEmail } from "../_core/email";
import * as db from "../db";

export const SUPPORT_REPLY_EMAIL_DRAIN_LIMIT = 5;
export const SUPPORT_REPLY_IMMEDIATE_DRAIN_LIMIT = 3;
export const GENERIC_EMAIL_OUTBOX_DRAIN_LIMIT = 10;

export async function drainGenericEmailOutbox(input: {
  limit: number;
  eventTypes?: string[];
}): Promise<{ claimed: number; sent: number; failed: number; skipped: number }> {
  const rows = await db.claimEmailOutboxBatch(input.limit, {
    eventTypes: input.eventTypes,
  });
  const result = { claimed: rows.length, sent: 0, failed: 0, skipped: 0 };

  for (const row of rows) {
    try {
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
      if (sendResult.skipped === "unsubscribed") {
        await db.markEmailOutboxSkipped(row.id, "Recipient unsubscribed from this email category");
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
