import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that protects admin routes.
 * Allows both full admins and staff members with roles.
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: adminCheck, isLoading: checkingAdmin } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!loading && !checkingAdmin) {
      if (!isAuthenticated || (adminCheck && !adminCheck.isAdmin && !adminCheck.isStaff)) {
        setLocation("/admin/login");
      }
    }
  }, [isAuthenticated, adminCheck, loading, checkingAdmin, setLocation]);

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || (!adminCheck?.isAdmin && !adminCheck?.isStaff)) {
    return null;
  }

  return <>{children}</>;
}
