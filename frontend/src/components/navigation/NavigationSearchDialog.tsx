import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Search, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  matchNavigationQuery,
  type NavigationDestination,
} from "@/lib/navigationV2";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavigationDestination[];
  language: "ar" | "en";
  onNavigate?: (path: string) => void;
  favorites?: string[];
  onToggleFavorite?: (path: string) => void;
  onSearchRecords?: () => void;
};

export default function NavigationSearchDialog({
  open,
  onOpenChange,
  items,
  language,
  onNavigate,
  favorites,
  onToggleFavorite,
  onSearchRecords,
}: Props) {
  const [query, setQuery] = useState("");
  const ar = language === "ar";
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  const matches = items.filter(item => matchNavigationQuery(item, query));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="nv2-search-dialog" dir={ar ? "rtl" : "ltr"} closeLabel={ar ? "إغلاق" : "Close"}>
        <DialogHeader>
          <DialogTitle>{ar ? "ابحث عن صفحة" : "Find a page"}</DialogTitle>
          <DialogDescription>
            {ar
              ? "انتقل مباشرة إلى الأدوات والصفحات المتاحة لك."
              : "Go directly to your available tools and pages."}
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-slate-500" />
          <Input
            autoFocus
            aria-label={ar ? "البحث في الصفحات" : "Search pages"}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={
              ar ? "إلى أين تريد الانتقال؟" : "Where would you like to go?"
            }
            className="ps-10"
          />
        </div>
        <nav
          className="nv2-search-results"
          aria-label={ar ? "نتائج البحث" : "Search results"}
        >
          {matches.map(item => (
            <div key={item.path} className="nv2-search-row">
              <Link
                href={item.path}
                onClick={() => {
                  onNavigate?.(item.path);
                  onOpenChange(false);
                }}
              >
                {item.label}
                {!!item.badge && (
                  <span className="nv2-count">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
              {onToggleFavorite && (
                <button
                  type="button"
                  onClick={() => onToggleFavorite(item.path)}
                  aria-label={`${favorites?.includes(item.path) ? (ar ? "إزالة تثبيت" : "Unpin") : ar ? "تثبيت" : "Pin"} ${item.label}`}
                  className="nv2-icon-button"
                >
                  <Star
                    className={
                      favorites?.includes(item.path)
                        ? "text-emerald-700"
                        : "text-slate-400"
                    }
                    size={17}
                    fill={
                      favorites?.includes(item.path) ? "currentColor" : "none"
                    }
                  />
                </button>
              )}
            </div>
          ))}
          {matches.length === 0 && (
            <p className="p-5 text-sm text-muted-foreground">
              {ar
                ? "لا توجد صفحات مطابقة. جرّب كلمة أخرى."
                : "No matching pages. Try another word."}
            </p>
          )}
        </nav>
        {onSearchRecords && (
          <button
            type="button"
            className="nv2-record-search"
            onClick={() => {
              onOpenChange(false);
              onSearchRecords();
            }}
          >
            {ar
              ? "البحث عن مستخدم أو طلب أو مفتاح"
              : "Search users, orders and keys"}
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          {ar
            ? "Tab للتنقل · Enter للفتح · Escape للإغلاق"
            : "Tab to move · Enter to open · Escape to close"}
        </p>
      </DialogContent>
    </Dialog>
  );
}
