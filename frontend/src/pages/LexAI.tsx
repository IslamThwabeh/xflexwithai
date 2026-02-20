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
import { trpc } from "@/lib/trpc";
import { Sparkles, AlertCircle, Crown, CheckCircle2, ImageIcon, Trash2 } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { format } from "date-fns";

export default function LexAI() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const isArabic = true;
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
  };

  const { data: subscription, isLoading: subLoading } = trpc.lexai.getSubscription.useQuery();
  const { data: messages, isLoading: messagesLoading } = trpc.lexai.getMessages.useQuery();
  const { data: adminCheck, isLoading: adminLoading } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: !!user,
  });

  const uploadImage = trpc.lexai.uploadImage.useMutation();
  const analyzeM15 = trpc.lexai.analyzeM15.useMutation();
  const analyzeH4 = trpc.lexai.analyzeH4.useMutation();
  const analyzeSingle = trpc.lexai.analyzeSingle.useMutation();
  const analyzeFeedback = trpc.lexai.analyzeFeedback.useMutation();
  const analyzeFeedbackWithImage = trpc.lexai.analyzeFeedbackWithImage.useMutation();
  const redeemKey = trpc.lexai.redeemKey.useMutation();
  const verifyAssignedKeyByEmail = trpc.lexai.verifyAssignedKeyByEmail.useMutation();
  const clearHistory = trpc.lexai.clearHistory.useMutation();

  const [guidedFlow, setGuidedFlow] = useState<
    "menu" | "specialized_m15" | "specialized_h4" | "single" | "feedback_image"
  >("menu");
  const [imageUrl, setImageUrl] = useState("");
  const [h4ImageUrl, setH4ImageUrl] = useState("");
  const [timeframe, setTimeframe] = useState("M15");
  const [userAnalysis, setUserAnalysis] = useState("");
  const [activationKey, setActivationKey] = useState("");
  const [assignedEmail, setAssignedEmail] = useState(user?.email ?? "");
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
  const hasKeyActivatedSubscription = !!(
    subscription &&
    subscription.isActive &&
    String(subscription.paymentStatus ?? "").toLowerCase() === "key"
  );

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
    if (!subscription) return 0;
    if (Number(subscription.messagesUsed ?? 0) === 0) return 30;
    const end = new Date(subscription.endDate ?? "");
    if (Number.isNaN(end.getTime())) return 0;
    const diff = end.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [subscription]);

  const formatMessageDate = (value: string | number | Date | null | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return format(date, "MMM d, h:mm a");
  };

  const formatRenewalDate = (value: string | number | Date | null | undefined) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return format(date, "MMM d, yyyy");
  };

  useEffect(() => {
    if (!hasKeyActivatedSubscription) return;
    const timer = setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" });
    }, 150);
    return () => clearTimeout(timer);
  }, [hasKeyActivatedSubscription, messagesLoading]);

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
    if (!hasKeyActivatedSubscription) {
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

  const handleRedeemKey = async () => {
    if (!activationKey.trim()) {
      toast.error(copy.errEnterKey);
      return;
    }

    try {
      await redeemKey.mutateAsync({ keyCode: activationKey.trim() });
      toast.success(copy.keyActivated);
      setActivationKey("");
      await utils.lexai.getSubscription.invalidate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : copy.keyActivationFailed);
    }
  };

  const handleVerifyAssignedKey = async () => {
    if (!assignedEmail.trim()) {
      toast.error(copy.emailForAssignedKey);
      return;
    }

    try {
      await verifyAssignedKeyByEmail.mutateAsync({ email: assignedEmail.trim() });
      toast.success(copy.assignedKeyVerified);
      await utils.lexai.getSubscription.invalidate();
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
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

  if (!hasKeyActivatedSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <Card className="max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
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
                <Crown className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-semibold">{copy.featurePro}</h4>
                  <p className="text-sm text-muted-foreground">
                    {copy.featureProDesc}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-semibold">{copy.featureRealtime}</h4>
                  <p className="text-sm text-muted-foreground">
                    {copy.featureRealtimeDesc}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ImageIcon className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-semibold">{copy.featureUpload}</h4>
                  <p className="text-sm text-muted-foreground">
                    {copy.featureUploadDesc}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold">$29.99/month</p>
                  <p className="text-sm text-muted-foreground">{copy.analysesPerMonth}</p>
                </div>
              </div>
              <div className="space-y-3">
                <Input
                  placeholder={copy.enterKey}
                  value={activationKey}
                  onChange={(event) => setActivationKey(event.target.value)}
                  disabled={redeemKey.isPending || verifyAssignedKeyByEmail.isPending}
                />
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleRedeemKey}
                  disabled={redeemKey.isPending || verifyAssignedKeyByEmail.isPending}
                >
                  {redeemKey.isPending ? copy.activating : copy.activateKey}
                </Button>
              </div>
              <div className="border-t pt-4 mt-4 space-y-3">
                <p className="text-sm font-medium text-right">{copy.alreadyHaveKeyTitle}</p>
                <Input
                  placeholder={copy.emailForAssignedKey}
                  value={assignedEmail}
                  onChange={(event) => setAssignedEmail(event.target.value)}
                  disabled={redeemKey.isPending || verifyAssignedKeyByEmail.isPending}
                  dir="ltr"
                />
                <Button
                  className="w-full"
                  variant="outline"
                  size="lg"
                  onClick={handleVerifyAssignedKey}
                  disabled={redeemKey.isPending || verifyAssignedKeyByEmail.isPending}
                >
                  {verifyAssignedKeyByEmail.isPending ? copy.verifying : copy.verifyEmailKey}
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground mt-3">
                {copy.noCommitment}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const messagesRemaining = subscription ? subscription.messagesLimit - subscription.messagesUsed : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="container max-w-5xl py-6 px-2 md:px-0">
        {/* Header */}
        <div className="mb-5 md:mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center shadow-md">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
                <p className="text-xs md:text-sm text-muted-foreground">
                  {copy.chatDesc}
                </p>
              </div>
            </div>
            <Link href="/">
              <Button variant="outline">{copy.backHome}</Button>
            </Link>
          </div>

          {/* Remaining days (single compact line) */}
          <div className="mt-2 text-sm text-right text-muted-foreground">
            <span>{copy.remainingDays}: </span>
            <span className="font-semibold text-slate-900">{remainingDays} {copy.daysSuffix}</span>
          </div>
        </div>

        {/* Chat Interface */}
        <Card className="flex flex-col h-[70vh] md:h-[680px] max-w-3xl mx-auto shadow-lg rounded-3xl overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="text-lg">{copy.chatTitle}</CardTitle>
            <CardDescription>
              {copy.chatDesc}
            </CardDescription>
          </CardHeader>

          {/* Messages */}
          <div
            className="flex-1 p-3 md:p-4 overflow-y-auto bg-slate-50/70 bg-[radial-gradient(circle_at_top,_rgba(129,140,248,0.18),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(56,189,248,0.16),_transparent_55%)]"
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
                      <Sparkles className="h-10 w-10 text-purple-500 mx-auto mb-3" />
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
                            ? "bg-gradient-to-br from-purple-500 to-blue-500 text-white"
                            : "bg-white border border-slate-200"
                        }`}
                      >
                        {message.imageUrl && (
                          <img
                            src={message.imageUrl}
                            alt="Chart"
                            className="rounded mb-2 w-full max-w-[360px] max-h-[420px] object-contain bg-black/5"
                          />
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
                            message.role === "user" ? "text-purple-100" : "text-muted-foreground"
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

          <CardContent className="border-t p-4">
            {!isAdmin && messagesRemaining <= 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-900">{copy.monthlyLimitReached}</p>
                  <p className="text-yellow-700">
                    {copy.renewOn} {formatRenewalDate(subscription?.endDate)}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-4" dir="rtl">
              {guidedFlow === "specialized_m15" && <div className="text-sm text-muted-foreground text-right">{copy.uploadM15First}</div>}
              {guidedFlow === "specialized_h4" && <div className="text-sm text-muted-foreground text-right">{copy.uploadH4Second}</div>}

              {guidedFlow === "single" && (
                <div className="flex items-center gap-3 justify-end">
                  <Input value={timeframe} onChange={(e) => setTimeframe(e.target.value)} className="max-w-[120px]" placeholder="M15" />
                  <span className="text-sm text-muted-foreground">{copy.timeframe}</span>
                </div>
              )}

              {(guidedFlow === "specialized_m15" || guidedFlow === "single" || guidedFlow === "feedback_image") && (
                <FileUpload accept="image/*" maxSize={5} label={copy.uploadChartImage} preview="image" currentUrl={imageUrl} onUrlChange={setImageUrl} onUpload={handleUpload} />
              )}

              {guidedFlow === "specialized_h4" && (
                <FileUpload accept="image/*" maxSize={5} label={copy.uploadH4Label} preview="image" currentUrl={h4ImageUrl} onUrlChange={setH4ImageUrl} onUpload={handleUpload} />
              )}

              {guidedFlow === "feedback_image" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium block text-right">{copy.yourAnalysis}</label>
                  <Textarea value={userAnalysis} onChange={(e) => setUserAnalysis(e.target.value)} rows={4} placeholder={copy.analysisPlaceholder} className="text-right" dir="rtl" />
                </div>
              )}

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-xs text-muted-foreground flex items-center gap-2 order-2 md:order-1">
                  <CheckCircle2 className="h-4 w-4" />
                  {copy.cappedNotice}
                </div>
                <div className="flex items-center gap-2 justify-end order-1 md:order-2">
                  <Button variant="outline" onClick={() => setShowDeleteDialog(true)} disabled={clearHistory.isPending || !!messagesLoading}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    {copy.deleteHistory}
                  </Button>
                  <Button onClick={handleAnalyze} disabled={isBusy || guidedFlow === "menu" || (!isAdmin && messagesRemaining <= 0)}>
                    {isBusy ? copy.analyzing : guidedFlow === "specialized_m15" ? copy.runM15 : guidedFlow === "specialized_h4" ? copy.runH4 : copy.runAnalysis}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>

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
    </div>
  );
}
