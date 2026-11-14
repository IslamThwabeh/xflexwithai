import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Bell,
  BookOpen,
  Briefcase,
  ChevronDown,
  Globe,
  Headphones,
  LogOut,
  MoreHorizontal,
  Search,
  Sparkles,
  User,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { APP_LOGO, APP_TITLE } from "@/const";
import {
  CLIENT_ACCOUNT_PATHS,
  groupClientDestinations,
} from "@/lib/navigationV2";
import { getLanguageSwitchLabel } from "@/lib/languageToggle";
import NavigationSearchDialog from "./NavigationSearchDialog";
import "./navigation-v2.css";

type Item = {
  href: string;
  label: string;
  icon: ReactNode;
  match: string;
  badge?: number;
};
type Props = {
  items: Item[];
  language: "ar" | "en";
  user: { name?: string | null; email?: string | null } | null | undefined;
  staffWorkspacePath: string | null;
  onLanguage: () => void;
  onLogout: () => void;
  subHeader?: ReactNode;
};

export default function ClientNavigation({
  items,
  language,
  user,
  staffWorkspacePath,
  onLanguage,
  onLogout,
  subHeader,
}: Props) {
  const [location] = useLocation();
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const ar = language === "ar";
  const destinations = items.map(item => ({ ...item, path: item.href }));
  const groups = groupClientDestinations(destinations, language);
  const icons = [BookOpen, Sparkles, Headphones, MoreHorizontal];
  const notification = items.find(item => item.href === "/notifications");
  const profile = {
    path: "/profile",
    label: ar ? "الملف الشخصي والإعدادات" : "Profile & settings",
  };
  const staff = staffWorkspacePath
    ? {
        path: staffWorkspacePath,
        label: ar ? "مساحة عمل الموظفين" : "Staff workspace",
      }
    : null;
  const searchItems = [...destinations, profile, ...(staff ? [staff] : [])];
  useEffect(() => {
    setOpenGroup(null);
    setAccountOpen(false);
    setSearchOpen(false);
  }, [location]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpenGroup(null);
        setAccountOpen(false);
        setSearchOpen(value => !value);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const active = (item: Item) =>
    location === item.match ||
    location.startsWith(`${item.match}/`) ||
    (item.match === "/broker" && location.startsWith("/broker-"));
  const groupMenus = (mobile: boolean) =>
    groups.map((group, index) => {
      const Icon = icons[index];
      const badge = group.items.reduce(
        (count, item) => count + (item.badge ?? 0),
        0
      );
      const selected = group.items.some(active);
      const id = `${mobile ? "mobile" : "desktop"}-${group.id}`;
      return (
        <Popover
          key={group.id}
          open={openGroup === id}
          onOpenChange={open => setOpenGroup(open ? id : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`nv2-client-group ${selected ? "is-active" : ""}`}
              aria-label={group.label}
            >
              <Icon size={19} />
              <span>{group.label}</span>
              {badge > 0 && (
                <span className="nv2-count">{badge > 99 ? "99+" : badge}</span>
              )}
              {!mobile && <ChevronDown size={13} />}
            </button>
          </PopoverTrigger>
          <PopoverContent
            dir={ar ? "rtl" : "ltr"}
            side={mobile ? "top" : "bottom"}
            align={mobile ? "center" : "start"}
            sideOffset={12}
            className="nv2-client-panel"
          >
            <p className="nv2-panel-title">{group.label}</p>
            {group.items.map(item => (
              <PopoverClose key={item.path} asChild>
                <Link
                  href={item.path}
                  className={`nv2-panel-link ${active(item) ? "is-active" : ""}`}
                  aria-current={active(item) ? "page" : undefined}
                >
                  {item.icon}
                  <span>{item.label}</span>
                  {!!item.badge && (
                    <span className="nv2-count">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              </PopoverClose>
            ))}
            {group.items.length === 0 && (
              <p className="p-3 text-sm text-muted-foreground">
                {ar
                  ? "ستظهر الخدمات المتاحة لحسابك هنا."
                  : "Your available services will appear here."}
              </p>
            )}
          </PopoverContent>
        </Popover>
      );
    });
  return (
    <>
      <header className="nv2-client-header" dir={ar ? "rtl" : "ltr"}>
        <div className="nv2-client-top">
          <Link href="/courses" className="nv2-brand">
            <img src={APP_LOGO} alt={APP_TITLE} />
          </Link>
          <nav
            className="nv2-client-desktop"
            aria-label={ar ? "التنقل الرئيسي" : "Main navigation"}
          >
            {groupMenus(false)}
          </nav>
          <div className="nv2-client-tools">
            <button
              type="button"
              className="nv2-icon-button"
              aria-label={ar ? "ابحث عن صفحة" : "Find a page"}
              title="Ctrl / Cmd + K"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={19} />
            </button>
            <button
              type="button"
              className="nv2-icon-button"
              aria-label={getLanguageSwitchLabel(language)}
              onClick={onLanguage}
            >
              <Globe size={19} />
            </button>
            {notification && (
              <Link
                href={notification.href}
                className="nv2-icon-button relative"
                aria-label={`${notification.label}${notification.badge ? ` (${notification.badge})` : ""}`}
              >
                <Bell size={19} />
                {!!notification.badge && (
                  <span className="nv2-bell-count">
                    {notification.badge > 99 ? "99+" : notification.badge}
                  </span>
                )}
              </Link>
            )}
            <Popover open={accountOpen} onOpenChange={setAccountOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="nv2-avatar"
                  aria-label={ar ? "قائمة الحساب" : "Account menu"}
                >
                  {user?.name?.trim().charAt(0).toUpperCase() || (
                    <User size={19} />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                dir={ar ? "rtl" : "ltr"}
                align="end"
                className="nv2-client-panel"
              >
                <div className="nv2-account-name">
                  <strong>{user?.name}</strong>
                  <span>{user?.email}</span>
                </div>
                <PopoverClose asChild>
                  <Link href={profile.path} className="nv2-panel-link">
                    <User size={17} />
                    {profile.label}
                  </Link>
                </PopoverClose>
                {items
                  .filter(item => CLIENT_ACCOUNT_PATHS.includes(item.href))
                  .map(item => (
                    <PopoverClose key={item.href} asChild>
                      <Link href={item.href} className="nv2-panel-link">
                        {item.icon}
                        {item.label}
                      </Link>
                    </PopoverClose>
                  ))}
                {staff && (
                  <PopoverClose asChild>
                    <Link href={staff.path} className="nv2-panel-link">
                      <Briefcase size={17} />
                      {staff.label}
                    </Link>
                  </PopoverClose>
                )}
                <PopoverClose asChild>
                  <button
                    type="button"
                    className="nv2-panel-link nv2-logout"
                    onClick={onLogout}
                  >
                    <LogOut size={17} />
                    {ar ? "تسجيل الخروج" : "Log out"}
                  </button>
                </PopoverClose>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {subHeader}
      </header>
      <nav
        className="nv2-client-bottom"
        aria-label={ar ? "التنقل الرئيسي للهاتف" : "Mobile main navigation"}
        dir={ar ? "rtl" : "ltr"}
      >
        {groupMenus(true)}
      </nav>
      <NavigationSearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        items={searchItems}
        language={language}
      />
    </>
  );
}
