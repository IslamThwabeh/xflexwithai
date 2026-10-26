export const LIVE_EXPERT_ROLE = 'live_expert';
export const LIVE_EXPERT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export function getLiveExpertMessagingWindow(input: {
  active: boolean;
  cohortStatus: string;
  sessionEndsAt: string | null;
  graceDays: number;
  now?: number;
}) {
  if (!input.active) return { canSend: false, messagingEndsAt: null };
  const end = input.sessionEndsAt ? Date.parse(input.sessionEndsAt) : NaN;
  const messagingEnd = Number.isFinite(end) ? end + input.graceDays * 86400000 : null;
  // Unscheduled enrolled clients can ask questions before classes start.
  // Completed cohorts without a valid end date fail closed for new messages.
  const canSend = messagingEnd !== null
    ? (input.now ?? Date.now()) <= messagingEnd
    : input.cohortStatus === 'not_started' || input.cohortStatus === 'in_progress';
  return { canSend, messagingEndsAt: messagingEnd === null ? null : new Date(messagingEnd).toISOString() };
}
