"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type Option, SelectField } from "@/components/select-field";

/** A select that stores its value in a URL search param. */
export function UrlFilter({
  param,
  options,
  allLabel,
  wide,
}: {
  param: string;
  options: Option[];
  allLabel: string;
  /** Span both columns of the mobile filter grid (long option labels). */
  wide?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <SelectField
      className={wide ? "col-span-2 lg:w-64" : "lg:w-44"}
      value={searchParams.get(param) ?? ""}
      onChange={(value) => {
        const params = new URLSearchParams(searchParams);
        if (value) params.set(param, value);
        else params.delete(param);
        params.delete("page");
        router.replace(`${pathname}?${params.toString()}`);
      }}
      options={options}
      noneLabel={allLabel}
      placeholder={allLabel}
    />
  );
}
