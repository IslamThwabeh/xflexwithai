import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Flame, Heart, Rocket, ThumbsUp, Frown, Bell, TrendingUp, BarChart3 } from "lucide-react";
import ClientLayout from "@/components/ClientLayout";
import { useLanguage } from "@/contexts/LanguageContext";

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

  const [keyCode, setKeyCode] = useState("");
  const [type, setType] = useState<RecommendationType>("recommendation");
  const [content, setContent] = useState("");
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit1, setTakeProfit1] = useState("");
  const [takeProfit2, setTakeProfit2] = useState("");
  const [riskPercent, setRiskPercent] = useState("");

  const { data: me, isLoading: meLoading } = trpc.recommendations.me.useQuery();
  const { data: feed = [], isLoading: feedLoading } = trpc.recommendations.feed.useQuery(
    { limit: 200 },
    { enabled: !!me && (me.hasSubscription || me.canPublish) }
  );

  const activateKeyMutation = trpc.recommendations.activateKey.useMutation({
    onSuccess: () => {
      toast.success(t('rec.toastKeyActivated'));
      setKeyCode("");
      utils.recommendations.me.invalidate();
      utils.recommendations.feed.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const postMessageMutation = trpc.recommendations.postMessage.useMutation({
    onSuccess: () => {
      toast.success(t('rec.toastPublished'));
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
  const expiryText = useMemo(() => {
    if (!me?.subscription?.endDate) return "-";
    const date = new Date(me.subscription.endDate);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleDateString(language === 'ar' ? "ar-SA" : "en-US");
  }, [me?.subscription?.endDate, language]);

  const onActivate = () => {
    if (!keyCode.trim() || !user?.email) {
      toast.error(t('rec.toastEnterKey'));
      return;
    }
    activateKeyMutation.mutate({ keyCode: keyCode.trim(), email: user.email });
  };

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
    });
  };

  const copyMessage = (message: any) => {
    const text = buildCopyBlock(message, t);
    navigator.clipboard.writeText(text);
    toast.success(t('rec.toastCopied'));
  };

  return (
    <ClientLayout>
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('rec.title')}</h1>
          <p className="text-muted-foreground">{t('rec.subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('rec.accessStatus')}</CardTitle>
            <CardDescription>{t('rec.accessDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {meLoading ? (
              <p className="text-sm text-muted-foreground">{t('rec.checking')}</p>
            ) : (
              <>
                <p className="text-sm">{t('rec.status')}: {canRead ? t('rec.activated') : t('rec.notActivated')}</p>
                <p className="text-sm">{t('rec.expiryDate')}: {expiryText}</p>
              </>
            )}

            {!canRead && (
              <div className="flex flex-col md:flex-row gap-2 pt-2">
                <Input
                  value={keyCode}
                  onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
                  placeholder={t('rec.enterKey')}
                  className="font-mono"
                />
                <Button onClick={onActivate} disabled={activateKeyMutation.isPending}>
                  {t('rec.activateKey')}
                </Button>
              </div>
            )}
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
                <Button variant={type === "alert" ? "default" : "outline"} onClick={() => setType("alert")}>
                  <Bell className="h-4 w-4 me-1" /> {t('rec.typeAlert')}
                </Button>
                <Button variant={type === "recommendation" ? "default" : "outline"} onClick={() => setType("recommendation")}>
                  <TrendingUp className="h-4 w-4 me-1" /> {t('rec.typeRecommendation')}
                </Button>
                <Button variant={type === "result" ? "default" : "outline"} onClick={() => setType("result")}>
                  <BarChart3 className="h-4 w-4 me-1" /> {t('rec.typeResult')}
                </Button>
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
              <Button onClick={onPublish} disabled={postMessageMutation.isPending}>{t('rec.publishBtn')}</Button>
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{message.type}</Badge>
                        {message.isAnalyst && <Badge>{t('rec.analyst')}</Badge>}
                        <span className="text-sm text-muted-foreground">{message.authorName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {message.createdAt ? new Date(message.createdAt).toLocaleString(language === 'ar' ? "ar-SA" : "en-US") : "-"}
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
