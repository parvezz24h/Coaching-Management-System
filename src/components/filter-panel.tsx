"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageSlots } from "@/components/page-title";
import { cn } from "@/lib/utils";

/**
 * A page's search box and filters.
 * Desktop: shown inline. Phones/tablets: hidden behind a search/filter icon in
 * the top bar that opens them in a panel just below it.
 */
export function FilterPanel({
  children,
  params,
  icon = "search",
  defaultOpen = false,
  className,
}: {
  children: React.ReactNode;
  /** URL params these filters control — used for the "active" dot and Clear. */
  params: string[];
  icon?: "search" | "filter";
  /** Open on small screens when the page needs a selection before showing data. */
  defaultOpen?: boolean;
  className?: string;
}) {
  const slots = usePageSlots();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const activeCount = params.filter((p) => searchParams.get(p)).length;
  const Icon = icon === "search" ? Search : SlidersHorizontal;
  const label = icon === "search" ? "Search and filters" : "Filters";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    // Put the cursor in the search box (or first filter) when opening.
    if (next) requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("input, [role=combobox]")?.focus());
  }

  function clear() {
    const next = new URLSearchParams(searchParams);
    for (const p of [...params, "page"]) next.delete(p);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <>
      <div className={cn("mb-4 hidden gap-2 lg:flex lg:flex-wrap lg:items-center", className)}>{children}</div>

      {slots.filter &&
        createPortal(
          <Button
            variant={open ? "secondary" : "ghost"}
            size="icon"
            aria-label={label}
            title={label}
            aria-expanded={open}
            aria-controls={panelId}
            onClick={toggle}
            className="relative size-10"
          >
            <Icon className="size-[1.125rem]" />
            {activeCount > 0 && (
              <span className="absolute top-2 right-2 size-2 rounded-full bg-primary ring-2 ring-background" aria-hidden />
            )}
          </Button>,
          slots.filter,
        )}

      {open &&
        slots.panel &&
        createPortal(
          <div
            id={panelId}
            ref={panelRef}
            role="region"
            aria-label={label}
            className="max-h-[60svh] overflow-y-auto border-t bg-background px-4 py-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 motion-safe:duration-200"
          >
            <div className="grid grid-cols-2 gap-2">{children}</div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {activeCount ? `${activeCount} filter${activeCount === 1 ? "" : "s"} applied` : "No filters applied"}
              </span>
              <div className="flex gap-1">
                {activeCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clear}>
                    Clear
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                  <X /> Close
                </Button>
              </div>
            </div>
          </div>,
          slots.panel,
        )}
    </>
  );
}
