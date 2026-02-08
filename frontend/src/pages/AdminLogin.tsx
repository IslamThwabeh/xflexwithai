import { LoginForm } from "@/components/LoginForm";
import { APP_TITLE } from "@/const";
import { Link, useLocation } from "wouter";
import { GraduationCap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";

export default function AdminLogin() {
  const { t } = useLanguage();
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: adminCheck, isLoading: checkingAdmin } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Redirect to dashboard if already authenticated as admin
  useEffect(() => {
    if (!loading && !checkingAdmin && isAuthenticated && adminCheck?.isAdmin) {
      setLocation("/admin/dashboard");
    }
  }, [isAuthenticated, adminCheck, loading, checkingAdmin, setLocation]);

  // Show loading while checking auth
  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <p className="text-white">Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="mb-8 text-center">
        <Link href="/">
          <div className="flex items-center gap-2 justify-center cursor-pointer hover:opacity-80 transition-opacity mb-4">
            <GraduationCap className="h-10 w-10 text-blue-500" />
            <h1 className="text-3xl font-bold text-white">
              {APP_TITLE}
            </h1>
          </div>
        </Link>
        <p className="text-slate-300">
          {t('auth.login.adminTitle')}
        </p>
      </div>

      <LoginForm isAdmin={true} />

      <div className="mt-6">
        <Link href="/">
          <button className="text-slate-400 hover:text-white transition-colors">
            {t('auth.page.backToHome')}
          </button>
        </Link>
      </div>
    </div>
  );
}
