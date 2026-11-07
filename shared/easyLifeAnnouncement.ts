export const EASY_LIFE_ANNOUNCEMENT_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Fixed campaign date: rebuilding the site must not restart the announcement.
// Align with publication via VITE_EASY_LIFE_LAUNCH_AT when releasing this change.
export const DEFAULT_EASY_LIFE_LAUNCH_AT = '2026-11-07T17:45:00Z';

export function getEasyLifeAnnouncementWindow(launchAt: string) {
  // Require an explicit timezone so every visitor shares the same campaign window.
  const startsAt = /T.+(?:Z|[+-]\d{2}:\d{2})$/.test(launchAt) ? Date.parse(launchAt) : NaN;
  return { startsAt, endsAt: startsAt + EASY_LIFE_ANNOUNCEMENT_DURATION_MS };
}

export function isEasyLifeAnnouncementActive(launchAt: string, now = Date.now()) {
  const { startsAt, endsAt } = getEasyLifeAnnouncementWindow(launchAt);
  return now >= startsAt && now < endsAt;
}
