import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { withApiBase } from "@/lib/apiBase";
import { formatFreeLibraryFileSize } from "@/lib/freeLibrary";
import { buildFreeLibraryVideoDeepLink } from "@shared/freeLibrary";
import { BookOpen, Download, ExternalLink, FileText, Play, Shield, Video } from "lucide-react";

type FreeLibraryDocumentItem = {
  slug: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  originalFileName: string;
  fileSizeBytes: number | null;
  highlightTopicsEn: string[];
  highlightTopicsAr: string[];
  viewPath: string;
  downloadPath: string;
};

type FreeLibraryVideoItem = {
  slug: string;
  titleEn: string;
  titleAr: string;
  descriptionEn: string;
  descriptionAr: string;
  categoryEn: string;
  categoryAr: string;
  originalFileName: string;
  fileSizeBytes: number;
  tone: "emerald" | "teal" | "amber";
  streamPath: string;
};

type FreeLibraryData = {
  documents: FreeLibraryDocumentItem[];
  videos: FreeLibraryVideoItem[];
};

type Props = {
  data: FreeLibraryData;
  isRtl: boolean;
  mode?: "full" | "compact" | "home";
  initialVideoSlug?: string | null;
};

const toneStyles: Record<FreeLibraryVideoItem["tone"], string> = {
  emerald: "from-emerald-500/10 to-teal-500/10 border-emerald-200",
  teal: "from-teal-500/10 to-emerald-500/10 border-teal-200",
  amber: "from-amber-500/10 to-orange-500/10 border-amber-200",
};

function FreeVideoPlayer({ selectedVideo, isRtl, compact }: { selectedVideo: FreeLibraryVideoItem; isRtl: boolean; compact?: boolean }) {
  const videoSrc = useMemo(() => withApiBase(selectedVideo.streamPath), [selectedVideo.streamPath]);

  return (
    <div className="overflow-hidden rounded-[20px] border border-emerald-100 bg-white shadow-sm">
      <div className="aspect-video bg-black">
        <video
          key={selectedVideo.slug}
          src={videoSrc}
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onContextMenu={(event) => event.preventDefault()}
          className="h-full w-full"
        />
      </div>
      <div className={compact ? "p-4" : "p-5 md:p-6"}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            <Video className="me-1 h-3.5 w-3.5" />
            {isRtl ? selectedVideo.categoryAr : selectedVideo.categoryEn}
          </Badge>
          <Badge variant="outline" className="border-emerald-200 text-emerald-700">
            {formatFreeLibraryFileSize(selectedVideo.fileSizeBytes, isRtl)}
          </Badge>
        </div>
        <h3 className={compact ? "text-lg font-bold text-xf-dark" : "text-2xl font-extrabold text-xf-dark tracking-[-0.4px]"}>
          {isRtl ? selectedVideo.titleAr : selectedVideo.titleEn}
        </h3>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          {isRtl ? selectedVideo.descriptionAr : selectedVideo.descriptionEn}
        </p>
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
          <Shield className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {isRtl
              ? "يتم تشغيل الفيديو من داخل المنصة مع تعطيل خيار التنزيل المباشر، لذلك يفضل مشاهدته من الصفحة نفسها بدل مشاركة الرابط."
              : "This video streams inside the platform with direct download controls disabled, so it is best viewed from this page rather than shared externally."}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function FreeLibrarySection({ data, isRtl, mode = "full", initialVideoSlug }: Props) {
  const isCompact = mode !== "full";
  const visibleVideos = mode === "compact" ? data.videos.slice(0, 2) : mode === "home" ? data.videos.slice(0, 3) : data.videos;
  const visibleDocuments = mode === "compact" ? data.documents.slice(0, 1) : data.documents;

  const firstVideo = visibleVideos[0] ?? data.videos[0] ?? null;
  const [selectedVideoSlug, setSelectedVideoSlug] = useState(initialVideoSlug && data.videos.some((video) => video.slug === initialVideoSlug) ? initialVideoSlug : firstVideo?.slug ?? null);

  useEffect(() => {
    if (initialVideoSlug && data.videos.some((video) => video.slug === initialVideoSlug)) {
      setSelectedVideoSlug(initialVideoSlug);
      return;
    }

    if (!selectedVideoSlug && firstVideo) {
      setSelectedVideoSlug(firstVideo.slug);
    }
  }, [data.videos, firstVideo, initialVideoSlug, selectedVideoSlug]);

  const selectedVideo = data.videos.find((video) => video.slug === selectedVideoSlug) ?? firstVideo;

  return (
    <div className={mode === "home" ? "space-y-8" : "space-y-10"}>
      {selectedVideo ? (
        <div className={mode === "compact" ? "grid gap-4 lg:grid-cols-[1.3fr_0.7fr]" : "grid gap-6 xl:grid-cols-[1.35fr_0.65fr]"}>
          <FreeVideoPlayer selectedVideo={selectedVideo} isRtl={isRtl} compact={isCompact} />

          <div className="space-y-3">
            {visibleVideos.map((video) => {
              const isActive = video.slug === selectedVideo.slug;
              return (
                <button
                  key={video.slug}
                  type="button"
                  onClick={() => setSelectedVideoSlug(video.slug)}
                  className={`w-full rounded-[18px] border bg-gradient-to-br p-4 text-start transition-all duration-200 ${toneStyles[video.tone]} ${isActive ? "ring-2 ring-emerald-400 shadow-md" : "hover:border-emerald-300 hover:shadow-sm"}`}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Badge variant="outline" className="border-white/70 bg-white/80 text-slate-700">
                      <Play className="me-1 h-3 w-3" />
                      {isRtl ? video.categoryAr : video.categoryEn}
                    </Badge>
                    <span className="text-xs font-medium text-gray-500">{formatFreeLibraryFileSize(video.fileSizeBytes, isRtl)}</span>
                  </div>
                  <h4 className="text-sm font-bold text-xf-dark md:text-base">{isRtl ? video.titleAr : video.titleEn}</h4>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-600 md:text-sm">
                    {isRtl ? video.descriptionAr : video.descriptionEn}
                  </p>
                  {mode !== "full" ? (
                    <div className="mt-3 text-xs font-semibold text-emerald-700">
                      {isRtl ? "افتح المكتبة الكاملة" : "Open full library"}
                    </div>
                  ) : null}
                </button>
              );
            })}

            {mode !== "full" ? (
              <Link href={buildFreeLibraryVideoDeepLink(selectedVideo.slug)}>
                <Button variant="outline" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  {isRtl ? "عرض كل الفيديوهات المجانية" : "View All Free Videos"}
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {visibleDocuments.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleDocuments.map((document) => (
            <div key={document.slug} className="rounded-[20px] border border-amber-100 bg-white p-5 shadow-sm md:p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                  <BookOpen className="me-1 h-3.5 w-3.5" />
                  {isRtl ? "دليل مجاني" : "Free Guide"}
                </Badge>
                <Badge variant="outline" className="border-amber-200 text-amber-700">
                  <FileText className="me-1 h-3.5 w-3.5" />
                  PDF
                </Badge>
                <Badge variant="outline" className="border-amber-200 text-amber-700">
                  {formatFreeLibraryFileSize(document.fileSizeBytes, isRtl)}
                </Badge>
              </div>

              <h3 className="text-xl font-extrabold tracking-[-0.3px] text-xf-dark">
                {isRtl ? document.titleAr : document.titleEn}
              </h3>
              <p className="mt-3 text-sm leading-6 text-gray-600">
                {isRtl ? document.descriptionAr : document.descriptionEn}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {(isRtl ? document.highlightTopicsAr : document.highlightTopicsEn).map((topic) => (
                  <span key={topic} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                    {topic}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button asChild variant="outline" className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-50">
                  <a href={withApiBase(document.viewPath)} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    {isRtl ? "فتح الدليل" : "Open Guide"}
                  </a>
                </Button>
                <Button asChild className="flex-1 bg-amber-500 text-white hover:bg-amber-600">
                  <a href={withApiBase(document.downloadPath)}>
                    <Download className="h-4 w-4" />
                    {isRtl ? "تنزيل PDF" : "Download PDF"}
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}