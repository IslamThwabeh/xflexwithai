import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileUpload } from "@/components/FileUpload";
import { trpc } from "@/lib/trpc";
import { Send, Sparkles, Image as ImageIcon, AlertCircle, Crown } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Link } from "wouter";
import { format } from "date-fns";

export default function LexAI() {
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  
  const { data: subscription, isLoading: subLoading } = trpc.lexai.getSubscription.useQuery();
  const { data: messages, isLoading: messagesLoading } = trpc.lexai.getMessages.useQuery();
  
  const sendMessage = trpc.lexai.sendMessage.useMutation({
    onSuccess: () => {
      utils.lexai.getMessages.invalidate();
      utils.lexai.getSubscription.invalidate();
      setMessageText("");
      setImageUrl("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const uploadImage = trpc.upload.image.useMutation();

  const [messageText, setMessageText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [showImageUpload, setShowImageUpload] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageText.trim() && !imageUrl) {
      toast.error("Please enter a message or upload an image");
      return;
    }

    await sendMessage.mutateAsync({
      content: messageText || "Please analyze this chart",
      imageUrl: imageUrl || undefined,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (authLoading || subLoading) {
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

  if (!subscription || !subscription.isActive) {
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

  const messagesRemaining = subscription.messagesLimit - subscription.messagesUsed;
  const usagePercentage = (subscription.messagesUsed / subscription.messagesLimit) * 100;

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
                  {messagesRemaining} analyses remaining this month
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
              <span className="font-medium">{subscription.messagesUsed} / {subscription.messagesLimit}</span>
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
        <Card className="h-[600px] flex flex-col">
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
                {messages.map((message) => (
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
            {messagesRemaining <= 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-900">Monthly limit reached</p>
                  <p className="text-yellow-700">Your subscription will renew on {format(new Date(subscription.endDate), "MMM d, yyyy")}</p>
                </div>
              </div>
            )}

            {showImageUpload && (
              <div className="mb-4">
                <FileUpload
                  accept="image/*"
                  maxSize={5}
                  label="Upload Chart Image"
                  preview="image"
                  currentUrl={imageUrl}
                  onUrlChange={setImageUrl}
                  onUpload={async (file) => {
                    const reader = new FileReader();
                    return new Promise((resolve, reject) => {
                      reader.onload = async () => {
                        const base64 = reader.result?.toString().split(',')[1];
                        if (!base64) {
                          reject(new Error('Failed to read file'));
                          return;
                        }
                        
                        try {
                          const result = await uploadImage.mutateAsync({
                            fileName: file.name,
                            fileData: base64,
                            contentType: file.type,
                          });
                          resolve(result.url);
                        } catch (error) {
                          reject(error);
                        }
                      };
                      reader.onerror = reject;
                      reader.readAsDataURL(file);
                    });
                  }}
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowImageUpload(!showImageUpload)}
                disabled={messagesRemaining <= 0}
              >
                <ImageIcon className="h-4 w-4" />
              </Button>
              <Input
                placeholder="Describe your analysis needs..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={sendMessage.isPending || messagesRemaining <= 0}
              />
              <Button
                onClick={handleSendMessage}
                disabled={sendMessage.isPending || messagesRemaining <= 0 || (!messageText.trim() && !imageUrl)}
              >
                {sendMessage.isPending ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
