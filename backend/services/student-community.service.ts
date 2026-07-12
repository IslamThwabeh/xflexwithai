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

export function isStudentCommunityEnabled(value: string | null | undefined) {
  return value?.trim().toLowerCase() === "true";
}
