import { ENV } from "./env";
import { isSuppressibleEmailCategory, type EmailCategory } from "./emailPreferences";
import { logger } from "./logger";
import { isLikelyValidEmail, normalizeEmailAddress } from "../../shared/emailValidation";

export type EmailAuditInput = {
  eventType?: string;
  templateId?: string;
  recipientUserId?: number;
  category?: EmailCategory;
  metadata?: Record<string, unknown>;
};

export type EmailErrorCategory = 'timeout' | '5xx' | '4xx' | 'network' | 'config' | 'unknown';

export class EmailSendError extends Error {
  readonly category: EmailErrorCategory;
  readonly attemptedProviders: string[];
  readonly providerUsed: string | null;
  constructor(message: string, opts: { category: EmailErrorCategory; attemptedProviders: string[]; providerUsed: string | null }) {
    super(message);
    this.name = 'EmailSendError';
    this.category = opts.category;
    this.attemptedProviders = opts.attemptedProviders;
    this.providerUsed = opts.providerUsed;
  }
}

function categorizeEmailError(error: unknown): EmailErrorCategory {
  const msg = error instanceof Error ? error.message : String(error || '');
  if (/not configured/i.test(msg)) return 'config';
  const statusMatch = msg.match(/\((\d{3})/);
  if (statusMatch) {
    const code = Number(statusMatch[1]);
    if (code >= 500) return '5xx';
    if (code >= 400) return '4xx';
  }
  if (/timeout|timed out|ETIMEDOUT/i.test(msg)) return 'timeout';
  if (/network|ECONN|fetch failed|ENOTFOUND|EAI_AGAIN/i.test(msg)) return 'network';
  return 'unknown';
}

type SendEmailInput = {
  to: string;
  bcc?: string[];
  subject: string;
  text: string;
  /** Optional HTML body — when provided, providers that support it will send as HTML */
  html?: string;
  headers?: Record<string, string>;
  audit?: EmailAuditInput;
  skipSupportForwarding?: boolean;
};

async function writeEmailDeliveryAudit(input: SendEmailInput, outcome: {
  status: 'sent' | 'failed' | 'skipped_unsubscribed' | 'skipped_deduped' | 'skipped_renewed';
  provider?: string | null;
  errorMessage?: string | null;
}) {
  try {
    const { logEmailDeliveryAttempt } = await import("../db");
    await logEmailDeliveryAttempt({
      recipientEmail: input.to,
      recipientUserId: input.audit?.recipientUserId,
      eventType: input.audit?.eventType || 'generic',
      templateId: input.audit?.templateId || null,
      subject: input.subject,
      status: outcome.status,
      provider: outcome.provider || null,
      errorMessage: outcome.errorMessage || null,
      metadata: input.audit?.metadata || null,
    });
  } catch (error) {
    logger.warn("[EMAIL] Failed to write delivery audit", {
      to: input.to,
      eventType: input.audit?.eventType || 'generic',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

type ProviderSendResult = {
  requestId: string | null;
};

async function sendViaZeptoMail(input: SendEmailInput): Promise<ProviderSendResult> {
  const token = ENV.zeptoMailToken;
  const apiUrl = ENV.zeptoMailApiUrl;
  const from = ENV.emailFrom;
  const fromName = ENV.emailFromName || "XFlex Academy";

  if (!token) throw new Error("ZEPTOMAIL_TOKEN is not configured");
  if (!apiUrl) throw new Error("ZEPTOMAIL_API_URL is not configured");
  if (!from) throw new Error("EMAIL_FROM is not configured");

  const rawToken = String(token || "").trim();
  const authHeader = /^zoho-enczapikey\b/i.test(rawToken)
    ? rawToken
    : `Zoho-enczapikey ${rawToken}`;

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      // ZeptoMail uses this auth scheme for API tokens.
      Authorization: authHeader,
    },
    body: JSON.stringify({
      from: { address: from, name: fromName },
      to: [{ email_address: { address: input.to } }],
      ...(input.bcc?.length
        ? { bcc: input.bcc.map((address) => ({ email_address: { address } })) }
        : {}),
      subject: input.subject,
      textbody: input.text,
      htmlbody: input.html || input.text.replace(/\n/g, "<br/>"),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const trimmed = (body || "").trim();
    const suffix = trimmed ? `: ${trimmed}` : "";
    throw new Error(`ZeptoMail failed (${res.status}${res.statusText ? ` ${res.statusText}` : ""})${suffix}`);
  }

  const response = await res.json().catch(() => null) as { request_id?: unknown } | null;
  return {
    requestId: typeof response?.request_id === "string" ? response.request_id : null,
  };
}

async function sendViaResend(input: SendEmailInput) {
  const apiKey = ENV.resendApiKey;
  const from = ENV.emailFrom;

  if (!apiKey) throw new Error("RESEND_API_KEY is not configured");
  if (!from) throw new Error("EMAIL_FROM is not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      ...(input.html ? { html: input.html } : { text: input.text }),
      ...(input.headers ? { headers: input.headers } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend failed (${res.status}): ${body}`);
  }
}

async function sendViaMailChannels(input: SendEmailInput) {
  const from = ENV.emailFrom;
  if (!from) throw new Error("EMAIL_FROM is not configured");

  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: from, name: ENV.emailFromName || "XFlex Academy" },
      subject: input.subject,
      content: input.html
        ? [{ type: "text/html", value: input.html }, { type: "text/plain", value: input.text }]
        : [{ type: "text/plain", value: input.text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MailChannels failed (${res.status}): ${body}`);
  }
}

function isSupportMailbox(email: string) {
  const normalized = String(email || "").trim().toLowerCase();
  return normalized === "support@xflexacademy.com";
}

async function forwardSupportMailboxCopies(input: SendEmailInput) {
  if (input.skipSupportForwarding || !isSupportMailbox(input.to)) return;

  try {
    const { getConfiguredAdminNotificationEmails } = await import("../db");
    const adminEmails = (await getConfiguredAdminNotificationEmails())
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email && !isSupportMailbox(email));

    if (!adminEmails.length) return;

    await Promise.allSettled(adminEmails.map((to) => sendEmail({
      ...input,
      to,
      skipSupportForwarding: true,
      audit: {
        ...input.audit,
        metadata: {
          ...(input.audit?.metadata || {}),
          forwardedFromSupportMailbox: input.to,
        },
      },
    })));
  } catch (error) {
    logger.warn("[EMAIL] Failed to forward support mailbox copy", {
      to: input.to,
      eventType: input.audit?.eventType || 'generic',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function sendEmail(input: SendEmailInput): Promise<{ provider: string | null; attemptedProviders: string[]; skipped?: 'unsubscribed' }> {
  const provider = ENV.emailProvider;
  const attemptedProviders: string[] = [];
  let providerUsed: string | null = null;

  const suppressibleCategory = input.audit?.category;
  if (isSuppressibleEmailCategory(suppressibleCategory)) {
    try {
      const { isEmailSuppressed } = await import("../db");
      const suppressed = await isEmailSuppressed(
        input.to,
        suppressibleCategory as Exclude<EmailCategory, 'transactional'>,
      );
      if (suppressed) {
        await writeEmailDeliveryAudit(input, {
          status: 'skipped_unsubscribed',
          provider: null,
          errorMessage: null,
        });
        logger.info("[EMAIL] Skipped suppressed recipient", {
          to: input.to,
          eventType: input.audit?.eventType || 'generic',
          category: suppressibleCategory,
        });
        return { provider: null, attemptedProviders: [], skipped: 'unsubscribed' };
      }
    } catch (error) {
      logger.warn("[EMAIL] Suppression check failed; continuing with send", {
        to: input.to,
        eventType: input.audit?.eventType || 'generic',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await forwardSupportMailboxCopies(input);

  const attemptWith = async (providerName: string, sendFn: (input: SendEmailInput) => Promise<unknown>) => {
    attemptedProviders.push(providerName);
    await sendFn(input);
    providerUsed = providerName;
  };

  try {
    if (provider === "resend") {
      await attemptWith("resend", sendViaResend);
      await writeEmailDeliveryAudit(input, { status: 'sent', provider: providerUsed });
      return { provider: providerUsed, attemptedProviders: [...attemptedProviders] };
    }

    if (provider === "zeptomail") {
      await attemptWith("zeptomail", sendViaZeptoMail);
      await writeEmailDeliveryAudit(input, { status: 'sent', provider: providerUsed });
      return { provider: providerUsed, attemptedProviders: [...attemptedProviders] };
    }

    if (provider === "mailchannels") {
      await attemptWith("mailchannels", sendViaMailChannels);
      await writeEmailDeliveryAudit(input, { status: 'sent', provider: providerUsed });
      return { provider: providerUsed, attemptedProviders: [...attemptedProviders] };
    }

    // Auto: attempt ZeptoMail if configured, then Resend, then MailChannels.
    // If a provider fails, try the next one so OTP delivery doesn't break.
    const errors: string[] = [];

    if (ENV.zeptoMailToken) {
      try {
        await attemptWith("zeptomail", sendViaZeptoMail);
        await writeEmailDeliveryAudit(input, { status: 'sent', provider: providerUsed });
        return { provider: providerUsed, attemptedProviders: [...attemptedProviders] };
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    if (ENV.resendApiKey) {
      try {
        await attemptWith("resend", sendViaResend);
        await writeEmailDeliveryAudit(input, { status: 'sent', provider: providerUsed });
        return { provider: providerUsed, attemptedProviders: [...attemptedProviders] };
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    try {
      await attemptWith("mailchannels", sendViaMailChannels);
      await writeEmailDeliveryAudit(input, { status: 'sent', provider: providerUsed });
      return { provider: providerUsed, attemptedProviders: [...attemptedProviders] };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }

    throw new Error(errors.join(" | ") || "Failed to send email");
  } catch (error) {
    const resolvedProvider = providerUsed || (provider && provider !== "auto" ? provider : attemptedProviders.join(",") || null);
    const category = categorizeEmailError(error);
    await writeEmailDeliveryAudit(input, {
      status: 'failed',
      provider: resolvedProvider,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    logger.error("[EMAIL] Failed to send email", {
      to: input.to,
      provider: resolvedProvider || provider,
      category,
      attemptedProviders,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new EmailSendError(
      error instanceof Error ? error.message : String(error),
      { category, attemptedProviders: [...attemptedProviders], providerUsed: providerUsed },
    );
  }
}

export type BccBatchRecipient = {
  email: string;
  userId: number;
};

export type StaffBccBatchRecipient = {
  email: string;
  userId?: number | null;
};

export type AdminNotificationBccRecipient = {
  email: string;
  userId: number;
};

export const ADMIN_NOTIFICATION_BCC_RECIPIENT_LIMIT = 499;

export async function sendAdminNotificationEmail(input: {
  recipients: AdminNotificationBccRecipient[];
  subject: string;
  text: string;
  html?: string;
  eventType: string;
  templateId: string;
  providerBatchKey: string;
  metadata?: Record<string, unknown>;
  supportTo?: string;
}): Promise<{
  provider: string | null;
  attemptedProviders: string[];
  providerRequestId: string | null;
  sentUserIds: number[];
  skippedUserIds: number[];
  recipientCount: number;
  deliveryMode: "single_to" | "bcc_batch" | "none";
}> {
  const uniqueRecipients = new Map<string, AdminNotificationBccRecipient>();
  for (const recipient of input.recipients) {
    const normalized = normalizeEmailAddress(recipient.email);
    if (!recipient.userId || !isLikelyValidEmail(normalized)) continue;
    if (!uniqueRecipients.has(normalized)) {
      uniqueRecipients.set(normalized, { ...recipient, email: normalized });
    }
  }

  const recipients = [...uniqueRecipients.values()];
  if (!recipients.length) {
    return {
      provider: null,
      attemptedProviders: [],
      providerRequestId: null,
      sentUserIds: [],
      skippedUserIds: [],
      recipientCount: 0,
      deliveryMode: "none",
    };
  }

  if (recipients.length === 1) {
    const [recipient] = recipients;
    const result = await sendEmail({
      to: recipient.email,
      subject: input.subject,
      text: input.text,
      html: input.html,
      audit: {
        eventType: input.eventType,
        templateId: input.templateId,
        recipientUserId: recipient.userId,
        category: "marketing",
        metadata: {
          ...(input.metadata || {}),
          deliveryMode: "single_to",
          providerBatchKey: input.providerBatchKey,
        },
      },
    });
    return {
      provider: result.provider,
      attemptedProviders: result.attemptedProviders,
      providerRequestId: null,
      sentUserIds: result.skipped === "unsubscribed" ? [] : [recipient.userId],
      skippedUserIds: result.skipped === "unsubscribed" ? [recipient.userId] : [],
      recipientCount: recipients.length,
      deliveryMode: "single_to",
    };
  }

  if (recipients.length > ADMIN_NOTIFICATION_BCC_RECIPIENT_LIMIT) {
    throw new EmailSendError("Admin notification BCC batch exceeds the safe recipient limit", {
      category: "config",
      attemptedProviders: [],
      providerUsed: null,
    });
  }

  if (ENV.emailProvider !== "auto" && ENV.emailProvider !== "zeptomail") {
    throw new EmailSendError("Admin notification BCC batches require ZeptoMail", {
      category: "config",
      attemptedProviders: [],
      providerUsed: null,
    });
  }

  const supportTo = normalizeEmailAddress(input.supportTo || "support@xflexacademy.com");
  if (!isLikelyValidEmail(supportTo)) {
    throw new EmailSendError("Admin notification BCC batch requires a valid support mailbox", {
      category: "config",
      attemptedProviders: [],
      providerUsed: null,
    });
  }

  const deliverable: AdminNotificationBccRecipient[] = [];
  const skipped: AdminNotificationBccRecipient[] = [];
  try {
    const { isEmailSuppressed } = await import("../db");
    for (const recipient of recipients) {
      const suppressed = await isEmailSuppressed(recipient.email, "marketing");
      if (suppressed) skipped.push(recipient);
      else deliverable.push(recipient);
    }
  } catch (error) {
    logger.warn("[EMAIL] Admin notification suppression check failed; continuing with send", {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    deliverable.push(...recipients);
  }

  if (skipped.length) {
    try {
      const { logEmailDeliveryAttempts } = await import("../db");
      await logEmailDeliveryAttempts(skipped.map((recipient) => ({
        recipientEmail: recipient.email,
        recipientUserId: recipient.userId,
        eventType: input.eventType,
        templateId: input.templateId,
        subject: input.subject,
        status: "skipped_unsubscribed",
        provider: null,
        metadata: {
          ...(input.metadata || {}),
          deliveryMode: "bcc_batch",
          providerBatchKey: input.providerBatchKey,
        },
      })));
    } catch (error) {
      logger.warn("[EMAIL] Failed to audit skipped admin notification recipients", {
        eventType: input.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!deliverable.length) {
    return {
      provider: null,
      attemptedProviders: [],
      providerRequestId: null,
      sentUserIds: [],
      skippedUserIds: skipped.map((recipient) => recipient.userId),
      recipientCount: recipients.length,
      deliveryMode: "none",
    };
  }

  const auditRecipients = [
    { email: supportTo, userId: null, deliveryMode: "bcc_batch_primary" },
    ...deliverable.map((recipient) => ({
      email: recipient.email,
      userId: recipient.userId,
      deliveryMode: "bcc_batch",
    })),
  ];

  try {
    const providerResult = await sendViaZeptoMail({
      to: supportTo,
      bcc: deliverable.map((recipient) => recipient.email),
      subject: input.subject,
      text: input.text,
      html: input.html,
      skipSupportForwarding: true,
    });
    const { logEmailDeliveryAttempts } = await import("../db");
    await logEmailDeliveryAttempts(auditRecipients.map((recipient) => ({
      recipientEmail: recipient.email,
      recipientUserId: recipient.userId,
      eventType: input.eventType,
      templateId: input.templateId,
      subject: input.subject,
      status: "sent",
      provider: "zeptomail",
      metadata: {
        ...(input.metadata || {}),
        deliveryMode: recipient.deliveryMode,
        providerBatchKey: input.providerBatchKey,
        providerRequestId: providerResult.requestId,
      },
    })));
    logger.info("[EMAIL] Admin notification BCC batch accepted", {
      to: supportTo,
      recipientCount: deliverable.length,
      skippedCount: skipped.length,
      providerBatchKey: input.providerBatchKey,
      providerRequestId: providerResult.requestId,
      eventType: input.eventType,
    });
    return {
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: providerResult.requestId,
      sentUserIds: deliverable.map((recipient) => recipient.userId),
      skippedUserIds: skipped.map((recipient) => recipient.userId),
      recipientCount: recipients.length,
      deliveryMode: "bcc_batch",
    };
  } catch (error) {
    const category = categorizeEmailError(error);
    try {
      const { logEmailDeliveryAttempts } = await import("../db");
      await logEmailDeliveryAttempts(auditRecipients.map((recipient) => ({
        recipientEmail: recipient.email,
        recipientUserId: recipient.userId,
        eventType: input.eventType,
        templateId: input.templateId,
        subject: input.subject,
        status: "failed",
        provider: "zeptomail",
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          ...(input.metadata || {}),
          deliveryMode: recipient.deliveryMode,
          providerBatchKey: input.providerBatchKey,
        },
      })));
    } catch {
      // Keep the provider failure authoritative; audit logging is best-effort.
    }
    logger.error("[EMAIL] Admin notification BCC batch failed", {
      to: supportTo,
      recipientCount: deliverable.length,
      skippedCount: skipped.length,
      providerBatchKey: input.providerBatchKey,
      category,
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new EmailSendError(
      error instanceof Error ? error.message : String(error),
      { category, attemptedProviders: ["zeptomail"], providerUsed: "zeptomail" },
    );
  }
}

export async function sendStaffBccBatch(input: {
  to: string;
  recipients: StaffBccBatchRecipient[];
  subject: string;
  text: string;
  html?: string;
  eventType: string;
  templateId: string;
  providerBatchKey: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  provider: "zeptomail";
  attemptedProviders: ["zeptomail"];
  providerRequestId: string | null;
  recipientCount: number;
}> {
  const companyTo = input.to.trim().toLowerCase();
  const uniqueRecipients = new Map<string, StaffBccBatchRecipient>();
  for (const recipient of input.recipients) {
    const normalized = recipient.email.trim().toLowerCase();
    if (!normalized || normalized === companyTo) continue;
    if (!uniqueRecipients.has(normalized)) {
      uniqueRecipients.set(normalized, { ...recipient, email: normalized });
    }
  }
  const recipients = [...uniqueRecipients.values()];
  if (!companyTo) throw new EmailSendError("Staff BCC batch requires a primary recipient", {
    category: "config",
    attemptedProviders: [],
    providerUsed: null,
  });
  if (recipients.length > 50) throw new EmailSendError("Staff BCC batch exceeds the safe 50-recipient limit", {
    category: "config",
    attemptedProviders: [],
    providerUsed: null,
  });
  if (ENV.emailProvider !== "auto" && ENV.emailProvider !== "zeptomail") {
    throw new EmailSendError("Staff BCC batches require ZeptoMail", {
      category: "config",
      attemptedProviders: [],
      providerUsed: null,
    });
  }

  const auditRecipients = [
    { email: companyTo, userId: null, deliveryMode: "bcc_batch_primary" },
    ...recipients.map((recipient) => ({
      email: recipient.email,
      userId: recipient.userId ?? null,
      deliveryMode: "bcc_batch",
    })),
  ];

  try {
    const providerResult = await sendViaZeptoMail({
      to: companyTo,
      bcc: recipients.map((recipient) => recipient.email),
      subject: input.subject,
      text: input.text,
      html: input.html,
      skipSupportForwarding: true,
    });
    const { logEmailDeliveryAttempts } = await import("../db");
    await logEmailDeliveryAttempts(auditRecipients.map((recipient) => ({
      recipientEmail: recipient.email,
      recipientUserId: recipient.userId,
      eventType: input.eventType,
      templateId: input.templateId,
      subject: input.subject,
      status: "sent",
      provider: "zeptomail",
      metadata: {
        ...(input.metadata || {}),
        deliveryMode: recipient.deliveryMode,
        providerBatchKey: input.providerBatchKey,
        providerRequestId: providerResult.requestId,
      },
    })));
    logger.info("[EMAIL] Staff BCC batch accepted", {
      to: companyTo,
      recipientCount: recipients.length,
      providerBatchKey: input.providerBatchKey,
      providerRequestId: providerResult.requestId,
      eventType: input.eventType,
    });
    return {
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: providerResult.requestId,
      recipientCount: recipients.length,
    };
  } catch (error) {
    const category = categorizeEmailError(error);
    try {
      const { logEmailDeliveryAttempts } = await import("../db");
      await logEmailDeliveryAttempts(auditRecipients.map((recipient) => ({
        recipientEmail: recipient.email,
        recipientUserId: recipient.userId,
        eventType: input.eventType,
        templateId: input.templateId,
        subject: input.subject,
        status: "failed",
        provider: "zeptomail",
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          ...(input.metadata || {}),
          deliveryMode: recipient.deliveryMode,
          providerBatchKey: input.providerBatchKey,
        },
      })));
    } catch {
      // The provider failure remains authoritative; audit logging is best-effort.
    }
    logger.error("[EMAIL] Staff BCC batch failed", {
      to: companyTo,
      recipientCount: recipients.length,
      providerBatchKey: input.providerBatchKey,
      category,
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new EmailSendError(
      error instanceof Error ? error.message : String(error),
      { category, attemptedProviders: ["zeptomail"], providerUsed: "zeptomail" },
    );
  }
}

/**
 * Sends one transactional recommendation email to the company mailbox with
 * clients hidden in BCC. ZeptoMail is deliberately required here because its
 * BCC contract and recipient ceiling are explicitly verified for this flow.
 */
export async function sendRecommendationBccBatch(input: {
  recipients: BccBatchRecipient[];
  subject: string;
  text: string;
  html?: string;
  eventType: string;
  templateId: string;
  providerBatchKey: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  provider: "zeptomail";
  attemptedProviders: ["zeptomail"];
  providerRequestId: string | null;
  recipientCount: number;
}> {
  const companyTo = ENV.recommendationEmailTo.trim().toLowerCase();
  const uniqueRecipients = new Map<string, BccBatchRecipient>();
  for (const recipient of input.recipients) {
    const normalized = recipient.email.trim().toLowerCase();
    if (!normalized || normalized === companyTo) continue;
    if (!uniqueRecipients.has(normalized)) {
      uniqueRecipients.set(normalized, { ...recipient, email: normalized });
    }
  }
  const recipients = [...uniqueRecipients.values()];
  if (!companyTo) throw new EmailSendError("RECOMMENDATION_EMAIL_TO is not configured", {
    category: "config",
    attemptedProviders: [],
    providerUsed: null,
  });
  if (!recipients.length) throw new EmailSendError("Recommendation BCC batch has no recipients", {
    category: "config",
    attemptedProviders: [],
    providerUsed: null,
  });
  if (recipients.length > 50) throw new EmailSendError("Recommendation BCC batch exceeds the safe 50-recipient limit", {
    category: "config",
    attemptedProviders: [],
    providerUsed: null,
  });
  if (ENV.emailProvider !== "auto" && ENV.emailProvider !== "zeptomail") {
    throw new EmailSendError("Recommendation BCC batches require ZeptoMail", {
      category: "config",
      attemptedProviders: [],
      providerUsed: null,
    });
  }

  try {
    const providerResult = await sendViaZeptoMail({
      to: companyTo,
      bcc: recipients.map((recipient) => recipient.email),
      subject: input.subject,
      text: input.text,
      html: input.html,
      skipSupportForwarding: true,
    });
    const { logEmailDeliveryAttempts } = await import("../db");
    await logEmailDeliveryAttempts(recipients.map((recipient) => ({
      recipientEmail: recipient.email,
      recipientUserId: recipient.userId,
      eventType: input.eventType,
      templateId: input.templateId,
      subject: input.subject,
      status: "sent",
      provider: "zeptomail",
      metadata: {
        ...(input.metadata || {}),
        deliveryMode: "bcc_batch",
        providerBatchKey: input.providerBatchKey,
        providerRequestId: providerResult.requestId,
      },
    })));
    logger.info("[EMAIL] Recommendation BCC batch accepted", {
      recipientCount: recipients.length,
      providerBatchKey: input.providerBatchKey,
      providerRequestId: providerResult.requestId,
    });
    return {
      provider: "zeptomail",
      attemptedProviders: ["zeptomail"],
      providerRequestId: providerResult.requestId,
      recipientCount: recipients.length,
    };
  } catch (error) {
    const category = categorizeEmailError(error);
    try {
      const { logEmailDeliveryAttempts } = await import("../db");
      await logEmailDeliveryAttempts(recipients.map((recipient) => ({
        recipientEmail: recipient.email,
        recipientUserId: recipient.userId,
        eventType: input.eventType,
        templateId: input.templateId,
        subject: input.subject,
        status: "failed",
        provider: "zeptomail",
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          ...(input.metadata || {}),
          deliveryMode: "bcc_batch",
          providerBatchKey: input.providerBatchKey,
        },
      })));
    } catch {
      // The provider failure remains authoritative; audit logging is best-effort.
    }
    logger.error("[EMAIL] Recommendation BCC batch failed", {
      recipientCount: recipients.length,
      providerBatchKey: input.providerBatchKey,
      category,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new EmailSendError(
      error instanceof Error ? error.message : String(error),
      { category, attemptedProviders: ["zeptomail"], providerUsed: "zeptomail" },
    );
  }
}

export async function sendLoginCodeEmail(input: {
  to: string;
  code: string;
  expiresMinutes: number;
}) {
  const subject = `Your XFlex Academy login code`;
  const text = `Your XFlex Academy login code is: ${input.code}\n\nThis code expires in ${input.expiresMinutes} minutes.\n\nIf you did not request this, you can ignore this email.`;

  await sendEmail({
    to: input.to,
    subject,
    text,
    audit: {
      eventType: 'login_code',
      templateId: 'login_code',
    },
  });
}
