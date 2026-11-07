import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

export type SupportRecovery = { email: string; token: string };

export function readSupportRecoveryLink(): SupportRecovery | null {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get("recoveryToken");
  if (!token) return null;
  const email = params.get("email") || "";
  // Keep the credential in memory and out of subsequent navigation/referrers.
  window.history.replaceState({}, "", window.location.pathname + window.location.search);
  return { email, token };
}

const inputClass = "w-full rounded-xl border border-black/10 bg-black/[0.03] px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500";

export function PasswordRecoveryForm({ supportRecovery, initialEmail, onBack }: {
  supportRecovery: SupportRecovery | null;
  initialEmail: string;
  onBack: () => void;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [email, setEmail] = useState(supportRecovery?.email || initialEmail);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const request = trpc.auth.requestPasswordResetCode.useMutation();
  const reset = trpc.auth.resetPasswordWithOtp.useMutation();
  const supportReset = trpc.auth.resetPasswordWithSupportToken.useMutation();
  const pending = request.isPending || reset.isPending || supportReset.isPending;
  const canReset = !!supportRecovery || sent;
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    setError("");
    try {
      await request.mutateAsync({ email: email.trim() });
      setSent(true);
      setCooldown(30);
    } catch (err: any) { setError(err.message); }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canReset) return sendCode();
    setError("");
    if (password !== confirm) {
      setError(ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match.");
      return;
    }
    try {
      if (supportRecovery) {
        await supportReset.mutateAsync({ email: supportRecovery.email, token: supportRecovery.token, newPassword: password });
      } else {
        await reset.mutateAsync({ email: email.trim(), code, newPassword: password });
      }
      setPassword(""); setConfirm(""); setCode(""); setDone(true);
    } catch (err: any) { setError(err.message); }
  };

  return <div className="text-slate-900">
    <h2 className="mb-2 text-xl font-semibold">{ar ? "إعادة تعيين كلمة المرور" : "Reset password"}</h2>
    {done ? <div role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
      {ar ? "تم تغيير كلمة المرور. سجّل الدخول بكلمة المرور الجديدة. إذا كان حسابك يتطلب رمز تحقق إضافياً ولم يصلك، تواصل مع الدعم." : "Password updated. Sign in with your new password. If your account requires an additional verification code and it does not arrive, contact support."}
    </div> : <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-slate-600">{supportRecovery
        ? (ar ? "اختر كلمة مرور جديدة باستخدام رابط الاسترداد من الدعم." : "Choose a new password using your support recovery link.")
        : (ar ? "أدخل بريد حسابك لاستلام رمز إعادة تعيين كلمة المرور." : "Enter your account email to receive a password reset code.")}</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {sent && <p role="status" className="text-sm text-emerald-700">{ar ? "إذا كان الحساب مؤهلاً، فسيصلك رمز صالح لمدة 10 دقائق. تحقق من البريد غير المرغوب فيه أيضاً." : "If the account is eligible, a code valid for 10 minutes will arrive. Check your spam folder too."}</p>}
      <div>
        <label htmlFor="recovery-email" className="mb-1 block text-sm">{ar ? "البريد الإلكتروني" : "Email"}</label>
        <input id="recovery-email" type="email" autoComplete="email" dir="ltr" required readOnly={canReset} value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
      </div>
      {canReset && <>
        {!supportRecovery && <div>
          <label htmlFor="recovery-code" className="mb-1 block text-sm">{ar ? "رمز الاسترداد" : "Reset code"}</label>
          <input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required dir="ltr" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className={inputClass} />
        </div>}
        <p id="password-requirements" className="text-xs text-slate-600">{ar ? "8 أحرف على الأقل، تتضمن حرفاً إنجليزياً كبيراً وصغيراً ورقماً." : "At least 8 characters, including uppercase, lowercase, and a number."}</p>
        <div>
          <label htmlFor="recovery-password" className="mb-1 block text-sm">{ar ? "كلمة المرور الجديدة" : "New password"}</label>
          <input id="recovery-password" type="password" autoComplete="new-password" aria-describedby="password-requirements" minLength={8} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="recovery-confirm" className="mb-1 block text-sm">{ar ? "تأكيد كلمة المرور" : "Confirm password"}</label>
          <input id="recovery-confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirm} onChange={e => setConfirm(e.target.value)} className={inputClass} />
        </div>
      </>}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-[var(--color-xf-primary)] py-3 font-semibold text-white disabled:opacity-50">
        {pending ? (ar ? "جارٍ التنفيذ..." : "Please wait…") : canReset ? (ar ? "حفظ كلمة المرور" : "Save new password") : (ar ? "إرسال رمز الاسترداد" : "Send reset code")}
      </button>
      {sent && !supportRecovery && <div className="flex justify-between gap-3 text-sm">
        <button type="button" disabled={pending || cooldown > 0} onClick={sendCode} className="text-emerald-700 disabled:opacity-50">{ar ? "إعادة الإرسال" : "Resend code"}{cooldown > 0 ? ` (${cooldown}s)` : ""}</button>
        <button type="button" disabled={pending} onClick={() => { setSent(false); setCode(""); setError(""); }}>{ar ? "تغيير البريد" : "Change email"}</button>
      </div>}
    </form>}
    <div className="mt-5 space-y-3 text-sm">
      <p className="text-slate-600">{ar ? "لا يصلك البريد؟ تواصل مع الدعم للتحقق من هويتك والحصول على رابط استرداد." : "Email not arriving? Contact support to verify your identity and receive a recovery link."}</p>
      <a href="https://wa.me/972597596030" target="_blank" rel="noopener noreferrer" className="block font-medium text-emerald-700">{ar ? "الدعم عبر واتساب" : "Contact support on WhatsApp"}</a>
      <Link href="/contact" className="block text-emerald-700">{ar ? "طرق التواصل الأخرى" : "Other contact options"}</Link>
      <button type="button" disabled={pending} onClick={onBack} className="text-slate-600 underline">{ar ? "العودة لتسجيل الدخول" : "Back to sign in"}</button>
    </div>
  </div>;
}
