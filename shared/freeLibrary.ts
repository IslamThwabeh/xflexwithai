export type FreeLibraryDocument = {
  slug: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  originalFileName: string;
  objectKey: string;
  fileSizeBytes: number | null;
  highlightTopicsEn: string[];
  highlightTopicsAr: string[];
};

export type FreeLibraryVideoTone = "emerald" | "teal" | "amber";

export type FreeLibraryVideo = {
  slug: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  categoryEn: string;
  categoryAr: string;
  originalFileName: string;
  objectKey: string;
  fileSizeBytes: number;
  tone: FreeLibraryVideoTone;
};

export const FREE_LIBRARY_DOCUMENTS: FreeLibraryDocument[] = [];

export const FREE_LIBRARY_VIDEOS: FreeLibraryVideo[] = [
  {
    slug: "build-trading-strategy",
    titleEn: "Build Your Trading Strategy",
    titleAr: "كيف تبني استراتيجية التداول",
    descriptionEn:
      "An Arabic walkthrough for structuring a repeatable trading strategy instead of entering the market randomly.",
    descriptionAr:
      "شرح عربي عملي لبناء استراتيجية تداول قابلة للتكرار بدل الدخول العشوائي إلى السوق.",
    categoryEn: "Strategy",
    categoryAr: "الاستراتيجية",
    originalFileName: "كيف تبني استراتيجية التداول.mp4",
    objectKey: "free-library/videos/build-trading-strategy.mp4",
    fileSizeBytes: 36070883,
    tone: "emerald",
  },
  {
    slug: "recommendation-psychology",
    titleEn: "Recommendation Psychology",
    titleAr: "سيكولوجية التوصيات",
    descriptionEn:
      "An Arabic session on the mindset, discipline, and emotional filters needed when trading recommendations.",
    descriptionAr:
      "جلسة عربية تركز على الذهنية والانضباط والفلترة النفسية المطلوبة عند العمل على التوصيات.",
    categoryEn: "Mindset",
    categoryAr: "الذهنية",
    originalFileName: "سيكوليجية التوصيات.mp4",
    objectKey: "free-library/videos/recommendation-psychology.mp4",
    fileSizeBytes: 71557610,
    tone: "amber",
  },
  {
    slug: "smart-chaos-course",
    titleEn: "Smart Chaos Course",
    titleAr: "كورس الفوضى الذكية",
    descriptionEn:
      "A focused Arabic lesson that breaks down the smart-chaos concept and how to read it inside market structure.",
    descriptionAr:
      "درس عربي مركز يشرح مفهوم الفوضى الذكية وكيفية قراءته داخل هيكل السوق.",
    categoryEn: "Market Reading",
    categoryAr: "قراءة السوق",
    originalFileName: "كورس الفوضى الذكية.mp4",
    objectKey: "free-library/videos/smart-chaos-course.mp4",
    fileSizeBytes: 121609277,
    tone: "teal",
  },
];

export function getFreeLibraryDocumentBySlug(slug: string) {
  return FREE_LIBRARY_DOCUMENTS.find((document) => document.slug === slug) ?? null;
}

export function getFreeLibraryVideoBySlug(slug: string) {
  return FREE_LIBRARY_VIDEOS.find((video) => video.slug === slug) ?? null;
}

export function buildFreeLibraryDocumentPath(slug: string, action: "view" | "download") {
  return `/api/free-library/documents/${encodeURIComponent(slug)}/${action}`;
}

export function buildFreeLibraryVideoStreamPath(slug: string, token?: string) {
  const basePath = `/api/free-library/videos/${encodeURIComponent(slug)}/stream`;
  if (!token) {
    return basePath;
  }

  return `${basePath}?token=${encodeURIComponent(token)}`;
}

export function buildFreeLibraryVideoDeepLink(slug: string) {
  return `/free-content?video=${encodeURIComponent(slug)}#free-videos`;
}