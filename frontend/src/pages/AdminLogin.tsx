import { LoginForm } from "@/components/LoginForm";
import { APP_TITLE } from "@/const";
import { Link, useLocation } from "wouter";
import { GraduationCap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function AdminLogin() {
  const { t } = useLanguage();
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: adminCheck, isLoading: checkingAdmin } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Show toast when redirected due to idle timeout
  const idleToastShown = useRef(false);
  useEffect(() => {
    if (idleToastShown.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "idle") {
      idleToastShown.current = true;
      toast.warning("Session expired due to inactivity. Please log in again.");
      params.delete("reason");
      const clean = params.toString();
      window.history.replaceState({}, "", window.location.pathname + (clean ? `?${clean}` : ""));
    }
  }, []);

  // Redirect to dashboard if already authenticated as admin
  useEffect(() => {
    if (!loading && !checkingAdmin && isAuthenticated && adminCheck?.isAdmin) {
      setLocation("/admin/dashboard");
    }
  }, [isAuthenticated, adminCheck, loading, checkingAdmin, setLocation]);

  // Show loading while checking auth
  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-xf-cream)]">
        <p className="text-slate-600">Loading...</p>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-xf-cream)] p-4">
      <div className="mb-8 text-center">
        <Link href="/">
          <div className="flex items-center gap-2 justify-center cursor-pointer hover:opacity-80 transition-opacity mb-4">
            <GraduationCap className="h-10 w-10 text-emerald-600" />
            <h1 className="text-3xl font-bold text-slate-800">
              {APP_TITLE}
            </h1>
          </div>
        </Link>
        <p className="text-slate-500">
          {t('auth.login.adminTitle')}
        </p>
      </div>

      <div className="w-full max-w-md backdrop-blur-xl bg-white/80 border border-emerald-100 rounded-2xl shadow-xl p-6 sm:p-8">
        <LoginForm isAdmin={true} />
      </div>

      <div className="mt-6">
        <Link href="/">
          <button className="text-slate-500 hover:text-emerald-600 transition-colors">
            {t('auth.page.backToHome')}
          </button>
        </Link>
      </div>
    </div>
  );
}
