"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS } from "@/components/nav-items";
import { cn } from "@/lib/utils";

// Pages declare their title with <SetPageTitle>; the top bar shows it.
// Until a page has rendered, the bar falls back to the nav label for the
// current section, so there is no empty flash.

type Ctx = { title: string | null; setTitle: (t: string | null) => void };
const PageTitleContext = createContext<Ctx>({ title: null, setTitle: () => {} });

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = useState<string | null>(null);
  return <PageTitleContext.Provider value={{ title, setTitle }}>{children}</PageTitleContext.Provider>;
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
  const fallback = NAV_ITEMS.find((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))?.label ?? "";
  return (
    <h1 className={cn("min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg", className)}>
      {title ?? fallback}
    </h1>
  );
}
