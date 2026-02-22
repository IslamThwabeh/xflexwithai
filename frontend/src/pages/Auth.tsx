import { useEffect, useMemo, useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { APP_TITLE } from "@/const";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export default function Auth() {
  const { t } = useLanguage();
  const [showLogin, setShowLogin] = useState(true);
  const [loginMethod, setLoginMethod] = useState<"code" | "password">("code");
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const { isAuthenticated, loading } = useAuth();
  const [location, setLocation] = useLocation();

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return null;
    const next = new URLSearchParams(window.location.search).get("next");
    if (!next) return null;
    if (!next.startsWith("/")) return null;
    if (next.startsWith("/admin")) return null;
    return next;
  }, [location]);

  const prefillEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    const fromQuery = new URLSearchParams(window.location.search).get("email") || "";
    if (fromQuery.trim()) return fromQuery.trim();
    try {
      return window.localStorage.getItem("xflex_last_email") || "";
    } catch {
      return "";
    }
  }, [location]);

  useEffect(() => {
    if (!prefillEmail) return;
    setOtpEmail(prev => (prev ? prev : prefillEmail));
  }, [prefillEmail]);

  const { data: adminCheck, isLoading: checkingAdmin } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (loading || checkingAdmin) return;
    if (!isAuthenticated) return;

    if (adminCheck?.isAdmin) {
      setLocation("/admin/dashboard");
      return;
    }

    setLocation(nextPath ?? "/courses");
  }, [adminCheck?.isAdmin, checkingAdmin, isAuthenticated, loading, nextPath, setLocation]);

  const requestLoginCode = trpc.auth.requestLoginCode.useMutation();
  const verifyLoginCode = trpc.auth.verifyLoginCode.useMutation();

  useEffect(() => {
    if (resendCooldownSec <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldownSec(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldownSec]);

  const handleSendCode = async () => {
    setOtpError(null);
    setOtpMessage(null);
    const email = otpEmail.trim();
    if (!email) {
      setOtpError("Please enter your email address");
      return;
    }

    try {
      try {
        window.localStorage.setItem("xflex_last_email", email);
      } catch {}

      await requestLoginCode.mutateAsync({ email });
      setOtpStep("verify");
      setResendCooldownSec(30);
      setOtpMessage(
        "If your email is eligible, we sent a 6-digit code. Please check your inbox and spam folder. If you don’t receive a code, activate a registration key or contact support."
      );
    } catch (e: any) {
      setOtpError(e?.message || "Failed to send code. Please try again.");
    }
  };

  const handleVerifyCode = async () => {
    setOtpError(null);
    setOtpMessage(null);
    const email = otpEmail.trim();
    const code = otpCode.trim();

    if (!email) {
      setOtpError("Please enter your email address");
      return;
    }
    if (!code) {
      setOtpError("Please enter the 6-digit code");
      return;
    }

    try {
      await verifyLoginCode.mutateAsync({ email, code });
      window.location.href = nextPath ?? "/courses";
    } catch (e: any) {
      setOtpError(e?.message || "Invalid code. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="mb-8 text-center">
        <Link href="/">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 transition-colors">
            {APP_TITLE}
          </h1>
        </Link>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          {t('auth.page.tagline')}
        </p>
      </div>

      {showLogin ? (
        <div className="w-full flex flex-col items-center">
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              size="sm"
              variant={loginMethod === "code" ? "default" : "outline"}
              onClick={() => {
                setLoginMethod("code");
                setOtpError(null);
                setOtpMessage(null);
              }}
            >
              Sign in with code
            </Button>
            <Button
              type="button"
              size="sm"
              variant={loginMethod === "password" ? "default" : "outline"}
              onClick={() => {
                setLoginMethod("password");
                setOtpError(null);
                setOtpMessage(null);
              }}
            >
              Sign in with password
            </Button>
          </div>

          {loginMethod === "code" ? (
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Sign in</CardTitle>
                <CardDescription>
                  We’ll email you a one-time login code. If you don’t receive it, check your spam folder or activate a registration key.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {otpError && (
                    <Alert variant="destructive">
                      <AlertDescription>{otpError}</AlertDescription>
                    </Alert>
                  )}

                  {otpMessage && (
                    <Alert>
                      <AlertDescription>{otpMessage}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="otpEmail">Email</Label>
                    <Input
                      id="otpEmail"
                      name="otpEmail"
                      type="email"
                      autoComplete="email"
                      value={otpEmail}
                      onChange={e => setOtpEmail(e.target.value)}
                      placeholder="name@example.com"
                      dir="ltr"
                    />
                  </div>

                  {otpStep === "verify" && (
                    <div className="space-y-2">
                      <Label htmlFor="otpCode">6-digit code</Label>
                      <Input
                        id="otpCode"
                        name="otpCode"
                        inputMode="numeric"
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value)}
                        placeholder="123456"
                        dir="ltr"
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    {otpStep === "request" ? (
                      <Button
                        className="flex-1"
                        onClick={handleSendCode}
                        disabled={requestLoginCode.isPending || resendCooldownSec > 0}
                      >
                        {requestLoginCode.isPending
                          ? "Sending..."
                          : resendCooldownSec > 0
                            ? `Send code (${resendCooldownSec}s)`
                            : "Send code"}
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={handleSendCode}
                          disabled={requestLoginCode.isPending || resendCooldownSec > 0}
                        >
                          {resendCooldownSec > 0 ? `Resend (${resendCooldownSec}s)` : "Resend"}
                        </Button>
                        <Button
                          className="flex-1"
                          onClick={handleVerifyCode}
                          disabled={verifyLoginCode.isPending}
                        >
                          {verifyLoginCode.isPending ? "Verifying..." : "Verify"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <LoginForm />
          )}
        </div>
      ) : (
        <RegisterForm />
      )}

      <div className="mt-6 text-center">
        <Button
          variant="link"
          onClick={() => setShowLogin(!showLogin)}
          className="text-gray-600 dark:text-gray-300"
        >
          {showLogin ? (
            <>
              {t('auth.page.switchToRegister')} <span className="font-semibold ml-1">{t('auth.page.signUp')}</span>
            </>
          ) : (
            <>
              {t('auth.page.switchToLogin')} <span className="font-semibold ml-1">{t('auth.page.signIn')}</span>
            </>
          )}
        </Button>
      </div>

      <div className="mt-4">
        <Link href="/">
          <Button variant="ghost" className="text-gray-600 dark:text-gray-300">
            {t('auth.page.backToHome')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
