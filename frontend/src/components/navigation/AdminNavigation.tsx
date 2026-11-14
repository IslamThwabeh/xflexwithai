import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BookOpen,
  ChevronDown,
  Headphones,
  LayoutDashboard,
  Search,
  Settings2,
  ShoppingCart,
  Sparkles,
  Star,
  Users,
  Wallet,
} from "lucide-react";
import {
  groupAdminDestinations,
  findActiveNavigationPath,
  readNavigationPreference,
  saveNavigationPreference,
  type NavigationDestination,
} from "@/lib/navigationV2";
import { useSidebar } from "@/components/ui/sidebar";
import NavigationSearchDialog from "./NavigationSearchDialog";
import "./navigation-v2.css";

export type AdminDestination = NavigationDestination & {
  icon: ReactNode;
  featureEnabled?: boolean;
};
type Props = {
  items: AdminDestination[];
  accountId: number;
  language: "ar" | "en";
  searchOpen: boolean;
  onSearchOpen: (open: boolean) => void;
  onNavigate: (path: string) => void;
  onSearchRecords?: () => void;
};
const icons = {
  overview: LayoutDashboard,
  students: Users,
  sales: ShoppingCart,
  finance: Wallet,
  services: Sparkles,
  content: BookOpen,
  team: Headphones,
  system: Settings2,
  training: BookOpen,
  other: LayoutDashboard,
};

export default function AdminNavigation({
  items,
  accountId,
  language,
  searchOpen,
  onSearchOpen,
  onNavigate,
  onSearchRecords,
}: Props) {
  const [location] = useLocation();
  const { state, isMobile, setOpen } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;
  const groups = groupAdminDestinations(items, language);
  const activePath = findActiveNavigationPath(items, location);
  const activeGroup = groups.find(group =>
    group.items.some(item => item.path === activePath)
  )?.id;
  const prefix = `xflex-navigation-v2:${accountId}`;
  const [expanded, setExpanded] = useState(() =>
    readNavigationPreference(
      `${prefix}:groups`,
      activeGroup ? [activeGroup] : []
    )
  );
  const [favorites, setFavorites] = useState(() =>
    readNavigationPreference(`${prefix}:favorites`)
  );
  const ar = language === "ar";
  useEffect(() => {
    setExpanded(
      readNavigationPreference(
        `${prefix}:groups`,
        activeGroup ? [activeGroup] : []
      )
    );
    setFavorites(readNavigationPreference(`${prefix}:favorites`));
  }, [prefix]);
  useEffect(() => {
    if (activeGroup)
      setExpanded(previous =>
        previous.includes(activeGroup) ? previous : [...previous, activeGroup]
      );
  }, [activeGroup, prefix]);
  const toggleGroup = (id: string) => {
    if (collapsed) setOpen(true);
    setExpanded(previous => {
      const next =
        previous.includes(id) && !collapsed
          ? previous.filter(value => value !== id)
          : [...new Set([...previous, id])];
      saveNavigationPreference(`${prefix}:groups`, next);
      return next;
    });
  };
  const toggleFavorite = (path: string) =>
    setFavorites(previous => {
      const next = previous.includes(path)
        ? previous.filter(value => value !== path)
        : [...previous, path];
      saveNavigationPreference(`${prefix}:favorites`, next);
      return next;
    });
  const pinned = favorites.flatMap(path => {
    const item = items.find(candidate => candidate.path === path);
    return item ? [item] : [];
  });
  const row = (item: AdminDestination, pinControl: boolean) => (
    <div className="nv2-admin-row" key={item.path}>
      <Link
        href={item.path}
        className={`nv2-admin-link ${activePath === item.path ? "is-active" : ""}`}
        title={collapsed ? item.label : undefined}
        aria-current={activePath === item.path ? "page" : undefined}
        onClick={() => onNavigate(item.path)}
      >
        {item.icon}
        {!collapsed && (
          <>
            <span className="nv2-admin-label">{item.label}</span>
            {item.featureEnabled !== undefined && (
              <span
                className={`nv2-feature ${item.featureEnabled ? "enabled" : "disabled"}`}
              >
                {item.featureEnabled
                  ? ar
                    ? "مفعّل"
                    : "On"
                  : ar
                    ? "متوقف"
                    : "Off"}
              </span>
            )}
            {!!item.badge && (
              <span className="nv2-count">
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            )}
          </>
        )}
      </Link>
      {pinControl && !collapsed && (
        <button
          type="button"
          className={`nv2-pin ${favorites.includes(item.path) ? "is-pinned" : ""}`}
          aria-label={`${favorites.includes(item.path) ? (ar ? "إزالة تثبيت" : "Unpin") : ar ? "تثبيت" : "Pin"} ${item.label}`}
          onClick={() => toggleFavorite(item.path)}
        >
          <Star
            size={13}
            fill={favorites.includes(item.path) ? "currentColor" : "none"}
          />
        </button>
      )}
    </div>
  );
  return (
    <>
      <div
        className={`nv2-admin-navigation ${collapsed ? "is-collapsed" : ""}`}
        dir={ar ? "rtl" : "ltr"}
      >
        <button
          type="button"
          className="nv2-admin-search"
          onClick={() => onSearchOpen(true)}
          aria-label={ar ? "ابحث عن صفحة" : "Find a page"}
          title={ar ? "ابحث عن صفحة" : "Find a page"}
        >
          <Search size={17} />
          {!collapsed && (
            <>
              <span>{ar ? "ابحث عن صفحة" : "Find a page"}</span>
              <kbd>⌘ / Ctrl K</kbd>
            </>
          )}
        </button>
        {pinned.length > 0 && (
          <section
            className="nv2-favorites"
            aria-label={ar ? "المفضلة" : "Favorites"}
          >
            {!collapsed && (
              <h2>
                <Star size={12} />
                {ar ? "المفضلة" : "Favorites"}
              </h2>
            )}
            {pinned.map(item => row(item, true))}
          </section>
        )}
        <nav aria-label={ar ? "صفحات مساحة العمل" : "Workspace pages"}>
          {groups.map(group => {
            const Icon =
              icons[group.id as keyof typeof icons] ?? LayoutDashboard;
            const isOpen = expanded.includes(group.id);
            const badge = group.items.reduce(
              (count, item) => count + (item.badge ?? 0),
              0
            );
            return (
              <section key={group.id} className="nv2-admin-group">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className={`nv2-admin-group-button ${activeGroup === group.id ? "has-active" : ""}`}
                  aria-label={group.label}
                  aria-expanded={!collapsed && isOpen}
                  aria-controls={
                    !collapsed ? `nv2-group-${group.id}` : undefined
                  }
                  title={collapsed ? group.label : undefined}
                >
                  <Icon size={18} />
                  {!collapsed && (
                    <>
                      <span>{group.label}</span>
                      {badge > 0 && (
                        <span className="nv2-count">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                      <ChevronDown
                        size={14}
                        className={isOpen ? "nv2-chevron-open" : ""}
                      />
                    </>
                  )}
                </button>
                {!collapsed && (
                  <div
                    id={`nv2-group-${group.id}`}
                    hidden={!isOpen}
                    className="nv2-admin-group-items"
                  >
                    {group.items.map(item => row(item, true))}
                  </div>
                )}
              </section>
            );
          })}
        </nav>
      </div>
      <NavigationSearchDialog
        open={searchOpen}
        onOpenChange={onSearchOpen}
        items={items}
        language={language}
        onNavigate={onNavigate}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onSearchRecords={onSearchRecords}
      />
    </>
  );
}
