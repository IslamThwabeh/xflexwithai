export type SupportMediaKind = "image" | "video" | "file";

export const MAX_SUPPORT_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_SUPPORT_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_SUPPORT_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_SUPPORT_VIDEO_SECONDS = 60;

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov", ".m4v", ".avi", ".mpeg", ".mpg"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"];

export function getSupportMediaKind(input?: { contentType?: string | null; name?: string | null; url?: string | null }): SupportMediaKind {
  const contentType = input?.contentType?.toLowerCase() ?? "";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("image/")) return "image";

  const value = `${input?.name ?? ""} ${input?.url ?? ""}`.toLowerCase().split("?")[0];
  if (VIDEO_EXTENSIONS.some((extension) => value.endsWith(extension) || value.includes(`${extension}/`))) return "video";
  if (IMAGE_EXTENSIONS.some((extension) => value.endsWith(extension) || value.includes(`${extension}/`))) return "image";

  return "file";
}

export function getVideoDuration(file: File | Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Video duration could not be read"));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Video metadata could not be read"));
    };
    video.src = objectUrl;
  });
}

export function formatSupportFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}
