import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { PauseCircle, PlayCircle, UserCog, Bell, TrendingUp, Copy, Trash2, ArrowDown, ArrowUp, Plus } from "lucide-react";
import { useDataTable, DataTablePagination, zebraRow } from "@/components/DataTable";

type RecommendationType = "alert" | "recommendation" | "result";

const QUICK_SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "US30"];

function buildCopyBlock(message: any, t: (key: string) => string) {
  const lines: string[] = [];
  if (message.symbol) lines.push(`${t('rec.copySymbol')}: ${message.symbol}`);
  if (message.side) lines.push(`${t('rec.copySide')}: ${message.side}`);
  if (message.entryPrice) lines.push(`${t('rec.copyEntry')}: ${message.entryPrice}`);
  if (message.stopLoss) lines.push(`${t('rec.copySL')}: ${message.stopLoss}`);
  if (message.takeProfit1) lines.push(`${t('rec.copyTP1')}: ${message.takeProfit1}`);
  if (message.takeProfit2) lines.push(`${t('rec.copyTP2')}: ${message.takeProfit2}`);
  if (message.riskPercent) lines.push(`${t('rec.copyRisk')}: ${message.riskPercent}`);
  lines.push("");
  lines.push(message.content || "");
  return lines.join("\n").trim();
}

/* ─── Analyst view: posting form + recent messages ─── */
function AnalystView() {
  const { t, language, isRTL } = useLanguage();
  const utils = trpc.useUtils();

  const [type, setType] = useState<RecommendationType>("recommendation");
  const [content, setContent] = useState("");
  const [symbol, setSymbol] = useState("XAUUSD");
  const [side, setSide] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit1, setTakeProfit1] = useState("");
  const [takeProfit2, setTakeProfit2] = useState("");
  const [riskPercent, setRiskPercent] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [resultParentId, setResultParentId] = useState<number | null>(null);

  const { data: me } = trpc.recommendations.me.useQuery();
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery();
  const { data: feed = [], isLoading: feedLoading } = trpc.recommendations.feed.useQuery(
    { limit: 200 },
    { enabled: !!me?.canPublish || !!adminCheck?.isAdmin }
  );

  const postMessageMutation = trpc.recommendations.postMessage.useMutation({
    onSuccess: () => {
      toast.success(sendEmail ? t('rec.toastPublished') : t('rec.toastPublishedNoEmail'));
      setContent(""); setSide(""); setEntryPrice("");
      setStopLoss(""); setTakeProfit1(""); setTakeProfit2(""); setRiskPercent("");
      setResultParentId(null);
      if (type === "result") setType("recommendation");
      utils.recommendations.feed.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMessageMutation = trpc.recommendations.deleteMessage.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم حذف الرسالة" : "Message deleted");
      utils.recommendations.feed.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const onPublish = () => {
    if (!content.trim()) { toast.error(t('rec.toastWriteMessage')); return; }
    postMessageMutation.mutate({
      type, content: content.trim(),
      symbol: symbol.trim() || undefined, side: side.trim() || undefined,
      entryPrice: entryPrice.trim() || undefined, stopLoss: stopLoss.trim() || undefined,
      takeProfit1: takeProfit1.trim() || undefined, takeProfit2: takeProfit2.trim() || undefined,
      riskPercent: riskPercent.trim() || undefined, sendEmail,
      parentId: resultParentId ?? undefined,
    });
  };

  const copyMessage = (message: any) => {
    navigator.clipboard.writeText(buildCopyBlock(message, t));
    toast.success(t('rec.toastCopied'));
  };

  const startAddResult = (parentMessage: any) => {
    setType("result");
    setResultParentId(parentMessage.id);
    setSymbol(parentMessage.symbol || "XAUUSD");
    setSide(parentMessage.side || "");
    setContent("");
    setEntryPrice(""); setStopLoss(""); setTakeProfit1(""); setTakeProfit2(""); setRiskPercent("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Group results under their parent messages
  const { rootMessages, childrenMap } = useMemo(() => {
    const childrenMap = new Map<number, any[]>();
    const rootMessages: any[] = [];
    for (const msg of feed) {
      if (msg.parentId) {
        const children = childrenMap.get(msg.parentId) || [];
        children.push(msg);
        childrenMap.set(msg.parentId, children);
      } else {
        rootMessages.push(msg);
      }
    }
    return { rootMessages, childrenMap };
  }, [feed]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('rec.publishNew')}</h1>
        <p className="text-muted-foreground">{t('rec.publishDesc')}</p>
      </div>

      {/* Posting form */}
      <Card>
        <CardHeader>
          <CardTitle>
            {resultParentId
              ? (isRTL ? "إضافة نتيجة لتوصية #" + resultParentId : "Add Result for Recommendation #" + resultParentId)
              : t('rec.publishNew')
            }
          </CardTitle>
          <CardDescription>{t('rec.publishDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              {isRTL ? "نوع الرسالة" : "Message Type"}
            </label>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={type === "alert" ? "default" : "outline"}
                onClick={() => { setType("alert"); setResultParentId(null); }}
                className={type === "alert" ? "bg-amber-500 hover:bg-amber-600 text-white" : ""}
              >
                <Bell className="h-4 w-4 me-1" /> {t('rec.typeAlert')}
              </Button>
              <Button
                size="sm"
                variant={type === "recommendation" ? "default" : "outline"}
                onClick={() => { setType("recommendation"); setResultParentId(null); }}
                className={type === "recommendation" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
              >
                <TrendingUp className="h-4 w-4 me-1" /> {t('rec.typeRecommendation')}
              </Button>
            </div>
            {resultParentId && (
              <div className="mt-2 flex items-center gap-2">
                <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">
                  {isRTL ? `مرتبطة بتوصية #${resultParentId}` : `Linked to Rec #${resultParentId}`}
                </Badge>
                <button
                  onClick={() => { setResultParentId(null); setType("recommendation"); }}
                  className="text-xs text-red-500 hover:underline"
                >
                  {isRTL ? "إلغاء الربط" : "Unlink"}
                </button>
              </div>
            )}
          </div>

          {/* Symbol quick-fill */}
          {type !== "alert" && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {isRTL ? "الأصل / الزوج" : "Symbol / Pair"}
              </label>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {QUICK_SYMBOLS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSymbol(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      symbol === s
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300"
                        : "bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder={t('rec.symbolPlaceholder')}
                className="max-w-xs"
              />
            </div>
          )}

          {/* Side toggle (BUY / SELL) */}
          {type !== "alert" && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {isRTL ? "الاتجاه" : "Direction"}
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSide("BUY")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                    side === "BUY"
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                      : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-emerald-300"
                  }`}
                >
                  <ArrowUp className="w-4 h-4" /> BUY
                </button>
                <button
                  onClick={() => setSide("SELL")}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                    side === "SELL"
                      ? "bg-red-500 text-white border-red-500 shadow-md shadow-red-500/20"
                      : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 hover:border-red-300"
                  }`}
                >
                  <ArrowDown className="w-4 h-4" /> SELL
                </button>
              </div>
            </div>
          )}

          {/* Price fields */}
          {type !== "alert" && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                {isRTL ? "تفاصيل الصفقة" : "Trade Details"}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <span className="text-xs text-muted-foreground">{isRTL ? "سعر الدخول" : "Entry"}</span>
                  <Input value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{isRTL ? "وقف الخسارة" : "Stop Loss"}</span>
                  <Input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{isRTL ? "هدف 1" : "Target 1"}</span>
                  <Input value={takeProfit1} onChange={(e) => setTakeProfit1(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">{isRTL ? "هدف 2" : "Target 2"}</span>
                  <Input value={takeProfit2} onChange={(e) => setTakeProfit2(e.target.value)} placeholder="0.00" />
                </div>
              </div>
              <div className="mt-2 max-w-[200px]">
                <span className="text-xs text-muted-foreground">{isRTL ? "نسبة المخاطرة" : "Risk %"}</span>
                <Input value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} placeholder="1%" />
              </div>
            </div>
          )}

          {/* Message content */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              {isRTL ? "نص الرسالة" : "Message"}
            </label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('rec.messagePlaceholder')} rows={4} />
          </div>

          {/* Publish actions */}
          <div className="flex items-center gap-3 flex-wrap pt-2 border-t">
            <Button
              onClick={onPublish}
              disabled={postMessageMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {postMessageMutation.isPending
                ? (isRTL ? "جاري النشر..." : "Publishing...")
                : t('rec.publishBtn')
              }
            </Button>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
              <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="rounded border-gray-300" />
              {t('rec.sendEmailLabel')}
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Recent messages */}
      <Card>
        <CardHeader>
          <CardTitle>{t('rec.messages')}</CardTitle>
          <CardDescription>{t('rec.messagesDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {feedLoading ? (
            <p className="text-sm text-muted-foreground">{t('rec.loadingMessages')}</p>
          ) : rootMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('rec.noMessages')}</p>
          ) : (
            rootMessages.map((message: any) => {
              const children = childrenMap.get(message.id) || [];
              const canDeleteMessage = !!adminCheck?.isAdmin || message.userId === me?.userId;
              return (
                <div key={message.id} className="space-y-2">
                  {/* Parent message */}
                  <div className={`rounded-lg border p-4 space-y-3 ${
                    message.type === "alert" ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30" :
                    message.type === "result" ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30" :
                    "bg-white dark:bg-slate-900/50"
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={
                          message.type === "alert" ? "border-amber-300 text-amber-700 dark:text-amber-400" :
                          message.type === "result" ? "border-blue-300 text-blue-700 dark:text-blue-400" :
                          "border-emerald-300 text-emerald-700 dark:text-emerald-400"
                        }>
                          {message.type === "alert" ? (isRTL ? "تنبيه" : "Alert") : message.type === "result" ? (isRTL ? "نتيجة" : "Result") : (isRTL ? "توصية" : "Recommendation")}
                        </Badge>
                        {message.symbol && <Badge className="bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-xs">{message.symbol}</Badge>}
                        {message.side && (
                          <Badge className={message.side === "BUY" ? "bg-emerald-100 text-emerald-700 text-xs" : "bg-red-100 text-red-700 text-xs"}>
                            {message.side === "BUY" ? "↑ BUY" : "↓ SELL"}
                          </Badge>
                        )}
                        {message.isAnalyst && <Badge className="bg-emerald-600 text-white text-xs">{t('rec.analyst')}</Badge>}
                        <span className="text-xs text-muted-foreground">#{message.id}</span>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {message.createdAt ? new Date(message.createdAt).toLocaleString(language === 'ar' ? "ar-EG" : "en-US") : "-"}
                      </div>
                    </div>
                    {(message.entryPrice || message.stopLoss || message.takeProfit1) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs p-3 rounded-lg bg-gray-50 dark:bg-white/5 border">
                        {message.entryPrice && <div><span className="text-muted-foreground">{isRTL ? "دخول:" : "Entry:"}</span> <span className="font-mono font-medium">{message.entryPrice}</span></div>}
                        {message.stopLoss && <div><span className="text-muted-foreground">{isRTL ? "وقف:" : "SL:"}</span> <span className="font-mono font-medium text-red-600">{message.stopLoss}</span></div>}
                        {message.takeProfit1 && <div><span className="text-muted-foreground">{isRTL ? "هدف 1:" : "TP1:"}</span> <span className="font-mono font-medium text-emerald-600">{message.takeProfit1}</span></div>}
                        {message.takeProfit2 && <div><span className="text-muted-foreground">{isRTL ? "هدف 2:" : "TP2:"}</span> <span className="font-mono font-medium text-emerald-600">{message.takeProfit2}</span></div>}
                        {message.riskPercent && <div><span className="text-muted-foreground">{isRTL ? "مخاطرة:" : "Risk:"}</span> <span className="font-mono font-medium">{message.riskPercent}</span></div>}
                      </div>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => copyMessage(message)}>
                        <Copy className="h-3.5 w-3.5 me-1" /> {t('rec.copy')}
                      </Button>
                      {(message.type === "recommendation" || message.type === "alert") && (
                        <Button size="sm" variant="outline" onClick={() => startAddResult(message)} className="text-blue-600 border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-900/20">
                          <Plus className="h-3.5 w-3.5 me-1" /> {isRTL ? "إضافة نتيجة" : "Add Result"}
                        </Button>
                      )}
                      {canDeleteMessage && (
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { if (confirm(isRTL ? "هل تريد حذف هذه الرسالة؟" : "Delete this message?")) deleteMessageMutation.mutate({ messageId: message.id }); }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Child results */}
                  {children.length > 0 && (
                    <div className={`space-y-2 ${isRTL ? "border-r-2 border-blue-300 dark:border-blue-700 pr-4 mr-4" : "border-l-2 border-blue-300 dark:border-blue-700 pl-4 ml-4"}`}>
                      {children.map((child: any) => (
                        <div key={child.id} className="rounded-lg border p-3 space-y-2 bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-400 text-xs">
                                {isRTL ? "نتيجة" : "Result"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">#{child.id}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {child.createdAt ? new Date(child.createdAt).toLocaleString(language === 'ar' ? "ar-EG" : "en-US") : "-"}
                              </span>
                              {(!!adminCheck?.isAdmin || child.userId === me?.userId) && (
                                <Button
                                  size="sm" variant="ghost"
                                  onClick={() => { if (confirm(isRTL ? "حذف النتيجة؟" : "Delete result?")) deleteMessageMutation.mutate({ messageId: child.id }); }}
                                  className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{child.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Admin view: analyst management + subscription management ─── */
function AdminView() {
  const { t, isRTL } = useLanguage();

  const utils = trpc.useUtils();

  const { data: analysts = [] } = trpc.recommendationAdmin.listAnalysts.useQuery();
  const { data: subscriptions = [] } = trpc.recommendationAdmin.subscriptions.list.useQuery();

  const pauseSubscriptionMutation = trpc.recommendationAdmin.subscriptions.pause.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم تجميد الاشتراك" : "Subscription frozen");
      utils.recommendationAdmin.subscriptions.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const resumeSubscriptionMutation = trpc.recommendationAdmin.subscriptions.resume.useMutation({
    onSuccess: () => {
      toast.success(isRTL ? "تم فك تجميد الاشتراك" : "Subscription unfrozen");
      utils.recommendationAdmin.subscriptions.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const subTable = useDataTable(subscriptions as any[], undefined, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('admin.rec.title')}</h1>
        <p className="text-muted-foreground">{t('admin.rec.subtitle')}</p>
      </div>

        {/* Active analysts summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> {isRTL ? 'المحللون النشطون' : 'Active Analysts'}</CardTitle>
            <CardDescription>{isRTL ? 'المحللون المعينون حالياً — لتعديل الأدوار اذهب إلى صفحة الأدوار' : 'Currently assigned analysts — to manage roles go to the Roles page'}</CardDescription>
          </CardHeader>
          <CardContent>
            {analysts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isRTL ? 'لا يوجد محللون' : 'No analysts assigned'}</p>
            ) : (
              <div className="space-y-2">
                {analysts.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between border rounded p-3">
                    <div>
                      <p className="font-medium">{a.name || "-"}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800">{isRTL ? 'محلل' : 'Analyst'}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{isRTL ? 'اشتراكات التوصيات' : 'Recommendation Subscriptions'}</CardTitle>
            <CardDescription>{isRTL ? 'تجميد أو فك تجميد الاشتراكات النشطة مؤقتاً' : 'Temporarily freeze or unfreeze active recommendation access'}</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{isRTL ? 'المستخدم' : 'User'}</TableHead>
                  <TableHead>{isRTL ? 'البريد' : 'Email'}</TableHead>
                  <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                  <TableHead>{isRTL ? 'ينتهي' : 'Ends'}</TableHead>
                  <TableHead>{isRTL ? 'المتبقي عند التجميد' : 'Frozen balance'}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subTable.paged.map((subscription: any, i: number) => (
                  <TableRow key={subscription.id} className={zebraRow(i)}>
                    <TableCell>{subscription.userName || '-'}</TableCell>
                    <TableCell>{subscription.userEmail || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={subscription.isPaused ? 'secondary' : 'default'}>
                        {subscription.isPaused ? (isRTL ? 'مجمّد' : 'Frozen') : (isRTL ? 'نشط' : 'Active')}
                      </Badge>
                    </TableCell>
                    <TableCell>{subscription.endDate ? new Date(subscription.endDate).toLocaleDateString(isRTL ? 'ar-EG' : undefined) : '-'}</TableCell>
                    <TableCell>{subscription.pausedRemainingDays ? `${subscription.pausedRemainingDays}d` : '-'}</TableCell>
                    <TableCell>
                      {subscription.isPaused ? (
                        <Button size="sm" variant="outline" onClick={() => resumeSubscriptionMutation.mutate({ subscriptionId: subscription.id })}>
                          <PlayCircle className="h-4 w-4 mr-1" />
                          {isRTL ? 'فك التجميد' : 'Unfreeze'}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => pauseSubscriptionMutation.mutate({ subscriptionId: subscription.id })}>
                          <PauseCircle className="h-4 w-4 mr-1" />
                          {isRTL ? 'تجميد' : 'Freeze'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </ResponsiveTable>
            <DataTablePagination
              page={subTable.page}
              pageSize={subTable.pageSize}
              totalPages={subTable.totalPages}
              totalItems={subTable.totalItems}
              setPage={subTable.setPage}
              changePageSize={subTable.changePageSize}
              isRtl={isRTL}
            />
          </CardContent>
        </Card>
      </div>
  );
}

/* ─── Main export: routes to correct view based on role ─── */
export default function AdminRecommendations() {
  const { t, isRTL } = useLanguage();
  const { data: adminCheck, isLoading } = trpc.auth.isAdmin.useQuery();
  const [activeTab, setActiveTab] = useState<"manage" | "channel">("manage");

  if (isLoading) return <DashboardLayout><div className="p-8 text-center text-muted-foreground">Loading...</div></DashboardLayout>;

  const isAdmin = adminCheck?.isAdmin;

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6" dir={isRTL ? "rtl" : "ltr"}>
        {isAdmin ? (
          <>
            {/* Pill-style tabs for admin */}
            <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-white/[0.06] rounded-xl p-1 w-fit">
              <button
                onClick={() => setActiveTab("manage")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "manage"
                    ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {isRTL ? "الإدارة" : "Management"}
              </button>
              <button
                onClick={() => setActiveTab("channel")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "channel"
                    ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-sm"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {isRTL ? "قناة التوصيات" : "Channel View"}
              </button>
            </div>
            {activeTab === "manage" ? <AdminView /> : <AnalystView />}
          </>
        ) : (
          <AnalystView />
        )}
      </div>
    </DashboardLayout>
  );
}
