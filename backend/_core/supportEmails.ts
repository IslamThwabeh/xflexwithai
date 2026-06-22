const SUPPORT_URL = "https://xflexacademy.com/support";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildSupportReplyEmail(input: {
  clientName?: string | null;
  replyContent: string;
  hasAttachment?: boolean;
}) {
  const clientName = input.clientName?.trim() || "Client";
  const attachmentAr = input.hasAttachment ? "\nيتضمن الرد مرفقاً داخل المحادثة." : "";
  const attachmentEn = input.hasAttachment ? "\nThe reply includes an attachment inside the conversation." : "";
  const subject = "رد جديد من فريق الدعم | New reply from XFlex Support";
  const text = [
    `مرحباً ${clientName}،`,
    "لديك رد جديد من فريق الدعم:",
    "",
    input.replyContent,
    attachmentAr,
    "",
    `افتح المحادثة: ${SUPPORT_URL}`,
    "",
    `Hello ${clientName},`,
    "You have a new reply from the support team:",
    "",
    input.replyContent,
    attachmentEn,
    "",
    `Open the conversation: ${SUPPORT_URL}`,
  ].join("\n");

  const safeReply = escapeHtml(input.replyContent);
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f7f6;font-family:Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #d1fae5;border-radius:16px;overflow:hidden">
        <tr><td style="background:#047857;color:#fff;padding:22px 26px">
          <div style="font-size:12px;opacity:.85">XFlex Academy</div>
          <h1 style="margin:8px 0 0;font-size:24px">رد جديد من فريق الدعم</h1>
        </td></tr>
        <tr><td style="padding:26px">
          <p style="margin:0 0 14px;line-height:1.8">مرحباً ${escapeHtml(clientName)}، لديك رد جديد من فريق الدعم:</p>
          <div style="white-space:pre-wrap;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;line-height:1.8">${safeReply}</div>
          ${input.hasAttachment ? '<p style="color:#475569;line-height:1.7">يتضمن الرد مرفقاً داخل المحادثة.</p>' : ""}
          <div style="text-align:center;margin:24px 0">
            <a href="${SUPPORT_URL}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700">افتح محادثة الدعم</a>
          </div>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0">
          <div dir="ltr">
            <h2 style="font-size:20px;margin:0 0 12px">New reply from XFlex Support</h2>
            <p style="line-height:1.8">Hello ${escapeHtml(clientName)}, you have a new support reply.</p>
            ${input.hasAttachment ? '<p style="color:#475569">The reply includes an attachment inside the conversation.</p>' : ""}
            <p style="text-align:center"><a href="${SUPPORT_URL}" style="color:#047857;font-weight:700">Open support conversation</a></p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}
