import { useEffect, useMemo, useRef, useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";
import { APP_TITLE } from "@/const";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Mail, KeyRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getStaffLandingPage } from "@shared/const";

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
  const { isAuthenticated, loading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const autoSubmitFired = useRef(false);
  const [clearingAdmin, setClearingAdmin] = useState(false);

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return null;
    const next = new URLSearchParams(window.location.search).get("next");
    if (!next) return null;
    if (!next.startsWith("/")) return null;
    if (next.startsWith("/admin")) return null;
    return next;
  }, [location]);

  // Capture referral code from URL and persist in localStorage
  const referralCode = useMemo(() => {
    if (typeof window === "undefined") return null;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Z0-9]{4,10}$/i.test(ref)) {
      localStorage.setItem("xflex_referral_code", ref);
      return ref;
    }
    return localStorage.getItem("xflex_referral_code");
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

  // Show toast when redirected due to idle timeout
  const idleToastShown = useRef(false);
  useEffect(() => {
    if (idleToastShown.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "idle") {
      idleToastShown.current = true;
      toast.warning("Session expired due to inactivity. Please log in again.");
      // Clean up the URL
      params.delete("reason");
      const clean = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (clean ? `?${clean}` : ""));
    }
  }, []);

  const { data: adminCheck, isLoading: checkingAdmin } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // If an admin session is detected on the student login page, clear it
  // so the student login form shows (admins have their own /admin/login page)
  useEffect(() => {
    if (loading || checkingAdmin || clearingAdmin) return;
    if (!isAuthenticated) return;

    if (adminCheck?.isAdmin) {
      setClearingAdmin(true);
      logout().finally(() => setClearingAdmin(false));
      return;
    }

    // Staff users go to admin panel (role-filtered sidebar)
    if (adminCheck?.isStaff) {
      const staffRoles: string[] = adminCheck.staffRoles ?? [];
      const landing = getStaffLandingPage(staffRoles);
      window.location.href = landing;
      return;
    }

    setLocation(nextPath ?? "/courses");
  }, [adminCheck?.isAdmin, checkingAdmin, isAuthenticated, loading, nextPath, setLocation, clearingAdmin, logout]);

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
      setOtpError(t('auth.page.code.emailRequired'));
      return;
    }

    try {
      try {
        window.localStorage.setItem("xflex_last_email", email);
      } catch {}

      await requestLoginCode.mutateAsync({ email });
      setOtpStep("verify");
      setResendCooldownSec(30);
      setOtpMessage(t('auth.page.code.sentMessage'));
    } catch (e: any) {
      setOtpError(e?.message || t('auth.page.code.sendFailed'));
    }
  };

  const handleVerifyCode = async () => {
    setOtpError(null);
    setOtpMessage(null);
    const email = otpEmail.trim();
    const code = otpCode.trim();

    if (!email) {
      setOtpError(t('auth.page.code.emailRequired'));
      return;
    }
    if (!code) {
      setOtpError(t('auth.page.code.codeRequired'));
      return;
    }

    try {
      const result = await verifyLoginCode.mutateAsync({ email, code });
      // Staff users redirect to their first accessible admin page
      if (result.isStaff) {
        window.location.href = getStaffLandingPage(result.staffRoles ?? []);
      } else {
        window.location.href = nextPath ?? "/courses";
      }
    } catch (e: any) {
      setOtpError(e?.message || t('auth.page.code.invalid'));
    }
  };

  /* ─── Auto-submit OTP when 6 digits filled (Safari autofill + paste) ─── */
  const handleVerifyCodeRef = useRef(handleVerifyCode);
  handleVerifyCodeRef.current = handleVerifyCode;

  useEffect(() => {
    const cleaned = otpCode.replace(/\D/g, "");
    if (otpStep === "verify" && cleaned.length >= 6 && !autoSubmitFired.current && !verifyLoginCode.isPending) {
      autoSubmitFired.current = true;
      handleVerifyCodeRef.current();
    }
  }, [otpCode, otpStep, verifyLoginCode.isPending]);

  // Reset auto-submit flag when user edits the code (so re-paste / correction works)
  const prevOtpCode = useRef(otpCode);
  useEffect(() => {
    if (otpCode !== prevOtpCode.current) {
      prevOtpCode.current = otpCode;
      // Only reset if the code actually changed (i.e. user typed/pasted new digits)
      if (!verifyLoginCode.isPending) {
        autoSubmitFired.current = false;
      }
    }
  }, [otpCode, verifyLoginCode.isPending]);

  useEffect(() => {
    if (otpStep === "request") {
      autoSubmitFired.current = false;
      setOtpCode("");
    }
  }, [otpStep]);

  const handleOtpFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpStep === "request") handleSendCode();
    else handleVerifyCode();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-[var(--color-xf-cream)]">
      {/* Decorative orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.07] blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, var(--color-xf-primary), transparent 70%)', animation: 'pulse 6s ease-in-out infinite' }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.06] blur-3xl pointer-events-none" style={{ background: 'radial-gradient(circle, var(--color-xf-accent), transparent 70%)', animation: 'pulse 6s ease-in-out infinite 3s' }} />

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/">
            <h1 className="text-3xl font-bold text-[var(--color-xf-dark)] cursor-pointer hover:text-[var(--color-xf-primary)] transition-colors tracking-tight">
              {APP_TITLE}
            </h1>
          </Link>
          <p className="text-[var(--color-xf-dark)]/50 mt-2 text-sm">{t('auth.page.tagline')}</p>
        </div>

        {/* Card */}
        <div className="backdrop-blur-xl bg-white/80 border border-black/[0.06] rounded-2xl shadow-xl overflow-hidden">

      {showLogin ? (
        <div className="p-6 sm:p-8">
          {/* Login method toggle */}
          <div className="flex gap-2 mb-6">
            <button
              type="button"
              onClick={() => { setLoginMethod("code"); setOtpError(null); setOtpMessage(null); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                loginMethod === "code"
                  ? "bg-[var(--color-xf-primary)] text-white shadow-lg shadow-emerald-500/25"
                  : "bg-black/[0.04] text-[var(--color-xf-dark)]/50 hover:bg-black/[0.08] hover:text-[var(--color-xf-dark)]/70"
              }`}
            >
              <Mail className="h-4 w-4" />
              {t('auth.page.loginMethod.code')}
            </button>
            <button
              type="button"
              onClick={() => { setLoginMethod("password"); setOtpError(null); setOtpMessage(null); }}
              className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${
                loginMethod === "password"
                  ? "bg-[var(--color-xf-primary)] text-white shadow-lg shadow-emerald-500/25"
                  : "bg-black/[0.04] text-[var(--color-xf-dark)]/50 hover:bg-black/[0.08] hover:text-[var(--color-xf-dark)]/70"
              }`}
            >
              <KeyRound className="h-4 w-4" />
              {t('auth.page.loginMethod.password')}
            </button>
          </div>

          {loginMethod === "code" ? (
                <form onSubmit={handleOtpFormSubmit}>
                  <h2 className="text-xl font-semibold text-[var(--color-xf-dark)] mb-1">{t('auth.page.code.title')}</h2>
                  <p className="text-[var(--color-xf-dark)]/40 text-sm mb-5">{t('auth.page.code.description')}</p>

                  {otpError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm">{otpError}</div>
                  )}
                  {otpMessage && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4 text-emerald-700 text-sm">{otpMessage}</div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="otpEmail" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.page.code.email')}</label>
                      <input
                        id="otpEmail"
                        name="email"
                        type="email"
                        autoComplete="email"
                        value={otpEmail}
                        onChange={e => setOtpEmail(e.target.value)}
                        placeholder="name@example.com"
                        dir="ltr"
                        className="w-full px-4 py-3 rounded-xl bg-black/[0.03] border border-black/[0.08] text-[var(--color-xf-dark)] placeholder:text-black/25 focus:outline-none focus:ring-2 focus:ring-[var(--color-xf-primary)]/40 focus:border-[var(--color-xf-primary)]/40 transition-all"
                      />
                    </div>

                    {otpStep === "verify" && (
                      <div>
                        <label htmlFor="otpCode" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.page.code.code')}</label>
                        <input
                          id="otpCode"
                          name="otp"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={otpCode}
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                            setOtpCode(val);
                          }}
                          placeholder="000000"
                          dir="ltr"
                          maxLength={6}
                          autoFocus
                          className="w-full px-4 py-3.5 rounded-xl bg-black/[0.03] border border-black/[0.08] text-[var(--color-xf-dark)] placeholder:text-black/15 focus:outline-none focus:ring-2 focus:ring-[var(--color-xf-primary)]/40 focus:border-[var(--color-xf-primary)]/40 transition-all text-center text-xl tracking-[0.35em] font-mono"
                        />
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      {otpStep === "request" ? (
                        <button
                          type="submit"
                          className="flex-1 py-3 rounded-xl bg-[var(--color-xf-primary)] text-white font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
                          disabled={requestLoginCode.isPending || resendCooldownSec > 0}
                        >
                          {requestLoginCode.isPending ? (
                            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                          ) : resendCooldownSec > 0 ? (
                            `${t('auth.page.code.send')} (${resendCooldownSec}s)`
                          ) : (
                            t('auth.page.code.send')
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="flex-1 py-3 rounded-xl bg-black/[0.04] text-[var(--color-xf-dark)]/60 font-medium hover:bg-black/[0.08] hover:text-[var(--color-xf-dark)]/80 transition-all disabled:opacity-40"
                            onClick={handleSendCode}
                            disabled={requestLoginCode.isPending || resendCooldownSec > 0}
                          >
                            {resendCooldownSec > 0 ? `${t('auth.page.code.resend')} (${resendCooldownSec}s)` : t('auth.page.code.resend')}
                          </button>
                          <button
                            type="submit"
                            className="flex-1 py-3 rounded-xl bg-[var(--color-xf-primary)] text-white font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                            disabled={verifyLoginCode.isPending}
                          >
                            {verifyLoginCode.isPending ? (
                              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                            ) : (
                              t('auth.page.code.verify')
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </form>
          ) : (
            <LoginForm
              onRequireOtp={(email, message) => {
                setOtpEmail(email);
                setOtpStep("verify");
                setLoginMethod("code");
                setOtpCode("");
                setOtpError(null);
                setOtpMessage(message || t('auth.page.code.stepUpFallback'));
              }}
            />
          )}
        </div>
      ) : (
        <div className="p-6 sm:p-8">
          <RegisterForm referralCode={referralCode} />
        </div>
      )}

        </div>

        {/* Toggle login/register */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setShowLogin(!showLogin)}
            className="text-[var(--color-xf-dark)]/40 hover:text-[var(--color-xf-dark)]/70 transition-colors text-sm"
          >
            {showLogin ? (
              <>{t('auth.page.switchToRegister')} <span className="font-semibold text-[var(--color-xf-primary)] ml-1">{t('auth.page.signUp')}</span></>
            ) : (
              <>{t('auth.page.switchToLogin')} <span className="font-semibold text-[var(--color-xf-primary)] ml-1">{t('auth.page.signIn')}</span></>
            )}
          </button>
        </div>

        {/* Back to home */}
        <div className="mt-4 text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-[var(--color-xf-dark)]/30 hover:text-[var(--color-xf-dark)]/60 transition-colors text-sm">
            <ArrowLeft className="h-4 w-4" />
            {t('auth.page.backToHome')}
          </Link>
        </div>
      </div>
    </div>
  );
}
