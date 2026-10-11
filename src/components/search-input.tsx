"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchInput({ placeholder = "Search…" }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  // "/" focuses the search box from anywhere on the page (unless already typing).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      e.preventDefault();
      input.current?.focus();
      input.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (value.trim() === current) return;
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (value.trim()) params.set("q", value.trim());
      else params.delete("q");
      params.delete("page");
      startTransition(() => router.replace(`${pathname}?${params.toString()}`));
    }, 300);
    return () => clearTimeout(timer);
  }, [value, searchParams, pathname, router]);

  return (
    <div className="relative col-span-2 w-full sm:w-72">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={input}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
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
