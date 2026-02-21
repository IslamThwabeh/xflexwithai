import { ENV } from "./env";
import { logger } from "./logger";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

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
      text: input.text,
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
      content: [{ type: "text/plain", value: input.text }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`MailChannels failed (${res.status}): ${body}`);
  }
}

export async function sendEmail(input: SendEmailInput) {
  const provider = ENV.emailProvider;

  try {
    if (provider === "resend") {
      await sendViaResend(input);
      return;
    }

    if (provider === "mailchannels") {
      await sendViaMailChannels(input);
      return;
    }

    // Auto: prefer Resend if configured, else MailChannels.
    if (ENV.resendApiKey) {
      await sendViaResend(input);
      return;
    }

    await sendViaMailChannels(input);
  } catch (error) {
    logger.error("[EMAIL] Failed to send email", {
      to: input.to,
      provider,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
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
  });
}
