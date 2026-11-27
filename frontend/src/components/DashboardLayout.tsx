import AdminNavigation, { useAdminNavigationFavorites } from "./navigation/AdminNavigation";
import NavigationSearchDialog from "./navigation/NavigationSearchDialog";
import InterfaceAnnouncement from "./navigation/InterfaceAnnouncement";
import { ADMIN_NAVIGATION_GROUPS, findActiveNavigationPath } from "@/lib/navigationV2";
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard,
  LogOut,
  Users,
  BookOpen,
  Key,
  MessageSquare,
  Shield,
  Headphones,
  Globe,
  Package,
  Radio,
  ShoppingCart,
  CalendarDays,
  FileText,
  ClipboardCheck,
  ClipboardList,
  Tag,
  MessageSquareQuote,
  Clock,
  DollarSign,
  Briefcase,
  Search,
  Star,
  Bell,
  Award,
  Activity,
  Bug,
  Building2,
  FileCheck,
  Moon,
  Sun,
  ChevronDown,
  BarChart3,
  Megaphone,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Settings2,
  Mail,
  Boxes,
  Sparkles,
  X,
  User,
} from "lucide-react";
import {
  CSSProperties,
  useEffect,
  useRef,
  useState,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Link, useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { getLanguageSwitchLabel } from "@/lib/languageToggle";
import { getVisibleAdminMenuSections } from "@/lib/adminNavigationAccess";
import type { LocalizedMenuLabel } from "@/lib/adminNavigationCatalog";
import { getAdminFeatureByPath } from "@shared/adminFeatureCatalog";

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
      return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : DEFAULT_WIDTH;
    } catch { return DEFAULT_WIDTH; }
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString()); } catch { /* Storage is optional. */ }
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f6f8f8] dark:bg-[#0b1120]">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <div className="relative group">
              <div className="relative">
                <img
                  src={APP_LOGO}
                  alt={APP_TITLE}
                  className="h-20 w-20 rounded-xl object-cover shadow"
                />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {APP_TITLE}
              </h1>
              <p className="text-sm text-muted-foreground">
                Please sign in to continue
              </p>
            </div>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const [location, setLocation] = useLocation();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const profileLabel = language === "ar" ? "الملف الشخصي والإعدادات" : "Profile & settings";
  const [isPageVisible, setIsPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );
  const wasPageVisibleRef = useRef(isPageVisible);
  const menuLabel = (entry: { labelKey: string; label?: LocalizedMenuLabel }) =>
    entry.labelKey === 'admin.sidebar.subscriberPayments'
      ? t('admin.sidebar.subscribers')
      : entry.label?.[language] ?? t(entry.labelKey);
  const { state, toggleSidebar, setOpenMobile } = useSidebar();

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
  const { theme, toggleTheme } = useTheme();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [showAdminSearch, setShowAdminSearch] = useState(false);
  const [showPageSearch, setShowPageSearch] = useState(false);
  const { favorites, toggleFavorite } = useAdminNavigationFavorites(user?.id ?? 0);
  const openPageSearch = () => { setOpenMobile(false); setShowPageSearch(true); };
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Check admin/staff status for sidebar filtering
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery();
  const { data: financeAuthority } = trpc.roles.myFinanceAuthority.useQuery(undefined, {
    enabled: adminCheck?.isAdmin === true,
    retry: false,
  });
  const staffRolesForAvailability = adminCheck?.staffRoles ?? [];
  const { data: staffEnrollments } = trpc.enrollments.myEnrollments.useQuery(
    undefined,
    {
      enabled: adminCheck?.isStaff === true && adminCheck?.isAdmin !== true,
      retry: false,
    }
  );
  const hasEmployeeTraining = (staffEnrollments?.length ?? 0) > 0;
  const canReadStaffNotifications =
    !!adminCheck?.isAdmin || !!adminCheck?.isStaff;
  const { data: performanceAvailability } =
    trpc.staffPerformance.availability.useQuery(undefined, {
      enabled: canReadStaffNotifications,
      retry: false,
    });
  const { data: surveyAvailability } =
    trpc.studentSurveys.availability.useQuery(undefined, {
      enabled:
        !!adminCheck?.isAdmin ||
        staffRolesForAvailability.includes("student_surveys_manager"),
      retry: false,
    });
  const { data: communityAvailability } = trpc.community.availability.useQuery(
    undefined,
    {
      enabled:
        !!adminCheck?.isAdmin ||
        staffRolesForAvailability.includes("student_community_moderator"),
      retry: false,
    }
  );
  const { data: rewardsAvailability } =
    trpc.points.rewardsAvailability.useQuery(undefined, {
      enabled:
        !!adminCheck?.isAdmin ||
        staffRolesForAvailability.includes("loyalty_rewards_manager"),
      retry: false,
    });
  const { data: jobEligibilityAvailability } =
    trpc.studentJobEligibility.availability.useQuery(undefined, {
      enabled:
        !!adminCheck?.isAdmin ||
        staffRolesForAvailability.includes("student_job_eligibility_manager"),
      retry: false,
    });
  const { data: featureOverview } = trpc.adminSettings.featureOverview.useQuery(
    undefined,
    {
      enabled: adminCheck?.isAdmin === true,
      retry: false,
    }
  );

  // Staff notifications — one request for the bell + sidebar route badges.
  const {
    data: staffNotificationBadges,
    refetch: refetchStaffNotificationBadges,
  } = trpc.staffNotifications.badgeCounts.useQuery(
    undefined,
    {
      enabled: canReadStaffNotifications,
      refetchInterval:
        canReadStaffNotifications && isPageVisible ? 120_000 : false,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      retry: false,
    }
  );
  const routeBadges = staffNotificationBadges?.byRoute;
  const unreadNotificationCount = staffNotificationBadges?.total ?? 0;
  const markReadByRoute = trpc.staffNotifications.markReadByRoute.useMutation({
    onSuccess: () => utils.staffNotifications.badgeCounts.invalidate(),
  });

  useEffect(() => {
    const wasVisible = wasPageVisibleRef.current;
    wasPageVisibleRef.current = isPageVisible;
    if (!wasVisible && isPageVisible && canReadStaffNotifications) {
      void refetchStaffNotificationBadges();
    }
  }, [canReadStaffNotifications, isPageVisible, refetchStaffNotificationBadges]);
  // The staff review uses this same selector with the selected employee's roles.
  const visibleSections = useMemo(() => getVisibleAdminMenuSections({
    adminCheck, financeAuthority, hasEmployeeTraining, performanceAvailability,
    surveyAvailability, communityAvailability, rewardsAvailability, jobEligibilityAvailability,
  }), [
    adminCheck, financeAuthority?.isFinanceOwner, hasEmployeeTraining,
    performanceAvailability?.enabled, performanceAvailability?.access,
    surveyAvailability?.access, communityAvailability?.enabled,
    rewardsAvailability?.enabled, jobEligibilityAvailability?.enabled,
  ]);

  const navigationItems = visibleSections.flatMap(section => section.items).map(item => {
    const feature = getAdminFeatureByPath(item.path);
    const Icon = item.icon;
    return {
      path: item.path,
      label: menuLabel(item),
      keywords: `${item.label?.en ?? ""} ${item.label?.ar ?? ""} ${item.path} ${item.descKey ? t(item.descKey) : ""}`,
      icon: <Icon className="h-4 w-4" />,
      badge: routeBadges?.[item.path] ?? 0,
      featureEnabled: feature && adminCheck?.isAdmin && featureOverview && !featureOverview.modules[feature.overviewKey].enabled ? false : undefined,
    };
  });
  const activePath = findActiveNavigationPath(navigationItems, location);
  const activeGroup = ADMIN_NAVIGATION_GROUPS.find(group => group.paths.some(path => path === activePath));
  const onNavigation = (path: string) => {
    setOpenMobile(false);
    if ((routeBadges?.[path] ?? 0) > 0) markReadByRoute.mutate({ actionUrl: path });
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setOpenMobile(false); setShowPageSearch(previous => !previous);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, location, setOpenMobile]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const bounds = sidebarRef.current?.getBoundingClientRect();
      const newWidth = isRTL ? (bounds?.right ?? window.innerWidth) - e.clientX : e.clientX - (bounds?.left ?? 0);
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth, isRTL]);

  return (
    <div className="nv2-admin-shell relative flex w-full min-w-0" ref={sidebarRef} dir={isRTL ? "rtl" : "ltr"}>
      <Sidebar
        collapsible="icon"
        side={isRTL ? "right" : "left"}
        className="no-print border-r-0"
        disableTransition={isResizing}
      >
        <SidebarHeader className="h-20 justify-center border-b border-white/10 px-4">
          <div className="flex items-center justify-between gap-2">
            <Link href={navigationItems[0]?.path ?? "/profile"} className="min-w-0 rounded-lg bg-white p-2" aria-label={APP_TITLE}>
              <img src={APP_LOGO} className={isCollapsed && !isMobile ? "h-6 w-6 object-contain" : "h-8 w-28 object-contain"} alt={APP_TITLE} />
            </Link>
            {isMobile && <button type="button" className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10" onClick={() => setOpenMobile(false)} aria-label={language === "ar" ? "إغلاق القائمة" : "Close menu"}><X size={20} /></button>}
          </div>
        </SidebarHeader>

        <SidebarContent>
          <AdminNavigation key={user?.id} items={navigationItems} accountId={user?.id ?? 0} language={language} onSearchOpen={open => { if (open) openPageSearch(); }} onNavigate={onNavigation} favorites={favorites} onToggleFavorite={toggleFavorite} />
        </SidebarContent>

        <SidebarFooter className="p-3 border-t border-white/[0.06]">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === "/profile"} tooltip={profileLabel}>
                <Link href="/profile" onClick={() => setOpenMobile(false)}>
                  <User className="h-4 w-4" />
                  <span>{profileLabel}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <div
        className={`no-print absolute top-0 h-full cursor-col-resize hover:bg-emerald-500/30 transition-colors ${isCollapsed ? "hidden" : "hidden md:block"}`}
        onMouseDown={() => {
          if (isCollapsed) return;
          setIsResizing(true);
        }}
        style={{ zIndex: 50, insetInlineStart: "var(--sidebar-width)", width: "4px" }}
      />

      <SidebarInset>
        {/* ── Sticky Topbar ──────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/[0.06]">
          <div className="flex items-center justify-between px-4 md:px-6 h-16">
            {/* Left: sidebar trigger + page title */}
            <div className="flex items-center gap-3">
              <SidebarTrigger className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 sm:h-9 sm:w-9 dark:text-gray-400 dark:hover:bg-white/[0.06]" />
              <nav aria-label={language === "ar" ? "مساحة العمل الحالية" : "Current workspace"} className="hidden min-w-0 sm:block">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  {activeGroup ? (language === "ar" ? activeGroup.ar : activeGroup.en) : (language === "ar" ? "مساحة العمل" : "Workspace")}
                </span>
              </nav>
            </div>

            {/* Right: grouped action buttons */}
            <div className="flex items-center gap-1">
              {/* ── Group 1: Utilities (Search + Dark mode) ── */}
              <div className="flex items-center gap-0.5 bg-gray-100/70 dark:bg-white/[0.04] rounded-xl p-1">
                <button type="button" onClick={openPageSearch} className="flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-white sm:h-8 sm:w-8 dark:hover:bg-white/10" aria-label={language === "ar" ? "ابحث عن صفحة" : "Find a page"} title="Ctrl / Cmd + K"><Search className="h-4 w-4" /></button>
                {toggleTheme && (
                  <button
                    onClick={toggleTheme}
                    className="flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-white sm:h-8 sm:w-8 dark:hover:bg-white/[0.08]"
                    title={theme === "dark" ? "Light mode" : "Dark mode"}
                  >
                    {theme === "dark" ? (
                      <Sun className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Moon className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                )}
              </div>

              {/* ── Group 2: Comms (Notifications + Language) ── */}
              <div className="flex items-center gap-0.5 bg-gray-100/70 dark:bg-white/[0.04] rounded-xl p-1">
                {/* Notification bell — visible to all admin/staff */}
                <button
                  onClick={() => setLocation("/admin/notifications")}
                  className="relative flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-white sm:h-8 sm:w-8 dark:hover:bg-white/[0.08]"
                  title={t("admin.sidebar.notifications")}
                >
                  <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {unreadNotificationCount > 99
                        ? "99+"
                        : unreadNotificationCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                  className="flex h-11 w-11 items-center justify-center rounded-lg transition hover:bg-white sm:h-8 sm:w-8 dark:hover:bg-white/[0.08]"
                  title={getLanguageSwitchLabel(language)}
                  aria-label={getLanguageSwitchLabel(language)}
                >
                  <Globe className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* ── Divider ── */}
              <div className="hidden md:block w-px h-7 bg-gray-200 dark:bg-white/[0.08] mx-1" />

              {/* ── Group 3: Identity (Avatar + dropdown) ── */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label={language === "ar" ? "قائمة الحساب" : "Account menu"} className="ms-0.5 flex min-h-11 min-w-11 items-center justify-center gap-2 transition hover:opacity-80 focus:outline-none sm:min-h-9 sm:min-w-9">
                    <Avatar className="h-9 w-9 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                      <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block text-start">
                      <p className="text-[13px] font-semibold text-slate-900 dark:text-white leading-tight">
                        {user?.name?.split(" ")[0] || "-"}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {adminCheck?.isStaff && !adminCheck?.isAdmin
                          ? t("admin.sidebar.staffLabel")
                          : t("admin.sidebar.admin")}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400 hidden md:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="me-2 h-4 w-4" />
                      <span>{profileLabel}</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t("admin.sidebar.signOut")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main
          className="flex-1 p-4 md:p-6 bg-[#f6f8f8] dark:bg-[#0b1120]"
          dir={isRTL ? "rtl" : "ltr"}
        >
          {user && <InterfaceAnnouncement key={user.id} user={user} audience={adminCheck?.isAdmin ? "admin" : "staff"} />}
          {children}
        </main>
      </SidebarInset>
      {/* Closed mobile drawers unmount their content; top-bar search must stay mounted. */}
      <NavigationSearchDialog open={showPageSearch} onOpenChange={setShowPageSearch} items={navigationItems} language={language} onNavigate={onNavigation} favorites={favorites} onToggleFavorite={toggleFavorite} onSearchRecords={adminCheck?.isAdmin ? () => setShowAdminSearch(true) : undefined} />
      {showAdminSearch && (
        <Suspense fallback={null}><AdminSearchDialogLazy onClose={() => setShowAdminSearch(false)} /></Suspense>
      )}
    </div>
  );
}

const AdminSearchDialogLazy = lazy(() => import("./AdminSearchDialog"));
