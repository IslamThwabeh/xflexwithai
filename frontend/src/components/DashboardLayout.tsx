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
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import { APP_LOGO, APP_TITLE, getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  LayoutDashboard, 
  LogOut, 
  PanelLeft, 
  Users, 
  BookOpen, 
  Key, 
  MessageSquare,
  Shield,
  Headphones,
  Globe,
  Package,
  ShoppingCart,
  CalendarDays,
  FileText,
  ClipboardCheck,
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
  Building2,
  FileCheck,
  Moon,
  Sun,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Megaphone,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Settings2,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState, useMemo, lazy, Suspense } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { ROLE_PAGE_ACCESS } from "@shared/const";

// Menu sections use i18n keys – resolved at render time
type MenuItem = { icon: any; labelKey: string; path: string; descKey?: string };
type MenuSection = { icon: any; labelKey: string; items: MenuItem[] };

const menuSectionsDef: MenuSection[] = [
  {
    icon: LayoutDashboard,
    labelKey: "admin.sidebar.overview",
    items: [
      { icon: LayoutDashboard, labelKey: "admin.sidebar.dashboard", path: "/admin/dashboard" },
    ]
  },
  {
    icon: ShoppingCart,
    labelKey: "admin.sidebar.sales",
    items: [
      { icon: ShoppingCart, labelKey: "admin.sidebar.orders", path: "/admin/orders" },
      { icon: Key, labelKey: "admin.sidebar.activationKeys", path: "/admin/package-keys" },
      { icon: Package, labelKey: "admin.sidebar.packages", path: "/admin/packages" },
      { icon: Tag, labelKey: "admin.sidebar.coupons", path: "/admin/coupons" },
      { icon: Building2, labelKey: "admin.sidebar.brokers", path: "/admin/brokers" },
      { icon: FileCheck, labelKey: "admin.sidebar.offerAgreements", path: "/admin/offer-agreements" },
    ]
  },
  {
    icon: TrendingUp,
    labelKey: "admin.sidebar.recChannel",
    items: [
      { icon: TrendingUp, labelKey: "admin.sidebar.recommendations", path: "/admin/recommendations" },
    ]
  },
  {
    icon: MessageSquare,
    labelKey: "admin.sidebar.lexai",
    items: [
      { icon: MessageSquare, labelKey: "admin.sidebar.lexai", path: "/admin/lexai" },
    ]
  },
  {
    icon: GraduationCap,
    labelKey: "admin.sidebar.learning",
    items: [
      { icon: BookOpen, labelKey: "admin.sidebar.courses", path: "/admin/courses" },
      { icon: GraduationCap, labelKey: "admin.sidebar.planProgress", path: "/admin/plan-progress" },
      { icon: ClipboardCheck, labelKey: "admin.sidebar.quizzes", path: "/admin/quizzes" },
    ]
  },
  {
    icon: Megaphone,
    labelKey: "admin.sidebar.content",
    items: [
      { icon: FileText, labelKey: "admin.sidebar.articles", path: "/admin/articles" },
      { icon: CalendarDays, labelKey: "admin.sidebar.events", path: "/admin/events" },
      { icon: MessageSquareQuote, labelKey: "admin.sidebar.testimonials", path: "/admin/testimonials" },
    ]
  },
  {
    icon: Users,
    labelKey: "admin.sidebar.students",
    items: [
      { icon: Users, labelKey: "admin.sidebar.students", path: "/admin/students" },
    ]
  },
  {
    icon: ShieldCheck,
    labelKey: "admin.sidebar.team",
    items: [
      { icon: Headphones, labelKey: "admin.sidebar.supportChat", path: "/admin/support" },
      { icon: Shield, labelKey: "admin.sidebar.roles", path: "/admin/roles" },
      { icon: Search, labelKey: "admin.sidebar.staffReview", path: "/admin/staff-review" },
    ]
  },
  {
    icon: BarChart3,
    labelKey: "admin.sidebar.reports",
    items: [
      { icon: DollarSign, labelKey: "admin.sidebar.revenue", path: "/admin/reports/revenue" },
      { icon: Clock, labelKey: "admin.sidebar.expiry", path: "/admin/reports/expiry" },
      { icon: Activity, labelKey: "admin.sidebar.engagement", path: "/admin/engagement" },
    ]
  },
  {
    icon: Star,
    labelKey: "admin.sidebar.moderation",
    items: [
      { icon: Star, labelKey: "admin.sidebar.reviews", path: "/admin/reviews" },
      { icon: Bell, labelKey: "admin.sidebar.notifications", path: "/admin/notifications" },
      { icon: Award, labelKey: "admin.sidebar.loyaltyPoints", path: "/admin/points" },
      { icon: Settings2, labelKey: "admin.sidebar.settings", path: "/admin/settings" },
    ]
  },
  {
    icon: Briefcase,
    labelKey: "admin.sidebar.careers",
    items: [
      { icon: Briefcase, labelKey: "admin.sidebar.jobsApplications", path: "/admin/jobs" },
    ]
  },
  // Hidden sections — backend kept, UI disabled
  // {
  //   labelKey: "admin.sidebar.lexai",
  //   items: [
  //     { icon: MessageSquare, labelKey: "admin.sidebar.conversations", path: "/admin/lexai/conversations" },
  //     { icon: Users, labelKey: "admin.sidebar.subscriptions", path: "/admin/lexai/subscriptions" },
  //   ]
  // },
];

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
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#faf7f2] dark:bg-[#0b1120]">
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
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{APP_TITLE}</h1>
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
  const [location, setLocation] = useLocation();
  const { t, language, setLanguage, isRTL } = useLanguage();
  const { state, toggleSidebar } = useSidebar();
  const { theme, toggleTheme } = useTheme();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const [showAdminSearch, setShowAdminSearch] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Check admin/staff status for sidebar filtering
  const { data: adminCheck } = trpc.auth.isAdmin.useQuery();

  // Staff notifications — bell badge + sidebar route badges (30s polling)
  const { data: unreadCountData } = trpc.staffNotifications.unreadCount.useQuery(undefined, { refetchInterval: 30_000 });
  const { data: routeBadges } = trpc.staffNotifications.countByRoute.useQuery(undefined, { refetchInterval: 30_000 });
  const markReadByRoute = trpc.staffNotifications.markReadByRoute.useMutation();

  // Compute visible menu sections based on role
  const visibleSections = useMemo(() => {
    // Admin sees everything
    if (!adminCheck || adminCheck.isAdmin) return menuSectionsDef;

    // Staff: filter by role-accessible paths
    const staffRoles: string[] = adminCheck.staffRoles ?? [];
    const accessiblePaths = new Set<string>();
    for (const role of staffRoles) {
      for (const p of ROLE_PAGE_ACCESS[role] ?? []) {
        accessiblePaths.add(p);
      }
    }

    return menuSectionsDef
      .map(section => ({
        ...section,
        items: section.items.filter(item => accessiblePaths.has(item.path)),
      }))
      .filter(section => section.items.length > 0);
  }, [adminCheck]);

  // Find active menu item across all sections
  const activeMenuItem = visibleSections
    .flatMap(section => section.items)
    .find(item => item.path === location);

  // Find which section contains the active item
  const activeSectionIndex = visibleSections.findIndex(section =>
    section.items.some(item => item.path === location)
  );

  // Track which sections are expanded — auto-expand the active one
  const [expandedSections, setExpandedSections] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    if (activeSectionIndex >= 0) initial.add(activeSectionIndex);
    return initial;
  });

  // Keep active section expanded when navigating
  useEffect(() => {
    if (activeSectionIndex >= 0) {
      setExpandedSections(prev => {
        if (prev.has(activeSectionIndex)) return prev;
        const next = new Set(prev);
        next.add(activeSectionIndex);
        return next;
      });
    }
  }, [activeSectionIndex]);

  const toggleSection = (index: number) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
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
  }, [isResizing, setSidebarWidth]);

  return (
    <div className="relative flex w-full" ref={sidebarRef} dir="ltr">
      <Sidebar
        collapsible="icon"
        className="border-r-0"
        disableTransition={isResizing}
      >
          <SidebarHeader className="h-16 justify-center border-b border-white/[0.06]">
            <div className="flex items-center gap-3 pl-2 group-data-[collapsible=icon]:px-0 transition-all w-full">
              {isCollapsed ? (
                <div className="relative h-8 w-8 shrink-0 group">
                  <img
                    src={APP_LOGO}
                    className="h-8 w-8 rounded-md object-cover ring-1 ring-emerald-500/30"
                    alt="Logo"
                  />
                  <button
                    onClick={toggleSidebar}
                    className="absolute inset-0 flex items-center justify-center bg-emerald-500/10 rounded-md ring-1 ring-emerald-500/30 opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <PanelLeft className="h-4 w-4 text-emerald-400" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={APP_LOGO}
                    className="h-8 w-8 rounded-md object-cover ring-1 ring-emerald-500/30 shrink-0"
                    alt="Logo"
                  />
                    <span className="font-semibold tracking-tight truncate text-white">
                      {APP_TITLE}
                    </span>
                  </div>
                </>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent>
            {visibleSections.map((section, sectionIndex) => {
              const isSingleItem = section.items.length === 1;
              const sectionHasActive = section.items.some(item => item.path === location);
              const isExpanded = expandedSections.has(sectionIndex);
              const SectionIcon = section.icon;
              const singleItemPath = isSingleItem ? section.items[0].path : null;
              const singleItemBadgeCount = singleItemPath ? (routeBadges?.[singleItemPath] ?? 0) : 0;

              return (
                <SidebarGroup key={sectionIndex} className="shrink-0 py-0.5 px-2">
                  {/* Section header row — clickable */}
                  <button
                    onClick={() => {
                      if (isSingleItem) {
                        setLocation(section.items[0].path);
                        if (singleItemBadgeCount > 0) {
                          markReadByRoute.mutate({ actionUrl: section.items[0].path });
                        }
                      } else {
                        toggleSection(sectionIndex);
                      }
                    }}
                    className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-[13px] font-medium transition-all group/section ${
                      isSingleItem && location === section.items[0].path
                        ? "bg-gradient-to-l from-emerald-600/20 to-emerald-500/10 text-white border border-emerald-500/20"
                        : sectionHasActive
                          ? "text-emerald-400"
                          : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className={`relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      (isSingleItem && location === section.items[0].path) || sectionHasActive
                        ? "bg-emerald-500/15"
                        : "bg-white/[0.04] group-hover/section:bg-white/[0.06]"
                    }`}>
                      <SectionIcon className={`w-4 h-4 ${
                        (isSingleItem && location === section.items[0].path) || sectionHasActive
                          ? "text-emerald-400"
                          : ""
                      }`} />
                      {singleItemBadgeCount > 0 && (
                        <span className="absolute -end-1 -top-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {singleItemBadgeCount > 99 ? '99+' : singleItemBadgeCount}
                        </span>
                      )}
                    </div>
                    {!isCollapsed && (
                      <>
                        <span className="flex-1 text-left truncate">{t(section.labelKey)}</span>
                        {isSingleItem && singleItemBadgeCount > 0 && (
                          <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                            {singleItemBadgeCount > 99 ? '99+' : singleItemBadgeCount}
                          </span>
                        )}
                        {!isSingleItem && (
                          <ChevronRight className={`w-3.5 h-3.5 text-gray-500 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                        )}
                      </>
                    )}
                  </button>

                  {/* Sub-items — collapsible */}
                  {!isSingleItem && isExpanded && !isCollapsed && (
                    <SidebarGroupContent className="mt-0.5">
                      <SidebarMenu>
                        {section.items.map(item => {
                          const isActive = location === item.path;
                          const label = t(item.labelKey);
                          const badgeCount = routeBadges?.[item.path] ?? 0;
                          return (
                            <SidebarMenuItem key={item.path}>
                              <SidebarMenuButton
                                isActive={isActive}
                                onClick={() => {
                                  setLocation(item.path);
                                  if (badgeCount > 0) {
                                    markReadByRoute.mutate({ actionUrl: item.path });
                                  }
                                }}
                                tooltip={label}
                                className={`transition-all font-normal ps-12 py-1.5 text-[13px] ${
                                  isActive
                                    ? "text-emerald-400 bg-emerald-500/[0.08] font-medium"
                                    : "text-gray-500 hover:text-white hover:bg-white/[0.04]"
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-emerald-400" : "bg-gray-600"}`} />
                                <span className="flex-1">{label}</span>
                                {badgeCount > 0 && (
                                  <span className="min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                    {badgeCount > 99 ? '99+' : badgeCount}
                                  </span>
                                )}
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  )}
                </SidebarGroup>
              );
            })}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-white/[0.06]" />
      </Sidebar>

      <div
        className={`absolute top-0 h-full cursor-col-resize hover:bg-emerald-500/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
        onMouseDown={() => {
          if (isCollapsed) return;
          setIsResizing(true);
        }}
        style={{ zIndex: 50, left: "var(--sidebar-width)", width: "4px" }}
      />

      <SidebarInset>
        {/* ── Sticky Topbar ──────────────────────────────── */}
        <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-gray-200/60 dark:border-white/[0.06]">
          <div className="flex items-center justify-between px-4 md:px-6 h-16">
            {/* Left: sidebar trigger + page title */}
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-xl hover:bg-gray-100 dark:hover:bg-white/[0.06] flex items-center justify-center text-gray-500 dark:text-gray-400" />
              <div className="hidden sm:block">
                <h1 className="text-[17px] font-bold text-slate-900 dark:text-white leading-tight">
                  {activeMenuItem ? t(activeMenuItem.labelKey) : APP_TITLE}
                </h1>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {activeMenuItem?.descKey ? t(activeMenuItem.descKey) : t('admin.topbar.welcome')}
                </p>
              </div>
            </div>

            {/* Right: grouped action buttons */}
            <div className="flex items-center gap-1">
              {/* ── Group 1: Utilities (Search + Dark mode) ── */}
              <div className="flex items-center gap-0.5 bg-gray-100/70 dark:bg-white/[0.04] rounded-xl p-1">
                {adminCheck?.isAdmin && (
                <button
                  onClick={() => setShowAdminSearch(true)}
                  className="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-white/[0.08] flex items-center justify-center transition"
                  title={t('admin.sidebar.search')}
                >
                  <Search className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
                )}
                {toggleTheme && (
                  <button
                    onClick={toggleTheme}
                    className="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-white/[0.08] flex items-center justify-center transition"
                    title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  >
                    {theme === 'dark'
                      ? <Sun className="w-4 h-4 text-amber-400" />
                      : <Moon className="w-4 h-4 text-gray-500" />
                    }
                  </button>
                )}
              </div>

              {/* ── Group 2: Comms (Notifications + Language) ── */}
              <div className="flex items-center gap-0.5 bg-gray-100/70 dark:bg-white/[0.04] rounded-xl p-1">
                {/* Notification bell — visible to all admin/staff */}
                <button
                  onClick={() => setLocation('/admin/notifications')}
                  className="relative w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-white/[0.08] flex items-center justify-center transition"
                  title={t('admin.sidebar.notifications')}
                >
                  <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  {(unreadCountData?.count ?? 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {unreadCountData!.count > 99 ? '99+' : unreadCountData!.count}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
                  className="w-8 h-8 rounded-lg hover:bg-white dark:hover:bg-white/[0.08] flex items-center justify-center transition"
                  title={language === 'ar' ? 'English' : 'عربي'}
                >
                  <Globe className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              {/* ── Divider ── */}
              <div className="hidden md:block w-px h-7 bg-gray-200 dark:bg-white/[0.08] mx-1" />

              {/* ── Group 3: Identity (Avatar + dropdown) ── */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 ms-0.5 hover:opacity-80 transition focus:outline-none">
                    <Avatar className="h-9 w-9 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
                      <AvatarFallback className="text-xs font-bold bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                        {user?.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block text-left">
                      <p className="text-[13px] font-semibold text-slate-900 dark:text-white leading-tight">
                        {user?.name?.split(' ')[0] || '-'}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {adminCheck?.isStaff && !adminCheck?.isAdmin
                          ? t('admin.sidebar.staffLabel')
                          : t('admin.sidebar.admin')}
                      </p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400 hidden md:block" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('admin.sidebar.signOut')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 bg-[#faf7f2] dark:bg-[#0b1120]" dir={isRTL ? "rtl" : "ltr"}>{children}</main>
      </SidebarInset>
      {showAdminSearch && <AdminSearchDialogLazy onClose={() => setShowAdminSearch(false)} />}
    </div>
  );
}

const AdminSearchDialogLazy = lazy(() => import('./AdminSearchDialog'));
