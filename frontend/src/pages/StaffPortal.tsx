import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Briefcase, TrendingUp, Bell, BarChart3, Copy, Flame, Heart, Rocket, ThumbsUp, Frown,
  Search, User, BookOpen, Key, GraduationCap, MessageSquare, Loader2, ArrowLeft,
  CheckCircle2, XCircle, Clock, ShieldCheck, Headphones,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";

// ── Reaction icons for recommendation feed ──────────────────────────────
const reactionIcons = {
  like: <ThumbsUp className="h-4 w-4" />,
  love: <Heart className="h-4 w-4" />,
  sad: <Frown className="h-4 w-4" />,
  fire: <Flame className="h-4 w-4" />,
  rocket: <Rocket className="h-4 w-4" />,
};

type RecommendationType = "alert" | "recommendation" | "result";

function buildCopyBlock(msg: any) {
  const lines: string[] = [];
  if (msg.symbol) lines.push(`Symbol: ${msg.symbol}`);
  if (msg.side) lines.push(`Side: ${msg.side}`);
  if (msg.entryPrice) lines.push(`Entry: ${msg.entryPrice}`);
  if (msg.stopLoss) lines.push(`SL: ${msg.stopLoss}`);
  if (msg.takeProfit1) lines.push(`TP1: ${msg.takeProfit1}`);
  if (msg.takeProfit2) lines.push(`TP2: ${msg.takeProfit2}`);
  if (msg.riskPercent) lines.push(`Risk: ${msg.riskPercent}`);
  lines.push("");
  lines.push(msg.content || "");
  return lines.join("\n").trim();
}

// ═════════════════════════════════════════════════════════════════════════
// Main Staff Portal Component
// ═════════════════════════════════════════════════════════════════════════
export default function StaffPortal() {
  const { user, logout } = useAuth();
  const { language, setLanguage, isRTL } = useLanguage();

  // ── Tab state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"analyst" | "support">("analyst");

  // ── Permissions ────────────────────────────────────────────────────
  const { data: perms, isLoading: permsLoading } =
    trpc.supportDashboard.myPermissions.useQuery();

  const hasPerm = (p: string) => perms?.isAdmin || perms?.permissions?.includes(p);
  const isAnalyst = perms?.isAnalyst ?? false;
  const isSupport = (perms?.permissions ?? []).some((r: string) =>
    ["support", "key_manager", "client_lookup", "view_progress", "view_subscriptions", "view_quizzes", "view_recommendations"].includes(r)
  ) || perms?.isAdmin;

  // Default to the first available tab
  const effectiveTab = activeTab === "analyst" && !isAnalyst ? "support" : activeTab === "support" && !isSupport ? "analyst" : activeTab;

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
  };

  // ── Loading ────────────────────────────────────────────────────────
  if (permsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // No staff access at all
  if (!isAnalyst && !isSupport) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir={isRTL ? "rtl" : "ltr"}>
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <ShieldCheck className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-bold">
              {language === "ar" ? "لا يوجد صلاحية" : "No Access"}
            </h2>
            <p className="text-muted-foreground text-center">
              {language === "ar"
                ? "ليس لديك أي أدوار موظفين. تواصل مع الإدارة لتعيين دور لك."
                : "You don't have any staff roles. Contact admin to get assigned a role."}
            </p>
            <Link href="/">
              <Button variant="outline">
                {language === "ar" ? "العودة للرئيسية" : "Back to Home"}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? "rtl" : "ltr"}>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Briefcase className="h-6 w-6 text-blue-600" />
            <h1 className="text-lg font-bold">
              {language === "ar" ? "بوابة الموظفين" : "Staff Portal"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/support">
              <Button variant="outline" size="sm">
                <Headphones className="h-4 w-4 mr-1" />
                {language === "ar" ? "الدعم" : "Chat"}
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                {user?.name?.charAt(0).toUpperCase() || "S"}
              </div>
              <span className="text-sm font-medium hidden md:inline">{user?.name}</span>
            </div>
            <button
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="text-xs px-2 py-1 rounded-full text-gray-600 hover:bg-gray-100"
            >
              {language === "ar" ? "EN" : "عربي"}
            </button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-600 px-1.5">
              ×
            </Button>
          </div>
        </div>
      </header>

      {/* ── Tab Bar ─────────────────────────────────────────────────── */}
      <div className="border-b bg-white">
        <div className="container mx-auto px-4 flex gap-1">
          {isAnalyst && (
            <button
              onClick={() => setActiveTab("analyst")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                effectiveTab === "analyst"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <TrendingUp className="h-4 w-4 inline me-1.5" />
              {language === "ar" ? "التوصيات" : "Recommendations"}
            </button>
          )}
          {isSupport && (
            <button
              onClick={() => setActiveTab("support")}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                effectiveTab === "support"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              <Search className="h-4 w-4 inline me-1.5" />
              {language === "ar" ? "أدوات الدعم" : "Support Tools"}
            </button>
          )}
        </div>
      </div>

      {/* ── Tab Content ─────────────────────────────────────────────── */}
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        {effectiveTab === "analyst" && isAnalyst && <AnalystTab language={language} />}
        {effectiveTab === "support" && isSupport && <SupportTab perms={perms} language={language} />}
      </main>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Analyst Tab – Publish recommendations & view feed
// ═════════════════════════════════════════════════════════════════════════
function AnalystTab({ language }: { language: string }) {
  const utils = trpc.useUtils();

  // Form state
  const [type, setType] = useState<RecommendationType>("recommendation");
  const [content, setContent] = useState("");
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit1, setTakeProfit1] = useState("");
  const [takeProfit2, setTakeProfit2] = useState("");
  const [riskPercent, setRiskPercent] = useState("");

  // Data
  const { data: feed = [], isLoading: feedLoading } = trpc.recommendations.feed.useQuery({ limit: 200 });

  const postMutation = trpc.recommendations.postMessage.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم نشر التوصية بنجاح" : "Recommendation published");
      setContent(""); setSymbol(""); setSide(""); setEntryPrice(""); setStopLoss(""); setTakeProfit1(""); setTakeProfit2(""); setRiskPercent("");
      utils.recommendations.feed.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const reactMutation = trpc.recommendations.react.useMutation({
    onSuccess: () => utils.recommendations.feed.invalidate(),
    onError: (e) => toast.error(e.message),
  });

  const onPublish = () => {
    if (!content.trim()) {
      toast.error(language === "ar" ? "اكتب محتوى الرسالة" : "Write message content");
      return;
    }
    postMutation.mutate({
      type,
      content: content.trim(),
      symbol: symbol.trim() || undefined,
      side: side.trim() || undefined,
      entryPrice: entryPrice.trim() || undefined,
      stopLoss: stopLoss.trim() || undefined,
      takeProfit1: takeProfit1.trim() || undefined,
      takeProfit2: takeProfit2.trim() || undefined,
      riskPercent: riskPercent.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Publish Form ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {language === "ar" ? "نشر توصية جديدة" : "Publish New Recommendation"}
          </CardTitle>
          <CardDescription>
            {language === "ar"
              ? "سيتم إرسال إشعار بالبريد لجميع المشتركين"
              : "Subscribers will be notified by email"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button variant={type === "alert" ? "default" : "outline"} onClick={() => setType("alert")}>
              <Bell className="h-4 w-4 me-1" /> {language === "ar" ? "تنبيه" : "Alert"}
            </Button>
            <Button variant={type === "recommendation" ? "default" : "outline"} onClick={() => setType("recommendation")}>
              <TrendingUp className="h-4 w-4 me-1" /> {language === "ar" ? "توصية" : "Recommendation"}
            </Button>
            <Button variant={type === "result" ? "default" : "outline"} onClick={() => setType("result")}>
              <BarChart3 className="h-4 w-4 me-1" /> {language === "ar" ? "نتيجة" : "Result"}
            </Button>
          </div>

          {/* Trading fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={language === "ar" ? "الزوج مثل EURUSD" : "Symbol e.g. EURUSD"} />
            <Input value={side} onChange={(e) => setSide(e.target.value)} placeholder={language === "ar" ? "الاتجاه (buy/sell)" : "Side (buy/sell)"} />
            <Input value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder={language === "ar" ? "سعر الدخول" : "Entry Price"} />
            <Input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder={language === "ar" ? "وقف الخسارة" : "Stop Loss"} />
            <Input value={takeProfit1} onChange={(e) => setTakeProfit1(e.target.value)} placeholder={language === "ar" ? "الهدف 1" : "Take Profit 1"} />
            <Input value={takeProfit2} onChange={(e) => setTakeProfit2(e.target.value)} placeholder={language === "ar" ? "الهدف 2" : "Take Profit 2"} />
            <Input value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} placeholder={language === "ar" ? "نسبة المخاطرة" : "Risk %"} />
          </div>

          {/* Content */}
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={language === "ar" ? "تفاصيل التوصية..." : "Recommendation details..."} rows={4} />
          <Button onClick={onPublish} disabled={postMutation.isPending} className="w-full sm:w-auto">
            {postMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
            {language === "ar" ? "نشر التوصية" : "Publish"}
          </Button>
        </CardContent>
      </Card>

      {/* ── Message Feed ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {language === "ar" ? "سجل التوصيات" : "Recommendations Feed"}
          </CardTitle>
          <CardDescription>
            {language === "ar" ? `${feed.length} رسالة` : `${feed.length} messages`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : feed.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">{language === "ar" ? "لا توجد رسائل بعد" : "No messages yet"}</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {feed.map((msg: any) => (
                <div key={msg.id} className="rounded-lg border p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{msg.type}</Badge>
                      {msg.isAnalyst && <Badge>{language === "ar" ? "محلل" : "Analyst"}</Badge>}
                      <span className="text-sm text-muted-foreground">{msg.authorName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {msg.createdAt ? new Date(msg.createdAt).toLocaleString(language === "ar" ? "ar-SA" : "en-US") : "-"}
                    </span>
                  </div>

                  {(msg.symbol || msg.side || msg.entryPrice) && (
                    <div className="text-sm rounded border bg-muted p-3 whitespace-pre-wrap">{buildCopyBlock(msg)}</div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(buildCopyBlock(msg)); toast.success(language === "ar" ? "تم النسخ" : "Copied"); }}>
                      <Copy className="h-4 w-4 me-1" /> {language === "ar" ? "نسخ" : "Copy"}
                    </Button>
                    {(Object.keys(reactionIcons) as Array<keyof typeof reactionIcons>).map((r) => (
                      <Button key={r} size="sm" variant={msg.myReaction === r ? "default" : "outline"}
                        onClick={() => reactMutation.mutate({ messageId: msg.id, reaction: msg.myReaction === r ? null : r })}>
                        {reactionIcons[r]} <span className="ms-1">{msg.reactions?.[r] ?? 0}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════
// Support Tab – Client lookup, progress, subscriptions, quizzes, rec feed
// ═════════════════════════════════════════════════════════════════════════
function SupportTab({ perms, language }: { perms: any; language: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserInfo, setSelectedUserInfo] = useState<{ name: string | null; email: string } | null>(null);

  const hasPerm = (p: string) => perms?.isAdmin || perms?.permissions?.includes(p);

  // Search
  const { data: searchResults, isLoading: searching } =
    trpc.supportDashboard.searchClients.useQuery({ query: searchSubmitted }, { enabled: searchSubmitted.length > 0 });

  // Selected client data
  const { data: clientProgress, isLoading: loadingProgress } =
    trpc.supportDashboard.clientProgress.useQuery({ userId: selectedUserId! }, { enabled: !!selectedUserId && !!hasPerm("view_progress") });

  const { data: clientSubs, isLoading: loadingSubs } =
    trpc.supportDashboard.clientSubscriptions.useQuery({ userId: selectedUserId! }, { enabled: !!selectedUserId && !!hasPerm("view_subscriptions") });

  const { data: clientQuizzes, isLoading: loadingQuizzes } =
    trpc.supportDashboard.clientQuizProgress.useQuery({ userId: selectedUserId! }, { enabled: !!selectedUserId && !!hasPerm("view_quizzes") });

  const { data: recFeed, isLoading: loadingRecs } =
    trpc.supportDashboard.recommendationFeed.useQuery(undefined, { enabled: !!hasPerm("view_recommendations") && !selectedUserId });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSelectedUserId(null);
    setSelectedUserInfo(null);
    setSearchSubmitted(searchQuery.trim());
  };

  const selectClient = (c: { id: number; name: string | null; email: string }) => {
    setSelectedUserId(c.id);
    setSelectedUserInfo({ name: c.name, email: c.email });
  };

  return (
    <div className="space-y-6">
      {/* Permission badges */}
      <div className="flex flex-wrap gap-2">
        {perms?.isAdmin && <Badge className="bg-red-100 text-red-800">Admin</Badge>}
        {hasPerm("support") && <Badge className="bg-blue-100 text-blue-800">Support</Badge>}
        {hasPerm("client_lookup") && <Badge className="bg-indigo-100 text-indigo-800">Client Lookup</Badge>}
        {hasPerm("view_progress") && <Badge className="bg-green-100 text-green-800">View Progress</Badge>}
        {hasPerm("view_subscriptions") && <Badge className="bg-cyan-100 text-cyan-800">View Subscriptions</Badge>}
        {hasPerm("view_quizzes") && <Badge className="bg-orange-100 text-orange-800">View Quizzes</Badge>}
        {hasPerm("view_recommendations") && <Badge className="bg-pink-100 text-pink-800">View Recommendations</Badge>}
      </div>

      {/* Client Lookup */}
      {(hasPerm("client_lookup") || hasPerm("support")) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />
              {language === "ar" ? "البحث عن عميل" : "Client Lookup"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={language === "ar" ? "بحث بالإيميل أو الاسم أو الهاتف..." : "Search by email, name, or phone..."}
                className="flex-1 border rounded-md px-3 py-2 text-sm" />
              <Button type="submit" disabled={searching || !searchQuery.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-1">{language === "ar" ? "بحث" : "Search"}</span>
              </Button>
            </form>

            {searchResults && searchResults.length > 0 && !selectedUserId && (
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                      <TableHead>{language === "ar" ? "الإيميل" : "Email"}</TableHead>
                      <TableHead>{language === "ar" ? "الهاتف" : "Phone"}</TableHead>
                      <TableHead>{language === "ar" ? "الانضمام" : "Joined"}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name || "—"}</TableCell>
                        <TableCell>{c.email}</TableCell>
                        <TableCell>{c.phone || "—"}</TableCell>
                        <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" onClick={() => selectClient(c)}>
                            <User className="h-4 w-4 mr-1" /> {language === "ar" ? "عرض" : "View"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {searchResults && searchResults.length === 0 && searchSubmitted && (
              <p className="text-center text-muted-foreground py-4">{language === "ar" ? "لم يتم العثور على عميل" : "No clients found"}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected client details */}
      {selectedUserId && selectedUserInfo && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedUserId(null); setSelectedUserInfo(null); }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {language === "ar" ? "رجوع" : "Back"}
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                {(selectedUserInfo.name || selectedUserInfo.email).charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-bold text-lg">{selectedUserInfo.name || "—"}</h2>
                <p className="text-sm text-muted-foreground">{selectedUserInfo.email}</p>
              </div>
            </div>
          </div>

          {/* Course Progress */}
          {hasPerm("view_progress") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" /> {language === "ar" ? "تقدم الدورات" : "Course Progress"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingProgress ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : !clientProgress || clientProgress.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">{language === "ar" ? "لا يوجد تسجيل" : "No enrollments found"}</p>
                ) : (
                  <div className="space-y-4">
                    {clientProgress.map((enr: any) => (
                      <div key={enr.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold">{enr.courseName}</h3>
                          <Badge variant={enr.completedAt ? "default" : "secondary"}>
                            {enr.completedAt ? (language === "ar" ? "مكتمل" : "Completed") : (language === "ar" ? "جاري" : "In Progress")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                          <span>{language === "ar" ? "الحلقات" : "Episodes"}: {enr.completedEpisodes}/{Number(enr.totalEpisodes)}</span>
                          <span>{language === "ar" ? "التقدم" : "Progress"}: {enr.progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="bg-blue-600 h-2.5 rounded-full transition-all" style={{ width: `${Math.min(enr.progressPercentage, 100)}%` }} />
                        </div>
                        {enr.episodeProgress && enr.episodeProgress.length > 0 && (
                          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {enr.episodeProgress.map((ep: any) => (
                              <div key={ep.id} className="flex items-center gap-1.5 text-xs">
                                {ep.isCompleted ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Clock className="h-3.5 w-3.5 text-gray-400" />}
                                <span>{language === "ar" ? `حلقة ${ep.episodeId}` : `Ep ${ep.episodeId}`}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Subscriptions & Keys */}
          {hasPerm("view_subscriptions") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Key className="h-5 w-5" /> {language === "ar" ? "الاشتراكات والمفاتيح" : "Subscriptions & Access"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSubs ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        LexAI
                        {clientSubs?.lexai ? <Badge className="bg-green-100 text-green-800 text-xs">{language === "ar" ? "فعّال" : "Active"}</Badge> : <Badge variant="secondary" className="text-xs">{language === "ar" ? "غير فعّال" : "Inactive"}</Badge>}
                      </h4>
                      {clientSubs?.lexai ? (
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{language === "ar" ? "الرسائل" : "Messages"}: {clientSubs.lexai.messagesUsed}/{clientSubs.lexai.messagesLimit}</p>
                          <p>{language === "ar" ? "الانتهاء" : "Expires"}: {new Date(clientSubs.lexai.endDate).toLocaleDateString()}</p>
                        </div>
                      ) : <p className="text-sm text-muted-foreground">{language === "ar" ? "لا يوجد اشتراك" : "No active subscription"}</p>}
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        {language === "ar" ? "التوصيات" : "Recommendations"}
                        {clientSubs?.recommendation ? <Badge className="bg-green-100 text-green-800 text-xs">{language === "ar" ? "فعّال" : "Active"}</Badge> : <Badge variant="secondary" className="text-xs">{language === "ar" ? "غير فعّال" : "Inactive"}</Badge>}
                      </h4>
                      {clientSubs?.recommendation ? (
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>{language === "ar" ? "الانتهاء" : "Expires"}: {new Date(clientSubs.recommendation.endDate).toLocaleDateString()}</p>
                        </div>
                      ) : <p className="text-sm text-muted-foreground">{language === "ar" ? "لا يوجد اشتراك" : "No active subscription"}</p>}
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2 flex items-center gap-2">
                        {language === "ar" ? "الدورات" : "Courses"}
                        <Badge variant="secondary" className="text-xs">{clientSubs?.enrollments?.length ?? 0} {language === "ar" ? "مسجل" : "enrolled"}</Badge>
                      </h4>
                      {(clientSubs?.enrollments ?? []).length > 0 ? (
                        <div className="text-sm text-muted-foreground space-y-1">
                          {(clientSubs?.enrollments ?? []).map((e: any) => (
                            <p key={e.id}>{e.courseName} — {e.progressPercentage}%</p>
                          ))}
                        </div>
                      ) : <p className="text-sm text-muted-foreground">{language === "ar" ? "لا يوجد تسجيل" : "No enrollments"}</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quiz Progress */}
          {hasPerm("view_quizzes") && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" /> {language === "ar" ? "تقدم الاختبارات" : "Quiz Progress"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingQuizzes ? (
                  <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : !clientQuizzes || clientQuizzes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">{language === "ar" ? "لا يوجد محاولات" : "No quiz attempts found"}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{language === "ar" ? "الاختبار" : "Quiz"}</TableHead>
                        <TableHead>{language === "ar" ? "المستوى" : "Level"}</TableHead>
                        <TableHead>{language === "ar" ? "النتيجة" : "Score"}</TableHead>
                        <TableHead>{language === "ar" ? "الحالة" : "Result"}</TableHead>
                        <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientQuizzes.map((q: any) => (
                        <TableRow key={q.attemptId}>
                          <TableCell className="font-medium">{q.quizTitle || `Quiz #${q.quizId}`}</TableCell>
                          <TableCell>{q.quizLevel ?? "—"}</TableCell>
                          <TableCell>{q.score}/{q.totalQuestions} ({q.percentage}%)</TableCell>
                          <TableCell>
                            {q.passed
                              ? <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />{language === "ar" ? "ناجح" : "Passed"}</Badge>
                              : <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />{language === "ar" ? "راسب" : "Failed"}</Badge>}
                          </TableCell>
                          <TableCell>{new Date(q.completedAt).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Recommendation feed (when no client selected) */}
      {!selectedUserId && hasPerm("view_recommendations") && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> {language === "ar" ? "سجل التوصيات" : "Recommendation Feed"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingRecs ? (
              <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !recFeed || recFeed.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{language === "ar" ? "لا توجد توصيات بعد" : "No recommendations yet"}</p>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {recFeed.map((msg: any) => (
                  <div key={msg.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs capitalize">{msg.type}</Badge>
                        {msg.symbol && <span className="font-semibold text-sm">{msg.symbol}</span>}
                        {msg.side && <Badge className={msg.side === "buy" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>{msg.side}</Badge>}
                      </div>
                      <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {(msg.entryPrice || msg.stopLoss || msg.takeProfit1) && (
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        {msg.entryPrice && <span>Entry: {msg.entryPrice}</span>}
                        {msg.stopLoss && <span>SL: {msg.stopLoss}</span>}
                        {msg.takeProfit1 && <span>TP1: {msg.takeProfit1}</span>}
                        {msg.takeProfit2 && <span>TP2: {msg.takeProfit2}</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
