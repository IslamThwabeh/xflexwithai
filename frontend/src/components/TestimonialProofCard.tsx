import { Badge } from "@/components/ui/badge";
import type { TestimonialProofItem } from "@/lib/defaultTestimonialProofs";
import { ArrowUpRight, Star } from "lucide-react";

type TestimonialProofCardProps = {
  item: TestimonialProofItem;
  isRTL: boolean;
  compact?: boolean;
};

const serviceLabels = {
  courses: { en: "Learning", ar: "التعلم" },
  community: { en: "Community", ar: "المجتمع" },
  lexai: { en: "LexAI", ar: "ليكس AI" },
  recommendations: { en: "Recommendations", ar: "التوصيات" },
} as const;

const fallbackHeadline = {
  en: "Real student proof",
  ar: "إثبات حقيقي من الطلاب",
};

export default function TestimonialProofCard({ item, isRTL, compact = false }: TestimonialProofCardProps) {
  if (!item.proofImageUrl) return null;

  const headline = isRTL
    ? item.proofHeadlineAr || item.titleAr || fallbackHeadline.ar
    : item.proofHeadlineEn || item.titleEn || fallbackHeadline.en;
  const summary = isRTL ? item.proofSummaryAr || item.textAr || "" : item.proofSummaryEn || item.textEn || "";
  const displayName = isRTL ? item.nameAr : item.nameEn;
  const rating = Math.max(1, Math.min(5, item.rating ?? 5));
  const serviceLabel = item.serviceKey ? serviceLabels[item.serviceKey as keyof typeof serviceLabels] : null;
  const altText = isRTL ? `لقطة شهادة: ${headline}` : `Feedback proof: ${headline}`;
  const openLabel = isRTL ? "افتح اللقطة الكاملة" : "Open full screenshot";

  return (
    <a
      href={item.proofImageUrl}
      target="_blank"
      rel="noreferrer"
      className="group block h-full"
    >
      <div className="h-full rounded-[28px] border border-black/5 bg-white p-3.5 shadow-[0_16px_36px_rgba(15,23,42,0.07)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_20px_42px_rgba(15,23,42,0.10)]">
        <div className={`${compact ? "mb-3 rounded-[22px] p-2.5" : "mb-4 rounded-[24px] p-3"} border border-[#eadfce] bg-[linear-gradient(180deg,#fbfaf7,#f5efe4)]`}>
          <div className={`${compact ? "h-[240px]" : "h-[340px] sm:h-[380px]"} overflow-hidden rounded-[18px] border border-black/5 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.05)]`}>
            <img
              src={item.proofImageUrl}
              alt={altText}
              loading="lazy"
              className="h-full w-full object-contain object-center"
            />
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((value) => (
              <Star key={value} className={`h-3.5 w-3.5 ${value <= rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />
            ))}
          </div>
          {serviceLabel ? (
            <Badge variant="outline" className="border-emerald-100 bg-emerald-50/70 text-[11px] text-emerald-700">
              {isRTL ? serviceLabel.ar : serviceLabel.en}
            </Badge>
          ) : null}
        </div>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`${compact ? "text-sm" : "text-base"} font-semibold tracking-[-0.2px] text-xf-dark`}>
              {headline}
            </p>
            {summary ? (
              <p className={`${compact ? "line-clamp-2 text-xs" : "line-clamp-3 text-sm"} mt-2 leading-relaxed text-gray-600`}>
                {summary}
              </p>
            ) : null}
            {displayName ? (
              <p className="mt-3 text-xs text-gray-500">
                {displayName}
              </p>
            ) : null}
            {!compact ? (
              <p className="mt-3 text-xs font-semibold text-emerald-700">
                {openLabel}
              </p>
            ) : null}
          </div>
          {!compact ? <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 transition group-hover:text-xf-primary" /> : null}
        </div>
      </div>
    </a>
  );
}
