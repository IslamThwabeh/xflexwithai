/**
 * Format duration from seconds to MM:SS format
 * @param seconds - Duration in seconds
 * @returns Formatted string in MM:SS format
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds === 0) return "0:00";
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Format duration from seconds to human-readable format
 * @param seconds - Duration in seconds
 * @returns Formatted string like "12 min 34 sec"
 */
export function formatDurationLong(seconds: number | null | undefined): string {
  if (!seconds || seconds === 0) return "0 seconds";
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes === 0) {
    return `${remainingSeconds} sec`;
  }
  
  if (remainingSeconds === 0) {
    return `${minutes} min`;
  }
  
  return `${minutes} min ${remainingSeconds} sec`;
}
