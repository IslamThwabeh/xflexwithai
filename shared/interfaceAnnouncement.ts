export const NAVIGATION_ANNOUNCEMENT_ID = "navigation-v2-2026-11";

export type InterfaceAnnouncementAction = "dismiss" | "later";

export function shouldShowInterfaceAnnouncement(
  state: { dismissedAt: string | null; deferredLogin: string | null } | null,
  login: string
) {
  return !state?.dismissedAt && state?.deferredLogin !== login;
}
