import { useEffect, useMemo, useRef, useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";
import { APP_TITLE } from "@/const";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Loader2, Mail, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { getStaffLandingPage } from "@shared/const";
import CinematicPublicLayout from "@/components/public/CinematicPublicLayout";

function shouldOpenRegisterByDefault() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode");
  const hasReferral = !!params.get("ref");
  const path = window.location.pathname;

  if (path === "/register") return true;
  if (mode === "register") return true;
  if (hasReferral) return true;

  return false;
}

export default function Auth() {
  const { t, language } = useLanguage();
  const isRtl = language === "ar";
  const [showLogin, setShowLogin] = useState(() => !shouldOpenRegisterByDefault());
  const [loginMethod, setLoginMethod] = useState<"code" | "password">("code");
  const [otpStep, setOtpStep] = useState<"request" | "verify">("request");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const { isAuthenticated, loading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const lastAutoSubmittedCode = useRef("");
  const [clearingAdmin, setClearingAdmin] = useState(false);

  const nextPath = useMemo(() => {
    if (typeof window === "undefined") return null;
    const next = new URLSearchParams(window.location.search).get("next");
    if (!next) return null;
    if (!next.startsWith("/")) return null;
    if (next.startsWith("/admin")) return null;
    return next;
  }, [location]);

  const referralCode = useMemo(() => {
    if (typeof window === "undefined") return null;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && /^[A-Z0-9]{4,10}$/i.test(ref)) {
      localStorage.setItem("xflex_referral_code", ref);
      return ref;
    }
    return localStorage.getItem("xflex_referral_code");
  }, [location]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const hasReferral = !!params.get("ref");
    const path = window.location.pathname;

    if (path === "/register" || mode === "register" || hasReferral) {
      setShowLogin(false);
      return;
    }

    if (mode === "login") {
      setShowLogin(true);
    }
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
    setOtpEmail((prev) => (prev ? prev : prefillEmail));
  }, [prefillEmail]);

  const idleToastShown = useRef(false);
  useEffect(() => {
    if (idleToastShown.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "idle") {
      idleToastShown.current = true;
      toast.warning(isRtl ? "انتهت الجلسة بسبب عدم النشاط. يرجى تسجيل الدخول مرة أخرى." : "Session expired due to inactivity. Please log in again.");
      params.delete("reason");
      const clean = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (clean ? `?${clean}` : ""));
    }
  }, [isRtl]);

  const { data: adminCheck, isLoading: checkingAdmin } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (loading || checkingAdmin || clearingAdmin) return;
    if (!isAuthenticated) return;

    if (adminCheck?.isAdmin) {
      setClearingAdmin(true);
      logout().finally(() => setClearingAdmin(false));
      return;
    }

    if (adminCheck?.isStaff) {
      const staffRoles: string[] = adminCheck.staffRoles ?? [];
      const landing = getStaffLandingPage(staffRoles);
      window.location.href = landing;
      return;
    }

    setLocation(nextPath ?? "/courses");
  }, [adminCheck?.isAdmin, adminCheck?.isStaff, adminCheck?.staffRoles, checkingAdmin, isAuthenticated, loading, nextPath, setLocation, clearingAdmin, logout]);

  const requestLoginCode = trpc.auth.requestLoginCode.useMutation();
  const verifyLoginCode = trpc.auth.verifyLoginCode.useMutation();

  useEffect(() => {
    if (resendCooldownSec <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldownSec]);

  const handleSendCode = async () => {
    setOtpError(null);
    setOtpMessage(null);
    const email = otpEmail.trim();
    if (!email) {
      setOtpError(t("auth.page.code.emailRequired"));
      return;
    }

    try {
      try {
        window.localStorage.setItem("xflex_last_email", email);
      } catch {}

      await requestLoginCode.mutateAsync({ email });
      setOtpStep("verify");
      setResendCooldownSec(30);
      setOtpMessage(t("auth.page.code.sentMessage"));
    } catch (e: any) {
      setOtpError(e?.message || t("auth.page.code.sendFailed"));
    }
  };

  const handleVerifyCode = async () => {
    setOtpError(null);
    setOtpMessage(null);
    const email = otpEmail.trim();
    const code = otpCode.trim();

    if (!email) {
      setOtpError(t("auth.page.code.emailRequired"));
      return;
    }
    if (!code) {
      setOtpError(t("auth.page.code.codeRequired"));
      return;
    }

    try {
      const result = await verifyLoginCode.mutateAsync({ email, code });
      if (result.isStaff) {
        window.location.href = getStaffLandingPage(result.staffRoles ?? []);
      } else {
        window.location.href = nextPath ?? "/courses";
      }
    } catch (e: any) {
      setOtpError(e?.message || t("auth.page.code.invalid"));
    }
  };

  const handleVerifyCodeRef = useRef(handleVerifyCode);
  handleVerifyCodeRef.current = handleVerifyCode;

  useEffect(() => {
    const cleaned = otpCode.replace(/\D/g, "");
    if (otpStep === "verify" && cleaned.length >= 6 && cleaned !== lastAutoSubmittedCode.current && !verifyLoginCode.isPending) {
      lastAutoSubmittedCode.current = cleaned;
      handleVerifyCodeRef.current();
    }
  }, [otpCode, otpStep, verifyLoginCode.isPending]);

  useEffect(() => {
    if (otpStep === "request") {
      lastAutoSubmittedCode.current = "";
      setOtpCode("");
    }
  }, [otpStep]);

  const handleOtpFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpStep === "request") handleSendCode();
    else handleVerifyCode();
  };

  const authHighlights = isRtl
    ? [
        { icon: TrendingUp, title: "بوابة دخول واحدة", body: "ادخل إلى حسابك أو أنشئ حساباً جديداً بخطوات واضحة حتى تبدأ رحلتك التعليمية بثقة." },
        { icon: ShieldCheck, title: "دخول آمن وواضح", body: "رمز تحقق أو كلمة مرور بحسب ما يناسبك، مع تجربة سريعة ومريحة على الجوال والكمبيوتر." },
        { icon: Sparkles, title: "جاهز من أول خطوة", body: "بعد تسجيل الدخول تستطيع متابعة الدورات، التوصيات، وخدمات الباقة من مكان واحد." },
      ]
    : [
        { icon: TrendingUp, title: "One clear entry point", body: "Sign in or create your account through a simple flow that gets you started with confidence." },
        { icon: ShieldCheck, title: "Secure, familiar access", body: "Use OTP or password login, whichever fits your situation, with a fast and comfortable experience on mobile and desktop." },
        { icon: Sparkles, title: "Ready from the first step", body: "Once you sign in, you can move straight into your courses, recommendations, and package services from one place." },
      ];

  return (
    <CinematicPublicLayout primaryAction={null}>
      <section className="relative overflow-hidden py-10 md:py-14" dir={isRtl ? "rtl" : "ltr"}>
        <div className="container mx-auto px-4 md:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#00C176]/25 bg-[#00C176]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#00C176]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00C176]" style={{ boxShadow: "0 0 8px #00C176" }} />
                {isRtl ? "الدخول إلى XFlex" : "Access XFlex"}
              </div>

              <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] text-white md:text-5xl">
                {isRtl ? "سجّل الدخول وابدأ بثقة." : "Sign in and get started with confidence."}
              </h1>
              <p className="mt-5 text-base leading-8 text-white/62 md:text-lg">
                {isRtl
                  ? "الدخول أو إنشاء الحساب يتم بخطوات واضحة وسريعة حتى تصل إلى محتواك وخدماتك من دون تعقيد."
                  : "Sign in or create your account through a clear, fast flow that gets you back to your content and services without friction."}
              </p>

              <div className="mt-8 grid gap-3">
                {authHighlights.map(({ icon: Icon, title, body }) => (
                  <div key={title} className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#00C176]/12">
                        <Icon className="h-4.5 w-4.5 text-[#00C176]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{title}</p>
                        <p className="mt-1.5 text-sm leading-6 text-white/56">{body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="w-full max-w-md lg:ms-auto">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.96] p-1 shadow-[0_28px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl">
                <div className="rounded-[1.7rem] bg-white px-4 py-6 sm:px-6 sm:py-8">
                  <div className="mb-8 text-center">
                    <Link href="/">
                      <h2 className="cursor-pointer text-3xl font-bold tracking-tight text-[var(--color-xf-dark)] transition-colors hover:text-[var(--color-xf-primary)]">
                        {APP_TITLE}
                      </h2>
                    </Link>
                    <p className="mt-2 text-sm text-[var(--color-xf-dark)]/50">{t("auth.page.tagline")}</p>
                  </div>

                  <div className="overflow-hidden rounded-[1.45rem] border border-black/[0.06] bg-white shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
                    {referralCode && !showLogin ? (
                      <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-3 text-sm text-emerald-700 sm:px-8">
                        {t("auth.register.title")}: {referralCode}
                      </div>
                    ) : null}

                    {showLogin ? (
                      <div className="p-6 sm:p-8">
                        <div className="mb-6 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setLoginMethod("code");
                              setOtpError(null);
                              setOtpMessage(null);
                            }}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                              loginMethod === "code"
                                ? "bg-[var(--color-xf-primary)] text-white shadow-lg shadow-emerald-500/25"
                                : "bg-black/[0.04] text-[var(--color-xf-dark)]/50 hover:bg-black/[0.08] hover:text-[var(--color-xf-dark)]/70"
                            }`}
                          >
                            <Mail className="h-4 w-4" />
                            {t("auth.page.loginMethod.code")}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setLoginMethod("password");
                              setOtpError(null);
                              setOtpMessage(null);
                            }}
                            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                              loginMethod === "password"
                                ? "bg-[var(--color-xf-primary)] text-white shadow-lg shadow-emerald-500/25"
                                : "bg-black/[0.04] text-[var(--color-xf-dark)]/50 hover:bg-black/[0.08] hover:text-[var(--color-xf-dark)]/70"
                            }`}
                          >
                            <KeyRound className="h-4 w-4" />
                            {t("auth.page.loginMethod.password")}
                          </button>
                        </div>

                        {loginMethod === "code" ? (
                          <form onSubmit={handleOtpFormSubmit}>
                            <h2 className="mb-1 text-xl font-semibold text-[var(--color-xf-dark)]">{t("auth.page.code.title")}</h2>
                            <p className="mb-5 text-sm text-[var(--color-xf-dark)]/40">{t("auth.page.code.description")}</p>

                            {otpError ? (
                              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{otpError}</div>
                            ) : null}
                            {otpMessage ? (
                              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{otpMessage}</div>
                            ) : null}

                            <div className="space-y-4">
                              <div>
                                <label htmlFor="otpEmail" className="mb-1.5 block text-sm font-medium text-[var(--color-xf-dark)]/60">
                                  {t("auth.page.code.email")}
                                </label>
                                <input
                                  id="otpEmail"
                                  name="email"
                                  type="email"
                                  autoComplete="email"
                                  value={otpEmail}
                                  onChange={(e) => setOtpEmail(e.target.value)}
                                  placeholder="name@example.com"
                                  dir="ltr"
                                  className="w-full rounded-xl border border-black/[0.08] bg-black/[0.03] px-4 py-3 text-[var(--color-xf-dark)] placeholder:text-black/25 transition-all focus:border-[var(--color-xf-primary)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-xf-primary)]/40"
                                />
                              </div>

                              {otpStep === "verify" ? (
                                <div>
                                  <label htmlFor="otpCode" className="mb-1.5 block text-sm font-medium text-[var(--color-xf-dark)]/60">
                                    {t("auth.page.code.code")}
                                  </label>
                                  <input
                                    id="otpCode"
                                    name="otp"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    value={otpCode}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                                      setOtpCode(val);
                                    }}
                                    placeholder="000000"
                                    dir="ltr"
                                    maxLength={6}
                                    autoFocus
                                    className="w-full rounded-xl border border-black/[0.08] bg-black/[0.03] px-4 py-3.5 text-center font-mono text-xl tracking-[0.35em] text-[var(--color-xf-dark)] placeholder:text-black/15 transition-all focus:border-[var(--color-xf-primary)]/40 focus:outline-none focus:ring-2 focus:ring-[var(--color-xf-primary)]/40"
                                  />
                                </div>
                              ) : null}

                              <div className="flex gap-2 pt-1">
                                {otpStep === "request" ? (
                                  <button
                                    type="submit"
                                    className="flex-1 rounded-xl bg-[var(--color-xf-primary)] py-3 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={requestLoginCode.isPending || resendCooldownSec > 0}
                                  >
                                    {requestLoginCode.isPending ? (
                                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                    ) : resendCooldownSec > 0 ? (
                                      `${t("auth.page.code.send")} (${resendCooldownSec}s)`
                                    ) : (
                                      t("auth.page.code.send")
                                    )}
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="flex-1 rounded-xl bg-black/[0.04] py-3 font-medium text-[var(--color-xf-dark)]/60 transition-all hover:bg-black/[0.08] hover:text-[var(--color-xf-dark)]/80 disabled:opacity-40"
                                      onClick={handleSendCode}
                                      disabled={requestLoginCode.isPending || resendCooldownSec > 0}
                                    >
                                      {resendCooldownSec > 0 ? `${t("auth.page.code.resend")} (${resendCooldownSec}s)` : t("auth.page.code.resend")}
                                    </button>
                                    <button
                                      type="submit"
                                      className="flex-1 rounded-xl bg-[var(--color-xf-primary)] py-3 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                                      disabled={verifyLoginCode.isPending}
                                    >
                                      {verifyLoginCode.isPending ? (
                                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                                      ) : (
                                        t("auth.page.code.verify")
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
                              setOtpMessage(message || t("auth.page.code.stepUpFallback"));
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

                  <div className="mt-6 text-center">
                    <button
                      type="button"
                      onClick={() => setShowLogin(!showLogin)}
                      className="text-sm text-[var(--color-xf-dark)]/40 transition-colors hover:text-[var(--color-xf-dark)]/70"
                    >
                      {showLogin ? (
                        <>
                          {t("auth.page.switchToRegister")} <span className="ml-1 font-semibold text-[var(--color-xf-primary)]">{t("auth.page.signUp")}</span>
                        </>
                      ) : (
                        <>
                          {t("auth.page.switchToLogin")} <span className="ml-1 font-semibold text-[var(--color-xf-primary)]">{t("auth.page.signIn")}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-4 text-center">
                    <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-xf-dark)]/30 transition-colors hover:text-[var(--color-xf-dark)]/60">
                      <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
                      {t("auth.page.backToHome")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </CinematicPublicLayout>
  );
}