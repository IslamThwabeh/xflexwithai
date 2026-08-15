export type StudentSurveyNotificationStage = "assigned" | "pre_due" | "due" | "overdue" | "manual";
export type StudentSurveyNotificationLanguage = "ar" | "en";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getStudentSurveyNotificationLanguage(
  notificationPrefs: string | null | undefined,
): StudentSurveyNotificationLanguage {
  if (!notificationPrefs) return "ar";
  try {
    const parsed = JSON.parse(notificationPrefs) as { language?: unknown };
    return parsed.language === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export function getNextStudentSurveyNotificationAt(input: {
  dueAt: string;
  stage: StudentSurveyNotificationStage;
  now?: Date;
}): string | null {
  if (input.stage === "manual") return null;
  const now = input.now ?? new Date();
  const dueMs = new Date(input.dueAt).getTime();
  if (!Number.isFinite(dueMs)) return null;

  if (input.stage === "assigned") {
    const preDueMs = dueMs - DAY_MS;
    return new Date(preDueMs > now.getTime() ? preDueMs : dueMs).toISOString();
  }
  if (input.stage === "pre_due") return new Date(dueMs).toISOString();
  return new Date(now.getTime() + DAY_MS).toISOString();
}

export function getStudentSurveyNotificationStage(input: {
  dueAt: string;
  notificationCount: number;
  lastStage?: string | null;
  now?: Date;
}): StudentSurveyNotificationStage {
  if (input.notificationCount === 0) return "assigned";
  const nowMs = (input.now ?? new Date()).getTime();
  const dueMs = new Date(input.dueAt).getTime();
  if (nowMs < dueMs) return "pre_due";
  if (input.lastStage !== "due" && input.lastStage !== "overdue") return "due";
  return "overdue";
}

function formatDeadline(value: string, language: StudentSurveyNotificationLanguage) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(language === "ar" ? "ar-JO" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Amman",
  }).format(parsed);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

export function buildStudentSurveyNotificationContent(input: {
  surveyTitle: string;
  dueAt: string;
  stage: StudentSurveyNotificationStage;
  language: StudentSurveyNotificationLanguage;
  surveyUrl: string;
}) {
  const deadline = formatDeadline(input.dueAt, input.language);
  const title = escapeHtml(input.surveyTitle);
  const isArabic = input.language === "ar";
  const stageCopy = isArabic
    ? {
        assigned: ["استبيان جديد بانتظارك", `تم تعيين استبيان \"${input.surveyTitle}\" لك. يرجى إرساله قبل ${deadline}.`],
        pre_due: ["تذكير: موعد الاستبيان خلال 24 ساعة", `يرجى إكمال استبيان \"${input.surveyTitle}\" قبل ${deadline}.`],
        due: ["موعد الاستبيان اليوم", `حان موعد استبيان \"${input.surveyTitle}\". يرجى إكماله الآن.`],
        overdue: ["تذكير يومي: الاستبيان متأخر", `استبيان \"${input.surveyTitle}\" ما زال بانتظار إجابتك. يمكنك إرساله الآن.`],
        manual: ["تذكير بالاستبيان", `يرجى إكمال استبيان \"${input.surveyTitle}\" من حسابك.`],
      }[input.stage]
    : {
        assigned: ["A new survey is waiting for you", `The \"${input.surveyTitle}\" survey has been assigned to you. Please submit it by ${deadline}.`],
        pre_due: ["Reminder: your survey is due within 24 hours", `Please complete the \"${input.surveyTitle}\" survey by ${deadline}.`],
        due: ["Your survey is due today", `The \"${input.surveyTitle}\" survey is now due. Please complete it today.`],
        overdue: ["Daily reminder: your survey is overdue", `The \"${input.surveyTitle}\" survey is still waiting for your response. You can submit it now.`],
        manual: ["Survey reminder", `Please complete the \"${input.surveyTitle}\" survey from your account.`],
      }[input.stage];
  const [subjectText, bodyText] = stageCopy;
  const actionLabel = isArabic ? "فتح الاستبيانات" : "Open surveys";
  const direction = isArabic ? "rtl" : "ltr";
  const subject = `[XFlex Trading Academy] ${subjectText}`;
  const text = `${bodyText}\n\n${actionLabel}: ${input.surveyUrl}`;
  const html = `<!doctype html><html dir="${direction}"><body style="margin:0;background:#f6f7f3;font-family:Arial,sans-serif;color:#17211b"><div style="max-width:620px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border:1px solid #e4e8e3;border-radius:18px;padding:28px"><p style="margin:0 0 8px;color:#047857;font-weight:700">XFlex Trading Academy</p><h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(subjectText)}</h1><p style="font-size:16px;line-height:1.8;margin:0 0 24px">${escapeHtml(bodyText)}</p><p style="margin:0"><a href="${escapeHtml(input.surveyUrl)}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:700">${actionLabel}</a></p><p style="margin:24px 0 0;color:#6b7280;font-size:13px">${title}</p></div></div></body></html>`;
  return { subject, text, html, title: subjectText, body: bodyText };
}

export function buildStudentSurveyNotificationDedupeKey(input: {
  assignmentId: number;
  stage: StudentSurveyNotificationStage;
  dueAt: string;
  scheduledAt?: string;
}) {
  if (input.stage === "assigned") return `student_survey:${input.assignmentId}:assigned`;
  if (input.stage === "pre_due" || input.stage === "due") {
    return `student_survey:${input.assignmentId}:${input.stage}:${input.dueAt}`;
  }
  if (input.stage === "manual") {
    return `student_survey:${input.assignmentId}:manual:${input.scheduledAt ?? new Date().toISOString()}`;
  }
  return `student_survey:${input.assignmentId}:overdue:${input.scheduledAt ?? new Date().toISOString()}`;
}
