"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchInput({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const [value, setValue] = useState(urlQuery);
  const [focused, setFocused] = useState(false);
  const [prevUrlQuery, setPrevUrlQuery] = useState(urlQuery);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The same search box can exist twice (inline on desktop, in the mobile
  // filter panel). Only typing pushes to the URL; when the URL changes some
  // other way (Clear, the other copy), adopt it unless the user is typing here.
  if (urlQuery !== prevUrlQuery) {
    setPrevUrlQuery(urlQuery);
    if (!focused) setValue(urlQuery);
  }

  function onType(next: string) {
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (next.trim()) params.set("q", next.trim());
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname));
    }, 300);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  // "/" focuses the search box from anywhere on the page (unless already typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      const el = input.current;
      if (!el || el.getClientRects().length === 0) return; // the hidden copy
      e.preventDefault();
      el.focus();
      el.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="relative col-span-2 w-full lg:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={input}
        type="search"
        value={value}
        onChange={(e) => onType(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        className="pl-8 pointer-fine:pr-8"
        aria-label={placeholder}
      />
      {pending ? (
        <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      ) : (
        !value && (
          <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground pointer-fine:block">
            /
          </kbd>
        )
      )}
    </div>
  );
}
