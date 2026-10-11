import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

const report = {
  title: "t",
  summary: [],
  columns: [
    { key: "name", label: "Name" },
    { key: "amount", label: "Amount", type: "money" as const },
  ],
  rows: [
    { name: 'Rahim "Raju" Ahmed', amount: 1500 },
    { name: "Line\nbreak, comma", amount: -20 },
    { name: "=HYPERLINK(\"evil\")", amount: null },
  ],
};

describe("toCsv", () => {
  it("starts with a BOM and uses CRLF line endings", () => {
    const csv = toCsv(report);
    expect(csv.startsWith("﻿Name,Amount\r\n")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });
  it("quotes quotes, commas and newlines; keeps negative numbers", () => {
    const lines = toCsv(report).slice(1).split("\r\n");
    expect(lines[1]).toBe('"Rahim ""Raju"" Ahmed",1500');
    expect(lines[2]).toBe('"Line\nbreak, comma",-20');
  });
  it("neutralises spreadsheet formulas in text", () => {
    expect(toCsv(report)).toContain(`"'=HYPERLINK(""evil"")",`);
  });
});
