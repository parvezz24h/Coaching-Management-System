// Money arithmetic in integer paisa (1/100 taka) so totals are exact.

type Numeric = number | string | { toString(): string } | null | undefined;

export function toPaisa(value: Numeric): number {
  if (value == null || value === "") return 0;
  return Math.round(Number(value.toString()) * 100);
}

/** Paisa → decimal string for Prisma Decimal columns ("1500.00"). */
export function fromPaisa(paisa: number): string {
  const sign = paisa < 0 ? "-" : "";
  const abs = Math.abs(paisa);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export type FeeStatus = "UNPAID" | "PARTIAL" | "PAID" | "WAIVED";

export function feeNet(fee: { amount: Numeric; discount: Numeric }) {
  return toPaisa(fee.amount) - toPaisa(fee.discount);
}

export function feeBalance(fee: { amount: Numeric; discount: Numeric; paidAmount: Numeric; status?: string }) {
  if (fee.status === "WAIVED") return 0;
  return Math.max(0, feeNet(fee) - toPaisa(fee.paidAmount));
}

/** Status implied by the amounts. A waived fee stays waived. */
export function feeStatus(netPaisa: number, paidPaisa: number, current?: string): FeeStatus {
  if (current === "WAIVED") return "WAIVED";
  if (netPaisa <= 0) return "WAIVED";
  if (paidPaisa >= netPaisa) return "PAID";
  return paidPaisa > 0 ? "PARTIAL" : "UNPAID";
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ""));
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

/** Whole number in words using the South Asian system (thousand, lakh, crore). */
function integerToWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  n %= 1000;
  if (n) parts.push(belowThousand(n));
  return parts.join(" ");
}

/** e.g. 150050 paisa → "Taka One Thousand Five Hundred and Fifty Paisa Only" */
export function amountInWords(paisa: number): string {
  const abs = Math.abs(paisa);
  const taka = Math.floor(abs / 100);
  const ps = abs % 100;
  const words = `Taka ${integerToWords(taka)}${ps ? ` and ${belowThousand(ps)} Paisa` : ""} Only`;
  return paisa < 0 ? `Minus ${words}` : words;
}
