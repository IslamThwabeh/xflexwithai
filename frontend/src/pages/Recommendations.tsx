import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPendingActivationDate, getPendingActivationDaysLeft, getPendingActivationWindow } from "@/lib/pendingActivation";
import { toast } from "sonner";
import { ArrowUpRight, Clock3, Copy, Flame, Heart, Rocket, ThumbsUp, Frown, Bell, BellOff, TrendingUp, BookOpen, MessageSquare, Building2, Megaphone } from "lucide-react";
import ClientLayout from "@/components/ClientLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { buildRecommendationThreads, groupRecommendationThreadsByDay } from "@/lib/recommendationThreads";
import { Link, useLocation } from "wouter";

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

function formatMessageTimestamp(value: unknown, language: string) {
  if (!value) return "-";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString(language === "ar" ? "ar-EG" : "en-US");
}

function getThreadContainerClass(paletteIndex: number) {
  return paletteIndex % 2 === 0
    ? "border-slate-200 bg-gradient-to-b from-white to-slate-50/80 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
    : "border-slate-300 bg-gradient-to-b from-slate-50 to-white shadow-[0_18px_42px_rgba(15,23,42,0.08)]";
}

function getThreadHeaderStripClass(paletteIndex: number) {
  return paletteIndex % 2 === 0
    ? "border-slate-200 bg-slate-50/95"
    : "border-slate-200 bg-white/95";
}

function getThreadRootPanelClass(paletteIndex: number) {
  return paletteIndex % 2 === 0
    ? "border-slate-200 bg-white/90"
    : "border-slate-200 bg-white/75";
}

function getThreadLaneClass(paletteIndex: number) {
  return paletteIndex % 2 === 0
    ? "border-slate-200"
    : "border-slate-300/90";
}

function getThreadChildPanelClass(type: string, paletteIndex: number) {
  if (type === "result") {
    return paletteIndex % 2 === 0
      ? "border-teal-200 bg-teal-50/85 dark:border-teal-800/40 dark:bg-teal-900/10"
      : "border-teal-200 bg-teal-100/65 dark:border-teal-800/40 dark:bg-teal-900/15";
  }

  return paletteIndex % 2 === 0
    ? "border-amber-200 bg-amber-50/85 dark:border-amber-800/40 dark:bg-amber-900/10"
    : "border-amber-200 bg-amber-100/65 dark:border-amber-800/40 dark:bg-amber-900/15";
}

function getThreadFollowUpLabel(count: number, isArabic: boolean) {
  if (isArabic) {
    return `${count} ${count === 1 ? "متابعة" : "متابعات"}`;
  }

  return `${count} ${count === 1 ? "follow-up" : "follow-ups"}`;
}

function parseThreadActionFromUrl() {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const threadAction = params.get("threadAction");
  const threadId = Number(params.get("threadId"));

  if (threadAction !== "unfollow" || !Number.isInteger(threadId) || threadId <= 0) {
    return null;
  }

  return { threadRootMessageId: threadId };
}

export default function Recommendations() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const utils = trpc.useUtils();
  const [location] = useLocation();
  const [now, setNow] = useState(() => Date.now());
  const [pendingThreadAction, setPendingThreadAction] = useState(() => parseThreadActionFromUrl());

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
  const muteThreadMutation = trpc.recommendations.muteThread.useMutation({
    onSuccess: (result) => {
      toast.success(result.alreadyMuted ? t('rec.toastThreadAlreadyMuted') : t('rec.toastThreadMuted'));
      setPendingThreadAction(null);
      void utils.recommendations.feed.invalidate();
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        params.delete('threadAction');
        params.delete('threadId');
        const nextSearch = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
      }
    },
    onError: () => toast.error(t('rec.toastThreadActionFailed')),
  });
  const unmuteThreadMutation = trpc.recommendations.unmuteThread.useMutation({
    onSuccess: () => {
      toast.success(t('rec.toastThreadUnmuted'));
      void utils.recommendations.feed.invalidate();
    },
    onError: () => toast.error(t('rec.toastThreadActionFailed')),
  });

  const canRead = !!me && (me.hasSubscription || me.canPublish);
  const canManageThreadNotifications = !!me?.hasSubscription;
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

  const threads = useMemo(() => buildRecommendationThreads(feed), [feed]);
  const threadGroups = useMemo(() => groupRecommendationThreadsByDay(threads, language), [threads, language]);
  const pendingThreadAlreadyMuted = !!pendingThreadAction && threads.some(
    (thread) => thread.root.id === pendingThreadAction.threadRootMessageId && !!thread.root.isThreadMuted,
  );

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

  useEffect(() => {
    setPendingThreadAction(parseThreadActionFromUrl());
  }, [location]);

  const copyMessage = (message: any) => {
    const text = buildCopyBlock(message, t);
    navigator.clipboard.writeText(text);
    toast.success(t('rec.toastCopied'));
  };

  const clearPendingThreadAction = () => {
    setPendingThreadAction(null);
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.delete('threadAction');
    params.delete('threadId');
    const nextSearch = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
  };

  const handleThreadMuteToggle = (threadRootMessageId: number, isThreadMuted: boolean) => {
    if (isThreadMuted) {
      unmuteThreadMutation.mutate({ threadRootMessageId });
      return;
    }

    muteThreadMutation.mutate({ threadRootMessageId });
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
      <div className="container mx-auto px-3 py-6 space-y-6 sm:px-4 sm:py-8">
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

        {canManageThreadNotifications && pendingThreadAction && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-100">
            <BellOff className="h-4 w-4" />
            <AlertTitle>{t('rec.threadMuteConfirmTitle')}</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                {pendingThreadAlreadyMuted ? t('rec.threadAlreadyMutedHint') : t('rec.threadMuteConfirmDesc')}
              </p>
              <div className="flex flex-wrap gap-2">
                {!pendingThreadAlreadyMuted && (
                  <Button
                    size="sm"
                    className="bg-amber-600 text-white hover:bg-amber-700"
                    disabled={muteThreadMutation.isPending}
                    onClick={() => muteThreadMutation.mutate({ threadRootMessageId: pendingThreadAction.threadRootMessageId })}
                  >
                    <BellOff className="h-4 w-4 me-1" />
                    {t('rec.threadMuteConfirmBtn')}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={clearPendingThreadAction}>
                  {t('rec.threadMuteCancel')}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

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
                        <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap break-words">{alert.note}</p>
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
              ) : threadGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('rec.noMessages')}</p>
              ) : (
                <div className="space-y-5">
                  {threadGroups.map((group) => (
                    <section key={group.key} className="space-y-3">
                      <div className="px-1">
                        <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase dark:text-slate-400">
                          {group.label}
                        </p>
                      </div>

                      <div className="space-y-4 sm:space-y-5">
                        {group.threads.map((thread) => {
                          const message = thread.root;
                          const children = thread.children;

                          return (
                            <div key={message.id} className={`rounded-[28px] border p-3 space-y-4 sm:p-4 lg:p-5 ${getThreadContainerClass(thread.paletteIndex)}`}>
                              <div className={`rounded-2xl border px-4 py-3 sm:px-5 sm:py-4 ${getThreadHeaderStripClass(thread.paletteIndex)}`}>
                                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                                  <div className="min-w-0 space-y-2">
                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        {language === 'ar' ? 'خيط الصفقة' : 'Trade Thread'}
                                      </span>
                                      {message.symbol && <Badge className="bg-white text-slate-700 dark:bg-white/10 dark:text-slate-200">{message.symbol}</Badge>}
                                      {message.side && (
                                        <Badge className={message.side === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                                          {message.side}
                                        </Badge>
                                      )}
                                      {children.length > 0 && (
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300">
                                          {getThreadFollowUpLabel(children.length, language === 'ar')}
                                        </Badge>
                                      )}
                                      {message.isThreadMuted && canManageThreadNotifications && (
                                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                          {t('rec.threadMutedBadge')}
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 sm:text-xs">
                                      <span className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 dark:border-white/10 dark:bg-white/10">
                                        {language === 'ar' ? 'بدأت' : 'Started'} {formatMessageTimestamp(message.createdAt, language)}
                                      </span>
                                      {children.length > 0 && thread.latestActivityAt !== message.createdAt && (
                                        <span className="rounded-full border border-white/80 bg-white/90 px-2.5 py-1 dark:border-white/10 dark:bg-white/10">
                                          {language === 'ar' ? 'آخر تحديث' : 'Last update'} {formatMessageTimestamp(thread.latestActivityAt, language)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {canManageThreadNotifications && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className={`w-full sm:w-auto ${message.isThreadMuted
                                        ? 'border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200'
                                        : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200'}`}
                                      disabled={muteThreadMutation.isPending || unmuteThreadMutation.isPending}
                                      onClick={() => handleThreadMuteToggle(message.rootThreadId ?? message.id, !!message.isThreadMuted)}
                                    >
                                      {message.isThreadMuted ? <Bell className="h-4 w-4 me-1" /> : <BellOff className="h-4 w-4 me-1" />}
                                      {message.isThreadMuted ? t('rec.threadUnmute') : t('rec.threadMute')}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              <div className={`rounded-2xl border p-4 space-y-3 sm:p-5 ${getThreadRootPanelClass(thread.paletteIndex)}`}>
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="space-y-2">
                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                      <Badge variant="outline" className={getMessageTypeClass(message.type)}>
                                        {getMessageTypeLabel(message.type, language === 'ar')}
                                      </Badge>
                                    </div>
                                  </div>

                                  <div className="text-[11px] text-muted-foreground sm:text-xs lg:text-right">
                                    {formatMessageTimestamp(message.createdAt, language)}
                                  </div>
                                </div>

                                {(message.entryPrice || message.stopLoss || message.takeProfit1 || message.takeProfit2 || message.riskPercent) && (
                                  <div className="grid grid-cols-1 gap-2 rounded-xl border bg-muted/60 p-3 text-xs sm:grid-cols-2 sm:text-sm">
                                    {message.entryPrice && <div><span className="text-muted-foreground">{language === 'ar' ? 'دخول:' : 'Entry:'}</span> <span className="font-mono font-medium">{message.entryPrice}</span></div>}
                                    {message.stopLoss && <div><span className="text-muted-foreground">{language === 'ar' ? 'وقف:' : 'SL:'}</span> <span className="font-mono font-medium text-red-600">{message.stopLoss}</span></div>}
                                    {message.takeProfit1 && <div><span className="text-muted-foreground">{language === 'ar' ? 'هدف 1:' : 'TP1:'}</span> <span className="font-mono font-medium text-emerald-600">{message.takeProfit1}</span></div>}
                                    {message.takeProfit2 && <div><span className="text-muted-foreground">{language === 'ar' ? 'هدف 2:' : 'TP2:'}</span> <span className="font-mono font-medium text-emerald-600">{message.takeProfit2}</span></div>}
                                    {message.riskPercent && <div><span className="text-muted-foreground">{language === 'ar' ? 'مخاطرة:' : 'Risk:'}</span> <span className="font-mono font-medium">{message.riskPercent}</span></div>}
                                  </div>
                                )}

                                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

                                {message.isThreadMuted && canManageThreadNotifications && (
                                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-900 dark:border-amber-800/40 dark:bg-amber-900/10 dark:text-amber-100">
                                    {t('rec.threadMutedHint')}
                                  </p>
                                )}

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
                                <div className="space-y-3">
                                  <div className={`rounded-xl border border-dashed px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:text-slate-300 sm:text-xs ${getThreadHeaderStripClass(thread.paletteIndex)}`}>
                                    {language === 'ar'
                                      ? `مسار المتابعات ${getThreadFollowUpLabel(children.length, true)}`
                                      : `Follow-up lane ${getThreadFollowUpLabel(children.length, false)}`}
                                  </div>

                                  <div className={`space-y-3 border-s-2 ps-4 sm:ps-5 ${getThreadLaneClass(thread.paletteIndex)}`}>
                                    {children.map((child: any) => (
                                      <div key={child.id} className={`rounded-xl border p-3 space-y-2 ${getThreadChildPanelClass(child.type, thread.paletteIndex)}`}>
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                            <Badge variant="outline" className={getMessageTypeClass(child.type)}>
                                              {getMessageTypeLabel(child.type, language === 'ar')}
                                            </Badge>
                                          </div>
                                          <div className="text-[11px] text-muted-foreground sm:text-xs sm:whitespace-nowrap">
                                            {formatMessageTimestamp(child.createdAt, language)}
                                          </div>
                                        </div>

                                        <p className="text-sm whitespace-pre-wrap break-words">{child.content}</p>

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
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </ClientLayout>
  );
}
