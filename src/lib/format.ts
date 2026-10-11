import { APP_TIMEZONE } from "@/lib/constants";

type Numeric = number | string | { toString(): string } | null | undefined;

export function toNumber(value: Numeric): number {
  if (value == null) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMoney(value: Numeric, symbol = "৳") {
  const n = toNumber(value);
  return `${n < 0 ? "-" : ""}${symbol}${moneyFormatter.format(Math.abs(n))}`;
}

// @db.Date columns come back as UTC midnight, so format them in UTC to keep
// the stored calendar day regardless of server timezone.
export function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }).format(value);
}

/** "YYYY-MM-DD" for a @db.Date value, for use in <input type="date">. */
export function toDateInput(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

/** Today's calendar date in the center's timezone, as "YYYY-MM-DD". */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date());
}

/** Parse "YYYY-MM-DD" into a UTC-midnight Date suitable for @db.Date columns. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Start and end (exclusive) of the current month in the center's timezone. */
export function currentMonthRange() {
  const [year, month] = todayISO().split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: new Date(`${year}-${pad(month)}-01T00:00:00+06:00`),
    end: new Date(`${nextYear}-${pad(nextMonth)}-01T00:00:00+06:00`),
  };
}

export function emptyToNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** "16:30" → "4:30 PM" */
export function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Current month in the center's timezone, as "YYYY-MM". */
export function currentMonthISO() {
  return todayISO().slice(0, 7);
}

/** First and last calendar day (UTC-midnight Dates) and day count of a "YYYY-MM" month. */
export function monthDays(month: string) {
  const [year, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const days = Array.from({ length: count }, (_, i) => new Date(Date.UTC(year, m - 1, i + 1)));
  return { first: days[0], last: days[count - 1], days };
}

/** "16:00","17:30" → "4:00–5:30 PM"; keeps both suffixes when they differ. */
export function formatTimeRange(start: string, end: string) {
  const [s, e] = [formatTime(start), formatTime(end)];
  return s.slice(-2) === e.slice(-2) ? `${s.slice(0, -3)}–${e}` : `${s}–${e}`;
}

/** "2026-10" → "October 2026" */
export function formatMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}
