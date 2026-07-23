import { ENV } from "./env";

export type StudentCommunityClientEmailKind =
  | "reply"
  | "content_hidden"
  | "content_deleted"
  | "content_restored"
  | "access_suspended"
  | "access_restored"
  | "report_action_taken"
  | "report_dismissed";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function absoluteUrl(actionUrl: string) {
  return `${ENV.siteUrl.replace(/\/+$/, "")}${actionUrl.startsWith("/") ? actionUrl : `/${actionUrl}`}`;
}

function formatSuspensionExpiry(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

export function buildStudentCommunityClientEmail(input: {
  kind: StudentCommunityClientEmailKind;
  clientName?: string | null;
  contentType?: "post" | "comment";
  postId?: number | null;
  reason?: string | null;
  expiresAt?: string | null;
}) {
  const clientName = input.clientName?.trim() || "Student";
  const contentAr = input.contentType === "comment" ? "تعليقك" : "منشورك";
  const contentEn = input.contentType === "comment" ? "comment" : "post";
  const expiry = formatSuspensionExpiry(input.expiresAt);

  const copy = {
    reply: {
      subject: "رد جديد في مجتمع الطلاب | New community reply",
      headingAr: "لديك رد جديد في مجتمع الطلاب",
      bodyAr: "أضاف أحد أعضاء المجتمع تعليقاً جديداً إلى منشورك. افتح المنشور لمتابعة النقاش.",
      headingEn: "You have a new community reply",
      bodyEn: "A community member added a new comment to your post. Open the post to continue the discussion.",
      actionLabelAr: "فتح المنشور",
      actionLabelEn: "Open post",
      actionUrl: input.postId ? `/community?postId=${input.postId}` : "/community",
    },
    content_hidden: {
      subject: "تحديث على محتوى المجتمع | Community content update",
      headingAr: `تم إخفاء ${contentAr}`,
      bodyAr: `راجع فريق الإشراف ${contentAr} وقرر إخفاءه من المجتمع. لا يحتوي هذا البريد على النص محل المراجعة. يمكنك التواصل مع الدعم إذا احتجت إلى توضيح.`,
      headingEn: `Your community ${contentEn} was hidden`,
      bodyEn: `The moderation team reviewed your ${contentEn} and hid it from the community. The reviewed text is not included in this email. Contact support if you need clarification.`,
      actionLabelAr: "التواصل مع الدعم",
      actionLabelEn: "Contact support",
      actionUrl: "/support",
    },
    content_deleted: {
      subject: "تحديث على محتوى المجتمع | Community content update",
      headingAr: `تم حذف ${contentAr}`,
      bodyAr: `راجع فريق الإشراف ${contentAr} وقرر حذفه من المجتمع. لا يحتوي هذا البريد على النص محل المراجعة. يمكنك التواصل مع الدعم إذا احتجت إلى توضيح.`,
      headingEn: `Your community ${contentEn} was deleted`,
      bodyEn: `The moderation team reviewed your ${contentEn} and deleted it from the community. The reviewed text is not included in this email. Contact support if you need clarification.`,
      actionLabelAr: "التواصل مع الدعم",
      actionLabelEn: "Contact support",
      actionUrl: "/support",
    },
    content_restored: {
      subject: "تمت استعادة محتواك في المجتمع | Community content restored",
      headingAr: `تمت استعادة ${contentAr}`,
      bodyAr: `أعاد فريق الإشراف ${contentAr} ليظهر مجدداً في مجتمع الطلاب.`,
      headingEn: `Your community ${contentEn} was restored`,
      bodyEn: `The moderation team restored your ${contentEn}, and it is visible in the student community again.`,
      actionLabelAr: "فتح المجتمع",
      actionLabelEn: "Open community",
      actionUrl: input.postId ? `/community?postId=${input.postId}` : "/community",
    },
    access_suspended: {
      subject: "تم تعليق الوصول إلى مجتمع الطلاب | Community access suspended",
      headingAr: "تم تعليق وصولك إلى مجتمع الطلاب",
      bodyAr: [
        "تم تعليق وصولك إلى مجتمع الطلاب وفق قواعد الاستخدام.",
        input.reason ? `السبب: ${input.reason}` : null,
        expiry ? `موعد انتهاء التعليق: ${expiry}` : "مدة التعليق: حتى تتم استعادته من فريق الإدارة.",
        "يمكنك التواصل مع الدعم إذا كنت تعتقد أن القرار يحتاج إلى مراجعة.",
      ].filter(Boolean).join("\n"),
      headingEn: "Your student community access was suspended",
      bodyEn: [
        "Your access to the student community was suspended under the community rules.",
        input.reason ? `Reason: ${input.reason}` : null,
        expiry ? `Suspension expiry: ${expiry}` : "Duration: until access is restored by the administration team.",
        "Contact support if you believe this decision needs review.",
      ].filter(Boolean).join("\n"),
      actionLabelAr: "التواصل مع الدعم",
      actionLabelEn: "Contact support",
      actionUrl: "/support",
    },
    access_restored: {
      subject: "تمت استعادة الوصول إلى مجتمع الطلاب | Community access restored",
      headingAr: "تمت استعادة وصولك إلى مجتمع الطلاب",
      bodyAr: "يمكنك الآن قراءة منشورات مجتمع الطلاب والمشاركة فيه مجدداً، مع الالتزام بقواعد الاستخدام.",
      headingEn: "Your student community access was restored",
      bodyEn: "You can now read and participate in the student community again, subject to the community rules.",
      actionLabelAr: "فتح المجتمع",
      actionLabelEn: "Open community",
      actionUrl: "/community",
    },
    report_action_taken: {
      subject: "تمت مراجعة بلاغك في المجتمع | Community report reviewed",
      headingAr: "تمت مراجعة بلاغك واتخاذ إجراء",
      bodyAr: "راجع فريق الإشراف البلاغ الذي أرسلته واتخذ إجراءً بشأن المحتوى. شكراً لمساعدتنا في الحفاظ على مجتمع آمن.",
      headingEn: "Your report was reviewed and action was taken",
      bodyEn: "The moderation team reviewed your report and took action on the content. Thank you for helping us keep the community safe.",
      actionLabelAr: "فتح المجتمع",
      actionLabelEn: "Open community",
      actionUrl: input.postId ? `/community?postId=${input.postId}` : "/community",
    },
    report_dismissed: {
      subject: "تمت مراجعة بلاغك في المجتمع | Community report reviewed",
      headingAr: "تمت مراجعة بلاغك",
      bodyAr: "راجع فريق الإشراف البلاغ الذي أرسلته، ولم يتطلب المحتوى إجراءً في الوقت الحالي. شكراً لمساعدتنا في الحفاظ على مجتمع آمن.",
      headingEn: "Your report was reviewed",
      bodyEn: "The moderation team reviewed your report, and the content did not require action at this time. Thank you for helping us keep the community safe.",
      actionLabelAr: "فتح المجتمع",
      actionLabelEn: "Open community",
      actionUrl: input.postId ? `/community?postId=${input.postId}` : "/community",
    },
  } satisfies Record<StudentCommunityClientEmailKind, {
    subject: string;
    headingAr: string;
    bodyAr: string;
    headingEn: string;
    bodyEn: string;
    actionLabelAr: string;
    actionLabelEn: string;
    actionUrl: string;
  }>;

  const selected = copy[input.kind];
  const actionUrl = absoluteUrl(selected.actionUrl);
  const text = [
    `مرحباً ${clientName}،`,
    selected.headingAr,
    selected.bodyAr,
    `${selected.actionLabelAr}: ${actionUrl}`,
    "",
    `Hello ${clientName},`,
    selected.headingEn,
    selected.bodyEn,
    `${selected.actionLabelEn}: ${actionUrl}`,
  ].join("\n\n");

  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f7f6;font-family:Arial,sans-serif;color:#1f2937">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr><td align="center" style="padding:24px 12px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #d1fae5;border-radius:16px;overflow:hidden">
        <tr><td style="background:#047857;color:#fff;padding:22px 26px">
          <div style="font-size:12px;opacity:.85">XFlex Academy</div>
          <h1 style="margin:8px 0 0;font-size:23px">${escapeHtml(selected.headingAr)}</h1>
        </td></tr>
        <tr><td style="padding:26px">
          <p style="margin:0 0 14px;line-height:1.8">مرحباً ${escapeHtml(clientName)}،</p>
          <p style="margin:0;line-height:1.9;white-space:pre-line">${escapeHtml(selected.bodyAr)}</p>
          <div style="text-align:center;margin:24px 0">
            <a href="${escapeHtml(actionUrl)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700">${escapeHtml(selected.actionLabelAr)}</a>
          </div>
          <hr style="border:0;border-top:1px solid #e5e7eb;margin:24px 0">
          <div dir="ltr">
            <h2 style="font-size:20px;margin:0 0 12px">${escapeHtml(selected.headingEn)}</h2>
            <p style="margin:0 0 12px;line-height:1.8">Hello ${escapeHtml(clientName)},</p>
            <p style="margin:0;line-height:1.8;white-space:pre-line">${escapeHtml(selected.bodyEn)}</p>
            <p style="text-align:center;margin:22px 0 0"><a href="${escapeHtml(actionUrl)}" style="color:#047857;font-weight:700">${escapeHtml(selected.actionLabelEn)}</a></p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return {
    ...selected,
    actionUrl: selected.actionUrl,
    subject: selected.subject,
    text,
    html,
  };
}
