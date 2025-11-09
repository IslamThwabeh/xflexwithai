import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_TITLE, getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Shield, LogIn } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AdminLogin() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const { data: adminCheck, isLoading: checkingAdmin } = trpc.auth.isAdmin.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    // If user is authenticated and is an admin, redirect to admin dashboard
    if (isAuthenticated && adminCheck?.isAdmin) {
      setLocation("/admin");
    }
  }, [isAuthenticated, adminCheck, setLocation]);

  if (loading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // If authenticated but not an admin
  if (isAuthenticated && adminCheck && !adminCheck.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have administrator privileges. Please contact the system administrator if you believe this is an error.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setLocation("/")} variant="outline">
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated - show login
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl">Admin Panel</CardTitle>
          <CardDescription>
            {APP_TITLE} - Administrator Access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Please sign in with your administrator account to access the admin panel.
          </p>
          <a href={getLoginUrl()} className="block">
            <Button className="w-full" size="lg">
              <LogIn className="mr-2 h-5 w-5" />
              Sign In as Administrator
            </Button>
          </a>
          <div className="text-center">
            <Button variant="link" onClick={() => setLocation("/")}>
              Return to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
