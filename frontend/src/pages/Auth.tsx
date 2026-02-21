import { useEffect, useMemo, useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";
import { Button } from "@/components/ui/button";
import { APP_TITLE } from "@/const";
import { Link } from "wouter";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

export default function Auth() {
  const { t } = useLanguage();
  const [showLogin, setShowLogin] = useState(true);
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

      {showLogin ? <LoginForm /> : <RegisterForm />}

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
