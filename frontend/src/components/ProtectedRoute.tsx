import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that protects user routes
 * Redirects to /auth if not authenticated
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: adminCheck, isLoading: checkingAdmin } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (loading || checkingAdmin) return;

    if (!isAuthenticated) {
      setLocation("/auth");
      return;
    }

    if (adminCheck?.isAdmin) {
      setLocation("/admin/dashboard");
    }
  }, [adminCheck?.isAdmin, checkingAdmin, isAuthenticated, loading, setLocation]);

  if (loading || (isAuthenticated && checkingAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (adminCheck?.isAdmin) {
    return null;
  }

  return <>{children}</>;
}
