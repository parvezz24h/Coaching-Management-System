import { describe, expect, it } from "vitest";
import { DEFAULT_GRADING_SCALE } from "./constants";
import { gradeForGpa, gradeForPercent, parseScale, rankResults, studentResult, type MarkEntry } from "./grading";

const scale = DEFAULT_GRADING_SCALE;
const specs = [
  { id: "phy", name: "Physics", fullMarks: 100, passMarks: 33 },
  { id: "hm", name: "Higher Math", fullMarks: 50, passMarks: 17 },
];
const marks = (phy?: MarkEntry, hm?: MarkEntry) =>
  new Map(Object.entries({ phy, hm }).filter((e): e is [string, MarkEntry] => e[1] !== undefined));
const m = (obtained: number): MarkEntry => ({ obtained, isAbsent: false });
const absent: MarkEntry = { obtained: null, isAbsent: true };

describe("grade boundaries (Bangladesh scale)", () => {
  it.each([
    [100, "A+"],
    [80, "A+"],
    [79.99, "A"],
    [60, "A-"],
    [33, "D"],
    [32.99, "F"],
    [0, "F"],
  ])("%f%% → %s", (pct, grade) => expect(gradeForPercent(pct, scale).grade).toBe(grade));

  it.each([
    [5, "A+"],
    [4.75, "A"],
    [3.5, "A-"],
    [3.25, "B"],
    [1, "D"],
    [0.99, "F"],
  ])("GPA %f → %s", (gpa, grade) => expect(gradeForGpa(gpa, scale).grade).toBe(grade));
});

describe("studentResult", () => {
  it("averages subject grade points", () => {
    const r = studentResult(specs, marks(m(85), m(31)), scale); // A+ (5) and A- (3.5)
    expect(r).toMatchObject({ complete: true, passed: true, gpa: 4.25, grade: "A", total: 116, fullTotal: 150 });
  });

  it("gives GPA 0 and F when any subject is failed", () => {
    const r = studentResult(specs, marks(m(95), m(10)), scale);
    expect(r).toMatchObject({ passed: false, gpa: 0, grade: "F", failedCount: 1 });
  });

  it("treats absent as failed", () => {
    const r = studentResult(specs, marks(m(95), absent), scale);
    expect(r.subjects[1]).toMatchObject({ isAbsent: true, grade: "F", passed: false });
    expect(r.gpa).toBe(0);
  });

  it("marks results with a missing subject as incomplete", () => {
    const r = studentResult(specs, marks(m(95)), scale);
    expect(r).toMatchObject({ complete: false, passed: false, grade: "—" });
  });

  it("passes exactly at the pass mark", () => {
    expect(studentResult(specs, marks(m(33), m(17)), scale)).toMatchObject({ passed: true, grade: "D", gpa: 1 });
  });

  it("truncates GPA instead of rounding", () => {
    const three = [...specs, { id: "x", name: "X", fullMarks: 100, passMarks: 33 }];
    // 5 + 5 + 4 = 14 / 3 = 4.666… → 4.66
    const r = studentResult(three, new Map([["phy", m(90)], ["hm", m(45)], ["x", m(75)]]), scale);
    expect(r.gpa).toBe(4.66);
  });
});

describe("rankResults", () => {
  it("uses competition ranking and leaves incomplete results unranked", () => {
    const top = studentResult(specs, marks(m(95), m(45)), scale);
    const mid = studentResult(specs, marks(m(85), m(31)), scale);
    const fail = studentResult(specs, marks(m(99), m(1)), scale);
    const missing = studentResult(specs, marks(m(99)), scale);
    const ranked = rankResults([
      { id: "fail", result: fail },
      { id: "a", result: top },
      { id: "missing", result: missing },
      { id: "b", result: top },
      { id: "mid", result: mid },
    ]);
    expect(Object.fromEntries(ranked.map((r) => [r.id, r.rank]))).toEqual({ a: 1, b: 1, mid: 3, fail: 4, missing: null });
  });
});

describe("parseScale", () => {
  it("falls back to the default scale for bad settings JSON", () => {
    expect(parseScale(null)).toEqual(DEFAULT_GRADING_SCALE);
    expect(parseScale([{ nope: 1 }])).toEqual(DEFAULT_GRADING_SCALE);
  });
  it("sorts a custom scale from highest to lowest", () => {
    const s = parseScale([
      { grade: "F", minPercent: 0, gpa: 0 },
      { grade: "P", minPercent: 40, gpa: 2 },
    ]);
    expect(s.map((r) => r.grade)).toEqual(["P", "F"]);
  });
});
