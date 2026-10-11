"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { NAV_SECTIONS } from "@/components/nav-items";
import { cn } from "@/lib/utils";

// Pages declare their title with <SetPageTitle>; the top bar shows it.
// Until a page has rendered, the bar falls back to the nav label for the
// current section, so there is no empty flash.

// On phones and tablets the top bar also hosts the page's action icons and a
// search/filter toggle, plus a panel that opens below it. Pages render into
// these slots through portals (see HeaderActions and FilterPanel).
type SlotName = "filter" | "actions" | "panel";
type Slots = Record<SlotName, HTMLElement | null>;
type Ctx = {
  title: string | null;
  setTitle: (t: string | null) => void;
  slots: Slots;
  setSlot: (name: SlotName, el: HTMLElement | null) => void;
};
const PageTitleContext = createContext<Ctx>({
  title: null,
  setTitle: () => {},
  slots: { filter: null, actions: null, panel: null },
  setSlot: () => {},
});

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slots>({ filter: null, actions: null, panel: null });
  const setSlot = useCallback((name: SlotName, el: HTMLElement | null) => {
    setSlots((s) => (s[name] === el ? s : { ...s, [name]: el }));
  }, []);
  return <PageTitleContext.Provider value={{ title, setTitle, slots, setSlot }}>{children}</PageTitleContext.Provider>;
}

export function usePageSlots() {
  return useContext(PageTitleContext).slots;
}

/** Right side of the top bar on phones/tablets: filter toggle, then page actions as icons. */
export function HeaderSlots() {
  const { setSlot } = useContext(PageTitleContext);
  const filterRef = useCallback((el: HTMLDivElement | null) => setSlot("filter", el), [setSlot]);
  const actionsRef = useCallback((el: HTMLDivElement | null) => setSlot("actions", el), [setSlot]);
  return (
    <div className="flex shrink-0 items-center gap-1 lg:hidden">
      <div ref={filterRef} className="flex" />
      <div
        ref={actionsRef}
        className={cn(
          "flex items-center gap-1",
          // Page actions become icon-only buttons. Labels stay in the DOM
          // (font-size 0) so screen readers still announce them.
          "[&_:is(a,button)]:size-10! [&_:is(a,button)]:gap-0! [&_:is(a,button)]:p-0! [&_:is(a,button)]:text-[0px]!",
          "[&_svg]:size-[1.125rem]! [&_[data-header]]:hidden!",
        )}
      />
    </div>
  );
}

/** Where the search/filter panel opens, directly below the top bar row. */
export function HeaderPanelSlot() {
  const { setSlot } = useContext(PageTitleContext);
  const ref = useCallback((el: HTMLDivElement | null) => setSlot("panel", el), [setSlot]);
  return <div ref={ref} className="lg:hidden" />;
}

/**
 * Renders a page's actions as compact icons in the top bar (phones/tablets).
 * Button labels stay in the accessibility tree and become tooltips.
 * Wrap an action in <span data-header="body" className="contents"> to keep it
 * out of the top bar.
 */
export function HeaderActions({ children }: { children: React.ReactNode }) {
  const { actions } = usePageSlots();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelectorAll<HTMLElement>("a, button").forEach((el) => {
      const label = el.textContent?.trim();
      if (label && !el.title) el.title = label;
    });
  });
  if (!actions) return null;
  return createPortal(
    <div ref={ref} className="flex items-center gap-1">
      {children}
    </div>,
    actions,
  );
}

export function SetPageTitle({ title }: { title: string }) {
  const { setTitle } = useContext(PageTitleContext);
  useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
  return null;
}

const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

export function HeaderTitle({ className }: { className?: string }) {
  const { title } = useContext(PageTitleContext);
  const pathname = usePathname();
  const section = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  // On a page below a section (e.g. a student's page), offer a way back to the section.
  const parent = section && pathname !== section.href ? section : null;
  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      {parent && (
        <Link
          href={parent.href}
          aria-label={`Back to ${parent.label}`}
          title={`Back to ${parent.label}`}
          className="-ml-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:size-10"
        >
          <ArrowLeft className="size-4" />
        </Link>
      )}
      <h1
        key={title ?? section?.label}
        className="min-w-0 truncate text-base font-semibold tracking-tight motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 sm:text-lg"
      >
        {title ?? section?.label ?? ""}
      </h1>
    </div>
  );
}
