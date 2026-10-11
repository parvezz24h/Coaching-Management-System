import { describe, expect, it } from "vitest";
import { weekdayOf } from "./constants";
import { formatMoney, formatTime, formatTimeRange, monthDays, parseDateInput, toDateInput } from "./format";

describe("dates", () => {
  it("round-trips date inputs as UTC midnight", () => {
    const d = parseDateInput("2026-10-11")!;
    expect(d.toISOString()).toBe("2026-10-11T00:00:00.000Z");
    expect(toDateInput(d)).toBe("2026-10-11");
    expect(parseDateInput("not a date")).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });

  it("knows month lengths, including leap years", () => {
    expect(monthDays("2026-02").days).toHaveLength(28);
    expect(monthDays("2028-02").days).toHaveLength(29);
    expect(toDateInput(monthDays("2026-11").last)).toBe("2026-11-30");
  });

  it("maps dates to the Saturday-first weekday codes", () => {
    expect(weekdayOf(parseDateInput("2026-10-10")!)).toBe("SAT");
    expect(weekdayOf(parseDateInput("2026-10-11")!)).toBe("SUN");
    expect(weekdayOf(parseDateInput("2026-10-16")!)).toBe("FRI");
  });
});

describe("display formatting", () => {
  it("formats 12-hour times and ranges", () => {
    expect(formatTime("00:05")).toBe("12:05 AM");
    expect(formatTime("16:30")).toBe("4:30 PM");
    expect(formatTimeRange("16:00", "17:30")).toBe("4:00–5:30 PM");
    expect(formatTimeRange("11:00", "12:30")).toBe("11:00 AM–12:30 PM");
  });

  it("formats money with lakh grouping and a leading minus", () => {
    expect(formatMoney(150000)).toBe("৳1,50,000");
    expect(formatMoney("-1500")).toBe("-৳1,500");
    expect(formatMoney(12.5, "Tk ")).toBe("Tk 12.5");
  });
});
