export const STUDENT_SURVEY_REFERENCE_PATTERN = /^[a-z0-9_-]+$/;

export function generateStudentSurveyReference(
  now = Date.now(),
  randomToken?: string,
) {
  const token = (randomToken ?? createRandomToken())
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8) || "draft";
  const timestamp = Math.max(0, Math.trunc(now)).toString(36);
  return `survey-${timestamp}-${token}`;
}

export function isValidStudentSurveyReference(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized.length >= 2
    && normalized.length <= 80
    && STUDENT_SURVEY_REFERENCE_PATTERN.test(normalized);
}

export function getStudentSurveyCreateErrorMessage(
  message: string | null | undefined,
  isRtl: boolean,
) {
  const fallback = isRtl
    ? "تعذر إنشاء الاستبيان. راجع البيانات وحاول مرة أخرى."
    : "The survey could not be created. Review the fields and try again.";
  const normalized = message?.trim();
  if (!normalized) return fallback;

  const lower = normalized.toLowerCase();
  const compact = lower.replace(/\s+/g, "");
  const targetsReference = compact.includes('"path":["code"]')
    || lower.includes("survey reference")
    || lower.includes("internal reference");
  const isFormatError = lower.includes("invalid_format")
    || lower.includes("must match pattern")
    || lower.includes("regex");

  if (targetsReference && isFormatError) {
    return isRtl
      ? "تعذر إنشاء المرجع الداخلي تلقائياً. أغلق نافذة الاستبيان وافتحها مرة أخرى ثم حاول مجدداً."
      : "The internal reference could not be generated. Close and reopen the survey window, then try again.";
  }

  if (lower.includes("a survey record already exists for this scope")) {
    return isRtl
      ? "تعذر استخدام المرجع التلقائي لأنه مستخدم مسبقاً. أغلق نافذة الاستبيان وافتحها مرة أخرى ثم حاول مجدداً."
      : "The automatic reference is already in use. Close and reopen the survey window, then try again.";
  }

  if (normalized.startsWith("[") && compact.includes('"code"')) return fallback;
  return normalized;
}

function createRandomToken() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}
