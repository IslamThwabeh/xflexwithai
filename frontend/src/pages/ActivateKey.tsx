import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import CinematicPublicLayout from "@/components/public/CinematicPublicLayout";
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
import { Key, CheckCircle2, AlertCircle, Package, ArrowUpCircle, Sparkles, LogIn, Home } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ActivateKey() {
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isRtl = language === "ar";
  const { user, loading } = useAuth();
  const [keyCode, setKeyCode] = useState("");
  const [isActivated, setIsActivated] = useState(false);
  const [activatedPackage, setActivatedPackage] = useState<string | null>(null);
  const [isUpgradeActivation, setIsUpgradeActivation] = useState(false);

  // Package key activation
  const activatePackageKey = trpc.packageKeys.activateKey.useMutation({
    onSuccess: (data: any) => {
      if (data.success) {
        setIsActivated(true);
        setActivatedPackage(language === 'ar' ? (data.packageNameAr || data.packageName) : data.packageName || null);
        setIsUpgradeActivation(data.isUpgrade ?? false);
        toast.success(data.message);
        setTimeout(() => setLocation("/dashboard"), 4000);
      } else {
        const msg = (language === 'ar' && data.messageAr) ? data.messageAr : data.message;
        toast.error(msg);
      }
    },
    onError: (error: any) => {
      // Try to extract bilingual message from error data
      const errorData = error?.data;
      if (language === 'ar' && errorData?.messageAr) {
        toast.error(errorData.messageAr);
      } else if (errorData?.message) {
        toast.error(errorData.message);
      } else {
        toast.error(language === 'ar' ? 'حدث خطأ أثناء تفعيل المفتاح. يرجى المحاولة مرة أخرى.' : error.message || 'An error occurred while activating the key. Please try again.');
      }
    },
  });

  const isPending = activatePackageKey.isPending;

  const handleActivate = () => {
    if (!keyCode.trim()) {
      toast.error(language === 'ar' ? 'يرجى إدخال مفتاح التفعيل' : 'Please enter an activation key');
      return;
    }
    activatePackageKey.mutate({ keyCode: keyCode.trim() });
  };

  if (loading) {
    return (
      <CinematicPublicLayout>
        <div className="min-h-[60vh] flex items-center justify-center bg-[#050505]" dir={isRtl ? "rtl" : "ltr"}>
          <div className="w-8 h-8 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </CinematicPublicLayout>
    );
  }

  if (!user) {
    return (
      <CinematicPublicLayout>
        <div className="bg-[#050505] py-10 md:py-14" dir={isRtl ? "rtl" : "ltr"}>
          <div className="bg-[var(--color-xf-cream)] py-10 md:py-14">
          <div className="mx-auto max-w-4xl px-4">
            <div className="mb-8 rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:px-8 md:py-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <Key className="h-3.5 w-3.5" />
                    {language === "ar" ? "تفعيل الباقة" : "Package Activation"}
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
                    {language === "ar" ? "تفعيل مفتاح الباقة" : "Activate Your Package Key"}
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
                    {language === "ar"
                      ? "سجّل الدخول أولاً ثم أدخل مفتاحك لربط الباقة بحسابك وفتح الوصول مباشرة."
                      : "Sign in first, then enter your key to attach the package to your account and unlock access immediately."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mx-auto max-w-xl rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:p-10">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <LogIn className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">
                {language === "ar" ? "سجّل الدخول للمتابعة" : "Sign In to Continue"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-gray-600">
                {language === "ar"
                  ? "تفعيل المفتاح يربط الباقة بحسابك الحالي، لذلك نحتاج إلى معرفة الحساب الذي سيستقبل الوصول."
                  : "Key activation links the package to your current account, so we need to know which account should receive the access."}
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/auth?next=/activate-key">
                  <Button className="min-w-[180px] gap-2">
                    <LogIn className="h-4 w-4" />
                    {language === "ar" ? "تسجيل الدخول" : "Sign In"}
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="min-w-[180px] gap-2 border-slate-200 bg-white">
                    <Home className="h-4 w-4" />
                    {language === "ar" ? "العودة للرئيسية" : "Back Home"}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        </div>
      </CinematicPublicLayout>
    );
  }

  return (
    <CinematicPublicLayout>
      <div className="bg-[#050505] py-10 md:py-14" dir={isRtl ? "rtl" : "ltr"}>
        <div className="bg-[var(--color-xf-cream)] py-10 md:py-14">
        <div className="mx-auto max-w-4xl px-4">
          <div className="mb-8 rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] md:px-8 md:py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <Key className="h-3.5 w-3.5" />
                  {language === "ar" ? "تفعيل الباقة" : "Package Activation"}
                </div>
                <h1 className="text-3xl font-bold text-gray-900 md:text-4xl">
                  {language === "ar" ? "تفعيل مفتاح الباقة" : "Activate Your Package Key"}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-7 text-gray-600">
                  {language === "ar"
                    ? "أدخل المفتاح لتوصيل الباقة بحسابك الحالي وفتح محتواها وخدماتها مباشرة."
                    : "Enter your key to connect the package to your current account and unlock its content and services immediately."}
                </p>
              </div>
              <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <p className="font-semibold">{language === "ar" ? "الحساب الحالي" : "Current account"}</p>
                <p className="mt-1 text-emerald-700" dir="ltr">{user.email ?? "-"}</p>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-md">
            <Card className="w-full rounded-[28px] border-slate-200 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
                  <Key className="h-8 w-8 text-emerald-600" />
                </div>
                <CardTitle className="text-2xl text-gray-900">
                  {language === "ar" ? "أدخل مفتاح التفعيل" : "Enter Your Activation Key"}
                </CardTitle>
                <CardDescription className="leading-7 text-gray-600">
                  {language === "ar"
                    ? "سيتم ربط المفتاح بهذا الحساب مباشرة بعد التفعيل."
                    : "This key will be linked to this account as soon as activation succeeds."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isActivated ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="keyCode">
                        {language === "ar" ? "مفتاح التفعيل" : "Activation Key"}
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
                      <Label>{language === "ar" ? "البريد الإلكتروني" : "Email Address"}</Label>
                      <Input value={user.email ?? ""} disabled dir="ltr" />
                      <p className="text-xs text-muted-foreground">
                        {language === "ar"
                          ? "سيتم ربط هذا المفتاح بحسابك الحالي بشكل دائم."
                          : "This key will be permanently linked to your current account."}
                      </p>
                    </div>

                    <Button
                      onClick={handleActivate}
                      disabled={isPending}
                      className="w-full"
                      size="lg"
                    >
                      {isPending
                        ? (language === "ar" ? "جاري التفعيل..." : "Activating...")
                        : (language === "ar" ? "تفعيل المفتاح" : "Activate Key")}
                    </Button>

                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2 text-amber-900">
                        <AlertCircle className="h-4 w-4" />
                        {language === "ar" ? "معلومات مهمة" : "Important Information"}
                      </h4>
                      <ul className="text-xs text-amber-900/75 space-y-1 list-disc list-inside leading-6">
                        <li>{language === "ar" ? "كل مفتاح يمكن تفعيله مرة واحدة فقط" : "Each key can only be activated once"}</li>
                        <li>{language === "ar" ? "سيتم ربط المفتاح ببريدك الإلكتروني بشكل دائم" : "The key will be permanently linked to your email"}</li>
                        <li>{language === "ar" ? "ستحصل على جميع محتويات الباقة" : "You'll get all package contents"}</li>
                        <li>{language === "ar" ? "لا يمكن نقل المفاتيح أو مشاركتها" : "Keys cannot be transferred or shared"}</li>
                        <li>{language === "ar" ? "الدورة التعليمية صالحة مدى الحياة" : "Trading course access is lifetime"}</li>
                        <li>{language === "ar" ? "خدمة LexAI والتوصيات صالحة لمدة شهر من تاريخ التفعيل" : "LexAI & Recommendations are valid for 1 month from activation"}</li>
                      </ul>
                    </div>
                  </>
                ) : isUpgradeActivation ? (
                  <div className="text-center space-y-5 py-6">
                    <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-amber-100 to-yellow-200 flex items-center justify-center shadow-lg shadow-amber-200/50 animate-bounce">
                      <ArrowUpCircle className="h-10 w-10 text-amber-600" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                        {language === "ar" ? "مبروك على الترقية! 🎉" : "Congratulations on Your Upgrade! 🎉"}
                      </h3>
                      {activatedPackage && (
                        <div className="flex items-center justify-center gap-2 text-gray-600">
                          <Package className="w-4 h-4" />
                          <span className="font-semibold">{activatedPackage}</span>
                        </div>
                      )}
                    </div>
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-5 text-start space-y-3 border border-amber-200">
                      <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        {language === "ar" ? "يمكنك الآن الاستفادة من جميع الميزات:" : "You now have access to all features:"}
                      </p>
                      <ul className="text-sm text-gray-600 space-y-2">
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          {language === "ar" ? "جميع دورات التداول والمراحل" : "All trading courses & stages"}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          {language === "ar" ? "مساعد LexAI الذكي للتداول" : "LexAI Smart Trading Assistant"}
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                          {language === "ar" ? "توصيات التداول الحية" : "Live Trading Recommendations"}
                        </li>
                      </ul>
                    </div>
                    <p className="text-sm font-medium text-amber-600">
                      {language === "ar"
                        ? "نتمنى لك تداولاً ناجحاً ومربحاً! 📈"
                        : "Wishing you successful and profitable trading! 📈"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === "ar" ? "جاري تحويلك إلى لوحة التحكم..." : "Redirecting you to your dashboard..."}
                    </p>
                  </div>
                ) : (
                  <div className="text-center space-y-4 py-8">
                    <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-green-600">
                        {language === "ar" ? "تم التفعيل بنجاح!" : "Activated Successfully!"}
                      </h3>
                      {activatedPackage && (
                        <div className="flex items-center justify-center gap-2 mt-2 text-gray-600">
                          <Package className="w-4 h-4" />
                          <span>{activatedPackage}</span>
                        </div>
                      )}
                      <p className="text-muted-foreground mt-2">
                        {language === "ar" ? "جاري تحويلك إلى لوحة التحكم..." : "Redirecting you to your dashboard..."}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </div>
    </CinematicPublicLayout>
  );
}
