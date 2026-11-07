export type ClientGuideTopic = 'getting-started' | 'recommendations' | 'lexai';
export type ClientGuideFilter = ClientGuideTopic | 'all';

export const CLIENT_GUIDE_TOPICS = [
  { id: 'all', ar: 'كل الشروحات', en: 'All guides' },
  { id: 'getting-started', ar: 'البداية', en: 'Getting started' },
  { id: 'recommendations', ar: 'التوصيات', en: 'Recommendations' },
  { id: 'lexai', ar: 'LexAI', en: 'LexAI' },
] as const;

export const CLIENT_GUIDES = [
  { slug: 'demo-account', topic: 'getting-started', seconds: 82, titleAr: 'فتح حساب تجريبي', titleEn: 'Open a demo account', descriptionAr: 'تعرّف على خطوات فتح حساب تجريبي للتدرب على استخدام المنصة.', descriptionEn: 'Learn how to open a demo account to practise using the platform.' },
  { slug: 'recommendations', topic: 'recommendations', seconds: 246, titleAr: 'تنفيذ التوصية والحجز والتأمين ومتابعة الصفقة', titleEn: 'Use recommendations and follow a trade', descriptionAr: 'شرح قراءة التوصية وتطبيقها ومتابعة التحديثات والحجز والتأمين.', descriptionEn: 'Read a recommendation, apply it, and follow its updates and trade management steps.' },
  { slug: 'lexai-options', topic: 'lexai', seconds: 351, titleAr: 'التعرف على خيارات LexAI', titleEn: 'Explore the LexAI options', descriptionAr: 'تعرّف على أنواع التحليل والخيارات المتاحة داخل LexAI.', descriptionEn: 'Explore the analysis modes and options available in LexAI.' },
  { slug: 'lexai-analysis', topic: 'lexai', seconds: 387, titleAr: 'تحليل الشارت باستخدام LexAI', titleEn: 'Analyse a chart with LexAI', descriptionAr: 'شاهد خطوات رفع الشارت وطلب التحليل من LexAI.', descriptionEn: 'Upload your chart and request an analysis from LexAI.' },
  { slug: 'lexai-apply', topic: 'lexai', seconds: 202, titleAr: 'تطبيق نتيجة تحليل LexAI', titleEn: 'Apply a LexAI analysis', descriptionAr: 'شرح عملي للانتقال من قراءة التحليل إلى تطبيق خطواته.', descriptionEn: 'A practical walkthrough of reading an analysis and applying its steps.' },
  { slug: 'lexai-review', topic: 'lexai', seconds: 152, titleAr: 'تقييم تحليلك باستخدام LexAI', titleEn: 'Review your analysis with LexAI', descriptionAr: 'أرسل تحليلك الشخصي إلى LexAI للحصول على ملاحظات عليه.', descriptionEn: 'Submit your own analysis to LexAI for feedback.' },
] as const;

export type ClientGuide = (typeof CLIENT_GUIDES)[number];

export function getClientGuide(slug: string) {
  return CLIENT_GUIDES.find(guide => guide.slug === slug);
}

export function getClientGuideObjectKey(slug: string) {
  return getClientGuide(slug) ? `client-guides/v1/${slug}.mp4` : null;
}

export function getClientGuidePoster(slug: string) {
  return `/images/client-guides/${slug}.jpg`;
}

export function formatGuideDuration(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function parseClientGuideFilter(value: string | null): ClientGuideFilter {
  return CLIENT_GUIDE_TOPICS.find(topic => topic.id === value)?.id ?? 'all';
}
