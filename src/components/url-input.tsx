"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

/** A date/month input that stores its value in a URL search param. */
export function UrlInput({
  param,
  type,
  defaultValue,
  max,
  label,
}: {
  param: string;
  type: "date" | "month";
  defaultValue: string;
  max?: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Input
      type={type}
      aria-label={label}
      className="lg:w-44"
      value={searchParams.get(param) ?? defaultValue}
      max={max}
      onChange={(e) => {
        if (!e.target.value) return;
        const params = new URLSearchParams(searchParams);
        params.set(param, e.target.value);
        router.replace(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
