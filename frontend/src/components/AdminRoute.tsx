import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { getStaffLandingPage, ROLE_PAGE_ACCESS } from "@shared/const";

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Wrapper component that protects admin routes.
 * Allows both full admins and staff members with roles.
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, loading } = useAuth();
  const [location, setLocation] = useLocation();
  const { data: adminCheck, isLoading: checkingAdmin } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const currentPath = typeof window !== "undefined" ? window.location.pathname : location.split("?")[0];
  const allowedStaffPaths = new Set<string>();

  for (const role of adminCheck?.staffRoles ?? []) {
    for (const path of ROLE_PAGE_ACCESS[role] ?? []) {
      allowedStaffPaths.add(path);
    }
  }

  const isUnauthorizedStaffRoute = !!adminCheck?.isStaff
    && !adminCheck.isAdmin
    && currentPath !== "/admin/dashboard"
    && !allowedStaffPaths.has(currentPath);

  useEffect(() => {
    if (!loading && !checkingAdmin) {
      if (!isAuthenticated || (adminCheck && !adminCheck.isAdmin && !adminCheck.isStaff)) {
        setLocation("/admin/login");
        return;
      }

      if (adminCheck?.isStaff && !adminCheck.isAdmin && isUnauthorizedStaffRoute) {
        setLocation(getStaffLandingPage(adminCheck.staffRoles ?? []));
      }
    }
  }, [isAuthenticated, adminCheck, loading, checkingAdmin, isUnauthorizedStaffRoute, setLocation]);

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

  if (isUnauthorizedStaffRoute) {
    return null;
  }

  return <>{children}</>;
}
