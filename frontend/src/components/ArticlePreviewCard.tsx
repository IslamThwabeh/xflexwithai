import { Link } from "wouter";
import { ArrowUpRight, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RouterOutputs } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type PublicArticle = RouterOutputs["articles"]["list"][number];

type Props = {
  article: PublicArticle;
  isRtl: boolean;
  variant?: "feature" | "grid" | "compact";
  className?: string;
};

const themeClasses: Record<PublicArticle["theme"], { badge: string; ring: string; glow: string }> = {
  emerald: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    ring: "group-hover:border-emerald-300",
    glow: "from-emerald-500/20 via-transparent to-teal-500/10",
  },
  teal: {
    badge: "border-teal-200 bg-teal-50 text-teal-700",
    ring: "group-hover:border-teal-300",
    glow: "from-teal-500/18 via-transparent to-emerald-500/10",
  },
  amber: {
    badge: "border-amber-200 bg-amber-50 text-amber-700",
    ring: "group-hover:border-amber-300",
    glow: "from-amber-500/18 via-transparent to-orange-500/10",
  },
};

function formatPublishedDate(value: string | null, isRtl: boolean) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(isRtl ? "ar-EG" : "en-US", {
    year: variantDateStyleYear(value),
    month: "long",
    day: "numeric",
  });
}

function variantDateStyleYear(value: string) {
  return value ? "numeric" : undefined;
}

export default function ArticlePreviewCard({ article, isRtl, variant = "grid", className }: Props) {
  const title = isRtl ? article.titleAr : article.titleEn;
  const excerpt = isRtl
    ? article.excerptAr || article.excerptEn || ""
    : article.excerptEn || article.excerptAr || "";
  const subject = isRtl ? article.subjectAr : article.subjectEn;
  const dateLabel = formatPublishedDate(article.publishedAt, isRtl);
  const theme = themeClasses[article.theme];
  const isFeature = variant === "feature";
  const isCompact = variant === "compact";

  return (
    <Link href={`/articles/${article.slug}`}>
      <article
        className={cn(
          "group relative overflow-hidden rounded-[26px] border border-white/80 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(15,23,42,0.14)]",
          theme.ring,
          className,
        )}
      >
        <div className={cn("relative overflow-hidden", isFeature ? "h-72 md:h-[400px]" : isCompact ? "h-44" : "h-56") }>
          {article.thumbnailUrl ? (
            <img
              src={article.thumbnailUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-emerald-100 via-white to-amber-100" />
          )}
          <div className={cn("absolute inset-0 bg-gradient-to-t", theme.glow)} />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 md:p-5">
            <Badge variant="outline" className={cn("rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.18em] uppercase", theme.badge)}>
              {subject}
            </Badge>
            <div className="rounded-full border border-white/70 bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
              {isRtl ? `${article.readingTimeMinutes} دقائق قراءة` : `${article.readingTimeMinutes} min read`}
            </div>
          </div>
        </div>

        <div className={cn("relative p-5 md:p-6", isFeature && "md:p-7") }>
          <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {dateLabel ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {dateLabel}
              </span>
            ) : null}
            {article.isCurated ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                {isRtl ? "قراءة مختارة" : "Editorial Pick"}
              </span>
            ) : null}
          </div>

          <h3 className={cn("font-extrabold tracking-[-0.4px] text-slate-950 transition-colors group-hover:text-emerald-800", isFeature ? "text-2xl md:text-[2rem] leading-tight" : isCompact ? "text-lg leading-snug" : "text-xl leading-snug") }>
            {title}
          </h3>

          {excerpt ? (
            <p className={cn("mt-3 text-sm leading-6 text-slate-600", isFeature ? "line-clamp-4 md:text-[15px]" : isCompact ? "line-clamp-3" : "line-clamp-3 md:text-[15px]") }>
              {excerpt}
            </p>
          ) : null}

          <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 transition-transform duration-200 group-hover:translate-x-1">
            {isRtl ? "اقرأ المقال كاملاً" : "Read the full article"}
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </div>
      </article>
    </Link>
  );
}