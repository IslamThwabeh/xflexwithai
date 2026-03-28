import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

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

  const registerReferralMutation = trpc.points.registerReferral.useMutation();

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      // Register referral if code was captured from URL
      if (referralCode) {
        try {
          await registerReferralMutation.mutateAsync({ referralCode });
        } catch { /* referral registration is best-effort */ }
        localStorage.removeItem("xflex_referral_code");
      }
      // Reload page to refresh auth state
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

    // Validation
    if (!name || !email || !password || !phone || !city || !country) {
      setError(t('auth.register.allFieldsRequired'));
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

    registerMutation.mutate({ name, email, password, phone, city, country });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{t('auth.register.title')}</CardTitle>
        <CardDescription>{t('auth.register.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">{t('auth.register.fullName')}</Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('auth.register.namePlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.register.email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.register.emailPlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('auth.register.phone')}</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder={t('auth.register.phonePlaceholder')}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="city">{t('auth.register.city')}</Label>
              <Input
                id="city"
                name="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t('auth.register.cityPlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">{t('auth.register.country')}</Label>
              <Input
                id="country"
                name="country"
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder={t('auth.register.countryPlaceholder')}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.register.password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.register.passwordPlaceholder')}
              required
            />
            <p className="text-sm text-muted-foreground">
              {t('auth.register.passwordHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('auth.register.confirmPassword')}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('auth.register.passwordPlaceholder')}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.register.submitting')}
              </>
            ) : (
              t('auth.register.submit')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

