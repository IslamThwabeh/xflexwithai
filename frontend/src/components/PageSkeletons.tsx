/**
 * Reusable loading skeleton patterns for various page types.
 * Import and use these as loading fallbacks for lazy-loaded pages.
 */
import { Skeleton } from '@/components/ui/skeleton';

/** Generic page with hero + card grid (e.g., Events, Articles, FreeContent) */
export function PageWithCardsSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-in fade-in">
      {/* Hero skeleton */}
      <div className="bg-gray-200 py-16">
        <div className="container mx-auto px-4 text-center space-y-3">
          <Skeleton className="h-4 w-24 mx-auto" />
          <Skeleton className="h-10 w-80 mx-auto max-w-full" />
          <Skeleton className="h-5 w-64 mx-auto max-w-full" />
        </div>
      </div>
      {/* Card grid skeleton */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border rounded-xl overflow-hidden">
              <Skeleton className="w-full h-40" />
              <div className="p-5 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Admin CRUD page skeleton (table-like) */
export function AdminTableSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-6 animate-in fade-in">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-32 flex-1" />
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Dashboard stats skeleton */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in">
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white border rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-6 rounded" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border rounded-lg p-6 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Checkout/detail page skeleton */
export function DetailPageSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 animate-in fade-in">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-10 w-64" />
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border rounded-2xl p-6 space-y-4">
              <Skeleton className="h-6 w-40" />
              <div className="grid sm:grid-cols-2 gap-3">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
            </div>
            <div className="bg-white border rounded-2xl p-6 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
          <div>
            <div className="bg-white border rounded-2xl p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Simple text page skeleton (e.g., Terms, Privacy) */
export function TextPageSkeleton() {
  return (
    <div className="min-h-screen bg-white animate-in fade-in">
      <div className="bg-gray-200 py-12">
        <div className="container mx-auto px-4 space-y-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-12 max-w-3xl space-y-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
