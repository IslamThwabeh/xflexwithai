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

      <div className="w-full max-w-md backdrop-blur-xl bg-white/[0.06] border border-white/[0.10] rounded-2xl shadow-2xl p-6 sm:p-8 [&_h2]:text-white [&_p]:text-white/40 [&_label]:!text-white/60 [&_input]:bg-white/[0.08] [&_input]:border-white/[0.12] [&_input]:text-white [&_input]:placeholder:text-white/25">
        <LoginForm isAdmin={true} />
      </div>

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
