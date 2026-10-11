// Loading placeholders that mirror the real page layouts, used by loading.tsx
// files so navigation shows the page's shape instantly.
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
// Deterministic "random" widths so rows don't all look identical.
const W = ["w-3/5", "w-2/5", "w-1/2", "w-2/3", "w-1/3", "w-3/4"];

/** Screen-reader announcement plus wrapper for a whole page placeholder. */
export function LoadingPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={cn("grid gap-5", className)}>
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

/** The details/actions row under the top bar. */
export function SkeletonActions({ buttons = 1, meta = false }: { buttons?: number; meta?: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {meta ? <Skeleton className="h-5 w-48" /> : <div className="hidden sm:block" />}
      <div className="flex gap-2">
        {range(buttons).map((i) => (
          <Skeleton key={i} className={cn("h-8 pointer-coarse:h-10", i === buttons - 1 ? "w-32" : "w-24")} />
        ))}
      </div>
    </div>
  );
}

/** Search box plus filter selects, matching the mobile two-column grid. */
export function SkeletonFilters({ selects = 2, search = true }: { selects?: number; search?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {search && <Skeleton className="col-span-2 h-8 pointer-coarse:h-10 sm:w-72" />}
      {range(selects).map((i) => (
        <Skeleton key={i} className="h-8 pointer-coarse:h-10 sm:w-44" />
      ))}
    </div>
  );
}

export function SkeletonStats({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-3 gap-2 sm:gap-3", className)}>
      {range(count).map((i) => (
        <Card key={i} size="sm">
          <CardContent className="grid gap-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-20 sm:w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** A table card: header row and body rows; extra columns hide on phones like the real tables. */
export function SkeletonTable({ rows = 8, cols = 4, inCard = true }: { rows?: number; cols?: number; inCard?: boolean }) {
  const body = (
    <div className="divide-y">
      <div className="flex items-center gap-4 px-4 py-3">
        {range(cols).map((c) => (
          <Skeleton key={c} className={cn("h-3", c === 0 ? "w-24" : "w-14", c >= 2 && "hidden sm:block", c === 0 && "flex-1 sm:flex-none")} />
        ))}
      </div>
      {range(rows).map((r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          <div className="grid flex-1 gap-1.5 sm:flex-none sm:basis-56">
            <Skeleton className={cn("h-4", W[r % W.length])} />
            <Skeleton className="h-3 w-24" />
          </div>
          {range(cols - 1).map((c) => (
            <Skeleton key={c} className={cn("h-4 sm:flex-1", c === 0 ? "w-14" : "hidden w-20 sm:block")} />
          ))}
        </div>
      ))}
    </div>
  );
  return inCard ? <Card className="py-0">{body}</Card> : body;
}

/** Stacked cards used for lists on phones (fees, payments); falls back to a table on desktop. */
export function SkeletonList({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      <Card className="py-0 md:hidden">
        <div className="divide-y">
          {range(rows).map((r) => (
            <div key={r} className="flex items-center gap-3 p-3">
              <div className="grid flex-1 gap-1.5">
                <Skeleton className={cn("h-4", W[r % W.length])} />
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </Card>
      <div className="hidden md:block">
        <SkeletonTable rows={rows} cols={cols} />
      </div>
    </>
  );
}

/** A card with a heading and some content lines or a table. */
export function SkeletonCard({ lines = 3, table, className }: { lines?: number; table?: { rows: number; cols: number }; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="grid gap-3">
        {table ? (
          <SkeletonTable rows={table.rows} cols={table.cols} inCard={false} />
        ) : (
          range(lines).map((i) => <Skeleton key={i} className={cn("h-4", W[i % W.length])} />)
        )}
      </CardContent>
    </Card>
  );
}

/** Label/value pairs, as on profile and batch detail cards. */
export function SkeletonFacts({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {range(count).map((i) => (
        <div key={i} className="grid gap-1.5">
          <Skeleton className="h-3 w-16" />
          <Skeleton className={cn("h-4", W[i % W.length])} />
        </div>
      ))}
    </div>
  );
}

/** A form card: label + input pairs in a two-column grid. */
export function SkeletonForm({ fields = 6, cards = 1, className }: { fields?: number; cards?: number; className?: string }) {
  return (
    <div className={cn("grid gap-5", className)}>
      {range(cards).map((c) => (
        <Card key={c}>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {range(fields).map((i) => (
              <div key={i} className="grid gap-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-full pointer-coarse:h-10" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** A printable document (receipt, marksheet). */
export function SkeletonDocument({ rows = 4 }: { rows?: number }) {
  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardContent className="grid gap-5 p-6 sm:p-8">
        <div className="grid justify-items-center gap-2 border-b pb-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <SkeletonFacts count={4} />
        <div className="grid gap-2">
          {range(rows).map((i) => (
            <div key={i} className="flex justify-between gap-4">
              <Skeleton className={cn("h-4", W[i % W.length])} />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="ml-auto h-6 w-28" />
      </CardContent>
    </Card>
  );
}
