import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { isLikelyValidEmail, normalizeEmailAddress } from "@shared/emailValidation";

const inputClass = "w-full px-4 py-3 rounded-xl bg-black/[0.03] border border-black/[0.08] text-[var(--color-xf-dark)] placeholder:text-black/25 focus:outline-none focus:ring-2 focus:ring-[var(--color-xf-primary)]/40 focus:border-[var(--color-xf-primary)]/40 transition-all";

export function RegisterForm({ onSuccess, referralCode }: { onSuccess?: () => void; referralCode?: string | null }) {
  const { t } = useLanguage();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      if (referralCode) {
        localStorage.removeItem("xflex_referral_code");
      }
      window.location.reload();
      onSuccess?.();
    },
    onError: (error) => {
      if (error.message === "Invalid email format") {
        setError(t('auth.register.invalidEmail'));
        return;
      }
      setError(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const normalizedEmail = normalizeEmailAddress(email);

    if (!name || !email || !password || !phone || !city || !country) {
      setError(t('auth.register.allFieldsRequired'));
      return;
    }
    if (!isLikelyValidEmail(normalizedEmail)) {
      setError(t('auth.register.invalidEmail'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.register.passwordMismatch'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.register.passwordTooShort'));
      return;
    }
    registerMutation.mutate({ name, email: normalizedEmail, password, phone, city, country, referralCode: referralCode ?? undefined });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--color-xf-dark)] mb-1">{t('auth.register.title')}</h2>
      <p className="text-[var(--color-xf-dark)]/40 text-sm mb-5">{t('auth.register.description')}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.register.fullName')}</label>
          <input id="name" name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('auth.register.namePlaceholder')} required className={inputClass} />
        </div>

        <div>
          <label htmlFor="regEmail" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.register.email')}</label>
          <input id="regEmail" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.register.emailPlaceholder')} required dir="ltr" className={inputClass} />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.register.phone')}</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('auth.register.phonePlaceholder')} required className={inputClass} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.register.city')}</label>
            <input id="city" name="city" type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('auth.register.cityPlaceholder')} required className={inputClass} />
          </div>
          <div>
            <label htmlFor="country" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.register.country')}</label>
            <input id="country" name="country" type="text" value={country} onChange={(e) => setCountry(e.target.value)} placeholder={t('auth.register.countryPlaceholder')} required className={inputClass} />
          </div>
        </div>

        <div>
          <label htmlFor="regPassword" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.register.password')}</label>
          <input id="regPassword" name="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('auth.register.passwordPlaceholder')} required className={inputClass} />
          <p className="text-xs text-[var(--color-xf-dark)]/30 mt-1">{t('auth.register.passwordHint')}</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.register.confirmPassword')}</label>
          <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t('auth.register.passwordPlaceholder')} required className={inputClass} />
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-[var(--color-xf-primary)] text-white font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('auth.register.submitting')}
            </span>
          ) : (
            t('auth.register.submit')
          )}
        </button>
      </form>
    </div>
  );
}

