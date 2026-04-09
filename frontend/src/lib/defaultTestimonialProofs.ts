export type TestimonialProofItem = {
  id: number | string;
  nameEn?: string | null;
  nameAr?: string | null;
  titleEn?: string | null;
  titleAr?: string | null;
  textEn?: string | null;
  textAr?: string | null;
  rating?: number | null;
  serviceKey?: string | null;
  proofImageUrl: string;
  showProofOnHome?: boolean | null;
  showProofOnDashboard?: boolean | null;
  proofHeadlineEn?: string;
  proofHeadlineAr?: string;
  proofSummaryEn?: string;
  proofSummaryAr?: string;
};

export const DEFAULT_TESTIMONIAL_PROOFS: TestimonialProofItem[] = [
  {
    id: "proof-academy-quality",
    proofImageUrl: "/feedbacks/support-academy-quality.JPG",
    rating: 5,
    serviceKey: "community",
    showProofOnHome: true,
    showProofOnDashboard: false,
    proofHeadlineEn: "A clear contrast from other academies",
    proofHeadlineAr: "فرق واضح عن الأكاديميات الأخرى",
    proofSummaryEn: "One student directly compares the academy against previous experiences and highlights stronger support, better care, and steadier progress.",
    proofSummaryAr: "إحدى الطالبات تقارن الأكاديمية مباشرة بتجارب سابقة وتذكر دعماً أقوى واهتماماً أفضل وتقدماً أكثر ثباتاً.",
  },
  {
    id: "proof-support-clear-explanations",
    proofImageUrl: "/feedbacks/support-clear-explanations.JPG",
    rating: 5,
    serviceKey: "courses",
    showProofOnHome: true,
    showProofOnDashboard: false,
    proofHeadlineEn: "Teaching explained in a way that sticks",
    proofHeadlineAr: "شرح تعليمي يثبت في الذهن",
    proofSummaryEn: "The material is described as detailed, useful, and practical rather than empty theory or filler.",
    proofSummaryAr: "الطالبة تصف المادة بأنها مفصلة ومفيدة وعملية وليست مجرد كلام عام أو حشو.",
  },
  {
    id: "proof-support-fast-replies",
    proofImageUrl: "/feedbacks/support-fast-replies.JPG",
    rating: 5,
    serviceKey: "community",
    showProofOnHome: true,
    showProofOnDashboard: true,
    proofHeadlineEn: "Follow-up that feels genuinely personal",
    proofHeadlineAr: "متابعة تشعر الطالب بالاهتمام الحقيقي",
    proofSummaryEn: "Students point to respectful communication, close follow-up, and the feeling that someone is really walking with them.",
    proofSummaryAr: "الطلاب يشيرون إلى الأسلوب الراقي وقرب المتابعة والشعور بأن هناك من يسير معهم فعلاً خطوة بخطوة.",
  },
  {
    id: "proof-support-clear-answers",
    proofImageUrl: "/feedbacks/support-clear-answers.JPG",
    rating: 5,
    serviceKey: "courses",
    showProofOnHome: true,
    showProofOnDashboard: true,
    proofHeadlineEn: "Answers that solve real blockers",
    proofHeadlineAr: "إجابات تحل العوائق فعلاً",
    proofSummaryEn: "The screenshots show students explicitly praising polite answers, troubleshooting help, and practical support when they get stuck.",
    proofSummaryAr: "اللقطات تظهر طلاباً يمدحون الإجابات المهذبة وحل المشاكل والدعم العملي عند التعثر.",
  },
];
