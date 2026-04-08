import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileUpload } from "@/components/FileUpload";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatPendingActivationDate, getPendingActivationDaysLeft, getPendingActivationWindow } from "@/lib/pendingActivation";
import { trpc } from "@/lib/trpc";
import { Sparkles, Crown, CheckCircle2, ImageIcon, Trash2, BookOpen, MessageSquare, Building2 } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { format } from "date-fns";
import ClientLayout from "@/components/ClientLayout";

export default function LexAI() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const isArabic = language === 'ar';
  const utils = trpc.useUtils();

  const copy = {
    loading: isArabic ? "جاري التحميل..." : "Loading...",
    signInRequired: isArabic ? "تسجيل الدخول مطلوب" : "Sign In Required",
    signInToAccess: isArabic ? "يرجى تسجيل الدخول للوصول إلى LexAI" : "Please sign in to access LexAI",
    goHome: isArabic ? "العودة للرئيسية" : "Go to Home",
    title: isArabic ? "تحليل العملات LexAI" : "LexAI Currency Analysis",
    subscribeDesc: isArabic
      ? "احصل على تحليل وتوصيات تداول مدعومة بالذكاء الاصطناعي"
      : "Get AI-powered analysis and recommendations for your trading charts",
    featurePro: isArabic ? "تحليل احترافي" : "Professional Analysis",
    featureProDesc: isArabic
      ? "اكتشاف متقدم للأنماط وتحليل الاتجاه"
      : "Advanced chart pattern recognition and trend analysis",
    featureRealtime: isArabic ? "توصيات فورية" : "Real-time Recommendations",
    featureRealtimeDesc: isArabic
      ? "احصل على إشارات تداول ونقاط دخول/خروج واضحة"
      : "Get actionable trading signals and entry/exit points",
    featureUpload: isArabic ? "دعم رفع الشارت" : "Chart Upload Support",
    featureUploadDesc: isArabic
      ? "ارفع شارت التداول للحصول على تحليل مفصل"
      : "Upload your trading charts for detailed analysis",
    analysesPerMonth: isArabic ? "100 تحليل شهريًا" : "100 analyses per month",
    enterKey: isArabic ? "أدخل مفتاح LexAI" : "Enter LexAI key",
    activating: isArabic ? "جاري التفعيل..." : "Activating...",
    activateKey: isArabic ? "تفعيل المفتاح" : "Activate Key",
    noCommitment: isArabic ? "إلغاء الاشتراك في أي وقت. بدون التزام." : "Cancel anytime. No commitment required.",
    adminPreview: isArabic ? "وضع معاينة المسؤول" : "Admin preview mode",
    analysesRemaining: isArabic ? "تحليل متبقٍ هذا الشهر" : "analyses remaining this month",
    backHome: isArabic ? "العودة للرئيسية" : "Back to Home",
    monthlyUsage: isArabic ? "الاستخدام الشهري" : "Monthly Usage",
    remainingDays: isArabic ? "الأيام المتبقية من صلاحية المفتاح" : "Remaining Key Validity Days",
    daysSuffix: isArabic ? "يوم" : "days",
    chatTitle: isArabic ? "الدردشة مع LexAI" : "Chat with LexAI",
    chatDesc: isArabic ? "ارفع شارت أو اكتب طلب التحليل" : "Upload a chart or describe your analysis needs",
    loadingMessages: isArabic ? "جاري تحميل الرسائل..." : "Loading messages...",
    startAnalysis: isArabic ? "ابدأ التحليل" : "Start Your Analysis",
    startAnalysisDesc: isArabic
      ? "ارفع شارت تداول أو اطرح سؤالًا للبدء بالتحليل الذكي"
      : "Upload a trading chart or ask a question to get started with AI-powered analysis",
    monthlyLimitReached: isArabic ? "تم الوصول للحد الشهري" : "Monthly limit reached",
    renewOn: isArabic ? "سيتم التجديد في" : "Your subscription will renew on",
    m15Analysis: isArabic ? "تحليل M15" : "M15 Analysis",
    h4Analysis: isArabic ? "تحليل H4" : "H4 Analysis",
    singleImage: isArabic ? "صورة واحدة" : "Single Image",
    feedbackOnly: isArabic ? "مراجعة فقط" : "Feedback Only",
    feedbackImage: isArabic ? "مراجعة + صورة" : "Feedback + Image",
    timeframe: isArabic ? "الإطار الزمني" : "Timeframe",
    uploadChartImage: isArabic ? "رفع صورة الشارت" : "Upload Chart Image",
    yourAnalysis: isArabic ? "تحليلك" : "Your Analysis",
    analysisPlaceholder: isArabic ? "اكتب تحليلك الفني هنا..." : "Write your technical analysis here...",
    h4Hint: isArabic ? "أكمل تحليل M15 قبل طلب H4." : "Complete an M15 analysis before requesting H4.",
    cappedNotice: isArabic ? "الردود محدودة بـ 1024 حرفًا." : "Responses are capped at 1024 characters.",
    analyzing: isArabic ? "جاري التحليل..." : "Analyzing...",
    runAnalysis: isArabic ? "تشغيل التحليل" : "Run Analysis",
    errUploadImageFirst: isArabic ? "يرجى رفع صورة أولاً" : "Please upload an image first",
    errEnterAnalysis: isArabic ? "يرجى إدخال التحليل" : "Please enter your analysis",
    errRequestFailed: isArabic ? "فشل الطلب" : "Request failed",
    errEnterKey: isArabic ? "يرجى إدخال المفتاح" : "Please enter a key",
    keyActivated: isArabic ? "تم تفعيل مفتاح LexAI" : "LexAI key activated",
    keyActivationFailed: isArabic ? "فشل تفعيل المفتاح" : "Key activation failed",
    keyRequired: isArabic ? "LexAI يتطلب مفتاح تسجيل مفعّل" : "LexAI requires an activated registration key",
    alreadyHaveKeyTitle: isArabic ? "لدي مفتاح مسجل مسبقًا" : "I already have an assigned key",
    emailForAssignedKey: isArabic ? "أدخل البريد الإلكتروني المرتبط بالمفتاح" : "Enter the email assigned to your key",
    verifyEmailKey: isArabic ? "التحقق بالبريد الإلكتروني" : "Verify by Email",
    verifying: isArabic ? "جاري التحقق..." : "Verifying...",
    assignedKeyVerified: isArabic ? "تم التحقق من المفتاح المرتبط بالبريد بنجاح" : "Assigned key verified successfully",
    deleteHistory: isArabic ? "حذف سجل المحادثة" : "Delete Chat History",
    deleteHistoryDone: isArabic ? "تم حذف سجل المحادثة" : "Chat history deleted",
    deleteHistoryConfirmTitle: isArabic ? "تأكيد حذف سجل المحادثة" : "Confirm Chat History Deletion",
    deleteHistoryConfirmDesc: isArabic ? "سيتم حذف جميع الرسائل القديمة نهائيًا. هل تريد المتابعة؟" : "This will permanently delete all old messages. Continue?",
    confirmDelete: isArabic ? "نعم، احذف" : "Yes, delete",
    cancelDelete: isArabic ? "إلغاء" : "Cancel",
    flowGreeting: isArabic ? "اهلا بك، تفضل بالاختيار مما يلي:" : "Welcome, please choose one option:",
    flowSpecialized: isArabic ? "تحليل تشارت متخصص" : "Specialized Chart Analysis",
    flowSingle: isArabic ? "تحليل فريم واحد (اي فريم)" : "Single Timeframe Analysis",
    flowWithFeedback: isArabic ? "فريم مع تحليلي الشخصي" : "Frame + My Analysis",
    flowRestart: isArabic ? "ابدأ من جديد" : "Start Over",
    chooseOptionFirst: isArabic ? "يرجى اختيار نوع التحليل أولاً" : "Please choose an analysis option first",
    uploadM15First: isArabic
      ? "📊 لتحليل متخصص، الرجاء إرسال صورة الشارت للإطار 15 دقيقة أولاً"
      : "For specialized analysis, upload M15 chart first",
    uploadH4Second: isArabic
      ? "✅ تم تحليل الإطار 15 دقيقة. الرجاء إرسال صورة الإطار 4 ساعات لنفس زوج العملات للتحليل المتكامل."
      : "M15 completed. Please upload H4 chart for full analysis.",
    uploadH4Label: isArabic ? "رفع صورة شارت H4" : "Upload H4 Chart Image",
    m15Done: isArabic ? "تم تحليل M15 بنجاح" : "M15 analyzed successfully",
    flowDoneBackMenu: isArabic
      ? "✅ تم التحليل بنجاح. يمكنك اختيار عملية جديدة من القائمة."
      : "Analysis completed. You can start a new flow from the menu.",
    restartDone: isArabic ? "تمت إعادة ضبط الجلسة" : "Session reset",
    runM15: isArabic ? "تحليل M15" : "Analyze M15",
    runH4: isArabic ? "تحليل H4" : "Analyze H4",
    cancelFlow: isArabic ? "إلغاء" : "Cancel",
  };

  const { data: subscription, isLoading: subLoading } = trpc.lexai.getSubscription.useQuery();
  const { data: messages, isLoading: messagesLoading } = trpc.lexai.getMessages.useQuery();
  const { data: adminCheck, isLoading: adminLoading } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: activationStatus } = trpc.subscriptions.activationStatus.useQuery(undefined, {
    enabled: !!user,
  });
  const { data: onboardingStatus } = trpc.onboarding.isComplete.useQuery(undefined, {
    enabled: !!user,
  });
  const { studyPeriodDays, entitlementDays } = getPendingActivationWindow(activationStatus);
  const activationDeadline = formatPendingActivationDate(activationStatus?.maxActivationDate, isArabic);
  const activationDaysLeft = getPendingActivationDaysLeft(activationStatus?.maxActivationDate);

  const uploadImage = trpc.lexai.uploadImage.useMutation();
  const analyzeM15 = trpc.lexai.analyzeM15.useMutation();
  const analyzeH4 = trpc.lexai.analyzeH4.useMutation();
  const analyzeSingle = trpc.lexai.analyzeSingle.useMutation();
  const analyzeFeedback = trpc.lexai.analyzeFeedback.useMutation();
  const analyzeFeedbackWithImage = trpc.lexai.analyzeFeedbackWithImage.useMutation();
  const clearHistory = trpc.lexai.clearHistory.useMutation();

  const [guidedFlow, setGuidedFlow] = useState<
    "menu" | "specialized_m15" | "specialized_h4" | "single" | "feedback_image"
  >("menu");
  const [imageUrl, setImageUrl] = useState("");
  const [h4ImageUrl, setH4ImageUrl] = useState("");
  const [timeframe, setTimeframe] = useState("M15");
  const [userAnalysis, setUserAnalysis] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages load or change
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    };
    // Scroll immediately and after a short delay to ensure DOM is rendered
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, messagesLoading]);

  const sortedMessages = useMemo(() => {
    return (messages ?? []).slice().sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [messages]);

  const isAdmin = !!adminCheck?.isAdmin;
  const isFrozenSub = !!(subscription && 'isFrozen' in subscription && subscription.isFrozen);
  const activeSubscription = subscription && !('isFrozen' in subscription) ? subscription : null;
  const hasActiveSubscription = !!activeSubscription?.isActive;

  const isBusy =
    uploadImage.isPending ||
    analyzeM15.isPending ||
    analyzeH4.isPending ||
    analyzeSingle.isPending ||
    analyzeFeedback.isPending ||
    analyzeFeedbackWithImage.isPending ||
    clearHistory.isPending;

  const isArabicText = (value: string) => /[\u0600-\u06FF]/.test(value);

  const remainingDays = useMemo(() => {
    if (!activeSubscription) return 0;
    if (Number(activeSubscription.messagesUsed ?? 0) === 0) return 30;
    const end = new Date(activeSubscription.endDate ?? "");
    if (Number.isNaN(end.getTime())) return 0;
    const diff = end.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [activeSubscription]);

  const formatMessageDate = (value: string | number | Date | null | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return format(date, "MMM d, h:mm a");
  };

  useEffect(() => {
    if (!hasActiveSubscription) return;
    const timer = setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" });
    }, 150);
    return () => clearTimeout(timer);
  }, [hasActiveSubscription, messagesLoading]);

  const handleUpload = async (file: File) => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result?.toString() ?? "";
        const parts = result.split(",");
        resolve(parts.length > 1 ? parts[1] : result);
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });

    const result = await uploadImage.mutateAsync({
      fileName: file.name,
      fileData: base64,
      contentType: file.type || "image/jpeg",
    });

    return result.url;
  };

  const resetInputs = () => {
    setImageUrl("");
    setH4ImageUrl("");
    setUserAnalysis("");
  };

  const restartFlow = () => {
    if (!hasActiveSubscription) {
      toast.error(copy.keyRequired);
      return;
    }

    resetInputs();
    setGuidedFlow("menu");
    toast.success(copy.restartDone);
  };

  const handleAnalyze = async () => {
    try {
      if (guidedFlow === "menu") {
        toast.error(copy.chooseOptionFirst);
        return;
      }

      if ((guidedFlow === "specialized_m15" || guidedFlow === "single" || guidedFlow === "feedback_image") && !imageUrl) {
        toast.error(copy.errUploadImageFirst);
        return;
      }

      if (guidedFlow === "specialized_h4" && !h4ImageUrl) {
        toast.error(copy.errUploadImageFirst);
        return;
      }

      if (guidedFlow === "feedback_image" && userAnalysis.trim().length < 5) {
        toast.error(copy.errEnterAnalysis);
        return;
      }

      if (guidedFlow === "specialized_m15") {
        await analyzeM15.mutateAsync({ imageUrl, language });
        await utils.lexai.getMessages.invalidate();
        await utils.lexai.getSubscription.invalidate();
        setImageUrl("");
        setGuidedFlow("specialized_h4");
        toast.success(copy.uploadH4Second);
        return;
      }

      if (guidedFlow === "specialized_h4") {
        await analyzeH4.mutateAsync({ imageUrl: h4ImageUrl, language });
      } else if (guidedFlow === "single") {
        await analyzeSingle.mutateAsync({ imageUrl, language, timeframe });
      } else {
        await analyzeFeedbackWithImage.mutateAsync({ userAnalysis, imageUrl, language });
      }

      await utils.lexai.getMessages.invalidate();
      await utils.lexai.getSubscription.invalidate();
      resetInputs();
      setGuidedFlow("menu");
      toast.success(copy.flowDoneBackMenu);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.errRequestFailed);
    }
  };

  const handleClearHistory = async () => {
    try {
      await clearHistory.mutateAsync();
      await utils.lexai.getMessages.invalidate();
      toast.success(copy.deleteHistoryDone);
      resetInputs();
      setGuidedFlow("menu");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.errRequestFailed);
    }
  };

  if (authLoading || subLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{copy.loading}</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-xf-cream)]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>{copy.signInRequired}</CardTitle>
            <CardDescription>{copy.signInToAccess}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">{copy.goHome}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasActiveSubscription) {
    // Frozen subscription — show specific frozen message
    if (isFrozenSub) {
      const frozenUntil = (subscription as any)?.frozenUntil;
      const frozenDate = frozenUntil ? new Date(frozenUntil).toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US') : null;
      return (
        <ClientLayout>
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--color-xf-cream)]">
          <Card className="max-w-lg mx-4">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">
                {language === 'ar' ? 'اشتراك LexAI مُجمّد مؤقتاً' : 'LexAI Subscription Frozen'}
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
                {isArabic ? 'فترة تعلم LexAI ما زالت فعالة' : 'Your LexAI Learning Window Is Active'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {isArabic
                  ? `لديك حتى ${studyPeriodDays} يومًا لإكمال الكورس وإعداد حساب الوسيط. وبعد التفعيل ستبقى خدمة LexAI متاحة لمدة ${entitlementDays} يومًا ضمن فترة اشتراكك.`
                  : `You have up to ${studyPeriodDays} days to finish the course and broker setup. After activation, LexAI stays available for ${entitlementDays} days during your subscription period.`}
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
                {isArabic ? 'افتح حساب وسيط أولاً' : 'Open a Broker Account First'}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {isArabic
                  ? 'لاستخدام LexAI، يجب أولاً فتح حساب تداول حقيقي وإيداع مبلغ بسيط. أكمل خطوات التسجيل لدى الوسيط.'
                  : 'To use LexAI, you need to open a real trading account and make a small deposit. Complete the broker onboarding steps.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Link href="/broker-onboarding">
                <Button className="w-full btn-primary-xf" size="lg">
                  <Building2 className="h-4 w-4 mr-2" />
                  {isArabic ? 'ابدأ التسجيل' : 'Start Broker Onboarding'}
                </Button>
              </Link>
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

    // No subscription — show standard paywall
    return (
      <ClientLayout>
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-[var(--color-xf-cream)]">
        <Card className="max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-3xl">{copy.title}</CardTitle>
            <CardDescription className="text-lg">
              {copy.subscribeDesc}
            </CardDescription>
            <p className="text-sm text-amber-700 mt-2">{copy.keyRequired}</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <Crown className="h-5 w-5 text-emerald-600 mt-1" />
                <div>
                  <h4 className="font-semibold">{copy.featurePro}</h4>
                  <p className="text-sm text-muted-foreground">
                    {copy.featureProDesc}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-emerald-600 mt-1" />
                <div>
                  <h4 className="font-semibold">{copy.featureRealtime}</h4>
                  <p className="text-sm text-muted-foreground">
                    {copy.featureRealtimeDesc}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ImageIcon className="h-5 w-5 text-emerald-600 mt-1" />
                <div>
                  <h4 className="font-semibold">{copy.featureUpload}</h4>
                  <p className="text-sm text-muted-foreground">
                    {copy.featureUploadDesc}
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
    <div className="min-h-[calc(100vh-64px)] md:min-h-0 bg-[var(--color-xf-cream)] flex flex-col">
      {/* Sub-header with title and stats */}
      <div className="container max-w-5xl py-2 md:py-4 px-2 md:px-0 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl md:rounded-2xl flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5 md:h-6 md:w-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-bold tracking-tight">{copy.title}</h1>
              <p className="text-xs text-muted-foreground hidden md:block">
                {copy.chatDesc}
              </p>
              <p className="text-xs text-muted-foreground md:hidden">
                {remainingDays} {copy.daysSuffix}
              </p>
            </div>
          </div>
        </div>

        {/* Remaining days - desktop only */}
        <div className="mt-2 text-sm text-right text-muted-foreground hidden md:block">
          <span>{copy.remainingDays}: </span>
          <span className="font-semibold text-slate-900">{remainingDays} {copy.daysSuffix}</span>
        </div>
      </div>

      {/* Chat Interface - fills remaining space on mobile */}
      <Card className="flex flex-col flex-1 md:flex-none md:h-[680px] max-w-3xl w-full mx-auto shadow-lg md:rounded-3xl rounded-t-3xl rounded-b-none md:rounded-b-3xl overflow-hidden md:mb-6">
          <CardHeader className="border-b">
            <CardTitle className="text-lg">{copy.chatTitle}</CardTitle>
            <CardDescription>
              {copy.chatDesc}
            </CardDescription>
          </CardHeader>

          {/* Messages */}
          <div
            className="flex-1 p-3 md:p-4 overflow-y-auto bg-slate-50/70 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(20,184,166,0.10),_transparent_55%)]"
            ref={scrollRef}
          >
            {messagesLoading ? (
              <p className="text-center text-muted-foreground">{copy.loadingMessages}</p>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {/* Welcome message when no history */}
                {(!messages || messages.length === 0) && (
                  <div className="flex justify-center py-6">
                    <div className="text-center max-w-md">
                      <Sparkles className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                      <h3 className="text-base font-semibold mb-1">{copy.startAnalysis}</h3>
                      <p className="text-sm text-muted-foreground">
                        {copy.startAnalysisDesc}
                      </p>
                    </div>
                  </div>
                )}

                {/* Chat messages */}
                {sortedMessages.map((message) => {
                  const rtl = isArabicText(message.content);
                  return (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[82%] rounded-2xl px-3 py-2.5 md:px-4 md:py-3 shadow ${
                          message.role === "user"
                            ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                            : "bg-white border border-slate-200"
                        }`}
                      >
                        {message.imageUrl && (
                          <div className="mb-2">
                            <img
                              src={message.imageUrl}
                              alt="Chart"
                              className="rounded-lg max-w-[120px] max-h-[90px] object-cover bg-black/5 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => {
                                if (message.imageUrl) window.open(message.imageUrl, '_blank');
                              }}
                            />
                          </div>
                        )}
                        <div
                          dir={rtl ? "rtl" : "ltr"}
                          className={`whitespace-pre-wrap leading-relaxed text-[0.9rem] md:text-[0.95rem] ${
                            rtl ? "text-right" : "text-left"
                          }`}
                        >
                          {message.content}
                        </div>
                        <p
                          className={`text-xs mt-2 ${
                            message.role === "user" ? "text-emerald-100" : "text-muted-foreground"
                          }`}
                        >
                          {formatMessageDate(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* Flow selection bubble - always visible at bottom of chat */}
                <div className="flex justify-center pt-2">
                  <div className="w-full max-w-[95%] md:max-w-[80%] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur px-3 py-3 md:px-4 md:py-3 shadow-sm" dir="rtl">
                    <p className="text-xs md:text-sm text-muted-foreground text-right mb-2">
                      {copy.flowGreeting}
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="w-full justify-center"
                        variant={guidedFlow === "specialized_m15" || guidedFlow === "specialized_h4" ? "default" : "outline"}
                        onClick={() => {
                          resetInputs();
                          setGuidedFlow("specialized_m15");
                        }}
                      >
                        {copy.flowSpecialized}
                      </Button>
                      <Button
                        size="sm"
                        className="w-full justify-center"
                        variant={guidedFlow === "single" ? "default" : "outline"}
                        onClick={() => {
                          resetInputs();
                          setGuidedFlow("single");
                        }}
                      >
                        {copy.flowSingle}
                      </Button>
                      <Button
                        size="sm"
                        className="w-full justify-center"
                        variant={guidedFlow === "feedback_image" ? "default" : "outline"}
                        onClick={() => {
                          resetInputs();
                          setGuidedFlow("feedback_image");
                        }}
                      >
                        {copy.flowWithFeedback}
                      </Button>
                      <Button
                        size="sm"
                        className="w-full justify-center"
                        variant="outline"
                        onClick={restartFlow}
                      >
                        {copy.flowRestart}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom input area - only show when a flow is selected */}
          {guidedFlow !== "menu" && (
          <div className="border-t bg-white shrink-0">
            <div className="p-3 space-y-3 max-h-[40vh] overflow-y-auto" dir="rtl">
              {guidedFlow === "specialized_m15" && <div className="text-xs text-muted-foreground text-right">{copy.uploadM15First}</div>}
              {guidedFlow === "specialized_h4" && <div className="text-xs text-muted-foreground text-right">{copy.uploadH4Second}</div>}

              {guidedFlow === "single" && (
                <div className="flex items-center gap-2 justify-end">
                  <Input value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="max-w-[100px] h-8 text-sm" placeholder="M15" />
                  <span className="text-xs text-muted-foreground">{copy.timeframe}</span>
                </div>
              )}

              {(guidedFlow === "specialized_m15" || guidedFlow === "single" || guidedFlow === "feedback_image") && (
                <FileUpload accept="image/*" maxSize={5} label={copy.uploadChartImage} preview="image" currentUrl={imageUrl} onUrlChange={setImageUrl} onUpload={handleUpload} />
              )}

              {guidedFlow === "specialized_h4" && (
                <FileUpload accept="image/*" maxSize={5} label={copy.uploadH4Label} preview="image" currentUrl={h4ImageUrl} onUrlChange={setH4ImageUrl} onUpload={handleUpload} />
              )}

              {guidedFlow === "feedback_image" && (
                <div className="space-y-1">
                  <label className="text-xs font-medium block text-right">{copy.yourAnalysis}</label>
                  <Textarea value={userAnalysis} onChange={(e) => setUserAnalysis(e.target.value)} rows={3} placeholder={copy.analysisPlaceholder} className="text-right text-sm" dir="rtl" />
                </div>
              )}
            </div>

            {/* Action buttons - always visible at bottom */}
            <div className="p-3 pt-0 flex items-center justify-between gap-2 border-t bg-slate-50/80">
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                <span className="hidden md:inline">{copy.cappedNotice}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { resetInputs(); setGuidedFlow("menu"); }}>
                  {copy.cancelFlow}
                </Button>
                <Button size="sm" onClick={handleAnalyze} disabled={isBusy}>
                  {isBusy ? copy.analyzing : guidedFlow === "specialized_m15" ? copy.runM15 : guidedFlow === "specialized_h4" ? copy.runH4 : copy.runAnalysis}
                </Button>
              </div>
            </div>
          </div>
          )}

          {/* Minimal footer when in menu state */}
          {guidedFlow === "menu" && (
          <div className="border-t bg-slate-50/80 p-3 flex items-center justify-between">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span className="hidden md:inline">{copy.cappedNotice}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} disabled={clearHistory.isPending || !!messagesLoading}>
              <Trash2 className="h-4 w-4" />
              <span className="hidden md:inline ml-1">{copy.deleteHistory}</span>
            </Button>
          </div>
          )}

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent dir="rtl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-right">{copy.deleteHistoryConfirmTitle}</AlertDialogTitle>
                <AlertDialogDescription className="text-right">{copy.deleteHistoryConfirmDesc}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{copy.cancelDelete}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearHistory}
                  disabled={clearHistory.isPending}
                >
                  {copy.confirmDelete}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

        </Card>
    </div>
    </ClientLayout>
  );
}
