import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPendingActivationDate, getPendingActivationDaysLeft, getPendingActivationWindow } from "@/lib/pendingActivation";
import { toast } from "sonner";
import { ArrowUpRight, Clock3, Copy, Flame, Heart, Rocket, ThumbsUp, Frown, Bell, TrendingUp, BookOpen, MessageSquare, Building2, Megaphone } from "lucide-react";
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

function formatCountdown(target: unknown, now: number) {
  const timestamp = new Date(target as string).getTime();
  if (Number.isNaN(timestamp)) return null;
  const totalSeconds = Math.max(0, Math.ceil((timestamp - now) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getMessageTypeLabel(type: string, isArabic: boolean) {
  if (type === "result") return isArabic ? "نتيجة" : "Result";
  if (type === "update") return isArabic ? "رد" : "Reply";
  if (type === "alert") return isArabic ? "تنبيه" : "Alert";
  return isArabic ? "توصية" : "Recommendation";
}

function getMessageTypeClass(type: string) {
  if (type === "result") return "border-teal-300 text-teal-700 dark:text-teal-300";
  if (type === "update") return "border-amber-300 text-amber-700 dark:text-amber-300";
  if (type === "alert") return "border-emerald-300 text-emerald-700 dark:text-emerald-300";
  return "border-emerald-300 text-emerald-700 dark:text-emerald-400";
}

export default function Recommendations() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const utils = trpc.useUtils();
  const [now, setNow] = useState(() => Date.now());

  const { data: me, isLoading: meLoading } = trpc.recommendations.me.useQuery();
  const { data: activationStatus } = trpc.subscriptions.activationStatus.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: onboardingStatus } = trpc.onboarding.isComplete.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: feed = [], isLoading: feedLoading } = trpc.recommendations.feed.useQuery(
    { limit: 200 },
    { enabled: !!me && (me.hasSubscription || me.canPublish) }
  );
  const { data: activeAlerts = [] } = trpc.recommendations.activeAlerts.useQuery(undefined, {
    enabled: !!me && (me.hasSubscription || me.canPublish),
    refetchInterval: 15_000,
  });

  const reactMutation = trpc.recommendations.react.useMutation({
    onSuccess: () => utils.recommendations.feed.invalidate(),
    onError: (error) => toast.error(error.message),
  });

  const canRead = !!me && (me.hasSubscription || me.canPublish);
  const isFrozenRec = !!me && !me.hasSubscription && !me.canPublish && me.isFrozen;
  const isArabic = language === 'ar';
  const { studyPeriodDays, entitlementDays } = getPendingActivationWindow(activationStatus);
  const activationDeadline = formatPendingActivationDate(activationStatus?.maxActivationDate, isArabic);
  const activationDaysLeft = getPendingActivationDaysLeft(activationStatus?.maxActivationDate);
  const remainingDays = useMemo(() => {
    if (!me?.subscription?.endDate) return 0;
    const end = new Date(me.subscription.endDate);
    if (Number.isNaN(end.getTime())) return 0;
    const diff = end.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [me?.subscription?.endDate]);

  const threadedFeed = useMemo(() => {
    const childrenMap = new Map<number, any[]>();
    for (const message of feed) {
      if (!message.parentId) continue;
      const existing = childrenMap.get(message.parentId) ?? [];
      existing.push(message);
      childrenMap.set(message.parentId, existing);
    }

    for (const children of childrenMap.values()) {
      children.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
    }

    return feed
      .filter((message: any) => !message.parentId)
      .map((message: any) => ({
        message,
        children: childrenMap.get(message.id) ?? [],
      }));
  }, [feed]);

  const preparationAlerts = useMemo(() => {
    return activeAlerts.filter((alert: any) => {
      const notifiedAt = new Date(alert.notifiedAt).getTime();
      const updatedAt = new Date(alert.updatedAt).getTime();

      if (Number.isNaN(notifiedAt) || Number.isNaN(updatedAt)) {
        return true;
      }

      return updatedAt <= notifiedAt;
    });
  }, [activeAlerts]);

  useEffect(() => {
    if (!canRead || activeAlerts.length === 0) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [activeAlerts.length, canRead]);

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
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--color-xf-cream)]">
          <Card className="max-w-lg mx-4">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mb-4">
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

    // Pending activation — student is still inside the learning window
    if (activationStatus?.hasPending) {
      return (
        <ClientLayout>
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--color-xf-cream)]">
          <Card className="max-w-lg mx-4">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center mb-4">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">
                {isArabic ? 'فترة تعلم قروب التوصيات ما زالت فعالة' : 'Your Recommendations Learning Window Is Active'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {isArabic
                  ? `لديك حتى ${studyPeriodDays} يومًا لإكمال الكورس وإعداد حساب الوسيط. وبعد التفعيل سيبقى قروب التوصيات متاحًا لمدة ${entitlementDays} يومًا ضمن فترة اشتراكك.`
                  : `You have up to ${studyPeriodDays} days to finish the course and broker setup. After activation, Recommendations stay available for ${entitlementDays} days during your subscription period.`}
              </CardDescription>
              {activationDeadline && (
                <p className="text-sm font-medium text-amber-700 mt-4">
                  {isArabic ? `آخر موعد قبل بدء التفعيل: ${activationDeadline}` : `Activation deadline: ${activationDeadline}`}
                </p>
              )}
              {activationDaysLeft !== null && (
                <p className="text-xs text-muted-foreground mt-2">
                  {isArabic
                    ? `يتبقى تقريبًا ${activationDaysLeft} يوم لإكمال الكورس وإعداد حساب الوسيط.`
                    : `You have about ${activationDaysLeft} days left to finish the course and broker setup.`}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/courses">
                <Button className="w-full" size="lg">
                  {isArabic ? 'تابع الكورس' : 'Continue Course'}
                </Button>
              </Link>
              <Link href="/broker-onboarding">
                <Button variant="outline" className="w-full" size="lg">
                  <Building2 className="h-4 w-4 mr-2" />
                  {isArabic ? 'ابدأ إعداد الوسيط' : 'Start Broker Setup'}
                </Button>
              </Link>
              <p className="text-center text-xs text-muted-foreground">
                {isArabic
                  ? `أكمل إعداد الوسيط مبكرًا لتحصل على أقصى استفادة من فترة الـ${entitlementDays} يومًا.`
                  : `Complete your broker setup early to maximize your ${entitlementDays}-day access window.`}
              </p>
              <Link href="/support">
                <Button variant="outline" className="w-full" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {isArabic ? 'تواصل مع الدعم' : 'Contact Support'}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
        </ClientLayout>
      );
    }

    // Broker onboarding not complete — student must open broker account first
    if (onboardingStatus && !onboardingStatus.complete) {
      return (
        <ClientLayout>
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--color-xf-cream)]">
          <Card className="w-full max-w-lg md:max-w-2xl mx-4">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">
                {language === 'ar' ? 'افتح حساب وسيط أولاً' : 'Open a Broker Account First'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {language === 'ar'
                  ? 'لاستخدام قروب التوصيات، يجب أولاً فتح حساب تداول حقيقي وإيداع مبلغ بسيط. أكمل خطوات التسجيل لدى الوسيط.'
                  : 'To access Recommendations, you need to open a real trading account and make a small deposit. Complete the broker onboarding steps.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Link href="/broker-onboarding">
                <Button className="w-full btn-primary-xf" size="lg">
                  <Building2 className="h-4 w-4 mr-2" />
                  {language === 'ar' ? 'ابدأ التسجيل' : 'Start Broker Onboarding'}
                </Button>
              </Link>
              <Link href="/support">
                <Button variant="outline" className="w-full" size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
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
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--color-xf-cream)]">
        <Card className="max-w-2xl w-full mx-4">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mb-4">
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
                <Bell className="h-5 w-5 text-emerald-600 mt-1" />
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
                <TrendingUp className="h-5 w-5 text-emerald-600 mt-1" />
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
                <Copy className="h-5 w-5 text-emerald-600 mt-1" />
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
    <div className="min-h-[calc(100vh-64px)] bg-[var(--color-xf-cream)]">
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
            <p className="text-sm">{t('rec.status')}: {t('rec.activated')}</p>
            <p className="text-sm">
              {t('rec.remainingDays')}: <span className="font-semibold">{remainingDays} {t('rec.daysSuffix')}</span>
            </p>
          </CardContent>
        </Card>

        {preparationAlerts.length > 0 && (
          <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-900/10 dark:text-emerald-100">
            <Megaphone className="h-4 w-4" />
            <AlertTitle>{language === 'ar' ? 'المحلل يجهز توصيات جديدة' : 'The analyst is preparing new recommendations'}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                {language === 'ar'
                  ? 'تم إرسال تنبيه قصير لأن المحلل على وشك العودة برسائل جديدة. افتح القناة بعد حوالي دقيقة وتابع الرسائل داخل نفس الدردشة.'
                  : 'A short alert was sent because the analyst is about to post again. Open the channel in about a minute and follow the next messages in this same chat.'}
              </p>
              <div className="space-y-2">
                {preparationAlerts.map((alert: any) => {
                  const unlockCountdown = formatCountdown(alert.unlockAt, now);
                  const expiryCountdown = formatCountdown(alert.expiresAt, now);
                  const unlockTime = alert.unlockAt ? new Date(alert.unlockAt).getTime() : 0;
                  const unlocked = unlockTime > 0 && unlockTime <= now;
                  return (
                    <div key={alert.id} className="rounded-lg border border-emerald-200 bg-white/80 p-3 text-sm dark:border-emerald-800/50 dark:bg-emerald-950/40">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="bg-emerald-600 text-white">{language === 'ar' ? 'جلسة نشطة' : 'Active session'}</Badge>
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Clock3 className="h-3.5 w-3.5" />
                          {unlocked
                            ? (language === 'ar' ? 'قد تبدأ الرسائل في أي لحظة' : 'Messages can start any moment now')
                            : (language === 'ar'
                                ? `تبدأ الرسائل خلال ${unlockCountdown ?? '0:00'}`
                                : `Messages begin in ${unlockCountdown ?? '0:00'}`)}
                        </span>
                        {expiryCountdown && (
                          <span className="text-xs text-muted-foreground">
                            {language === 'ar' ? `يسقط التنبيه خلال ${expiryCountdown} إذا لم يبدأ المحلل الإرسال` : `This alert drops in ${expiryCountdown} if the analyst does not start sending`}
                          </span>
                        )}
                      </div>
                      {alert.note && (
                        <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{alert.note}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {me?.canPublish && (
          <Card className="border-emerald-200 bg-emerald-50/70 dark:border-emerald-800/40 dark:bg-emerald-900/10">
            <CardHeader>
              <CardTitle>{language === 'ar' ? 'استخدم مساحة المحلل المخصصة' : 'Use the dedicated analyst workspace'}</CardTitle>
              <CardDescription>
                {language === 'ar'
                  ? 'لوحة المحلل أصبحت أقرب للدردشة: تنبيه بسيط عند العودة بعد صمت طويل، ثم توصية رئيسية يتبعها ردود قصيرة داخل نفس الصفقة.'
                  : 'The analyst workspace is now closer to a chat: one simple alert when coming back after a long silence, then a main recommendation followed by short replies in the same trade thread.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/admin/recommendations">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <ArrowUpRight className="h-4 w-4 me-1" />
                  {language === 'ar' ? 'افتح لوحة نشر التوصيات' : 'Open recommendation publisher'}
                </Button>
              </Link>
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
              ) : threadedFeed.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('rec.noMessages')}</p>
              ) : (
                threadedFeed.map(({ message, children }: any) => (
                  <div key={message.id} className="space-y-2">
                    <div className="rounded-lg border p-4 space-y-3 bg-white">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={getMessageTypeClass(message.type)}>
                            {getMessageTypeLabel(message.type, language === 'ar')}
                          </Badge>
                          {message.isAnalyst && <Badge>{t('rec.analyst')}</Badge>}
                          {message.symbol && <Badge className="bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300">{message.symbol}</Badge>}
                          {message.side && (
                            <Badge className={message.side === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                              {message.side}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {message.createdAt ? new Date(message.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}
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
                            variant={message.myReaction === reaction ? 'default' : 'outline'}
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

                    {children.length > 0 && (
                      <div className={`space-y-2 ${language === 'ar' ? 'border-r-2 border-amber-300 pr-4 mr-4' : 'border-l-2 border-amber-300 pl-4 ml-4'}`}>
                        {children.map((child: any) => (
                          <div key={child.id} className={`rounded-lg border p-3 space-y-2 ${child.type === 'result' ? 'bg-teal-50/50 border-teal-200 dark:bg-teal-900/10 dark:border-teal-800/30' : 'bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800/30'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={getMessageTypeClass(child.type)}>
                                  {getMessageTypeLabel(child.type, language === 'ar')}
                                </Badge>
                                <span className="text-xs text-muted-foreground">#{child.id}</span>
                              </div>
                              <div className="text-xs text-muted-foreground whitespace-nowrap">
                                {child.createdAt ? new Date(child.createdAt).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US') : '-'}
                              </div>
                            </div>

                            <p className="text-sm whitespace-pre-wrap">{child.content}</p>

                            <div className="flex items-center gap-2 flex-wrap">
                              <Button size="sm" variant="outline" onClick={() => copyMessage(child)}>
                                <Copy className="h-4 w-4 me-1" /> {t('rec.copy')}
                              </Button>
                              {(Object.keys(reactionIcons) as Array<keyof typeof reactionIcons>).map((reaction) => (
                                <Button
                                  key={reaction}
                                  size="sm"
                                  variant={child.myReaction === reaction ? 'default' : 'outline'}
                                  onClick={() => reactMutation.mutate({
                                    messageId: child.id,
                                    reaction: child.myReaction === reaction ? null : reaction,
                                  })}
                                >
                                  {reactionIcons[reaction]}
                                  <span className="ms-1">{child.reactions?.[reaction] ?? 0}</span>
                                </Button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
