import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Key, CheckCircle2, AlertCircle, Package, ArrowUpCircle, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ActivateKey() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const [keyCode, setKeyCode] = useState("");
  const [email, setEmail] = useState("");
  const [isActivated, setIsActivated] = useState(false);
  const [activatedPackage, setActivatedPackage] = useState<string | null>(null);
  const [isUpgradeActivation, setIsUpgradeActivation] = useState(false);

  // Try package key activation first, fall back to legacy course key
  const activatePackageKey = trpc.packageKeys.activateKey.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        setIsActivated(true);
        setActivatedPackage(language === 'ar' ? (data.packageNameAr || data.packageName) : data.packageName || null);
        setIsUpgradeActivation(data.isUpgrade ?? false);
        toast.success(data.message);
        setTimeout(() => setLocation("/dashboard"), 4000);
      } else {
        // Show Arabic message if available and language is Arabic
        const msg = (language === 'ar' && data.messageAr) ? data.messageAr : data.message;
        toast.error(msg);
        // Only fall through to legacy key if it's NOT a renewal mismatch
        if (!data.messageAr) {
          activateLegacyKey.mutate({ keyCode: keyCode.trim(), email: email.trim() });
        }
      }
    },
    onError: () => {
      // Not a package key, try legacy course key
      activateLegacyKey.mutate({ keyCode: keyCode.trim(), email: email.trim() });
    },
  });

  const activateLegacyKey = trpc.registrationKeys.activateKey.useMutation({
    onSuccess: (data) => {
      setIsActivated(true);
      toast.success(data.message);
      setTimeout(() => {
        if (data.key?.courseId) {
          setLocation(`/course/${data.key.courseId}`);
        } else {
          setLocation("/dashboard");
        }
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const isPending = activatePackageKey.isPending || activateLegacyKey.isPending;

  const handleActivate = () => {
    if (!keyCode.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال مفتاح التفعيل' : 'Please enter an activation key');
      return;
    }
    if (!email.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال بريدك الإلكتروني' : 'Please enter your email');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error(language === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address');
      return;
    }
    // Try package key first
    activatePackageKey.mutate({ keyCode: keyCode.trim(), email: email.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Key className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">
            {language === 'ar' ? 'تفعيل مفتاح الباقة' : 'Activate Your Package'}
          </CardTitle>
          <CardDescription>
            {language === 'ar'
              ? 'أدخل مفتاح التفعيل وبريدك الإلكتروني لفتح باقتك'
              : 'Enter your activation key and email to unlock your package'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isActivated ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="keyCode">
                  {language === 'ar' ? 'مفتاح التفعيل' : 'Activation Key'}
                </Label>
                <Input
                  id="keyCode"
                  placeholder="XFLEX-XXXXX-XXXXX-XXXXX"
                  value={keyCode}
                  onChange={(e) => setKeyCode(e.target.value.toUpperCase())}
                  className="font-mono"
                  dir="ltr"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email Address'}
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  dir="ltr"
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                  {language === 'ar'
                    ? 'سيتم ربط هذا المفتاح ببريدك الإلكتروني'
                    : 'This key will be linked to your email address'}
                </p>
              </div>

              <Button
                onClick={handleActivate}
                disabled={isPending}
                className="w-full"
                size="lg"
              >
                {isPending 
                  ? (language === 'ar' ? 'جاري التفعيل...' : 'Activating...') 
                  : (language === 'ar' ? 'تفعيل المفتاح' : 'Activate Key')}
              </Button>

              <div className="mt-6 p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {language === 'ar' ? 'معلومات مهمة' : 'Important Information'}
                </h4>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>{language === 'ar' ? 'كل مفتاح يمكن تفعيله مرة واحدة فقط' : 'Each key can only be activated once'}</li>
                  <li>{language === 'ar' ? 'سيتم ربط المفتاح ببريدك الإلكتروني بشكل دائم' : 'The key will be permanently linked to your email'}</li>
                  <li>{language === 'ar' ? 'ستحصل على جميع محتويات الباقة' : "You'll get all package contents"}</li>
                  <li>{language === 'ar' ? 'لا يمكن نقل المفاتيح أو مشاركتها' : 'Keys cannot be transferred or shared'}</li>
                </ul>
              </div>
            </>
          ) : isUpgradeActivation ? (
            /* ==============================================
               UPGRADE CONGRATULATIONS SCREEN
               ============================================== */
            <div className="text-center space-y-5 py-6">
              <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-amber-100 to-yellow-200 flex items-center justify-center shadow-lg shadow-amber-200/50 animate-bounce">
                <ArrowUpCircle className="h-10 w-10 text-amber-600" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                  {language === 'ar' ? 'مبروك على الترقية! 🎉' : 'Congratulations on Your Upgrade! 🎉'}
                </h3>
                {activatedPackage && (
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Package className="w-4 h-4" />
                    <span className="font-semibold">{activatedPackage}</span>
                  </div>
                )}
              </div>
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 rounded-xl p-5 text-start space-y-3 border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {language === 'ar' ? 'يمكنك الآن الاستفادة من جميع الميزات:' : 'You now have access to all features:'}
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    {language === 'ar' ? 'جميع دورات التداول والمراحل' : 'All trading courses & stages'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    {language === 'ar' ? 'مساعد LexAI الذكي للتداول' : 'LexAI Smart Trading Assistant'}
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    {language === 'ar' ? 'توصيات التداول الحية' : 'Live Trading Recommendations'}
                  </li>
                </ul>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                {language === 'ar' 
                  ? 'نتمنى لك تداولاً ناجحاً ومربحاً! 📈'
                  : 'Wishing you successful and profitable trading! 📈'}
              </p>
              <p className="text-xs text-muted-foreground">
                {language === 'ar' ? 'جاري تحويلك إلى لوحة التحكم...' : 'Redirecting you to your dashboard...'}
              </p>
            </div>
          ) : (
            /* ==============================================
               NORMAL ACTIVATION SUCCESS SCREEN
               ============================================== */
            <div className="text-center space-y-4 py-8">
              <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-green-600">
                  {language === 'ar' ? 'تم التفعيل بنجاح!' : 'Activated Successfully!'}
                </h3>
                {activatedPackage && (
                  <div className="flex items-center justify-center gap-2 mt-2 text-gray-600">
                    <Package className="w-4 h-4" />
                    <span>{activatedPackage}</span>
                  </div>
                )}
                <p className="text-muted-foreground mt-2">
                  {language === 'ar' ? 'جاري تحويلك إلى لوحة التحكم...' : 'Redirecting you to your dashboard...'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
