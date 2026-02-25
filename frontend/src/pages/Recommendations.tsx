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

const reactionIcons = {
  like: <ThumbsUp className="h-4 w-4" />,
  love: <Heart className="h-4 w-4" />,
  sad: <Frown className="h-4 w-4" />,
  fire: <Flame className="h-4 w-4" />,
  rocket: <Rocket className="h-4 w-4" />,
};

type RecommendationType = "alert" | "recommendation" | "result";

function buildCopyBlock(message: any) {
  const lines: string[] = [];
  if (message.symbol) lines.push(`الزوج/الأصل: ${message.symbol}`);
  if (message.side) lines.push(`الاتجاه: ${message.side}`);
  if (message.entryPrice) lines.push(`الدخول: ${message.entryPrice}`);
  if (message.stopLoss) lines.push(`وقف الخسارة: ${message.stopLoss}`);
  if (message.takeProfit1) lines.push(`هدف 1: ${message.takeProfit1}`);
  if (message.takeProfit2) lines.push(`هدف 2: ${message.takeProfit2}`);
  if (message.riskPercent) lines.push(`نسبة المخاطرة: ${message.riskPercent}`);
  lines.push("");
  lines.push(message.content || "");
  return lines.join("\n").trim();
}

export default function Recommendations() {
  const { user } = useAuth();
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
      toast.success("تم تفعيل مفتاح قروب التوصيات بنجاح");
      setKeyCode("");
      utils.recommendations.me.invalidate();
      utils.recommendations.feed.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const postMessageMutation = trpc.recommendations.postMessage.useMutation({
    onSuccess: () => {
      toast.success("تم نشر الرسالة وإرسال الإشعارات");
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
    return date.toLocaleDateString("ar-SA");
  }, [me?.subscription?.endDate]);

  const onActivate = () => {
    if (!keyCode.trim() || !user?.email) {
      toast.error("يرجى إدخال المفتاح");
      return;
    }
    activateKeyMutation.mutate({ keyCode: keyCode.trim(), email: user.email });
  };

  const onPublish = () => {
    if (!content.trim()) {
      toast.error("الرجاء كتابة الرسالة");
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
    const text = buildCopyBlock(message);
    navigator.clipboard.writeText(text);
    toast.success("تم نسخ التوصية");
  };

  return (
    <ClientLayout>
    <div className="min-h-[calc(100vh-64px)] bg-gray-50">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">قروب التوصيات</h1>
          <p className="text-muted-foreground">تنبيهات وتوصيات مباشرة مع إمكانية نسخ سريع للتنفيذ</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>حالة الوصول</CardTitle>
            <CardDescription>اشتراك قروب التوصيات منفصل عن الدورة و LexAI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {meLoading ? (
              <p className="text-sm text-muted-foreground">جاري التحقق...</p>
            ) : (
              <>
                <p className="text-sm">الحالة: {canRead ? "مفعل" : "غير مفعل"}</p>
                <p className="text-sm">تاريخ الانتهاء: {expiryText}</p>
              </>
            )}

            {!canRead && (
              <div className="flex flex-col md:flex-row gap-2 pt-2">
                <Input
                  value={keyCode}
                  onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
                  placeholder="أدخل مفتاح التوصيات"
                  className="font-mono"
                />
                <Button onClick={onActivate} disabled={activateKeyMutation.isPending}>
                  تفعيل المفتاح
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {me?.canPublish && (
          <Card>
            <CardHeader>
              <CardTitle>نشر توصية جديدة</CardTitle>
              <CardDescription>مخصص للمحلل/الموظف المسؤول عن القروب</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Button variant={type === "alert" ? "default" : "outline"} onClick={() => setType("alert")}>
                  <Bell className="h-4 w-4 ml-1" /> تنبيه
                </Button>
                <Button variant={type === "recommendation" ? "default" : "outline"} onClick={() => setType("recommendation")}>
                  <TrendingUp className="h-4 w-4 ml-1" /> توصية
                </Button>
                <Button variant={type === "result" ? "default" : "outline"} onClick={() => setType("result")}>
                  <BarChart3 className="h-4 w-4 ml-1" /> نتيجة
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="الزوج/الأصل (اختياري)" />
                <Input value={side} onChange={(e) => setSide(e.target.value)} placeholder="الاتجاه BUY/SELL (اختياري)" />
                <Input value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="سعر الدخول (اختياري)" />
                <Input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} placeholder="وقف الخسارة (اختياري)" />
                <Input value={takeProfit1} onChange={(e) => setTakeProfit1(e.target.value)} placeholder="الهدف الأول (اختياري)" />
                <Input value={takeProfit2} onChange={(e) => setTakeProfit2(e.target.value)} placeholder="الهدف الثاني (اختياري)" />
                <Input value={riskPercent} onChange={(e) => setRiskPercent(e.target.value)} placeholder="نسبة المخاطرة (اختياري)" />
              </div>

              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="اكتب التوصية أو النتيجة هنا..." rows={4} />
              <Button onClick={onPublish} disabled={postMessageMutation.isPending}>نشر + إرسال إيميل</Button>
            </CardContent>
          </Card>
        )}

        {canRead && (
          <Card>
            <CardHeader>
              <CardTitle>الرسائل</CardTitle>
              <CardDescription>تحديثات القروب بشكل مباشر</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {feedLoading ? (
                <p className="text-sm text-muted-foreground">جاري تحميل الرسائل...</p>
              ) : feed.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد رسائل بعد.</p>
              ) : (
                feed.map((message: any) => (
                  <div key={message.id} className="rounded-lg border p-4 space-y-3 bg-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{message.type}</Badge>
                        {message.isAnalyst && <Badge>محلل</Badge>}
                        <span className="text-sm text-muted-foreground">{message.authorName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {message.createdAt ? new Date(message.createdAt).toLocaleString("ar-SA") : "-"}
                      </div>
                    </div>

                    {(message.symbol || message.side || message.entryPrice) && (
                      <div className="text-sm rounded border bg-muted p-3 whitespace-pre-wrap">
                        {buildCopyBlock(message)}
                      </div>
                    )}

                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="sm" variant="outline" onClick={() => copyMessage(message)}>
                        <Copy className="h-4 w-4 ml-1" /> نسخ
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
                          <span className="mr-1">{message.reactions?.[reaction] ?? 0}</span>
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
