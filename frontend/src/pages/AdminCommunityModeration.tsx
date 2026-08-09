import DashboardLayout from "@/components/DashboardLayout";
import { AdminFeatureSetupCard, SafeAdminPreview } from "@/components/admin/SafeAdminPreview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AlertCircle, BellRing, Bot, CheckCircle2, ExternalLink, Eye, EyeOff, Heart, Loader2, MessageCircle, Plus, Power, PowerOff, RefreshCw, Search, Send, ShieldAlert, Sparkles, Trash2, UserCheck, UserX, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function getInitialCommunityPostId() {
  if (typeof window === "undefined") return null;
  const value = Number(new URLSearchParams(window.location.search).get("postId"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function getInitialCommunityReportId() {
  if (typeof window === "undefined") return null;
  const value = Number(new URLSearchParams(window.location.search).get("reportId"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function getInitialCommunityPreview() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "student";
}

type CommunitySetupTarget = "policy" | "automated-checks";

function getInitialCommunitySetupTarget(): CommunitySetupTarget | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("setup");
  return value === "policy" || value === "automated-checks" ? value : null;
}

const COMMUNITY_SETUP_ELEMENT_IDS: Record<CommunitySetupTarget, string> = {
  policy: "community-policy-terms",
  "automated-checks": "community-automated-checks",
};

function focusCommunitySetup(target: CommunitySetupTarget) {
  const element = document.getElementById(COMMUNITY_SETUP_ELEMENT_IDS[target]);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
  element.focus({ preventScroll: true });
}

type CommunityContentAction = "hide" | "restore" | "delete";

type CommunityModerationIntent = {
  kind: "content";
  action: CommunityContentAction;
  targetType: "post" | "comment";
  targetId: number;
  targetLabel: string;
  preview: string;
  authorEmail: string;
  affectedReportCount: number;
} | {
  kind: "report";
  reportId: number;
  targetLabel: string;
  preview: string;
  reporterEmail: string;
};

type CommunityFocusTarget = {
  targetType: "post" | "comment";
  targetId: number;
};

export default function AdminCommunityModeration() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [initialPostId] = useState(getInitialCommunityPostId);
  const [initialReportId] = useState(getInitialCommunityReportId);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(
    getInitialCommunityPostId,
  );
  const [directStudentPreview] = useState(getInitialCommunityPreview);
  const [initialSetupTarget] = useState(getInitialCommunitySetupTarget);
  const [showStudentPreview, setShowStudentPreview] = useState(directStudentPreview);
  const [focusedReportId, setFocusedReportId] = useState<number | null>(initialReportId);
  const [focusedTarget, setFocusedTarget] = useState<CommunityFocusTarget | null>(
    initialPostId ? { targetType: "post", targetId: initialPostId } : null,
  );
  const [moderationIntent, setModerationIntent] = useState<CommunityModerationIntent | null>(null);
  const [moderationNote, setModerationNote] = useState("");
  const resolvedReportDeepLink = useRef(false);

  const availability = trpc.community.availability.useQuery(undefined, { retry: false });
  const enabled = Boolean(availability.data?.enabled);
  const postsQuery = trpc.community.adminListPosts.useQuery({ limit: 100 }, { enabled, retry: false });
  const reportsQuery = trpc.community.adminReports.useQuery({ status: "open", limit: 100 }, { enabled, retry: false });
  const postQuery = trpc.community.adminGetPost.useQuery(
    { id: selectedPostId ?? 0 },
    { enabled: enabled && Boolean(selectedPostId), retry: false },
  );
  const selectedPost = postQuery.data;

  useEffect(() => {
    if (!initialSetupTarget || availability.isLoading) return;
    const timeout = window.setTimeout(
      () => focusCommunitySetup(initialSetupTarget),
      75,
    );
    return () => window.clearTimeout(timeout);
  }, [availability.isLoading, initialSetupTarget]);

  useEffect(() => {
    if (!postsQuery.isSuccess) return;
    const posts = postsQuery.data ?? [];
    if (posts.length === 0) {
      setSelectedPostId(null);
      return;
    }
    if (!posts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(posts[0].id);
    }
  }, [postsQuery.data, postsQuery.isSuccess, selectedPostId]);

  useEffect(() => {
    if (!initialReportId || resolvedReportDeepLink.current || !reportsQuery.data) return;
    const report = reportsQuery.data.find(item => item.id === initialReportId);
    if (!report) return;
    resolvedReportDeepLink.current = true;
    setFocusedReportId(report.id);
    setFocusedTarget({
      targetType: report.targetType === "comment" ? "comment" : "post",
      targetId: report.targetId,
    });
    if (report.postId) setSelectedPostId(report.postId);
  }, [initialReportId, reportsQuery.data]);

  useEffect(() => {
    if (!focusedReportId || !reportsQuery.data) return;
    const timeoutId = window.setTimeout(() => {
      document.getElementById(`community-report-${focusedReportId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 80);
    return () => window.clearTimeout(timeoutId);
  }, [focusedReportId, reportsQuery.data]);

  useEffect(() => {
    if (!focusedTarget || !selectedPost) return;
    const targetExists = focusedTarget.targetType === "post"
      ? selectedPost.id === focusedTarget.targetId
      : selectedPost.comments.some(comment => comment.id === focusedTarget.targetId);
    if (!targetExists) return;
    const timeoutId = window.setTimeout(() => {
      document.getElementById(
        `community-${focusedTarget.targetType}-${focusedTarget.targetId}`,
      )?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [focusedTarget, selectedPost]);

  const labels = isRtl ? {
    title: "إشراف مجتمع الطلاب",
    subtitle: "مراجعة البلاغات وإخفاء أو استعادة المحتوى ضمن المجتمع التجريبي.",
    disabledTitle: "المجتمع غير مفعّل",
    disabledBody: "صفحة الإدارة متاحة لك، لكن المجتمع ما زال مخفياً عن الطلاب وموظفي الدعم حتى تفعيله بموافقة منفصلة.",
    openSettings: "إدارة إعدادات التفعيل",
    posts: "المنشورات",
    reports: "البلاغات المفتوحة",
    noPosts: "لا توجد منشورات.",
    noPostsDetail: "لم ينشر الطلاب محتوى فعلياً بعد. استخدم معاينة الطالب لشرح التجربة بأمان.",
    noReports: "لا توجد بلاغات مفتوحة.",
    noReportsDetail: "ستظهر هنا البلاغات الجديدة مع المحتوى والسبب وإجراءات المراجعة.",
    comments: "التعليقات",
    hide: "إخفاء",
    restore: "استعادة",
    delete: "حذف منطقي",
    dismiss: "رفض البلاغ",
    updated: "تم تحديث الإشراف",
    previewStudent: "معاينة تجربة الطالب",
    closePreview: "إغلاق المعاينة",
    workspace: "مساحة المجتمع والسلامة",
    loadFailed: "تعذر تحميل بيانات المجتمع",
    loadFailedBody: "لم تُجرَ أي تغييرات. أعد المحاولة، ويمكنك استخدام المعاينة الآمنة أدناه في هذه الأثناء.",
    retry: "إعادة المحاولة",
    detailFailed: "تعذر تحميل تفاصيل المنشور",
  } : {
    title: "Student Community Moderation",
    subtitle: "Review reports and hide, restore, or soft-delete community content during the pilot.",
    disabledTitle: "Community not enabled",
    disabledBody: "This admin page is available to you, but the community remains hidden from students and support staff until separately enabled.",
    openSettings: "Manage feature settings",
    posts: "Posts",
    reports: "Open reports",
    noPosts: "No posts yet.",
    noPostsDetail: "Students have not published live content yet. Use the student preview to demonstrate the experience safely.",
    noReports: "No open reports.",
    noReportsDetail: "New reports will appear here with the content, reason, and moderation actions.",
    comments: "Comments",
    hide: "Hide",
    restore: "Restore",
    delete: "Soft delete",
    dismiss: "Dismiss report",
    updated: "Moderation updated",
    previewStudent: "Preview student experience",
    closePreview: "Close preview",
    workspace: "Community & safety workspace",
    loadFailed: "Community data could not be loaded",
    loadFailedBody: "No changes were made. Retry, or use the safe preview below in the meantime.",
    retry: "Retry",
    detailFailed: "Post details could not be loaded",
  };

  const closeModerationDialog = () => {
    setModerationIntent(null);
    setModerationNote("");
  };

  const moderate = trpc.community.moderateContent.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.community.adminListPosts.invalidate(),
        utils.community.adminReports.invalidate(),
        selectedPostId ? utils.community.adminGetPost.invalidate({ id: selectedPostId }) : Promise.resolve(),
      ]);
      toast.success(labels.updated);
      closeModerationDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const dismissReport = trpc.community.dismissReport.useMutation({
    onSuccess: async () => {
      await utils.community.adminReports.invalidate();
      toast.success(labels.updated);
      closeModerationDialog();
    },
    onError: (error) => toast.error(error.message),
  });

  const submitModeration = () => {
    if (!moderationIntent) return;
    if (moderationIntent.kind === "report") {
      dismissReport.mutate({
        reportId: moderationIntent.reportId,
        note: moderationNote.trim() || null,
      });
      return;
    }
    moderate.mutate({
      targetType: moderationIntent.targetType,
      targetId: moderationIntent.targetId,
      action: moderationIntent.action,
      note: moderationNote.trim() || null,
    });
  };

  const focusReport = (report: NonNullable<typeof reportsQuery.data>[number]) => {
    setFocusedReportId(report.id);
    setFocusedTarget({
      targetType: report.targetType === "comment" ? "comment" : "post",
      targetId: report.targetId,
    });
    if (report.postId) setSelectedPostId(report.postId);
  };

  if (availability.isLoading) {
    return <AdminCommunityState title={isRtl ? "جار التحميل..." : "Loading..."} icon={<Loader2 className="h-6 w-6 animate-spin" />} />;
  }

  if (availability.isError) {
    return (
      <DashboardLayout>
        <main className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
          <header>
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">{labels.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{labels.subtitle}</p>
          </header>
          <CommunityQueryError
            title={labels.loadFailed}
            body={labels.loadFailedBody}
            retryLabel={labels.retry}
            onRetry={() => void availability.refetch()}
          />
          <CommunityStudentPreview isRtl={isRtl} focusOnMount={directStudentPreview} />
        </main>
      </DashboardLayout>
    );
  }

  if (!enabled) {
    return (
      <DashboardLayout>
        <main className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">{labels.title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{labels.subtitle}</p>
            </div>
            <Button variant="outline" onClick={() => document.getElementById("community-student-preview")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <Eye className="h-4 w-4" />{labels.previewStudent}
            </Button>
          </header>
          {directStudentPreview && <CommunityStudentPreview isRtl={isRtl} focusOnMount />}
          <AdminFeatureSetupCard
            isRtl={isRtl}
            title={labels.disabledTitle}
            description={labels.disabledBody}
            action={<Button variant="outline" onClick={() => setLocation("/admin/features")}>{labels.openSettings}</Button>}
            items={[
              {
                label: isRtl
                  ? "راجع تجربة النشر والبلاغ أدناه"
                  : "Review publishing and reporting below",
                complete: true,
                action: (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() =>
                      document
                        .getElementById("community-student-preview")
                        ?.scrollIntoView({ behavior: "smooth", block: "start" })
                    }
                  >
                    {isRtl ? "فتح المعاينة" : "Open preview"}
                  </Button>
                ),
              },
              {
                label: isRtl
                  ? "أكمل قواعد المنافسين واللغة المحظورة"
                  : "Complete competitor and prohibited-language rules",
                action: (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => focusCommunitySetup("policy")}
                  >
                    {isRtl ? "فتح محرر القواعد" : "Open rule editor"}
                  </Button>
                ),
              },
              {
                label: isRtl
                  ? "تحقق من جاهزية اتصال وقواعد السلامة"
                  : "Confirm safety connection and rule readiness",
                action: (
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => focusCommunitySetup("automated-checks")}
                  >
                    {isRtl ? "فتح دليل الاتصال" : "Open connection guide"}
                  </Button>
                ),
              },
            ]}
          />
          {!directStudentPreview && <CommunityStudentPreview isRtl={isRtl} />}
          <CommunitySafetyManager isRtl={isRtl} />
          <CommunityAccessManager isRtl={isRtl} featureEnabled={false} />
        </main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-emerald-700">
              <ShieldAlert className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">{labels.workspace}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">{labels.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{labels.subtitle}</p>
          </div>
          <Button
            type="button"
            variant={showStudentPreview ? "default" : "outline"}
            className={showStudentPreview ? "bg-indigo-600 hover:bg-indigo-700" : ""}
            onClick={() => setShowStudentPreview((current) => !current)}
          >
            <Eye className="h-4 w-4" />
            {showStudentPreview ? labels.closePreview : labels.previewStudent}
          </Button>
        </header>

        {showStudentPreview && <CommunityStudentPreview isRtl={isRtl} focusOnMount={directStudentPreview} />}

        <CommunitySafetyManager isRtl={isRtl} />
        <CommunityAccessManager isRtl={isRtl} featureEnabled />

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
              ) : postsQuery.isError ? (
                <CommunityQueryError
                  compact
                  title={labels.loadFailed}
                  body={labels.loadFailedBody}
                  retryLabel={labels.retry}
                  onRetry={() => void postsQuery.refetch()}
                />
              ) : !(postsQuery.data?.length) ? (
                <div className="rounded-xl border border-dashed p-5 text-center">
                  <p className="text-sm font-semibold text-slate-700">{labels.noPosts}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{labels.noPostsDetail}</p>
                </div>
              ) : postsQuery.data.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => {
                    setSelectedPostId(post.id);
                    setFocusedTarget({ targetType: "post", targetId: post.id });
                    setFocusedReportId(null);
                  }}
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
            ) : postQuery.isLoading ? (
              <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>
            ) : postQuery.isError || !selectedPost ? (
              <CommunityQueryError
                title={labels.detailFailed}
                body={labels.loadFailedBody}
                retryLabel={labels.retry}
                onRetry={() => void postQuery.refetch()}
              />
            ) : (
              <Card>
                <CardContent className="space-y-5 p-5 md:p-6">
                  <article
                    id={`community-post-${selectedPost.id}`}
                    className={focusedTarget?.targetType === "post" && focusedTarget.targetId === selectedPost.id
                      ? "rounded-xl ring-2 ring-indigo-400 ring-offset-4"
                      : ""}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-bold text-slate-950">{selectedPost.title}</h2>
                        <p className="mt-1 text-xs text-slate-500">{selectedPost.authorEmail}</p>
                      </div>
                      <ModerationButtons
                        labels={labels}
                        status={selectedPost.status}
                        disabled={moderate.isPending}
                        onAction={action => setModerationIntent({
                          kind: "content",
                          action,
                          targetType: "post",
                          targetId: selectedPost.id,
                          targetLabel: selectedPost.title,
                          preview: selectedPost.body,
                          authorEmail: selectedPost.authorEmail,
                          affectedReportCount: Number(
                            postsQuery.data?.find(post => post.id === selectedPost.id)?.openReportCount ?? 0,
                          ),
                        })}
                      />
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedPost.body}</p>
                  </article>

                  <div className="border-t pt-5">
                    <h3 className="mb-3 font-semibold">{labels.comments}</h3>
                    <div className="space-y-3">
                      {selectedPost.comments.map((comment) => (
                        <article
                          key={comment.id}
                          id={`community-comment-${comment.id}`}
                          className={`rounded-xl border bg-slate-50 p-3 ${
                            focusedTarget?.targetType === "comment" && focusedTarget.targetId === comment.id
                              ? "border-indigo-400 ring-2 ring-indigo-300 ring-offset-2"
                              : ""
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-medium text-slate-500">{comment.authorEmail}</p>
                              <Badge className={statusClass(comment.status)}>{statusLabel(comment.status, isRtl)}</Badge>
                            </div>
                            <ModerationButtons
                              labels={labels}
                              status={comment.status}
                              disabled={moderate.isPending}
                              onAction={action => setModerationIntent({
                                kind: "content",
                                action,
                                targetType: "comment",
                                targetId: comment.id,
                                targetLabel: isRtl ? `تعليق #${comment.id}` : `Comment #${comment.id}`,
                                preview: comment.body,
                                authorEmail: comment.authorEmail,
                                affectedReportCount: Number(comment.openReportCount ?? 0),
                              })}
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
              ) : reportsQuery.isError ? (
                <CommunityQueryError
                  compact
                  title={labels.loadFailed}
                  body={labels.loadFailedBody}
                  retryLabel={labels.retry}
                  onRetry={() => void reportsQuery.refetch()}
                />
              ) : !(reportsQuery.data?.length) ? (
                <div className="rounded-xl border border-dashed p-5 text-center">
                  <p className="text-sm font-semibold text-slate-700">{labels.noReports}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{labels.noReportsDetail}</p>
                </div>
              ) : reportsQuery.data.map((report) => (
                <article
                  key={report.id}
                  id={`community-report-${report.id}`}
                  className={`rounded-xl border bg-white p-3 ${
                    focusedReportId === report.id
                      ? "border-indigo-400 ring-2 ring-indigo-300 ring-offset-2"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{report.reason}</p>
                      <p className="mt-1 text-xs text-slate-500">{report.reporterEmail}</p>
                    </div>
                    <Badge variant="outline">{report.targetType} #{report.targetId}</Badge>
                  </div>
                  {report.details && <p className="mt-2 text-xs leading-5 text-slate-500">{report.details}</p>}
                  {report.targetPreview && (
                    <p className="mt-2 line-clamp-3 rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-600">
                      {report.targetTitle && <span className="font-semibold">{report.targetTitle}: </span>}
                      {report.targetPreview}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => focusReport(report)}>
                      <Eye className="h-4 w-4" /> {isRtl ? "عرض" : "View"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={dismissReport.isPending}
                      onClick={() => setModerationIntent({
                        kind: "report",
                        reportId: report.id,
                        targetLabel: report.targetTitle
                          || (isRtl ? `${report.targetType === "post" ? "منشور" : "تعليق"} #${report.targetId}` : `${report.targetType} #${report.targetId}`),
                        preview: report.targetPreview || "",
                        reporterEmail: report.reporterEmail,
                      })}
                    >
                      <XCircle className="h-4 w-4" /> {labels.dismiss}
                    </Button>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>
        </div>

        <ModerationConfirmationDialog
          isRtl={isRtl}
          intent={moderationIntent}
          note={moderationNote}
          pending={moderate.isPending || dismissReport.isPending}
          onNoteChange={setModerationNote}
          onCancel={closeModerationDialog}
          onConfirm={submitModeration}
        />
      </main>
    </DashboardLayout>
  );
}

function ModerationConfirmationDialog({
  isRtl,
  intent,
  note,
  pending,
  onNoteChange,
  onCancel,
  onConfirm,
}: {
  isRtl: boolean;
  intent: CommunityModerationIntent | null;
  note: string;
  pending: boolean;
  onNoteChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const requiresReason = intent?.kind === "content" && intent.action === "delete";
  const actionName = intent?.kind === "report"
    ? (isRtl ? "رفض البلاغ" : "Dismiss report")
    : intent?.action === "hide"
      ? (isRtl ? "إخفاء المحتوى" : "Hide content")
      : intent?.action === "restore"
        ? (isRtl ? "استعادة المحتوى" : "Restore content")
        : (isRtl ? "حذف المحتوى منطقياً" : "Soft-delete content");
  const copy = isRtl ? {
    live: "إجراء فعلي — وليس معاينة",
    description: "راجع الهدف والأثر قبل تنفيذ هذا الإجراء على بيانات المجتمع الفعلية.",
    target: "المحتوى المستهدف",
    previewUnavailable: "معاينة المحتوى غير متاحة لهذا البلاغ.",
    author: "صاحب المحتوى",
    reporter: "صاحب البلاغ",
    reports: "البلاغات المفتوحة المتأثرة",
    notifications: "سيتم إرسال الإشعارات",
    reportNotification: "سيتم إشعار صاحب البلاغ داخل المنصة وعبر البريد الإلكتروني بعد التأكيد.",
    contentNotification: "سيتم إشعار الطالب صاحب المحتوى داخل المنصة وعبر البريد الإلكتروني بعد التأكيد.",
    reporterNotification: (count: number) => count > 0
      ? `سيتم أيضاً إشعار ${count} من أصحاب البلاغات المفتوحة بنتيجة الإجراء.`
      : "لا توجد بلاغات مفتوحة إضافية لإشعار أصحابها.",
    deleteReason: "سبب الحذف (مطلوب)",
    note: "ملاحظة التدقيق (اختيارية)",
    deletePlaceholder: "اكتب سبباً واضحاً للحذف يظهر في سجل التدقيق...",
    notePlaceholder: "أضف سياقاً اختيارياً لسجل التدقيق...",
    cancel: "إلغاء",
    confirm: "تأكيد الإجراء وإرسال الإشعارات",
  } : {
    live: "Live action — not a preview",
    description: "Review the exact target and impact before changing live community data.",
    target: "Target content",
    previewUnavailable: "A content preview is unavailable for this report.",
    author: "Content author",
    reporter: "Reporter",
    reports: "Open reports affected",
    notifications: "Notifications will be sent",
    reportNotification: "The reporter will receive an in-app notification and email after confirmation.",
    contentNotification: "The student content author will receive an in-app notification and email after confirmation.",
    reporterNotification: (count: number) => count > 0
      ? `${count} open report ${count === 1 ? "reporter" : "reporters"} will also be notified of the outcome.`
      : "There are no additional open reporters to notify.",
    deleteReason: "Deletion reason (required)",
    note: "Audit note (optional)",
    deletePlaceholder: "Enter a clear deletion reason for the audit trail...",
    notePlaceholder: "Add optional context for the audit trail...",
    cancel: "Cancel",
    confirm: "Confirm action and send notifications",
  };

  return (
    <Dialog open={Boolean(intent)} onOpenChange={open => !open && onCancel()}>
      <DialogContent dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2 text-red-700">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wide">{copy.live}</span>
          </div>
          <DialogTitle>{actionName}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        {intent && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.target}</p>
              <p className="mt-1 font-semibold text-slate-950">{intent.targetLabel}</p>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {intent.preview || copy.previewUnavailable}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                <Badge variant="outline">
                  {intent.kind === "report" ? copy.reporter : copy.author}: {intent.kind === "report" ? intent.reporterEmail : intent.authorEmail}
                </Badge>
                <Badge variant="outline">
                  {copy.reports}: {intent.kind === "report" ? 1 : intent.affectedReportCount}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <p className="flex items-center gap-2 font-semibold">
                <BellRing className="h-4 w-4" /> {copy.notifications}
              </p>
              <p className="mt-1 text-sm leading-6">
                {intent.kind === "report" ? copy.reportNotification : copy.contentNotification}
              </p>
              {intent.kind === "content" && (
                <p className="mt-1 text-sm leading-6">{copy.reporterNotification(intent.affectedReportCount)}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="community-moderation-note">
                {requiresReason ? copy.deleteReason : copy.note}
              </Label>
              <Textarea
                id="community-moderation-note"
                value={note}
                maxLength={2000}
                placeholder={requiresReason ? copy.deletePlaceholder : copy.notePlaceholder}
                onChange={event => onNoteChange(event.target.value)}
              />
              {requiresReason && note.trim().length > 0 && note.trim().length < 3 && (
                <p className="text-xs font-medium text-red-700">
                  {isRtl ? "اكتب ثلاثة أحرف على الأقل." : "Enter at least three characters."}
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{copy.cancel}</Button>
          <Button
            variant={requiresReason ? "destructive" : "default"}
            disabled={pending || (requiresReason && note.trim().length < 3)}
            onClick={onConfirm}
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {copy.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommunityQueryError({
  title,
  body,
  retryLabel,
  onRetry,
  compact = false,
}: {
  title: string;
  body: string;
  retryLabel: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <div role="alert" className={`rounded-xl border border-red-200 bg-red-50 ${compact ? "p-4" : "p-5"}`}>
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-red-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-red-800">{body}</p>
          <Button type="button" size="sm" variant="outline" className="mt-3 border-red-300 bg-white" onClick={onRetry}>
            <RefreshCw className="h-4 w-4" /> {retryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommunityStudentPreview({ isRtl, focusOnMount = false }: { isRtl: boolean; focusOnMount?: boolean }) {
  const copy = isRtl
    ? {
        audience: "طالبة تجريبية — نور محمود",
        title: "مجتمع الطلاب كما يظهر قبل الإطلاق",
        description: "معاينة كاملة لإنشاء منشور، فحصه قبل النشر، التفاعل معه، والإبلاغ عنه. جميع البيانات أدناه افتراضية.",
        community: "مجتمع XFlex",
        feed: "أحدث النقاشات",
        composer: "شارك سؤالاً أو تجربة مفيدة مع زملائك...",
        publish: "نشر في المجتمع",
        safe: "يتم الفحص قبل النشر",
        safeBody: "قواعد المنافسين واللغة المحظورة، ثم فحص المعنى والسياق. لا يُحفظ المحتوى إلا بعد اجتياز الفحص.",
        author: "نور محمود · طالبة تجريبية",
        time: "منذ 12 دقيقة",
        titleText: "كيف نظّمتم أول مشروع باستخدام أدوات الذكاء الاصطناعي؟",
        body: "أنهيت اليوم أول نموذج عملي، وساعدني تقسيم المهمة إلى خطوات صغيرة. ما الطريقة التي وجدتموها أكثر فاعلية؟",
        commentAuthor: "سارة أحمد",
        comment: "بدأت بقائمة واضحة للمخرجات ثم راجعت كل خطوة مع الدرس. كانت طريقة ممتازة لتقليل التشتت.",
        likes: "14 إعجاباً",
        comments: "4 تعليقات",
        report: "إبلاغ",
        moderation: "ما يحدث خلف الشاشة",
        checkOne: "فحص القواعد المحلية",
        checkTwo: "فحص سلامة السياق",
        checkThree: "النشر وإشعار المشاركين",
        reportFlow: "عند الإبلاغ",
        reportBody: "يصل البلاغ إلى لوحة الإدارة مع المنشور والسبب. يمكن للمدير إخفاء المحتوى أو استعادته أو رفض البلاغ.",
        active: "نموذج توضيحي",
      }
    : {
        audience: "Sample student — Noor Mahmoud",
        title: "Student community before launch",
        description: "A complete preview of creating, pre-checking, interacting with, and reporting a post. Everything below is synthetic.",
        community: "XFlex Community",
        feed: "Latest discussions",
        composer: "Share a useful question or experience with your peers...",
        publish: "Publish to community",
        safe: "Checked before publishing",
        safeBody: "Competitor and prohibited-language rules run first, followed by context and meaning safety checks. Content is saved only after it passes.",
        author: "Noor Mahmoud · Sample student",
        time: "12 minutes ago",
        titleText: "How did you organize your first project with AI tools?",
        body: "I finished my first practical prototype today, and breaking the work into small steps helped. Which approach worked best for you?",
        commentAuthor: "Sara Ahmad",
        comment: "I began with a clear output checklist and reviewed every step against the lesson. It was a great way to stay focused.",
        likes: "14 likes",
        comments: "4 comments",
        report: "Report",
        moderation: "What happens behind the screen",
        checkOne: "Local policy check",
        checkTwo: "Context safety check",
        checkThree: "Publish and notify participants",
        reportFlow: "When a post is reported",
        reportBody: "The report reaches the admin workspace with the post and reason. A moderator can hide or restore the content, or dismiss the report.",
        active: "Demonstration",
      };

  return (
    <SafeAdminPreview
      isRtl={isRtl}
      audience={copy.audience}
      title={copy.title}
      description={copy.description}
      anchorId="community-student-preview"
      focusOnMount={focusOnMount}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between border-b bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-emerald-600 p-2 text-white"><MessageCircle className="h-4 w-4" /></div>
              <p className="font-bold text-slate-950">{copy.community}</p>
            </div>
            <Badge className="bg-indigo-50 text-indigo-700">{copy.active}</Badge>
          </div>

          <div className="space-y-4 p-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 font-bold text-white">ن</div>
                <div className="min-w-0 flex-1">
                  <div className="min-h-20 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-400">{copy.composer}</div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><ShieldAlert className="h-3.5 w-3.5" />{copy.safe}</span>
                    <Button size="sm" disabled><Send className="h-4 w-4" />{copy.publish}</Button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{copy.feed}</p>
              <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 font-bold text-white">ن</div>
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{copy.author}</p>
                      <p className="text-xs text-slate-500">{copy.time}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700"><CheckCircle2 className="me-1 h-3 w-3" />{copy.safe}</Badge>
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-950">{copy.titleText}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{copy.body}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 border-y border-slate-100 py-3">
                  <Button size="sm" variant="ghost" disabled><Heart className="h-4 w-4" />{copy.likes}</Button>
                  <Button size="sm" variant="ghost" disabled><MessageCircle className="h-4 w-4" />{copy.comments}</Button>
                  <Button size="sm" variant="ghost" disabled className="ms-auto text-slate-500"><ShieldAlert className="h-4 w-4" />{copy.report}</Button>
                </div>
                <div className="mt-3 flex items-start gap-3 rounded-xl bg-slate-50 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">س</div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{copy.commentAuthor}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{copy.comment}</p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 text-emerald-900">
              <Sparkles className="h-5 w-5" />
              <h3 className="font-bold">{copy.moderation}</h3>
            </div>
            <p className="mt-2 text-xs leading-5 text-emerald-800">{copy.safeBody}</p>
            <div className="mt-4 space-y-3">
              {[copy.checkOne, copy.checkTwo, copy.checkThree].map((item, index) => (
                <div key={item} className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-white p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">{index + 1}</span>
                  <span className="text-sm font-medium text-slate-800">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="flex items-center gap-2 font-bold text-amber-950"><ShieldAlert className="h-5 w-5" />{copy.reportFlow}</h3>
            <p className="mt-2 text-sm leading-6 text-amber-900">{copy.reportBody}</p>
          </div>
        </div>
      </div>
    </SafeAdminPreview>
  );
}

function CommunitySafetyManager({ isRtl }: { isRtl: boolean }) {
  const utils = trpc.useUtils();
  const [newTerm, setNewTerm] = useState("");
  const [newTermCategory, setNewTermCategory] = useState<
    "competitor" | "prohibited_language"
  >("competitor");
  const [outcome, setOutcome] = useState<
    "all" | "allowed" | "blocked_policy" | "blocked_openai" | "error"
  >("all");
  const configQuery = trpc.community.adminSafetyConfig.useQuery(undefined, {
    retry: false,
  });
  const termsQuery = trpc.community.adminPolicyTerms.useQuery(undefined, {
    retry: false,
  });
  const decisionsQuery = trpc.community.adminModerationDecisions.useQuery({
    outcome,
    limit: 20,
  }, { retry: false });

  const labels = isRtl ? {
    title: "سلامة المحتوى قبل النشر",
    description: "كل منشور وتعليق يمر على قائمة المنافسين والألفاظ المحظورة، ثم فحص OpenAI للسياق والمعنى، قبل حفظه.",
    configured: "OpenAI جاهز",
    missingKey: "مفتاح OpenAI غير مُعد — النشر سيتوقف بأمان",
    failClosed: "عند تعذر الفحص: منع النشر",
    ready: "جاهز لتفعيل محدود",
    notReady: "متطلبات التفعيل غير مكتملة",
    policyTerms: "قواعد الحظر المحلية",
    competitor: "منافس",
    prohibitedLanguage: "لفظ أو عبارة محظورة",
    competitorPlaceholder: "أضف اسم منافس أو علامة تجارية",
    prohibitedLanguagePlaceholder: "أضف لفظاً أو عبارة غير مسموحة",
    add: "إضافة",
    active: "نشط",
    inactive: "متوقف",
    disable: "إيقاف",
    enable: "تفعيل",
    noTerms: "لم تُضف قواعد حظر بعد.",
    decisions: "آخر قرارات الفحص",
    all: "الكل",
    allowed: "مسموح",
    blockedPolicy: "مرفوض: سياسة محلية",
    blockedOpenAi: "مرفوض: سلامة",
    error: "تعذر الفحص",
    noDecisions: "لا توجد قرارات فحص بعد.",
    updated: "تم تحديث سياسة المجتمع",
    loadFailed: "تعذر تحميل بيانات السلامة",
    loadFailedBody: "لا تفترض اللوحة أن الإعداد غير جاهز. أعد المحاولة لقراءة الحالة الفعلية.",
    retry: "إعادة المحاولة",
    unavailable: "غير متاح حالياً",
    connectionGuideTitle: "مكان إعداد فحص المحتوى التلقائي",
    connectionGuideBody: "لا يُحفظ مفتاح OpenAI داخل لوحة الإدارة. أضيفيه كسِرّ بيئة ثم أعيدي تشغيل الخدمة.",
    localConnectionGuide: "محلياً: أضيفي OPENAI_API_KEY إلى ملف .env ثم أعيدي تشغيل خادم التطوير.",
    productionConnectionGuide: "في الإنتاج: احفظي OPENAI_API_KEY كسِرّ مشفّر في إعدادات Cloudflare Worker.",
    openCloudflare: "فتح لوحة Cloudflare",
  } : {
    title: "Pre-publication content safety",
    description: "Every post and comment passes competitor and prohibited-language rules, then OpenAI moderation for context and meaning, before it is saved.",
    configured: "OpenAI ready",
    missingKey: "OpenAI key missing — publishing will fail closed",
    failClosed: "Failure mode: block publishing",
    ready: "Ready for limited activation",
    notReady: "Activation requirements incomplete",
    policyTerms: "Local blocking rules",
    competitor: "Competitor",
    prohibitedLanguage: "Prohibited word or phrase",
    competitorPlaceholder: "Add a competitor or brand name",
    prohibitedLanguagePlaceholder: "Add a prohibited word or phrase",
    add: "Add",
    active: "Active",
    inactive: "Inactive",
    disable: "Disable",
    enable: "Enable",
    noTerms: "No local blocking rules have been added.",
    decisions: "Recent moderation decisions",
    all: "All",
    allowed: "Allowed",
    blockedPolicy: "Blocked: local policy",
    blockedOpenAi: "Blocked: safety",
    error: "Check unavailable",
    noDecisions: "No moderation decisions yet.",
    updated: "Community policy updated",
    loadFailed: "Safety data could not be loaded",
    loadFailedBody: "The workspace will not assume the configuration is unready. Retry to read its live status.",
    retry: "Retry",
    unavailable: "Currently unavailable",
    connectionGuideTitle: "Where to configure automated content checks",
    connectionGuideBody: "The OpenAI key is never stored in this admin page. Add it as an environment secret, then restart the service.",
    localConnectionGuide: "Local: add OPENAI_API_KEY to .env, then restart the development server.",
    productionConnectionGuide: "Production: save OPENAI_API_KEY as an encrypted secret for the Cloudflare Worker.",
    openCloudflare: "Open Cloudflare dashboard",
  };

  const addTerm = trpc.community.addPolicyTerm.useMutation({
    onSuccess: async () => {
      setNewTerm("");
      await Promise.all([
        utils.community.adminPolicyTerms.invalidate(),
        utils.community.adminSafetyConfig.invalidate(),
      ]);
      toast.success(labels.updated);
    },
    onError: error => toast.error(error.message),
  });
  const setTermActive = trpc.community.setPolicyTermActive.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.community.adminPolicyTerms.invalidate(),
        utils.community.adminSafetyConfig.invalidate(),
      ]);
      toast.success(labels.updated);
    },
    onError: error => toast.error(error.message),
  });

  const outcomeLabel = (value: string) => {
    if (value === "allowed") return labels.allowed;
    if (value === "blocked_policy") return labels.blockedPolicy;
    if (value === "blocked_openai") return labels.blockedOpenAi;
    return labels.error;
  };
  const outcomeClass = (value: string) => {
    if (value === "allowed") return "bg-emerald-100 text-emerald-700";
    if (value === "error") return "bg-amber-100 text-amber-800";
    return "bg-red-100 text-red-700";
  };

  return (
    <Card
      id="community-safety-setup"
      tabIndex={-1}
      className="scroll-mt-24 outline-none"
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-emerald-700" />
          {labels.title}
        </CardTitle>
        <p className="text-sm leading-6 text-slate-500">{labels.description}</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {configQuery.isLoading ? (
          <Loader2 className="mx-auto my-5 h-5 w-5 animate-spin text-emerald-700" />
        ) : configQuery.isError ? (
          <CommunityQueryError
            compact
            title={labels.loadFailed}
            body={labels.loadFailedBody}
            retryLabel={labels.retry}
            onRetry={() => void configQuery.refetch()}
          />
        ) : (
          <section
            id="community-automated-checks"
            tabIndex={-1}
            className="scroll-mt-24 space-y-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            <div className="flex flex-wrap gap-2">
              <Badge className={configQuery.data?.openAiConfigured
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-800"}>
                {configQuery.data?.openAiConfigured ? labels.configured : labels.missingKey}
              </Badge>
              <Badge variant="outline">
                {configQuery.data?.model || "omni-moderation-latest"}
              </Badge>
              <Badge variant="outline">{labels.failClosed}</Badge>
              <Badge className={configQuery.data?.readyForLimitedActivation
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-800"}>
                {configQuery.data?.readyForLimitedActivation
                  ? labels.ready
                  : labels.notReady}
              </Badge>
            </div>

            {!configQuery.data?.openAiConfigured && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                <h3 className="text-sm font-bold">{labels.connectionGuideTitle}</h3>
                <p className="mt-1 text-xs leading-5">{labels.connectionGuideBody}</p>
                <ul className="mt-3 space-y-1.5 text-xs leading-5">
                  <li>{labels.localConnectionGuide}</li>
                  <li>{labels.productionConnectionGuide}</li>
                </ul>
                <a
                  href="https://dash.cloudflare.com/"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-amber-950 underline underline-offset-4"
                >
                  {labels.openCloudflare}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
          </section>
        )}

        <section
          id="community-policy-terms"
          tabIndex={-1}
          className="scroll-mt-24 space-y-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <div>
            <h3 className="font-semibold text-slate-950">{labels.policyTerms}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {configQuery.isError ? labels.unavailable : (
                <>
                  {labels.competitor}: {configQuery.data?.activeCompetitorTermCount ?? 0} {labels.active}
                  {" · "}
                  {labels.prohibitedLanguage}: {configQuery.data?.activeProhibitedLanguageTermCount ?? 0} {labels.active}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={newTermCategory}
              onChange={event => setNewTermCategory(
                event.target.value as typeof newTermCategory,
              )}
            >
              <option value="competitor">{labels.competitor}</option>
              <option value="prohibited_language">{labels.prohibitedLanguage}</option>
            </select>
            <Input
              value={newTerm}
              maxLength={100}
              placeholder={newTermCategory === "competitor"
                ? labels.competitorPlaceholder
                : labels.prohibitedLanguagePlaceholder}
              onChange={event => setNewTerm(event.target.value)}
              onKeyDown={event => {
                if (event.key === "Enter" && newTerm.trim().length >= 2) {
                  addTerm.mutate({
                    term: newTerm.trim(),
                    category: newTermCategory,
                  });
                }
              }}
            />
            <Button
              disabled={newTerm.trim().length < 2 || addTerm.isPending}
              onClick={() => addTerm.mutate({
                term: newTerm.trim(),
                category: newTermCategory,
              })}
            >
              {addTerm.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Plus className="h-4 w-4" />}
              {labels.add}
            </Button>
          </div>
          {termsQuery.isLoading ? (
            <Loader2 className="mx-auto my-5 h-5 w-5 animate-spin text-emerald-700" />
          ) : termsQuery.isError ? (
            <CommunityQueryError
              compact
              title={labels.loadFailed}
              body={labels.loadFailedBody}
              retryLabel={labels.retry}
              onRetry={() => void termsQuery.refetch()}
            />
          ) : !(termsQuery.data?.length) ? (
            <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">
              {labels.noTerms}
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {termsQuery.data.map(term => (
                <div key={term.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950">{term.term}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline">
                        {term.category === "prohibited_language"
                          ? labels.prohibitedLanguage
                          : labels.competitor}
                      </Badge>
                      <Badge className={term.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-600"}>
                        {term.isActive ? labels.active : labels.inactive}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={setTermActive.isPending}
                    onClick={() => setTermActive.mutate({
                      id: term.id,
                      isActive: !term.isActive,
                    })}
                  >
                    {term.isActive
                      ? <PowerOff className="h-4 w-4" />
                      : <Power className="h-4 w-4" />}
                    {term.isActive ? labels.disable : labels.enable}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3 border-t pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="font-semibold text-slate-950">{labels.decisions}</h3>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={outcome}
              onChange={event => setOutcome(event.target.value as typeof outcome)}
            >
              <option value="all">{labels.all}</option>
              <option value="allowed">{labels.allowed}</option>
              <option value="blocked_policy">{labels.blockedPolicy}</option>
              <option value="blocked_openai">{labels.blockedOpenAi}</option>
              <option value="error">{labels.error}</option>
            </select>
          </div>
          {decisionsQuery.isLoading ? (
            <Loader2 className="mx-auto my-5 h-5 w-5 animate-spin text-emerald-700" />
          ) : decisionsQuery.isError ? (
            <CommunityQueryError
              compact
              title={labels.loadFailed}
              body={labels.loadFailedBody}
              retryLabel={labels.retry}
              onRetry={() => void decisionsQuery.refetch()}
            />
          ) : !(decisionsQuery.data?.length) ? (
            <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">
              {labels.noDecisions}
            </p>
          ) : (
            <div className="divide-y rounded-xl border">
              {decisionsQuery.data.map(decision => (
                <div key={decision.id} className="flex flex-col gap-2 p-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={outcomeClass(decision.outcome)}>
                        {outcomeLabel(decision.outcome)}
                      </Badge>
                      <Badge variant="outline">{decision.contentType}</Badge>
                      {decision.entityId && (
                        <span className="text-xs text-slate-500">#{decision.entityId}</span>
                      )}
                    </div>
                    <p className="mt-2 truncate text-sm font-medium text-slate-900">
                      {decision.userName || decision.userEmail}
                    </p>
                    {(decision.matchedPolicyTerm || decision.flaggedCategories.length > 0) && (
                      <p className="mt-1 text-xs text-slate-500">
                        {decision.matchedPolicyTerm
                          || decision.flaggedCategories.join(", ")}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {new Date(decision.createdAt).toLocaleString(isRtl ? "ar-JO" : "en-US")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function CommunityAccessManager({ isRtl, featureEnabled }: { isRtl: boolean; featureEnabled: boolean }) {
  const utils = trpc.useUtils();
  const pageSize = 20;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "allowed" | "banned">("all");
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState<{
    action: "ban" | "restore";
    member: {
      userId: number;
      name: string | null;
      email: string;
      access: "allowed" | "banned";
    };
  } | null>(null);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const labels = isRtl ? {
    title: "إدارة وصول الأعضاء",
    description: "تحكم مباشر بحسابات العملاء وفريق الدعم. استخدم التعليق فقط عند إساءة الاستخدام.",
    liveControl: "تحكم فعلي بالحساب — ليس معاينة",
    liveEnabled: "أي تعليق أو استعادة هنا يغيّر وصول الحساب الفعلي فوراً، ويرسل إشعاراً داخل المنصة وبريداً إلكترونياً.",
    liveDisabled: "رغم أن المجتمع غير مفعّل، فإن التعليق أو الاستعادة هنا يُسجّل فوراً على الحساب الفعلي ويرسل إشعاراً داخل المنصة وبريداً إلكترونياً. هذا القسم منفصل عن المعاينة الافتراضية.",
    search: "البحث بالاسم أو البريد",
    all: "الكل",
    allowed: "مسموح",
    banned: "محظور",
    staff: "فريق الدعم",
    client: "عميل",
    ban: "حظر",
    restore: "إلغاء الحظر",
    reason: "سبب التعليق (مطلوب)",
    restoreNote: "ملاحظة الاستعادة (اختيارية)",
    reasonPlaceholder: "اكتب سبباً واضحاً يظهر في سجل التدقيق...",
    expiry: "انتهاء الحظر (اختياري)",
    permanent: "اتركه فارغاً للحظر الدائم.",
    cancel: "إلغاء",
    confirmBan: "تأكيد الحظر",
    confirmRestore: "تأكيد الاستعادة",
    banTitle: "حظر العضو من المجتمع",
    restoreTitle: "استعادة وصول العضو",
    banDescription: "سيُسجّل تعليق فعلي فوراً، وسيُمنع هذا الحساب من القراءة أو النشر أو التعليق أو الإبلاغ عند إتاحة المجتمع.",
    restoreDescription: "ستتم إزالة التعليق الفعلي فوراً. هذا لا يفعّل ميزة المجتمع لجميع الطلاب.",
    exactMember: "الحساب المتأثر",
    notificationImpact: "سيتلقى هذا العضو إشعاراً داخل المنصة وبريداً إلكترونياً فور تأكيد الإجراء.",
    noMembers: "لا توجد حسابات مطابقة.",
    previous: "السابق",
    next: "التالي",
    updated: "تم تحديث وصول العضو",
    permanentBan: "دائم",
    loadFailed: "تعذر تحميل حسابات الأعضاء",
    loadFailedBody: "لم يتغير وصول أي حساب. أعد المحاولة قبل اتخاذ قرار فعلي.",
    retry: "إعادة المحاولة",
  } : {
    title: "Member access management",
    description: "Direct control for every client and support account. Use suspension only for misuse.",
    liveControl: "Live account control — not a preview",
    liveEnabled: "A suspension or restoration here changes the real account immediately and sends an in-app notification and email.",
    liveDisabled: "Although the community feature is off, a suspension or restoration here is written to the real account immediately and sends an in-app notification and email. This section is separate from the synthetic preview.",
    search: "Search by name or email",
    all: "All",
    allowed: "Allowed",
    banned: "Suspended",
    staff: "Support staff",
    client: "Client",
    ban: "Suspend",
    restore: "Restore",
    reason: "Suspension reason (required)",
    restoreNote: "Restoration note (optional)",
    reasonPlaceholder: "Enter a clear reason for the audit trail...",
    expiry: "Suspension expiry (optional)",
    permanent: "Leave empty for a permanent suspension.",
    cancel: "Cancel",
    confirmBan: "Confirm suspension",
    confirmRestore: "Confirm restoration",
    banTitle: "Suspend community member",
    restoreTitle: "Restore community access",
    banDescription: "A real suspension is recorded immediately. This account cannot read, post, comment, or report whenever community routes are available.",
    restoreDescription: "The live suspension is removed immediately. This does not enable the community feature for everyone.",
    exactMember: "Affected account",
    notificationImpact: "This member will receive an in-app notification and email as soon as you confirm.",
    noMembers: "No matching accounts.",
    previous: "Previous",
    next: "Next",
    updated: "Member access updated",
    permanentBan: "Permanent",
    loadFailed: "Member accounts could not be loaded",
    loadFailedBody: "No account access changed. Retry before making a live decision.",
    retry: "Retry",
  };

  const membersQuery = trpc.community.adminMembers.useQuery({
    search: search.trim() || null,
    status,
    limit: pageSize,
    offset: page * pageSize,
  }, { retry: false });

  const closeDialog = () => {
    setDialog(null);
    setReason("");
    setExpiresAt("");
  };

  const banMember = trpc.community.banMember.useMutation({
    onSuccess: async () => {
      await utils.community.adminMembers.invalidate();
      toast.success(labels.updated);
      closeDialog();
    },
    onError: error => toast.error(error.message),
  });
  const restoreMember = trpc.community.restoreMember.useMutation({
    onSuccess: async () => {
      await utils.community.adminMembers.invalidate();
      toast.success(labels.updated);
      closeDialog();
    },
    onError: error => toast.error(error.message),
  });

  const openDialog = (
    action: "ban" | "restore",
    member: NonNullable<typeof dialog>["member"],
  ) => {
    setDialog({ action, member });
    setReason("");
    setExpiresAt("");
  };

  const submit = () => {
    if (!dialog) return;
    if (dialog.action === "ban") {
      banMember.mutate({
        userId: dialog.member.userId,
        reason: reason.trim(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      return;
    }
    restoreMember.mutate({
      userId: dialog.member.userId,
      note: reason.trim() || null,
    });
  };

  const items = membersQuery.data?.items ?? [];
  const total = membersQuery.data?.total ?? 0;
  const isPending = banMember.isPending || restoreMember.isPending;

  return (
    <>
      <Card className="overflow-hidden border-rose-200 shadow-sm">
        <CardHeader className="border-b border-rose-100 bg-rose-50/70">
          <div className="mb-1 flex items-center gap-2 text-rose-700">
            <ShieldAlert className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wide">{labels.liveControl}</span>
          </div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="h-5 w-5 text-emerald-700" />
            {labels.title}
          </CardTitle>
          <p className="text-sm leading-6 text-slate-500">{labels.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <div className="flex items-start gap-2">
              <BellRing className="mt-1 h-4 w-4 shrink-0" />
              <p>{featureEnabled ? labels.liveEnabled : labels.liveDisabled}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
            <div className="relative">
              <Search className="absolute start-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                className="ps-9"
                value={search}
                placeholder={labels.search}
                onChange={event => {
                  setSearch(event.target.value);
                  setPage(0);
                }}
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={status}
              onChange={event => {
                setStatus(event.target.value as typeof status);
                setPage(0);
              }}
            >
              <option value="all">{labels.all}</option>
              <option value="allowed">{labels.allowed}</option>
              <option value="banned">{labels.banned}</option>
            </select>
          </div>

          {membersQuery.isLoading ? (
            <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin text-emerald-700" />
          ) : membersQuery.isError ? (
            <CommunityQueryError
              title={labels.loadFailed}
              body={labels.loadFailedBody}
              retryLabel={labels.retry}
              onRetry={() => void membersQuery.refetch()}
            />
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">{labels.noMembers}</p>
          ) : (
            <div className="divide-y rounded-xl border">
              {items.map(member => (
                <div key={member.userId} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-slate-950">{member.name || member.email}</p>
                      <Badge variant="outline">{member.isStaff ? labels.staff : labels.client}</Badge>
                      <Badge className={member.access === "banned" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}>
                        {member.access === "banned" ? labels.banned : labels.allowed}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{member.email}</p>
                    {member.access === "banned" && (
                      <p className="mt-2 text-xs leading-5 text-red-700">
                        {member.reason || labels.permanentBan}
                        {" · "}
                        {member.expiresAt
                          ? new Date(member.expiresAt).toLocaleString(isRtl ? "ar-JO" : "en-US")
                          : labels.permanentBan}
                      </p>
                    )}
                  </div>
                  {member.access === "banned" ? (
                    <Button size="sm" variant="outline" onClick={() => openDialog("restore", member)}>
                      <UserCheck className="h-4 w-4" /> {labels.restore}
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => openDialog("ban", member)}>
                      <UserX className="h-4 w-4" /> {labels.ban}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {membersQuery.isSuccess && <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{Math.min(page * pageSize + items.length, total)} / {total}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>
                {labels.previous}
              </Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(value => value + 1)}>
                {labels.next}
              </Button>
            </div>
          </div>}
        </CardContent>
      </Card>

      <Dialog open={Boolean(dialog)} onOpenChange={open => !open && closeDialog()}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <div className="mb-1 flex items-center gap-2 text-red-700">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-wide">{labels.liveControl}</span>
            </div>
            <DialogTitle>{dialog?.action === "ban" ? labels.banTitle : labels.restoreTitle}</DialogTitle>
            <DialogDescription>
              {dialog?.action === "ban" ? labels.banDescription : labels.restoreDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {dialog && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{labels.exactMember}</p>
                <p className="mt-1 text-base font-bold text-slate-950">{dialog.member.name || dialog.member.email}</p>
                <p className="mt-1 break-all text-sm text-slate-600">{dialog.member.email}</p>
              </div>
            )}
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              <p className="flex items-start gap-2">
                <BellRing className="mt-1 h-4 w-4 shrink-0" />
                <span>{labels.notificationImpact}</span>
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="community-access-reason">
                {dialog?.action === "ban" ? labels.reason : labels.restoreNote}
              </Label>
              <Textarea
                id="community-access-reason"
                value={reason}
                maxLength={500}
                placeholder={labels.reasonPlaceholder}
                onChange={event => setReason(event.target.value)}
              />
            </div>
            {dialog?.action === "ban" && (
              <div className="space-y-2">
                <Label htmlFor="community-access-expiry">{labels.expiry}</Label>
                <Input
                  id="community-access-expiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={event => setExpiresAt(event.target.value)}
                />
                <p className="text-xs text-slate-500">{labels.permanent}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>{labels.cancel}</Button>
            <Button
              variant={dialog?.action === "ban" ? "destructive" : "default"}
              disabled={
                isPending
                || (dialog?.action === "ban" && reason.trim().length < 3)
              }
              onClick={submit}
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {dialog?.action === "ban" ? labels.confirmBan : labels.confirmRestore}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ModerationButtons({ labels, status, disabled, onAction }: {
  labels: Record<string, string>;
  status: string;
  disabled: boolean;
  onAction: (action: CommunityContentAction) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "hidden" && status !== "deleted" && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAction("hide")}>
          <EyeOff className="h-4 w-4" /> {labels.hide}
        </Button>
      )}
      {status !== "visible" && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAction("restore")}>
          <CheckCircle2 className="h-4 w-4" /> {labels.restore}
        </Button>
      )}
      {status !== "deleted" && (
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => onAction("delete")}>
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

function AdminCommunityState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <DashboardLayout>
      <div className="flex min-h-[70vh] items-center justify-center p-6">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="flex flex-col items-center p-8">
            <div className="mb-4 rounded-2xl bg-slate-100 p-3 text-slate-600">{icon}</div>
            <h1 className="text-xl font-bold text-slate-950">{title}</h1>
            {body && <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>}
            {actionLabel && onAction && (
              <Button className="mt-5" onClick={onAction}>
                {actionLabel}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
