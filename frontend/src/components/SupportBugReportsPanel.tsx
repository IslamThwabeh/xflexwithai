import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bug, CheckCircle2, Clock3, ImagePlus, Loader2, Send, ShieldX, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";

type ClientBugStatus = "pending" | "rewarded" | "rejected";

function formatDate(value: string, isRTL: boolean) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(isRTL ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SupportBugReportsPanel() {
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();
  const [description, setDescription] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: reports, isLoading } = trpc.bugReports.myList.useQuery();
  const uploadMutation = trpc.bugReports.uploadImage.useMutation();
  const submitMutation = trpc.bugReports.submit.useMutation({
    onSuccess: async () => {
      setDescription("");
      setSelectedImage(null);
      setPreviewUrl("");
      toast.success(isRTL ? "تم إرسال البلاغ" : "Bug report submitted");
      await utils.bugReports.myList.invalidate();
      await utils.notifications.unreadCount.invalidate();
      await utils.notifications.list.invalidate();
    },
  });

  useEffect(() => {
    if (!selectedImage) {
      setPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImage);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedImage]);

  const isSubmitting = uploading || submitMutation.isPending;
  const hasSubmitContent = Boolean(description.trim() || selectedImage);
  const sortedReports = useMemo(() => reports ?? [], [reports]);

  const statusMeta = (status: ClientBugStatus) => {
    if (status === "rewarded") {
      return {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
        label: isRTL ? "تم القبول" : "Accepted",
      };
    }

    if (status === "rejected") {
      return {
        icon: <ShieldX className="h-3.5 w-3.5" />,
        className: "bg-rose-100 text-rose-700 border-rose-200",
        label: isRTL ? "مرفوض" : "Rejected",
      };
    }

    return {
      icon: <Clock3 className="h-3.5 w-3.5" />,
      className: "bg-amber-100 text-amber-700 border-amber-200",
      label: isRTL ? "قيد المراجعة" : "Pending review",
    };
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(isRTL ? "يرجى اختيار صورة فقط" : "Please select an image only");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(isRTL ? "حجم الصورة أكبر من 5 ميجابايت" : "Image size exceeds 5MB");
      return;
    }

    setSelectedImage(file);
  };

  const uploadImage = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index++) {
      binary += String.fromCharCode(bytes[index]);
    }

    const result = await uploadMutation.mutateAsync({
      fileData: btoa(binary),
      fileName: file.name,
      contentType: file.type,
    });

    return result.url;
  };

  const handleSubmit = async () => {
    const trimmedDescription = description.trim();
    if (!trimmedDescription && !selectedImage) {
      toast.error(isRTL ? "أدخل وصفاً أو أرفق صورة على الأقل" : "Add a description or image first");
      return;
    }

    setUploading(true);
    try {
      const imageUrl = selectedImage ? await uploadImage(selectedImage) : undefined;
      await submitMutation.mutateAsync({
        description: trimmedDescription || undefined,
        imageUrl,
      });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error(isRTL ? "تعذر إرسال البلاغ" : "Could not submit bug report");
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-emerald-50 p-2.5 text-emerald-600">
            <Bug className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              {isRTL ? "أبلغ عن خلل واحصل على نقاط" : "Report a bug and earn points"}
            </h2>
            <p className="text-sm text-slate-600">
              {isRTL
                ? "أرسل وصفاً واضحاً أو صورة توضح المشكلة. بعد المراجعة سيحدد الفريق عدد النقاط حسب مستوى الخطورة."
                : "Send a clear description or a screenshot. After review, the team will assign points based on the bug risk."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-900">
              {isRTL ? "وصف الخلل" : "Bug description"}
            </label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={3000}
              rows={5}
              placeholder={isRTL ? "اشرح أين ظهر الخلل وما الذي حدث" : "Explain where the bug appeared and what happened"}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
            <div className="text-xs text-slate-400">
              {description.length}/3000
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {isRTL ? "صورة توضيحية" : "Screenshot"}
                </p>
                <p className="text-xs text-slate-500">
                  {isRTL ? "اختياري، لكن يمكن الاعتماد عليها وحدها" : "Optional, but it can be submitted on its own"}
                </p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50">
                <ImagePlus className="h-4 w-4" />
                {selectedImage ? (isRTL ? "تغيير الصورة" : "Change image") : (isRTL ? "اختيار صورة" : "Choose image")}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              </label>
            </div>

            {selectedImage && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-600">
                  <span className="truncate">{selectedImage.name}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedImage(null)}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-white hover:text-slate-600"
                    aria-label={isRTL ? "إزالة الصورة" : "Remove image"}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {previewUrl && (
                  <img
                    src={previewUrl}
                    alt={isRTL ? "معاينة صورة البلاغ" : "Bug report preview"}
                    className="max-h-72 w-full rounded-xl object-contain bg-white"
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {isRTL
                  ? "يجب إدخال وصف أو رفع صورة واحدة على الأقل."
                  : "You need at least a description or an image."}
              </span>
            </div>
            <Button onClick={handleSubmit} disabled={isSubmitting || !hasSubmitContent} className="h-11 rounded-xl px-5">
              {isSubmitting ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Send className="me-2 h-4 w-4" />}
              {isRTL ? "إرسال البلاغ" : "Submit report"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-4 sm:p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {isRTL ? "بلاغاتي السابقة" : "My bug reports"}
            </h3>
            <p className="text-sm text-slate-500">
              {isRTL ? "تابع حالة كل بلاغ والنقاط المضافة" : "Track every report status and awarded points"}
            </p>
          </div>
          <Badge variant="outline" className="rounded-full border-slate-200 px-3 py-1 text-xs text-slate-600">
            {sortedReports.length} {isRTL ? "بلاغ" : "reports"}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : sortedReports.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            {isRTL ? "لا توجد بلاغات بعد. أرسل أول بلاغ من النموذج أعلاه." : "No bug reports yet. Submit your first report from the form above."}
          </div>
        ) : (
          <div className="space-y-3">
            {sortedReports.map((report: any) => {
              const meta = statusMeta(report.status as ClientBugStatus);
              return (
                <article key={report.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`gap-1 rounded-full border ${meta.className}`}>
                          {meta.icon}
                          {meta.label}
                        </Badge>
                        <span className="text-xs text-slate-400">#{report.id}</span>
                      </div>
                      <p className="text-xs text-slate-500">{formatDate(report.createdAt, isRTL)}</p>
                    </div>
                    {Number(report.awardedPoints ?? 0) > 0 && (
                      <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                        +{report.awardedPoints} {isRTL ? "نقطة" : "pts"}
                      </Badge>
                    )}
                  </div>

                  {report.description && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{report.description}</p>
                  )}

                  {report.imageUrl && (
                    <a
                      href={report.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
                    >
                      <img
                        src={report.imageUrl}
                        alt={isRTL ? "صورة البلاغ" : "Bug report image"}
                        className="max-h-72 w-full object-cover"
                      />
                    </a>
                  )}

                  {report.adminNote && (
                    <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
                      <p className="mb-1 font-medium text-slate-900">{isRTL ? "ملاحظة الفريق" : "Team note"}</p>
                      <p className="whitespace-pre-wrap">{report.adminNote}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
