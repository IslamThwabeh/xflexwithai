import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export function LoginForm({ onSuccess, isAdmin = false }: { onSuccess?: () => void; isAdmin?: boolean }) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: () => {
      // Reload page to refresh auth state
      window.location.reload();
      onSuccess?.();
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  const adminLoginMutation = trpc.auth.adminLogin.useMutation({
    onSuccess: () => {
      // Reload page to refresh auth state and redirect
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
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{isAdmin ? t('auth.login.adminTitle') : t('auth.login.title')}</CardTitle>
        <CardDescription>
          {isAdmin ? t('auth.login.adminDescription') : t('auth.login.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">{t('auth.login.email')}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('auth.login.emailPlaceholder')}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('auth.login.password')}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.login.passwordPlaceholder')}
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('auth.login.submitting')}
              </>
            ) : (
              t('auth.login.submit')
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

