import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/FileUpload";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Sparkles, AlertCircle, Crown, CheckCircle2 } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { format } from "date-fns";

export default function LexAI() {
  const { user, loading: authLoading } = useAuth();
  const { language } = useLanguage();
  const utils = trpc.useUtils();

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

  const [flow, setFlow] = useState<
    "m15" | "h4" | "single" | "feedback" | "feedback_image"
  >("m15");
  const [imageUrl, setImageUrl] = useState("");
  const [timeframe, setTimeframe] = useState("M15");
  const [userAnalysis, setUserAnalysis] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sortedMessages = useMemo(() => {
    return (messages ?? []).slice().sort((a, b) => {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [messages]);

  const hasM15 = sortedMessages.some(
    message => message.role === "assistant" && message.analysisType === "m15"
  );

  const isAdmin = !!adminCheck?.isAdmin;

  const isBusy =
    uploadImage.isPending ||
    analyzeM15.isPending ||
    analyzeH4.isPending ||
    analyzeSingle.isPending ||
    analyzeFeedback.isPending ||
    analyzeFeedbackWithImage.isPending;

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
    setUserAnalysis("");
  };

  const handleAnalyze = async () => {
    try {
      if ((flow === "m15" || flow === "h4" || flow === "single" || flow === "feedback_image") && !imageUrl) {
        toast.error("Please upload an image first");
        return;
      }

      if ((flow === "feedback" || flow === "feedback_image") && userAnalysis.trim().length < 5) {
        toast.error("Please enter your analysis");
        return;
      }

      if (flow === "m15") {
        await analyzeM15.mutateAsync({ imageUrl, language });
      } else if (flow === "h4") {
        await analyzeH4.mutateAsync({ imageUrl, language });
      } else if (flow === "single") {
        await analyzeSingle.mutateAsync({ imageUrl, language, timeframe });
      } else if (flow === "feedback") {
        await analyzeFeedback.mutateAsync({ userAnalysis, language });
      } else {
        await analyzeFeedbackWithImage.mutateAsync({ userAnalysis, imageUrl, language });
      }

      await utils.lexai.getMessages.invalidate();
      await utils.lexai.getSubscription.invalidate();
      resetInputs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    }
  };

  if (authLoading || subLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Sign In Required</CardTitle>
            <CardDescription>Please sign in to access LexAI</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">Go to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin && !adminLoading && (!subscription || !subscription.isActive)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-blue-50">
        <Card className="max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-3xl">LexAI Currency Analysis</CardTitle>
            <CardDescription className="text-lg">
              Get AI-powered analysis and recommendations for your trading charts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <Crown className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-semibold">Professional Analysis</h4>
                  <p className="text-sm text-muted-foreground">
                    Advanced chart pattern recognition and trend analysis
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-semibold">Real-time Recommendations</h4>
                  <p className="text-sm text-muted-foreground">
                    Get actionable trading signals and entry/exit points
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <ImageIcon className="h-5 w-5 text-purple-600 mt-1" />
                <div>
                  <h4 className="font-semibold">Chart Upload Support</h4>
                  <p className="text-sm text-muted-foreground">
                    Upload your trading charts for detailed analysis
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-2xl font-bold">$29.99/month</p>
                  <p className="text-sm text-muted-foreground">100 analyses per month</p>
                </div>
              </div>
              <Button className="w-full" size="lg">
                Subscribe to LexAI
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-3">
                Cancel anytime. No commitment required.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const messagesRemaining = subscription ? subscription.messagesLimit - subscription.messagesUsed : 0;
  const usagePercentage = subscription
    ? (subscription.messagesUsed / subscription.messagesLimit) * 100
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <div className="container max-w-5xl py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">LexAI Currency Analysis</h1>
                <p className="text-sm text-muted-foreground">
                  {isAdmin
                    ? "Admin preview mode"
                    : `${messagesRemaining} analyses remaining this month`}
                </p>
              </div>
            </div>
            <Link href="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>

          {/* Usage indicator */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Monthly Usage</span>
              <span className="font-medium">
                {subscription
                  ? `${subscription.messagesUsed} / ${subscription.messagesLimit}`
                  : "Admin"}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <Card className="h-[680px] flex flex-col">
          <CardHeader className="border-b">
            <CardTitle className="text-lg">Chat with LexAI</CardTitle>
            <CardDescription>
              Upload a chart or describe your analysis needs
            </CardDescription>
          </CardHeader>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messagesLoading ? (
              <p className="text-center text-muted-foreground">Loading messages...</p>
            ) : !messages || messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-md">
                  <Sparkles className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Start Your Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload a trading chart or ask a question to get started with AI-powered analysis
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedMessages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-purple-500 to-blue-500 text-white"
                          : "bg-white border"
                      }`}
                    >
                      {message.imageUrl && (
                        <img
                          src={message.imageUrl}
                          alt="Chart"
                          className="rounded mb-2 max-w-full"
                        />
                      )}
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <p
                        className={`text-xs mt-2 ${
                          message.role === "user" ? "text-purple-100" : "text-muted-foreground"
                        }`}
                      >
                        {format(new Date(message.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Input Area */}
          <CardContent className="border-t p-4">
            {!isAdmin && messagesRemaining <= 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-900">Monthly limit reached</p>
                  <p className="text-yellow-700">Your subscription will renew on {format(new Date(subscription.endDate), "MMM d, yyyy")}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={flow === "m15" ? "default" : "outline"}
                  onClick={() => setFlow("m15")}
                >
                  M15 Analysis
                </Button>
                <Button
                  size="sm"
                  variant={flow === "h4" ? "default" : "outline"}
                  onClick={() => setFlow("h4")}
                  disabled={!hasM15}
                >
                  H4 Analysis
                </Button>
                <Button
                  size="sm"
                  variant={flow === "single" ? "default" : "outline"}
                  onClick={() => setFlow("single")}
                >
                  Single Image
                </Button>
                <Button
                  size="sm"
                  variant={flow === "feedback" ? "default" : "outline"}
                  onClick={() => setFlow("feedback")}
                >
                  Feedback Only
                </Button>
                <Button
                  size="sm"
                  variant={flow === "feedback_image" ? "default" : "outline"}
                  onClick={() => setFlow("feedback_image")}
                >
                  Feedback + Image
                </Button>
              </div>

              {flow === "single" && (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">Timeframe</span>
                  <Input
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="max-w-[120px]"
                    placeholder="M15"
                  />
                </div>
              )}

              {(flow === "m15" || flow === "h4" || flow === "single" || flow === "feedback_image") && (
                <FileUpload
                  accept="image/*"
                  maxSize={5}
                  label="Upload Chart Image"
                  preview="image"
                  currentUrl={imageUrl}
                  onUrlChange={setImageUrl}
                  onUpload={handleUpload}
                />
              )}

              {(flow === "feedback" || flow === "feedback_image") && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Your Analysis</label>
                  <Textarea
                    value={userAnalysis}
                    onChange={(e) => setUserAnalysis(e.target.value)}
                    rows={4}
                    placeholder="Write your technical analysis here..."
                  />
                </div>
              )}

              {flow === "h4" && !hasM15 && (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Complete an M15 analysis before requesting H4.
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Responses are capped at 1024 characters.
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={isBusy || (!isAdmin && messagesRemaining <= 0)}
                >
                  {isBusy ? "Analyzing..." : "Run Analysis"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
