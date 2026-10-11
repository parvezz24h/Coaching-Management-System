"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string };

/** Select bound to a string value where "" means nothing selected. */
export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  noneLabel,
  invalid,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  /** When set, adds an option that clears the selection. */
  noneLabel?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const items = noneLabel ? [{ value: null, label: noneLabel }, ...options] : options;
  return (
    <Select
      items={items}
      value={value === "" ? null : value}
      onValueChange={(v) => onChange((v as string | null) ?? "")}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-invalid={invalid || undefined} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {noneLabel && <SelectItem value={null}>{noneLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
