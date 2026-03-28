import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────
type SortDir = "asc" | "desc" | null;

// ─── Hook ────────────────────────────────────
export function useDataTable<T>(
  data: T[],
  sortFns?: Record<string, (a: T, b: T) => number>,
  defaultPageSize = 10,
) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  // Reset page when data length changes (React recommended pattern)
  const [prevLen, setPrevLen] = useState(data.length);
  if (data.length !== prevLen) {
    setPrevLen(data.length);
    setPage(0);
  }

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir || !sortFns?.[sortKey]) return data;
    const fn = sortFns[sortKey];
    const mult = sortDir === "desc" ? -1 : 1;
    return [...data].sort((a, b) => fn(a, b) * mult);
  }, [data, sortKey, sortDir, sortFns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const handleSort = (key: string) => {
    if (!sortFns?.[key]) return;
    if (sortKey === key) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortKey(null);
        setSortDir(null);
      } else setSortDir("asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(0);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    setPage(0);
  };

  return {
    paged,
    sorted,
    page: safePage,
    pageSize,
    totalPages,
    totalItems: sorted.length,
    sortKey,
    sortDir,
    setPage,
    handleSort,
    changePageSize,
  };
}

// ─── Pagination Component ────────────────────
interface PaginationProps {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  setPage: (p: number) => void;
  changePageSize: (s: number) => void;
  isRtl?: boolean;
}

export function DataTablePagination({
  page,
  pageSize,
  totalPages,
  totalItems,
  setPage,
  changePageSize,
  isRtl = false,
}: PaginationProps) {
  if (totalItems === 0) return null;

  const start = page * pageSize + 1;
  const end = Math.min((page + 1) * pageSize, totalItems);

  return (
    <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-3 text-sm pt-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>
          {isRtl
            ? `عرض ${start}–${end} من ${totalItems}`
            : `Showing ${start}–${end} of ${totalItems}`}
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => changePageSize(Number(v))}
        >
          <SelectTrigger className="w-[70px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(0)}
            disabled={page === 0}
          >
            {isRtl ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <ChevronsLeft className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(page - 1)}
            disabled={page === 0}
          >
            {isRtl ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>
          <span className="px-3 text-muted-foreground min-w-[60px] text-center">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages - 1}
          >
            {isRtl ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
          >
            {isRtl ? (
              <ChevronsLeft className="w-4 h-4" />
            ) : (
              <ChevronsRight className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Sortable Header ─────────────────────────
interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  currentSortDir: SortDir;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  currentSortDir,
  onSort,
  className,
}: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 hover:text-foreground transition-colors",
        className,
      )}
    >
      {label}
      {isActive && currentSortDir === "asc" && (
        <ArrowUp className="w-3.5 h-3.5" />
      )}
      {isActive && currentSortDir === "desc" && (
        <ArrowDown className="w-3.5 h-3.5" />
      )}
      {!isActive && <ArrowUpDown className="w-3.5 h-3.5 opacity-30" />}
    </button>
  );
}

// ─── Zebra row helper ────────────────────────
export function zebraRow(index: number, extra?: string) {
  return cn(index % 2 === 1 && "bg-muted/30", extra);
}
