export function formatFreeLibraryFileSize(bytes: number | null | undefined, isRtl: boolean) {
  if (!bytes || bytes <= 0) {
    return isRtl ? "الحجم غير متوفر" : "Size unavailable";
  }

  const units = isRtl ? ["بايت", "ك.ب", "م.ب", "ج.ب"] : ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const display = value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${display} ${units[unitIndex]}`;
}