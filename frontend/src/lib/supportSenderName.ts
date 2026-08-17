export function getSupportStaffDisplayName(senderName?: string | null): string | null {
  const nameParts = senderName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (nameParts.length === 0) return null;
  if (nameParts.length === 1) return nameParts[0];
  return `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
}
