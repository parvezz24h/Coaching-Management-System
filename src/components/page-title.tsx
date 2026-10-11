"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
