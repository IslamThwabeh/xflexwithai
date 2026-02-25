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
  ClipboardList,
  Briefcase,
  Globe,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

// Menu sections use i18n keys – resolved at render time
type MenuItem = { icon: any; labelKey: string; path: string };
type MenuSection = { labelKey: string; items: MenuItem[] };

const menuSectionsDef: MenuSection[] = [
  {
    labelKey: "admin.sidebar.overview",
    items: [
      { icon: LayoutDashboard, labelKey: "admin.sidebar.dashboard", path: "/admin/dashboard" },
    ]
  },
  {
    labelKey: "admin.sidebar.content",
    items: [
      { icon: BookOpen, labelKey: "admin.sidebar.courses", path: "/admin/courses" },
      { icon: Key, labelKey: "admin.sidebar.courseKeys", path: "/admin/keys" },
    ]
  },
  {
    labelKey: "admin.sidebar.lexai",
    items: [
      { icon: MessageSquare, labelKey: "admin.sidebar.conversations", path: "/admin/lexai/conversations" },
      { icon: Users, labelKey: "admin.sidebar.subscriptions", path: "/admin/lexai/subscriptions" },
      { icon: Key, labelKey: "admin.sidebar.lexaiKeys", path: "/admin/lexai/keys" },
    ]
  },
  {
    labelKey: "admin.sidebar.users",
    items: [
      { icon: Users, labelKey: "admin.sidebar.usersList", path: "/admin/users" },
    ]
  },
  {
    labelKey: "admin.sidebar.recommendations",
    items: [
      { icon: MessageSquare, labelKey: "admin.sidebar.groupMgmt", path: "/admin/recommendations" },
    ]
  },
  {
    labelKey: "admin.sidebar.support",
    items: [
      { icon: Headphones, labelKey: "admin.sidebar.supportChat", path: "/admin/support" },
      { icon: ClipboardList, labelKey: "admin.sidebar.supportDash", path: "/support-panel" },
      { icon: Briefcase, labelKey: "admin.sidebar.staffPortal", path: "/staff" },
      { icon: Shield, labelKey: "admin.sidebar.roles", path: "/admin/roles" },
    ]
  },
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
      <div className="flex items-center justify-center min-h-screen">
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
              <h1 className="text-2xl font-bold tracking-tight">{APP_TITLE}</h1>
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
            className="w-full shadow-lg hover:shadow-xl transition-all"
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
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // Find active menu item across all sections
  const activeMenuItem = menuSectionsDef
    .flatMap(section => section.items)
    .find(item => item.path === location);

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
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 pl-2 group-data-[collapsible=icon]:px-0 transition-all w-full">
              {isCollapsed ? (
                <div className="relative h-8 w-8 shrink-0 group">
                  <img
                    src={APP_LOGO}
                    className="h-8 w-8 rounded-md object-cover ring-1 ring-border"
                    alt="Logo"
                  />
                  <button
                    onClick={toggleSidebar}
                    className="absolute inset-0 flex items-center justify-center bg-accent rounded-md ring-1 ring-border opacity-0 group-hover:opacity-100 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <PanelLeft className="h-4 w-4 text-foreground" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={APP_LOGO}
                      className="h-8 w-8 rounded-md object-cover ring-1 ring-border shrink-0"
                      alt="Logo"
                    />
                    <span className="font-semibold tracking-tight truncate">
                      {APP_TITLE}
                    </span>
                  </div>
                  <button
                    onClick={toggleSidebar}
                    className="ml-auto h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                  >
                    <PanelLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                </>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent>
            {menuSectionsDef.map((section, sectionIndex) => (
              <SidebarGroup key={sectionIndex} className="shrink-0 py-1">
                {!isCollapsed && (
                  <SidebarGroupLabel className="h-auto text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70 px-3 pb-1">
                    {t(section.labelKey)}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map(item => {
                      const isActive = location === item.path;
                      const label = t(item.labelKey);
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => setLocation(item.path)}
                            tooltip={label}
                            className={`transition-all font-normal ${
                              isActive ? "bg-primary/10 text-primary font-medium" : ""
                            }`}
                          >
                            <item.icon
                              className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                            />
                            <span>{label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="p-3 space-y-2">
            {/* Language Switcher */}
            {!isCollapsed && (
              <button
                onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                className="flex items-center gap-2 w-full rounded-lg px-2 py-2 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span>{language === "ar" ? "English" : "عربي"}</span>
              </button>
            )}
            {isCollapsed && (
              <button
                onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
                className="flex items-center justify-center w-full rounded-lg py-2 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
                title={language === "ar" ? "English" : "عربي"}
              >
                <Globe className="h-4 w-4" />
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
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
          </SidebarFooter>
      </Sidebar>

      <div
        className={`absolute top-0 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
        onMouseDown={() => {
          if (isCollapsed) return;
          setIsResizing(true);
        }}
        style={{ zIndex: 50, left: "var(--sidebar-width)", width: "4px" }}
      />

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem ? t(activeMenuItem.labelKey) : APP_TITLE}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4" dir={isRTL ? "rtl" : "ltr"}>{children}</main>
      </SidebarInset>
    </div>
  );
}
