import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { APP_TITLE } from "@/const";
import {
  GraduationCap,
  Sparkles,
  MessageSquare,
  Globe,
  LogOut,
  LayoutDashboard,
  Headphones,
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
  ];

  return (
    <div className="min-h-screen flex flex-col" dir={isRTL ? "rtl" : "ltr"}>
      {/* Sticky Nav */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/courses">
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                <GraduationCap className="h-7 w-7 text-blue-600" />
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent hidden sm:inline">
                  {APP_TITLE}
                </span>
              </div>
            </Link>

            {/* Center Nav */}
            <nav className="flex items-center gap-1">
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
                      <span className="hidden sm:inline">{item.label}</span>
                    </Button>
                  </Link>
                );
              })}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              {/* Language Toggle */}
              <button
                onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition"
              >
                <Globe className="w-3.5 h-3.5" />
                {language === "ar" ? "EN" : "عربي"}
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

      {/* Page Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
