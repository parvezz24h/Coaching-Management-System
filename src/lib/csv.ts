import type { Report } from "@/lib/reports";

/** RFC 4180 CSV with a BOM so Excel opens Bangla text and ৳ correctly. */
export function toCsv(report: Report): string {
  const cell = (v: string | number | null) => {
    if (v == null) return "";
    const s = String(v);
    // Neutralise spreadsheet formula injection.
    const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [report.columns.map((c) => cell(c.label)).join(",")];
  for (const r of report.rows) lines.push(report.columns.map((c) => cell(r[c.key])).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}
