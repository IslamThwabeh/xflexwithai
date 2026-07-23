export const STUDENT_COMMUNITY_FEATURE_FLAG = "student_community_enabled";

export const STUDENT_COMMUNITY_CONTENT_STATUSES = [
  "visible",
  "hidden",
  "deleted",
] as const;

export const STUDENT_COMMUNITY_REPORT_STATUSES = [
  "open",
  "reviewed",
  "dismissed",
] as const;

export type StudentCommunityContentStatus = typeof STUDENT_COMMUNITY_CONTENT_STATUSES[number];
export type StudentCommunityReportStatus = typeof STUDENT_COMMUNITY_REPORT_STATUSES[number];
export type StudentCommunityTargetType = "post" | "comment";
export type StudentCommunityAccessState = "allowed" | "banned" | "not_eligible";

export function isStudentCommunityEnabled(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export function isStudentCommunityBanActive(input: {
  status?: string | null;
  expiresAt?: string | null;
  now?: Date;
}) {
  if (input.status !== "banned") return false;
  if (!input.expiresAt) return true;

  const expiresAtMs = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiresAtMs)) return true;

  return expiresAtMs > (input.now ?? new Date()).getTime();
}
