/** Author attribution is reserved for full admins, including in API responses. */
export function protectRecommendationAuthors<T extends {
  userId: number;
  authorName: string;
  authorEmail: string | null;
  isAnalyst: boolean;
  closedByUserId: number | null;
  deliveryDiagnosticsJson: string | null;
}>(messages: T[], viewerUserId: number, isAdmin: boolean): T[] {
  if (isAdmin) return messages;
  return messages.map((message) => ({
    ...message,
    userId: message.userId === viewerUserId ? viewerUserId : 0,
    authorName: "XFlex",
    authorEmail: null,
    isAnalyst: false,
    closedByUserId: null,
    deliveryDiagnosticsJson: null,
  }));
}
