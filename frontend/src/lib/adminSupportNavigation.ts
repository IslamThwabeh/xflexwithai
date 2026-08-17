export const ADMIN_SUPPORT_INBOX_PATH = "/admin/support";

export function getAdminSupportConversationId(search: string): number | null {
  const rawConversationId = new URLSearchParams(search).get("conversationId");
  if (!rawConversationId || !/^[1-9]\d*$/.test(rawConversationId)) return null;

  const conversationId = Number(rawConversationId);
  return Number.isSafeInteger(conversationId) ? conversationId : null;
}

export function getAdminSupportConversationPath(
  conversationId: number
): string {
  return `${ADMIN_SUPPORT_INBOX_PATH}?conversationId=${conversationId}`;
}

export function getAdminSupportDraftKey(conversationId: number): string {
  return `admin-support-draft:${conversationId}`;
}
