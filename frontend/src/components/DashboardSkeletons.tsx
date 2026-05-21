import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function KpiBentoSkeleton() {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
      {/* Featured tall tile */}
      <Card
        className="p-5 sm:p-6 sm:col-span-2 md:col-span-2 lg:col-span-2 row-span-2 min-h-[12rem] flex flex-col justify-between overflow-hidden relative shadow-[var(--shadow-card)]"
        style={{ background: "var(--gradient-card)" }}
      >
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-3 w-28" />
        </div>
        <div className="h-16 flex items-end gap-1">
          {[...Array(14)].map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-md"
              style={{ height: `${30 + Math.abs(Math.sin(i * 1.1)) * 60}%` }}
            />
          ))}
        </div>
      </Card>

      {/* 2x2 small KPI tiles */}
      <div className="sm:col-span-2 md:col-span-2 lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <Card
            key={i}
            className="p-4 sm:p-5 shadow-[var(--shadow-card)] relative overflow-hidden"
            style={{ background: "var(--gradient-card)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-24 mb-1.5" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>
    </section>
  );
}

export function ChartSkeleton({ height = "h-72", title = true }: { height?: string; title?: boolean }) {
  return (
    <Card className="p-5 shadow-[var(--shadow-card)]">
      {title && (
        <>
          <Skeleton className="h-4 w-40 mb-2" />
          <Skeleton className="h-3 w-56 mb-4" />
        </>
      )}
      <div className={`${height} relative overflow-hidden rounded-md bg-muted/30`}>
        {/* Faux gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between py-3 px-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-px bg-border/60" />
          ))}
        </div>
        {/* Faux bars/lines */}
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2 h-3/4">
          {[...Array(12)].map((_, i) => (
            <Skeleton
              key={i}
              className="flex-1 rounded-t-md"
              style={{ height: `${30 + Math.abs(Math.sin(i * 1.3)) * 60}%` }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

export function PlatformCardSkeleton() {
  return (
    <Card className="p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5 mb-4">
        <Skeleton className="size-9 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3 w-12 mx-auto" />
            <Skeleton className="h-5 w-10 mx-auto" />
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-12" />
      </div>
    </Card>
  );
}

export function PostsTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-[200px]" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <Card className="shadow-[var(--shadow-card)] overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-3 py-3 flex gap-3">
          {[...Array(7)].map((_, i) => (
            <Skeleton key={i} className={`h-3 ${i === 2 ? "flex-1" : "w-20"}`} />
          ))}
        </div>
        <div className="divide-y divide-border">
          {[...Array(rows)].map((_, r) => (
            <div key={r} className="px-3 py-3 flex items-center gap-3">
              <Skeleton className="size-6 rounded" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1 max-w-md" />
              {[...Array(5)].map((_, c) => (
                <Skeleton key={c} className="h-4 w-16" />
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-border px-3 py-2.5 flex items-center justify-between">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-7 w-48" />
        </div>
      </Card>
    </section>
  );
}

export function TopPostsSkeleton({ count = 8 }: { count?: number }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(count)].map((_, i) => (
          <Card key={i} className="overflow-hidden shadow-[var(--shadow-card)]">
            <Skeleton className="aspect-square w-full rounded-none" />
            <div className="p-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-10" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
