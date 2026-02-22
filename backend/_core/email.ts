import { ENV } from "./env";
import { logger } from "./logger";

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
};

async function sendViaZeptoMail(input: SendEmailInput) {
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
      subject: input.subject,
      textbody: input.text,
      htmlbody: input.text.replace(/\n/g, "<br/>"),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const trimmed = (body || "").trim();
    const suffix = trimmed ? `: ${trimmed}` : "";
    throw new Error(`ZeptoMail failed (${res.status}${res.statusText ? ` ${res.statusText}` : ""})${suffix}`);
  }
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

    if (provider === "zeptomail") {
      await sendViaZeptoMail(input);
      return;
    }

    if (provider === "mailchannels") {
      await sendViaMailChannels(input);
      return;
    }

    // Auto: attempt ZeptoMail if configured, then Resend, then MailChannels.
    // If a provider fails, try the next one so OTP delivery doesn't break.
    const errors: string[] = [];

    if (ENV.zeptoMailToken) {
      try {
        await sendViaZeptoMail(input);
        return;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    if (ENV.resendApiKey) {
      try {
        await sendViaResend(input);
        return;
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    try {
      await sendViaMailChannels(input);
      return;
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }

    throw new Error(errors.join(" | ") || "Failed to send email");
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
