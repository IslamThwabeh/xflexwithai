import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Key, Package, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const DISMISSED_KEY = "xflex-key-prompt-dismissed";

interface KeyActivationPromptProps {
  hasEnrollments: boolean;
  hasLexai: boolean;
  hasRecommendations: boolean;
}

export default function KeyActivationPrompt({
  hasEnrollments,
  hasLexai,
  hasRecommendations,
}: KeyActivationPromptProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const isAr = language === "ar";

  const hasPaidAccess = hasEnrollments || hasLexai || hasRecommendations;

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"prompt" | "activate">("prompt");
  const [keyCode, setKeyCode] = useState("");
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    if (hasPaidAccess) return;
    const dismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (dismissed) return;
    // Small delay so the page loads first
    const timer = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(timer);
  }, [hasPaidAccess]);

  const activatePackageKey = trpc.packageKeys.activateKey.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        setIsActivated(true);
        toast.success(data.message);
        setTimeout(() => {
          setOpen(false);
          window.location.reload();
        }, 2000);
      } else {
        toast.error(data.message);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isPending = activatePackageKey.isPending;

  const handleActivate = () => {
    if (!keyCode.trim()) {
      toast.error(isAr ? "يرجى إدخال مفتاح التفعيل" : "Please enter your activation key");
      return;
    }
    if (!user?.email) {
      toast.error(isAr ? "لم يتم العثور على بريدك الإلكتروني" : "Email not found");
      return;
    }
    activatePackageKey.mutate({ keyCode: keyCode.trim(), email: user.email });
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "1");
    setOpen(false);
  };

  if (hasPaidAccess) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md" dir={isAr ? "rtl" : "ltr"}>
        {isActivated ? (
          <>
            <DialogHeader>
              <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <DialogTitle className="text-center">
                {isAr ? "تم التفعيل بنجاح! 🎉" : "Activated Successfully! 🎉"}
              </DialogTitle>
              <DialogDescription className="text-center">
                {isAr ? "جاري تحديث الصفحة..." : "Refreshing your dashboard..."}
              </DialogDescription>
            </DialogHeader>
          </>
        ) : step === "prompt" ? (
          <>
            <DialogHeader>
              <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-7 w-7 text-blue-600" />
              </div>
              <DialogTitle className="text-center text-xl">
                {isAr ? "مرحباً بك في XFlex! 👋" : "Welcome to XFlex! 👋"}
              </DialogTitle>
              <DialogDescription className="text-center text-base">
                {isAr
                  ? "يبدو أنك لم تقم بتفعيل باقة بعد. قم بإدخال مفتاح التفعيل للوصول إلى الدورة التدريبية والخدمات المميزة."
                  : "It looks like you haven't activated a package yet. Enter your activation key to unlock the trading course and premium features."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <Key className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-blue-900">
                    {isAr ? "لديك مفتاح تفعيل؟" : "Have an activation key?"}
                  </p>
                  <p className="text-xs text-blue-700 mt-0.5">
                    {isAr ? "أدخل مفتاحك الآن لفتح جميع المحتوى المدفوع" : "Enter it now to unlock all paid content"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 border border-purple-100">
                <Sparkles className="h-5 w-5 text-purple-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-purple-900">
                    {isAr ? "لا تملك مفتاحاً؟" : "Don't have a key?"}
                  </p>
                  <p className="text-xs text-purple-700 mt-0.5">
                    {isAr ? "تصفح باقاتنا واحصل على مفتاح التفعيل" : "Browse our packages to get started"}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={() => setStep("activate")} className="w-full gap-2">
                <Key className="h-4 w-4" />
                {isAr ? "لدي مفتاح تفعيل" : "I have a key"}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => { handleDismiss(); setLocation("/packages/basic"); }}
                className="w-full gap-2"
              >
                <Package className="h-4 w-4" />
                {isAr ? "تصفح الباقات" : "Browse Packages"}
              </Button>
              <Button
                variant="ghost"
                onClick={handleDismiss}
                className="w-full text-muted-foreground"
              >
                {isAr ? "تخطي الآن" : "Skip for now"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-center">
                {isAr ? "أدخل مفتاح التفعيل" : "Enter Activation Key"}
              </DialogTitle>
              <DialogDescription className="text-center">
                {isAr
                  ? "أدخل المفتاح الذي حصلت عليه لتفعيل باقتك"
                  : "Enter the key you received to activate your package"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="prompt-key">
                  {isAr ? "مفتاح التفعيل" : "Activation Key"}
                </Label>
                <Input
                  id="prompt-key"
                  placeholder="XFLEX-XXXXX-XXXXX-XXXXX"
                  value={keyCode}
                  onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
                  className="font-mono text-center"
                  dir="ltr"
                  disabled={isPending}
                  onKeyDown={(e) => { if (e.key === "Enter") handleActivate(); }}
                />
              </div>
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={handleActivate} disabled={isPending} className="w-full gap-2">
                {isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isAr ? "تفعيل" : "Activate"}
              </Button>
              <Button variant="ghost" onClick={() => setStep("prompt")} className="w-full">
                {isAr ? "رجوع" : "Back"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
