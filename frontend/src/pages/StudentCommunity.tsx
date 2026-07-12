import ClientLayout from "@/components/ClientLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Flag, Loader2, MessageCircle, Plus, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function StudentCommunity() {
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const utils = trpc.useUtils();
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);
  const [postForm, setPostForm] = useState({ title: "", body: "" });
  const [commentBody, setCommentBody] = useState("");

  const availability = trpc.community.availability.useQuery(undefined, { retry: false });
  const enabled = Boolean(availability.data?.enabled);
  const postsQuery = trpc.community.listPosts.useQuery({ limit: 50 }, { enabled, retry: false });
  const postQuery = trpc.community.getPost.useQuery(
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
    title: "مجتمع الطلاب",
    subtitle: "مساحة آمنة للأسئلة والتجارب بين الطلاب مع إشراف إداري.",
    disabledTitle: "المجتمع غير مفعّل",
    disabledBody: "الميزة جاهزة لكنها مخفية حتى تفعيل student_community_enabled بموافقة منفصلة.",
    safety: "يرجى عدم مشاركة بيانات الحسابات، أرقام المحافظ، أو توصيات تداول شخصية. يمكن الإبلاغ عن أي محتوى مخالف.",
    newPost: "منشور جديد",
    postTitle: "عنوان المنشور",
    postBody: "محتوى المنشور",
    publish: "نشر",
    posts: "المنشورات",
    noPosts: "لا توجد منشورات بعد.",
    comments: "التعليقات",
    noComments: "لا توجد تعليقات بعد.",
    addComment: "إضافة تعليق",
    commentPlaceholder: "اكتب تعليقاً مفيداً ومحترماً...",
    report: "إبلاغ",
    reportSuccess: "تم إرسال البلاغ للمراجعة",
    postSuccess: "تم نشر المنشور",
    commentSuccess: "تم إضافة التعليق",
  } : {
    title: "Student Community",
    subtitle: "A supervised space for student questions and shared learning.",
    disabledTitle: "Community not enabled",
    disabledBody: "This feature is ready but hidden until student_community_enabled is turned on with separate approval.",
    safety: "Do not share account credentials, wallet numbers, or personal trading advice. You can report content that breaks the rules.",
    newPost: "New post",
    postTitle: "Post title",
    postBody: "Post body",
    publish: "Publish",
    posts: "Posts",
    noPosts: "No posts yet.",
    comments: "Comments",
    noComments: "No comments yet.",
    addComment: "Add comment",
    commentPlaceholder: "Write a helpful, respectful comment...",
    report: "Report",
    reportSuccess: "Report sent for review",
    postSuccess: "Post published",
    commentSuccess: "Comment added",
  };

  const createPost = trpc.community.createPost.useMutation({
    onSuccess: async (post) => {
      setPostForm({ title: "", body: "" });
      setSelectedPostId(post.id);
      await utils.community.listPosts.invalidate();
      toast.success(labels.postSuccess);
    },
    onError: (error) => toast.error(error.message),
  });

  const createComment = trpc.community.createComment.useMutation({
    onSuccess: async () => {
      setCommentBody("");
      if (selectedPostId) await utils.community.getPost.invalidate({ id: selectedPostId });
      await utils.community.listPosts.invalidate();
      toast.success(labels.commentSuccess);
    },
    onError: (error) => toast.error(error.message),
  });

  const reportContent = trpc.community.reportContent.useMutation({
    onSuccess: () => toast.success(labels.reportSuccess),
    onError: (error) => toast.error(error.message),
  });

  if (availability.isLoading) {
    return <CommunityState title={isRtl ? "جار التحميل..." : "Loading..."} icon={<Loader2 className="h-6 w-6 animate-spin" />} />;
  }

  if (!enabled) {
    return <CommunityState title={labels.disabledTitle} body={labels.disabledBody} icon={<AlertCircle className="h-7 w-7" />} />;
  }

  const selectedPost = postQuery.data;

  return (
    <ClientLayout>
      <main className="min-h-screen bg-[var(--color-xf-cream)] px-4 py-8" dir={isRtl ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-6xl space-y-6">
          <header>
            <div className="mb-2 flex items-center gap-2 text-emerald-700">
              <MessageCircle className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">Phase 4</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-950 md:text-3xl">{labels.title}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{labels.subtitle}</p>
          </header>

          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-start gap-3 p-4 text-sm leading-6 text-emerald-950">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
              {labels.safety}
            </CardContent>
          </Card>

          <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Plus className="h-5 w-5 text-emerald-700" />
                    {labels.newPost}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={postForm.title}
                    maxLength={300}
                    placeholder={labels.postTitle}
                    onChange={(event) => setPostForm({ ...postForm, title: event.target.value })}
                  />
                  <Textarea
                    rows={5}
                    value={postForm.body}
                    maxLength={5000}
                    placeholder={labels.postBody}
                    onChange={(event) => setPostForm({ ...postForm, body: event.target.value })}
                  />
                  <Button
                    className="w-full bg-emerald-700 hover:bg-emerald-800"
                    disabled={createPost.isPending || !postForm.title.trim() || !postForm.body.trim()}
                    onClick={() => createPost.mutate({ title: postForm.title.trim(), body: postForm.body.trim() })}
                  >
                    {createPost.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {labels.publish}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{labels.posts}</CardTitle>
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
                      <p className="line-clamp-2 font-semibold text-slate-950">{post.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{post.authorName || post.authorEmail} · {post.visibleCommentCount} {labels.comments}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>
            </aside>

            <section>
              {!selectedPostId ? (
                <Card className="border-dashed">
                  <CardContent className="p-10 text-center text-sm text-slate-500">{labels.noPosts}</CardContent>
                </Card>
              ) : postQuery.isLoading || !selectedPost ? (
                <div className="flex min-h-72 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-700" /></div>
              ) : (
                <Card>
                  <CardContent className="space-y-5 p-5 md:p-6">
                    <article>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-bold text-slate-950">{selectedPost.title}</h2>
                          <p className="mt-1 text-xs text-slate-500">{selectedPost.authorName || selectedPost.authorEmail}</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => reportContent.mutate({ targetType: "post", targetId: selectedPost.id, reason: "inappropriate" })}>
                          <Flag className="h-4 w-4" /> {labels.report}
                        </Button>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{selectedPost.body}</p>
                    </article>

                    <div className="border-t pt-5">
                      <h3 className="mb-3 font-semibold">{labels.comments}</h3>
                      {selectedPost.comments.length === 0 ? (
                        <p className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">{labels.noComments}</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedPost.comments.map((comment) => (
                            <article key={comment.id} className="rounded-xl border bg-slate-50 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-xs font-medium text-slate-500">{comment.authorName || comment.authorEmail}</p>
                                <Button size="sm" variant="ghost" onClick={() => reportContent.mutate({ targetType: "comment", targetId: comment.id, reason: "inappropriate" })}>
                                  <Flag className="h-3.5 w-3.5" /> {labels.report}
                                </Button>
                              </div>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{comment.body}</p>
                            </article>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 space-y-2">
                        <Textarea
                          rows={3}
                          value={commentBody}
                          maxLength={5000}
                          placeholder={labels.commentPlaceholder}
                          onChange={(event) => setCommentBody(event.target.value)}
                        />
                        <Button disabled={createComment.isPending || !commentBody.trim()} onClick={() => createComment.mutate({ postId: selectedPost.id, body: commentBody.trim() })}>
                          {createComment.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                          {labels.addComment}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        </div>
      </main>
    </ClientLayout>
  );
}

function CommunityState({ icon, title, body }: { icon: React.ReactNode; title: string; body?: string }) {
  return (
    <ClientLayout>
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-xf-cream)] p-6">
        <Card className="w-full max-w-lg text-center">
          <CardContent className="flex flex-col items-center p-8">
            <div className="mb-4 rounded-2xl bg-slate-100 p-3 text-slate-600">{icon}</div>
            <h1 className="text-xl font-bold text-slate-950">{title}</h1>
            {body && <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>}
          </CardContent>
        </Card>
      </div>
    </ClientLayout>
  );
}
