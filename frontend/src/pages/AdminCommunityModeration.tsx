import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, MessageCircle, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AdminCommunityModeration() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const utils = trpc.useUtils();
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const availability = trpc.community.availability.useQuery(undefined, { retry: false });
  const enabled = Boolean(availability.data?.enabled);
  const postsQuery = trpc.community.adminListPosts.useQuery({ limit: 100 }, { enabled, retry: false });
  const reportsQuery = trpc.community.adminReports.useQuery({ status: "open", limit: 100 }, { enabled, retry: false });
  const postQuery = trpc.community.adminGetPost.useQuery(
    { id: selectedPostId ?? 0 },
    { enabled: enabled && Boolean(selectedPostId), retry: false },
  );

  useEffect(() => {
    const posts = postsQuery.data ?? [];
    if (posts.length === 0) {
      setSelectedPostId(null);
      return;
    }
    if (!posts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(posts[0].id);
    }
  }, [postsQuery.data, selectedPostId]);

  const labels = isRtl ? {
    title: "إشراف مجتمع الطلاب",
    subtitle: "مراجعة البلاغات وإخفاء أو استعادة المحتوى ضمن المجتمع التجريبي.",
    disabledTitle: "المجتمع غير مفعّل",
    disabledBody: "لوحة الإشراف جاهزة لكنها مخفية حتى تفعيل student_community_enabled بموافقة منفصلة.",
    posts: "المنشورات",
    reports: "البلاغات المفتوحة",
    noPosts: "لا توجد منشورات.",
    noReports: "لا توجد بلاغات مفتوحة.",
    comments: "التعليقات",
    hide: "إخفاء",
    restore: "استعادة",
    delete: "حذف منطقي",
    dismiss: "رفض البلاغ",
    updated: "تم تحديث الإشراف",
  } : {
    title: "Student Community Moderation",
    subtitle: "Review reports and hide, restore, or soft-delete community content during the pilot.",
    disabledTitle: "Community not enabled",
    disabledBody: "The moderation console is ready but hidden until student_community_enabled is turned on with separate approval.",
    posts: "Posts",
    reports: "Open reports",
    noPosts: "No posts yet.",
    noReports: "No open reports.",
    comments: "Comments",
    hide: "Hide",
    restore: "Restore",
    delete: "Soft delete",
    dismiss: "Dismiss report",
    updated: "Moderation updated",
  };

  const moderate = trpc.community.moderateContent.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.community.adminListPosts.invalidate(),
        utils.community.adminReports.invalidate(),
        selectedPostId ? utils.community.adminGetPost.invalidate({ id: selectedPostId }) : Promise.resolve(),
      ]);
      toast.success(labels.updated);
    },
    onError: (error) => toast.error(error.message),
  });

  const dismissReport = trpc.community.dismissReport.useMutation({
    onSuccess: async () => {
      await utils.community.adminReports.invalidate();
      toast.success(labels.updated);
    },
    onError: (error) => toast.error(error.message),
  });

  if (availability.isLoading) {
    return <AdminCommunityState title={isRtl ? "جار التحميل..." : "Loading..."} icon={<Loader2 className="h-6 w-6 animate-spin" />} />;
  }

  if (!enabled) {
    return <AdminCommunityState title={labels.disabledTitle} body={labels.disabledBody} icon={<AlertCircle className="h-7 w-7" />} />;
  }

  const selectedPost = postQuery.data;

  return (
    <DashboardLayout>
      <main className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <header>
          <div className="mb-2 flex items-center gap-2 text-emerald-700">
            <ShieldAlert className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.16em]">Phase 4</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">{labels.title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{labels.subtitle}</p>
        </header>

        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)_360px]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageCircle className="h-5 w-5 text-emerald-700" />
                {labels.posts}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {postsQuery.isLoading ? (
                <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
              ) : !(postsQuery.data?.length) ? (
                <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">{labels.noPosts}</p>
              ) : postsQuery.data.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => setSelectedPostId(post.id)}
                  className={`w-full rounded-xl border p-3 text-start transition ${
                    selectedPostId === post.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 font-semibold text-slate-950">{post.title}</p>
                    <Badge className={statusClass(post.status)}>{statusLabel(post.status, isRtl)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{post.authorEmail}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <section>
            {!selectedPostId ? (
              <Card className="border-dashed"><CardContent className="p-10 text-center text-sm text-slate-500">{labels.noPosts}</CardContent></Card>
            ) : postQuery.isLoading || !selectedPost ? (
              <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>
            ) : (
              <Card>
                <CardContent className="space-y-5 p-5 md:p-6">
                  <article>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-slate-950">{selectedPost.title}</h2>
                        <p className="mt-1 text-xs text-slate-500">{selectedPost.authorEmail}</p>
                      </div>
                      <ModerationButtons
                        labels={labels}
                        status={selectedPost.status}
                        disabled={moderate.isPending}
                        onHide={() => moderate.mutate({ targetType: "post", targetId: selectedPost.id, action: "hide" })}
                        onRestore={() => moderate.mutate({ targetType: "post", targetId: selectedPost.id, action: "restore" })}
                        onDelete={() => moderate.mutate({ targetType: "post", targetId: selectedPost.id, action: "delete" })}
                      />
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedPost.body}</p>
                  </article>

                  <div className="border-t pt-5">
                    <h3 className="mb-3 font-semibold">{labels.comments}</h3>
                    <div className="space-y-3">
                      {selectedPost.comments.map((comment) => (
                        <article key={comment.id} className="rounded-xl border bg-slate-50 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-slate-500">{comment.authorEmail}</p>
                              <Badge className={statusClass(comment.status)}>{statusLabel(comment.status, isRtl)}</Badge>
                            </div>
                            <ModerationButtons
                              labels={labels}
                              status={comment.status}
                              disabled={moderate.isPending}
                              onHide={() => moderate.mutate({ targetType: "comment", targetId: comment.id, action: "hide" })}
                              onRestore={() => moderate.mutate({ targetType: "comment", targetId: comment.id, action: "restore" })}
                              onDelete={() => moderate.mutate({ targetType: "comment", targetId: comment.id, action: "delete" })}
                            />
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.body}</p>
                        </article>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </section>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FlagIcon />
                {labels.reports}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {reportsQuery.isLoading ? (
                <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
              ) : !(reportsQuery.data?.length) ? (
                <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">{labels.noReports}</p>
              ) : reportsQuery.data.map((report) => (
                <article key={report.id} className="rounded-xl border bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{report.reason}</p>
                      <p className="mt-1 text-xs text-slate-500">{report.reporterEmail}</p>
                    </div>
                    <Badge variant="outline">{report.targetType} #{report.targetId}</Badge>
                  </div>
                  {report.details && <p className="mt-2 text-xs leading-5 text-slate-500">{report.details}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedPostId(report.targetType === "post" ? report.targetId : selectedPostId)}>
                      <Eye className="h-4 w-4" /> {isRtl ? "عرض" : "View"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={dismissReport.isPending} onClick={() => dismissReport.mutate({ reportId: report.id })}>
                      <XCircle className="h-4 w-4" /> {labels.dismiss}
                    </Button>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
        </div>
      </main>
    </DashboardLayout>
  );
}

function ModerationButtons({ labels, status, disabled, onHide, onRestore, onDelete }: {
  labels: Record<string, string>;
  status: string;
  disabled: boolean;
  onHide: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "hidden" && status !== "deleted" && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={onHide}>
          <EyeOff className="h-4 w-4" /> {labels.hide}
        </Button>
      )}
      {status !== "visible" && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={onRestore}>
          <CheckCircle2 className="h-4 w-4" /> {labels.restore}
        </Button>
      )}
      {status !== "deleted" && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={onDelete}>
          <Trash2 className="h-4 w-4" /> {labels.delete}
        </Button>
      )}
    </div>
  );
}

function FlagIcon() {
  return <ShieldAlert className="h-5 w-5 text-red-600" />;
}

function statusLabel(status: string, isRtl: boolean) {
  const labels: Record<string, [string, string]> = {
    visible: ["Visible", "ظاهر"],
    hidden: ["Hidden", "مخفي"],
    deleted: ["Deleted", "محذوف"],
  };
  return labels[status]?.[isRtl ? 1 : 0] ?? status;
}

function statusClass(status: string) {
  if (status === "hidden") return "bg-amber-100 text-amber-700";
  if (status === "deleted") return "bg-red-100 text-red-700";
  return "bg-emerald-100 text-emerald-700";
}

function AdminCommunityState({ icon, title, body }: { icon: React.ReactNode; title: string; body?: string }) {
  return (
    <DashboardLayout>
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="flex flex-col items-center p-8">
            <div className="mb-4 rounded-2xl bg-slate-100 p-3 text-slate-600">{icon}</div>
            <h1 className="text-xl font-bold text-slate-950">{title}</h1>
            {body && <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
