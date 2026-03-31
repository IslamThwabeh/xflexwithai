import { Skeleton } from './ui/skeleton';

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar skeleton */}
      <div className="w-[280px] border-r border-border bg-[#0c1222] p-4 space-y-6 hidden md:block">
        {/* Logo area */}
        <div className="flex items-center gap-3 px-2">
          <Skeleton className="h-8 w-8 rounded-md bg-white/[0.06]" />
          <Skeleton className="h-4 w-24 bg-white/[0.06]" />
        </div>
        {/* Menu items */}
        <div className="space-y-2 px-2">
          <Skeleton className="h-10 w-full rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-10 w-full rounded-lg bg-white/[0.06]" />
          <Skeleton className="h-10 w-full rounded-lg bg-white/[0.06]" />
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {/* Topbar skeleton */}
        <div className="h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2.5 w-44" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="flex-1 p-4 md:p-6 bg-[#faf7f2] dark:bg-[#0b1120] space-y-4">
          <Skeleton className="h-12 w-48 rounded-lg" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
