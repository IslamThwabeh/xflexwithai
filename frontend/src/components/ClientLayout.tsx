import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { APP_TITLE } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  GraduationCap,
  Sparkles,
  MessageSquare,
  Globe,
  LogOut,
  LayoutDashboard,
  Headphones,
  ShoppingBag,
  Package,
  ClipboardCheck,
  User,
  Bell,
  Award,
  Calculator,
  Menu,
  Building2,
} from "lucide-react";

interface ClientLayoutProps {
  children: ReactNode;
  /** Optional extra content shown below the main nav (e.g. course progress bar) */
  subHeader?: ReactNode;
}

function getPreferredLanguageFromNotificationPrefs(notificationPrefs: string | null | undefined): "ar" | "en" | null {
  try {
    const prefs = JSON.parse(notificationPrefs || "{}");
    return prefs.language === "en" || prefs.language === "ar" ? prefs.language : null;
  } catch {
    return null;
  }
}

export default function ClientLayout({ children, subHeader }: ClientLayoutProps) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const lastInteractionAtRef = useRef(0);
  const hydratedLanguageForUserIdRef = useRef<number | null>(null);

  const { data: unreadNotifData } = trpc.notifications.unreadCount.useQuery(undefined, { refetchInterval: 30_000 });
  const touchInteractionMutation = trpc.users.touchInteraction.useMutation();
  const updateNotificationPrefsMutation = trpc.users.updateNotificationPrefs.useMutation();
  const unreadNotifCount = unreadNotifData?.count ?? 0;

  useEffect(() => {
    if (!user?.id) {
      hydratedLanguageForUserIdRef.current = null;
      return;
    }

    if (hydratedLanguageForUserIdRef.current === user.id) {
      return;
    }

    const preferredLanguage = getPreferredLanguageFromNotificationPrefs((user as any)?.notificationPrefs);
    if (preferredLanguage && preferredLanguage !== language) {
      setLanguage(preferredLanguage);
    }

    hydratedLanguageForUserIdRef.current = user.id;
  }, [language, setLanguage, user]);

  useEffect(() => {
    if (!user) return;

    const touchInteraction = () => {
      const now = Date.now();
      if (now - lastInteractionAtRef.current < 60_000) return;
      lastInteractionAtRef.current = now;
      touchInteractionMutation.mutate();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        touchInteraction();
      }
    };

    touchInteraction();

    window.addEventListener("pointerdown", touchInteraction, { passive: true });
    window.addEventListener("keydown", touchInteraction);
    window.addEventListener("touchstart", touchInteraction, { passive: true });
    window.addEventListener("focus", touchInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointerdown", touchInteraction);
      window.removeEventListener("keydown", touchInteraction);
      window.removeEventListener("touchstart", touchInteraction);
      window.removeEventListener("focus", touchInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [touchInteractionMutation, user]);

  const handleLogout = async () => {
    try { window.localStorage.removeItem("xflex_last_email"); } catch {}
    await logout();
    window.location.href = "/";
  };

  const toggleLanguagePreference = () => {
    const nextLanguage = language === "ar" ? "en" : "ar";
    setLanguage(nextLanguage);

    if (user) {
      updateNotificationPrefsMutation.mutate({ language: nextLanguage });
    }
  };

  const navItems = [
    {
      href: "/courses",
      label: t("dashboard.nav.dashboard"),
      icon: <LayoutDashboard className="h-4 w-4" />,
      match: "/courses",
    },
    {
      href: "/lexai",
      label: "LexAI",
      icon: <Sparkles className="h-4 w-4" />,
      match: "/lexai",
    },
    {
      href: "/recommendations",
      label: t("dashboard.nav.rec"),
      icon: <MessageSquare className="h-4 w-4" />,
      match: "/recommendations",
    },
    {
      href: "/support",
      label: t("dashboard.nav.support"),
      icon: <Headphones className="h-4 w-4" />,
      match: "/support",
    },
    {
      href: "/quiz",
      label: t("dashboard.nav.quizzes"),
      icon: <ClipboardCheck className="h-4 w-4" />,
      match: "/quiz",
    },
    {
      href: "/my-packages",
      label: language === "ar" ? "باقتي" : "My Package",
      icon: <Package className="h-4 w-4" />,
      match: "/my-packages",
    },
    {
      href: "/broker-onboarding",
      label: language === "ar" ? "الوسطاء" : "Brokers",
      icon: <Building2 className="h-4 w-4" />,
      match: "/broker",
    },
    {
      href: "/notifications",
      label: language === "ar" ? "الإشعارات" : "Notifications",
      icon: <Bell className="h-4 w-4" />,
      match: "/notifications",
      badge: unreadNotifCount,
    },
    {
      href: "/my-points",
      label: language === "ar" ? "النقاط" : "Points",
      icon: <Award className="h-4 w-4" />,
      match: "/my-points",
    },
    {
      href: "/calculators",
      label: language === "ar" ? "الحاسبات" : "Calculators",
      icon: <Calculator className="h-4 w-4" />,
      match: "/calculators",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky Nav — always LTR so buttons stay in place regardless of language */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50" dir="ltr">
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between">
            {/* Left: Hamburger (mobile) + Logo */}
            <div className="flex items-center gap-2">
              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-1.5 rounded-md text-gray-600 hover:bg-gray-100 transition"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <Link href="/courses">
                <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                  <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-600" />
                  <span className="text-lg sm:text-xl font-bold text-[var(--color-xf-dark)] hidden sm:inline">
                    {APP_TITLE}
                  </span>
                </div>
              </Link>
            </div>

            {/* Center Nav — desktop only */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.startsWith(item.match);
                const badgeCount = item.badge ?? 0;
                return (
                  <Link key={item.href} href={item.href}>
                    <button
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-[var(--color-xf-primary)] text-white shadow-sm shadow-emerald-500/20"
                          : "text-[var(--color-xf-dark)]/60 hover:text-[var(--color-xf-dark)] hover:bg-black/[0.04]"
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                      {badgeCount > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {badgeCount > 99 ? '99+' : badgeCount}
                        </span>
                      )}
                    </button>
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Language Toggle */}
              <button
                onClick={toggleLanguagePreference}
                className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-full text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{language === "ar" ? "EN" : "عربي"}</span>
              </button>

              {/* User Avatar — links to profile */}
              <Link href="/profile">
                <div className="cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-semibold ring-2 ring-emerald-300/50 hover:ring-emerald-400 transition-all" title={user?.name || ''}>
                    {(() => {
                      const parts = (user?.name || '').trim().split(/\s+/);
                      const f = parts[0]?.charAt(0).toUpperCase() || 'U';
                      const l = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : '';
                      return f + l;
                    })()}
                  </div>
                </div>
              </Link>

              {/* Logout */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLogoutDialog(true)}
                className="text-gray-400 hover:text-red-600 px-1.5"
                title={t("dashboard.logout")}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Optional sub-header (e.g. course progress) */}
        {subHeader}
      </header>

      {/* Mobile Navigation Drawer */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-72 p-0" dir={isRTL ? "rtl" : "ltr"}>
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-emerald-600" />
              <span className="font-bold text-[var(--color-xf-dark)]">
                {APP_TITLE}
              </span>
            </SheetTitle>
          </SheetHeader>

          {/* User info — links to profile */}
          <Link href="/profile">
            <div className="p-4 border-b bg-gray-50 cursor-pointer hover:bg-gray-100 transition" onClick={() => setMobileMenuOpen(false)}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 flex items-center justify-center text-white font-semibold ring-2 ring-emerald-300/50">
                  {(() => {
                    const parts = (user?.name || '').trim().split(/\s+/);
                    const f = parts[0]?.charAt(0).toUpperCase() || 'U';
                    const l = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : '';
                    return f + l;
                  })()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
            </div>
          </Link>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto p-2">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.match);
              const badgeCount = item.badge ?? 0;
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className={isActive ? "text-emerald-600" : "text-gray-400"}>
                      {item.icon}
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </button>
                </Link>
              );
            })}
          </nav>

          {/* Footer actions */}
          <div className="border-t p-3 space-y-2">
            <button
              onClick={() => { toggleLanguagePreference(); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition"
            >
              <Globe className="h-4 w-4 text-gray-400" />
              {language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); setShowLogoutDialog(true); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="h-4 w-4" />
              {t("dashboard.logout")}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page Content */}
      {/* Main content — respects RTL */}
      <main className="flex-1" dir={isRTL ? "rtl" : "ltr"}>{children}</main>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent dir={isRTL ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isRTL ? "تأكيد تسجيل الخروج" : "Confirm Logout"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL ? "هل أنت متأكد من أنك تريد تسجيل الخروج؟" : "Are you sure you want to log out?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {isRTL ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout} className="bg-red-600 hover:bg-red-700">
              {isRTL ? "تسجيل الخروج" : "Log Out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
