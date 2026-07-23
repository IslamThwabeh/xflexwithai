import DashboardLayout from "@/components/DashboardLayout";
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
import { AlertCircle, Bot, CheckCircle2, Eye, EyeOff, Loader2, MessageCircle, Plus, Power, PowerOff, Search, ShieldAlert, Trash2, UserCheck, UserX, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function getInitialCommunityPostId() {
  if (typeof window === "undefined") return null;
  const value = Number(new URLSearchParams(window.location.search).get("postId"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

export default function AdminCommunityModeration() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [selectedPostId, setSelectedPostId] = useState<number | null>(
    getInitialCommunityPostId,
  );

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
    disabledBody: "صفحة الإدارة متاحة لك، لكن المجتمع ما زال مخفياً عن الطلاب وموظفي الدعم حتى تفعيله بموافقة منفصلة.",
    openSettings: "إدارة إعدادات التفعيل",
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
    disabledBody: "This admin page is available to you, but the community remains hidden from students and support staff until separately enabled.",
    openSettings: "Manage feature settings",
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
    return (
      <DashboardLayout>
        <main className="space-y-6 p-4 md:p-6" dir={isRtl ? "rtl" : "ltr"}>
          <header>
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">{labels.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{labels.subtitle}</p>
          </header>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-semibold text-amber-950">{labels.disabledTitle}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-900">{labels.disabledBody}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => setLocation("/admin/settings")}>
                {labels.openSettings}
              </Button>
            </CardContent>
          </Card>
          <CommunitySafetyManager isRtl={isRtl} />
          <CommunityAccessManager isRtl={isRtl} />
        </main>
      </DashboardLayout>
    );
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

        <CommunitySafetyManager isRtl={isRtl} />
        <CommunityAccessManager isRtl={isRtl} />

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-emerald-700" />
          {labels.title}
        </CardTitle>
        <p className="text-sm leading-6 text-slate-500">{labels.description}</p>
      </CardHeader>
      <CardContent className="space-y-5">
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

        <section className="space-y-3">
          <div>
            <h3 className="font-semibold text-slate-950">{labels.policyTerms}</h3>
            <p className="mt-1 text-xs text-slate-500">
              {labels.competitor}: {configQuery.data?.activeCompetitorTermCount ?? 0} {labels.active}
              {" · "}
              {labels.prohibitedLanguage}: {configQuery.data?.activeProhibitedLanguageTermCount ?? 0} {labels.active}
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

function CommunityAccessManager({ isRtl }: { isRtl: boolean }) {
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
    description: "جميع حسابات العملاء وفريق الدعم مشمولة تلقائياً. استخدم الحظر فقط عند إساءة الاستخدام.",
    search: "البحث بالاسم أو البريد",
    all: "الكل",
    allowed: "مسموح",
    banned: "محظور",
    staff: "فريق الدعم",
    client: "عميل",
    ban: "حظر",
    restore: "إلغاء الحظر",
    reason: "سبب القرار",
    reasonPlaceholder: "اكتب سبباً واضحاً يظهر في سجل التدقيق...",
    expiry: "انتهاء الحظر (اختياري)",
    permanent: "اتركه فارغاً للحظر الدائم.",
    cancel: "إلغاء",
    confirmBan: "تأكيد الحظر",
    confirmRestore: "تأكيد الاستعادة",
    banTitle: "حظر العضو من المجتمع",
    restoreTitle: "استعادة وصول العضو",
    banDescription: "سيُمنع العضو فوراً من قراءة المجتمع أو النشر أو التعليق أو الإبلاغ.",
    restoreDescription: "سيستعيد العضو الوصول عند تفعيل المجتمع.",
    noMembers: "لا توجد حسابات مطابقة.",
    previous: "السابق",
    next: "التالي",
    updated: "تم تحديث وصول العضو",
    permanentBan: "دائم",
  } : {
    title: "Member access management",
    description: "Every client and support account is included automatically. Use suspension only for misuse.",
    search: "Search by name or email",
    all: "All",
    allowed: "Allowed",
    banned: "Suspended",
    staff: "Support staff",
    client: "Client",
    ban: "Suspend",
    restore: "Restore",
    reason: "Decision reason",
    reasonPlaceholder: "Enter a clear reason for the audit trail...",
    expiry: "Suspension expiry (optional)",
    permanent: "Leave empty for a permanent suspension.",
    cancel: "Cancel",
    confirmBan: "Confirm suspension",
    confirmRestore: "Confirm restoration",
    banTitle: "Suspend community member",
    restoreTitle: "Restore community access",
    banDescription: "The member will immediately lose read, post, comment, and report access.",
    restoreDescription: "The member will regain access when the community is enabled.",
    noMembers: "No matching accounts.",
    previous: "Previous",
    next: "Next",
    updated: "Member access updated",
    permanentBan: "Permanent",
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="h-5 w-5 text-emerald-700" />
            {labels.title}
          </CardTitle>
          <p className="text-sm leading-6 text-slate-500">{labels.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{Math.min(page * pageSize + items.length, total)} / {total}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>
                {labels.previous}
              </Button>
              <Button size="sm" variant="outline" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(value => value + 1)}>
                {labels.next}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={Boolean(dialog)} onOpenChange={open => !open && closeDialog()}>
        <DialogContent dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{dialog?.action === "ban" ? labels.banTitle : labels.restoreTitle}</DialogTitle>
            <DialogDescription>
              {dialog?.action === "ban" ? labels.banDescription : labels.restoreDescription}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="community-access-reason">{labels.reason}</Label>
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
