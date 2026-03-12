import { ReactNode, lazy, Suspense, useState } from "react";
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

const GlobalSearchDialogLazy = lazy(() => import("./GlobalSearchDialog"));
import { APP_TITLE } from "@/const";
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
  Search,
  Menu,
} from "lucide-react";

interface ClientLayoutProps {
  children: ReactNode;
  /** Optional extra content shown below the main nav (e.g. course progress bar) */
  subHeader?: ReactNode;
}

export default function ClientLayout({ children, subHeader }: ClientLayoutProps) {
  const { user, logout } = useAuth();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const [location] = useLocation();
  const [showSearch, setShowSearch] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    window.location.href = "/";
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
      href: "/orders",
      label: t("dashboard.nav.orders"),
      icon: <ShoppingBag className="h-4 w-4" />,
      match: "/orders",
    },
    {
      href: "/subscriptions",
      label: t("dashboard.nav.subscriptions"),
      icon: <Package className="h-4 w-4" />,
      match: "/subscriptions",
    },
    {
      href: "/profile",
      label: t("dashboard.nav.profile") || (language === "ar" ? "الملف الشخصي" : "Profile"),
      icon: <User className="h-4 w-4" />,
      match: "/profile",
    },
    {
      href: "/notifications",
      label: language === "ar" ? "الإشعارات" : "Notifications",
      icon: <Bell className="h-4 w-4" />,
      match: "/notifications",
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
    <div className="min-h-screen flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      {/* Sticky Nav */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
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
                  <GraduationCap className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600" />
                  <span className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hidden sm:inline">
                    {APP_TITLE}
                  </span>
                </div>
              </Link>
            </div>

            {/* Center Nav — desktop only */}
            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => {
                const isActive = location.startsWith(item.match);
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={
                        isActive
                          ? ""
                          : "text-gray-600 hover:text-gray-900"
                      }
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Search */}
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-1 p-1.5 sm:px-2 sm:py-1.5 rounded-full text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
              >
                <Search className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
              {/* Language Toggle */}
              <button
                onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-full text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
              >
                <Globe className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === "ar" ? "EN" : "عربي"}</span>
              </button>

              {/* User Avatar */}
              <div className="flex items-center gap-1.5">
                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </div>
                <span className="text-sm font-medium hidden md:inline max-w-[100px] truncate">
                  {user?.name}
                </span>
              </div>

              {/* Logout */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
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
        <SheetContent side={isRTL ? "right" : "left"} className="w-72 p-0">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-blue-600" />
              <span className="font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {APP_TITLE}
              </span>
            </SheetTitle>
          </SheetHeader>

          {/* User info */}
          <div className="p-4 border-b bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                {user?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto p-2">
            {navItems.map((item) => {
              const isActive = location.startsWith(item.match);
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                      isActive
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span className={isActive ? "text-blue-600" : "text-gray-400"}>
                      {item.icon}
                    </span>
                    {item.label}
                  </button>
                </Link>
              );
            })}
          </nav>

          {/* Footer actions */}
          <div className="border-t p-3 space-y-2">
            <button
              onClick={() => { setLanguage(language === "ar" ? "en" : "ar"); setMobileMenuOpen(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition"
            >
              <Globe className="h-4 w-4 text-gray-400" />
              {language === "ar" ? "Switch to English" : "التبديل إلى العربية"}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition"
            >
              <LogOut className="h-4 w-4" />
              {t("dashboard.logout")}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Page Content */}
      <main className="flex-1">{children}</main>

      {showSearch && (
        <Suspense fallback={null}>
          <GlobalSearchDialogLazy onClose={() => setShowSearch(false)} />
        </Suspense>
      )}
    </div>
  );
}
