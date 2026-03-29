import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const inputClass = "w-full px-4 py-3 rounded-xl bg-black/[0.03] border border-black/[0.08] text-[var(--color-xf-dark)] placeholder:text-black/25 focus:outline-none focus:ring-2 focus:ring-[var(--color-xf-primary)]/40 focus:border-[var(--color-xf-primary)]/40 transition-all";

export function LoginForm({ onSuccess, onRequireOtp, isAdmin = false }: { onSuccess?: () => void; onRequireOtp?: (email: string, message?: string) => void; isAdmin?: boolean }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      if (data?.requiresOtp) {
        onRequireOtp?.(email, data?.message);
        return;
      }
      window.location.reload();
      onSuccess?.();
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const adminLoginMutation = trpc.auth.adminLogin.useMutation({
    onSuccess: () => {
      window.location.reload();
      onSuccess?.();
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError(t('auth.login.allFieldsRequired'));
      return;
    }
    if (isAdmin) {
      adminLoginMutation.mutate({ email, password });
    } else {
      loginMutation.mutate({ email, password });
    }
  };

  const isPending = loginMutation.isPending || adminLoginMutation.isPending;

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--color-xf-dark)] mb-1">
        {isAdmin ? t('auth.login.adminTitle') : t('auth.login.title')}
      </h2>
      <p className="text-[var(--color-xf-dark)]/40 text-sm mb-5">
        {isAdmin ? t('auth.login.adminDescription') : t('auth.login.description')}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">{error}</div>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.login.email')}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('auth.login.emailPlaceholder')}
            required
            dir="ltr"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-[var(--color-xf-dark)]/60 mb-1.5">{t('auth.login.password')}</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('auth.login.passwordPlaceholder')}
            required
            className={inputClass}
          />
        </div>

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-[var(--color-xf-primary)] text-white font-semibold hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20"
          disabled={isPending}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('auth.login.submitting')}
            </span>
          ) : (
            t('auth.login.submit')
          )}
        </button>
      </form>
    </div>
  );
}

