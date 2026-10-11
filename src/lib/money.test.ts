import { describe, expect, it } from "vitest";
import { amountInWords, feeBalance, feeStatus, fromPaisa, toPaisa } from "./money";

describe("paisa conversion", () => {
  it("avoids floating point drift", () => {
    expect(toPaisa("0.29")).toBe(29);
    expect(toPaisa(0.1) + toPaisa(0.2)).toBe(30);
    expect(toPaisa("1500.50")).toBe(150050);
    expect(toPaisa(null)).toBe(0);
  });
  it("formats back to two decimals, including negatives", () => {
    expect(fromPaisa(150050)).toBe("1500.50");
    expect(fromPaisa(7)).toBe("0.07");
    expect(fromPaisa(-5)).toBe("-0.05");
    expect(fromPaisa(0)).toBe("0.00");
  });
});

describe("fee status", () => {
  it.each([
    [1000, 0, undefined, "UNPAID"],
    [1000, 400, undefined, "PARTIAL"],
    [1000, 1000, undefined, "PAID"],
    [0, 0, undefined, "WAIVED"],
    [1000, 400, "WAIVED", "WAIVED"],
  ])("net %i, paid %i, current %s → %s", (net, paid, current, expected) => {
    expect(feeStatus(net, paid, current)).toBe(expected);
  });

  it("computes balance net of discount and payments; waived owes nothing", () => {
    expect(feeBalance({ amount: "1500", discount: "300", paidAmount: "200" })).toBe(100000);
    expect(feeBalance({ amount: "1500", discount: "0", paidAmount: "200", status: "WAIVED" })).toBe(0);
  });
});

describe("amountInWords", () => {
  it.each([
    [0, "Taka Zero Only"],
    [150000, "Taka One Thousand Five Hundred Only"],
    [150050, "Taka One Thousand Five Hundred and Fifty Paisa Only"],
    [2125000, "Taka Twenty-One Thousand Two Hundred Fifty Only"],
    [10000000, "Taka One Lakh Only"],
    [123456789, "Taka Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Eighty-Nine Paisa Only"],
    [1000000000, "Taka One Crore Only"],
    [-150000, "Minus Taka One Thousand Five Hundred Only"],
  ])("%i paisa", (paisa, words) => {
    expect(amountInWords(paisa)).toBe(words);
  });
});
