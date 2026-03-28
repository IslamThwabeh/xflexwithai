import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Flame, Heart, Rocket, ThumbsUp, Frown, Bell, TrendingUp, BarChart3 } from "lucide-react";
import ClientLayout from "@/components/ClientLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";

const reactionIcons = {
  like: <ThumbsUp className="h-4 w-4" />,
  love: <Heart className="h-4 w-4" />,
  sad: <Frown className="h-4 w-4" />,
  fire: <Flame className="h-4 w-4" />,
  rocket: <Rocket className="h-4 w-4" />,
};

type RecommendationType = "alert" | "recommendation" | "result";

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

export default function Recommendations() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const utils = trpc.useUtils();

  const [type, setType] = useState<RecommendationType>("recommendation");
  const [content, setContent] = useState("");
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit1, setTakeProfit1] = useState("");
  const [takeProfit2, setTakeProfit2] = useState("");
  const [riskPercent, setRiskPercent] = useState("");
  const [sendEmail, setSendEmail] = useState(false);

  const { data: me, isLoading: meLoading } = trpc.recommendations.me.useQuery();
  const { data: feed = [], isLoading: feedLoading } = trpc.recommendations.feed.useQuery(
    { limit: 200 },
    { enabled: !!me && (me.hasSubscription || me.canPublish) }
  );

  const postMessageMutation = trpc.recommendations.postMessage.useMutation({
    onSuccess: () => {
      toast.success(sendEmail ? t('rec.toastPublished') : t('rec.toastPublishedNoEmail'));
      setContent("");
      setSymbol("");
      setSide("");
      setEntryPrice("");
      setStopLoss("");
      setTakeProfit1("");
      setTakeProfit2("");
      setRiskPercent("");
      utils.recommendations.feed.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const reactMutation = trpc.recommendations.react.useMutation({
    onSuccess: () => utils.recommendations.feed.invalidate(),
    onError: (error) => toast.error(error.message),
  });

  const canRead = !!me && (me.hasSubscription || me.canPublish);
  const isFrozenRec = !!me && !me.hasSubscription && !me.canPublish && me.isFrozen;
  const expiryText = useMemo(() => {
    if (!me?.subscription?.endDate) return "-";
    const date = new Date(me.subscription.endDate);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString(language === 'ar' ? "ar-EG" : "en-US");
  }, [me?.subscription?.endDate, language]);

  const onPublish = () => {
    if (!content.trim()) {
      toast.error(t('rec.toastWriteMessage'));
      return;
    }

    postMessageMutation.mutate({
      type,
      content: content.trim(),
      symbol: symbol.trim() || undefined,
      side: side.trim() || undefined,
      entryPrice: entryPrice.trim() || undefined,
      stopLoss: stopLoss.trim() || undefined,
      takeProfit1: takeProfit1.trim() || undefined,
      takeProfit2: takeProfit2.trim() || undefined,
      riskPercent: riskPercent.trim() || undefined,
      sendEmail,
    });
  };

  const copyMessage = (message: any) => {
    const text = buildCopyBlock(message, t);
    navigator.clipboard.writeText(text);
    toast.success(t('rec.toastCopied'));
  };

  // Full-screen paywall — matches LexAI style
  if (!meLoading && !canRead) {
    // Frozen subscription — show specific frozen message
    if (isFrozenRec) {
      const frozenUntil = me?.frozenUntil;
      const frozenDate = frozenUntil ? new Date(frozenUntil).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : null;
      return (
        <ClientLayout>
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
          <Card className="max-w-lg mx-4">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mb-4">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">
                {language === 'ar' ? 'اشتراك التوصيات مُجمّد مؤقتاً' : 'Recommendations Subscription Frozen'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {language === 'ar'
                  ? 'تم تجميد اشتراكك مؤقتاً. سيتم استئنافه تلقائياً عند انتهاء فترة التجميد.'
                  : 'Your subscription is temporarily frozen. It will resume automatically when the freeze period ends.'}
              </CardDescription>
              {frozenDate && (
                <p className="text-sm font-medium text-amber-700 mt-3">
                  {language === 'ar' ? `ينتهي التجميد في: ${frozenDate}` : `Frozen until: ${frozenDate}`}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <Link href="/support">
                <Button variant="outline" className="w-full">
                  {language === 'ar' ? 'تواصل مع الدعم' : 'Contact Support'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        </ClientLayout>
      );
    }

    // No subscription — show standard paywall
    return (
      <ClientLayout>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <Card className="max-w-2xl w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
              <TrendingUp className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-3xl">
              {language === 'ar' ? 'قروب التوصيات' : 'Recommendations Group'}
            </CardTitle>
            <CardDescription className="text-lg">
              {language === 'ar'
                ? 'تنبيهات وتوصيات مباشرة مع إمكانية نسخ سريع للتنفيذ'
                : 'Live alerts and trading recommendations with quick copy for execution'}
            </CardDescription>
            <p className="text-sm text-amber-700 mt-2">
              {language === 'ar'
                ? 'قروب التوصيات يتطلب مفتاح باقة مفعّل'
                : 'Recommendations requires an active package key'}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <Bell className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-semibold">
                    {language === 'ar' ? 'تنبيهات فورية' : 'Instant Alerts'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'استقبل تنبيهات السوق فور صدورها' : 'Receive market alerts the moment they are published'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <TrendingUp className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-semibold">
                    {language === 'ar' ? 'توصيات التداول' : 'Trading Recommendations'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'نقاط دخول وخروج وإيقاف خسارة واضحة' : 'Clear entry, exit, and stop-loss points'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Copy className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-semibold">
                    {language === 'ar' ? 'نسخ سريع للتنفيذ' : 'Quick Copy for Execution'}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {language === 'ar' ? 'انسخ التوصية بضغطة واحدة للتنفيذ الفوري' : 'Copy any recommendation in one click for instant execution'}
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t pt-6">
              <Link href="/activate-key">
                <Button className="w-full" size="lg">
                  {language === 'ar' ? 'تفعيل مفتاح الباقة' : 'Activate Your Package Key'}
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('rec.title')}</h1>
          <p className="text-muted-foreground">{t('rec.subtitle')}</p>
        </div>

        {/* Status card — only shown to active subscribers */}
        <Card>
          <CardHeader>
            <CardTitle>{t('rec.accessStatus')}</CardTitle>
            <CardDescription>{t('rec.accessDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">{t('rec.status')}: {t('rec.activated')}</p>
            <p className="text-sm">{t('rec.expiryDate')}: {expiryText}</p>
          </CardContent>
        </Card>

        {me?.canPublish && (
          <Card>
            <CardHeader>
              <CardTitle>{t('rec.publishNew')}</CardTitle>
              <CardDescription>{t('rec.publishDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <div className="flex flex-col gap-1">
                  <Button variant={type === "alert" ? "default" : "outline"} onClick={() => setType("alert")}>
                    <Bell className="h-4 w-4 me-1" /> {t('rec.typeAlert')}
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">{t('rec.typeAlertDesc')}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant={type === "recommendation" ? "default" : "outline"} onClick={() => setType("recommendation")}>
                    <TrendingUp className="h-4 w-4 me-1" /> {t('rec.typeRecommendation')}
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">{t('rec.typeRecommendationDesc')}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant={type === "result" ? "default" : "outline"} onClick={() => setType("result")}>
                    <BarChart3 className="h-4 w-4 me-1" /> {t('rec.typeResult')}
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">{t('rec.typeResultDesc')}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={t('rec.symbolPlaceholder')} />
                <Input value={side} onChange={(e) => setSide(e.target.value)} placeholder={t('rec.sidePlaceholder')} />
                <Input value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder={t('rec.entryPlaceholder')} />
                <Input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder={t('rec.slPlaceholder')} />
                <Input value={takeProfit1} onChange={(e) => setTakeProfit1(e.target.value)} placeholder={t('rec.tp1Placeholder')} />
                <Input value={takeProfit2} onChange={(e) => setTakeProfit2(e.target.value)} placeholder={t('rec.tp2Placeholder')} />
                <Input value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} placeholder={t('rec.riskPlaceholder')} />
              </div>

              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={t('rec.messagePlaceholder')} rows={4} />

              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={onPublish} disabled={postMessageMutation.isPending}>{t('rec.publishBtn')}</Button>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="rounded border-gray-300" />
                  {t('rec.sendEmailLabel')}
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {canRead && (
          <Card>
            <CardHeader>
              <CardTitle>{t('rec.messages')}</CardTitle>
              <CardDescription>{t('rec.messagesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {feedLoading ? (
                <p className="text-sm text-muted-foreground">{t('rec.loadingMessages')}</p>
              ) : feed.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('rec.noMessages')}</p>
              ) : (
                feed.map((message: any) => (
                  <div key={message.id} className="rounded-lg border p-4 space-y-3 bg-white">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{message.type}</Badge>
                        {message.isAnalyst && <Badge>{t('rec.analyst')}</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {message.createdAt ? new Date(message.createdAt).toLocaleString(language === 'ar' ? "ar-EG" : "en-US") : "-"}
                      </div>
                    </div>

                    {(message.symbol || message.side || message.entryPrice) && (
                      <div className="text-sm rounded border bg-muted p-3 whitespace-pre-wrap">
                        {buildCopyBlock(message, t)}
                      </div>
                    )}

                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => copyMessage(message)}>
                        <Copy className="h-4 w-4 me-1" /> {t('rec.copy')}
                      </Button>

                      {(Object.keys(reactionIcons) as Array<keyof typeof reactionIcons>).map((reaction) => (
                        <Button
                          key={reaction}
                          size="sm"
                          variant={message.myReaction === reaction ? "default" : "outline"}
                          onClick={() => reactMutation.mutate({
                            messageId: message.id,
                            reaction: message.myReaction === reaction ? null : reaction,
                          })}
                        >
                          {reactionIcons[reaction]}
                          <span className="ms-1">{message.reactions?.[reaction] ?? 0}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </ClientLayout>
  );
}
