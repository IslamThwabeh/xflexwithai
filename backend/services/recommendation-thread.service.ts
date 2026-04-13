export function getRecommendationThreadRootId(input: {
  messageId: number;
  parentId?: number | null;
}) {
  return input.parentId ?? input.messageId;
}

export function filterRecipientsByMutedThreads<T extends { userId: number }>(
  recipients: T[],
  mutedUserIds: Iterable<number>,
) {
  const mutedSet = mutedUserIds instanceof Set ? mutedUserIds : new Set(mutedUserIds);
  return recipients.filter((recipient) => !mutedSet.has(recipient.userId));
}