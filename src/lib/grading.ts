// Result calculation. Pure functions: no database access, safe on the client.
import { DEFAULT_GRADING_SCALE, type GradeRule } from "@/lib/constants";

/** Settings JSON → a validated scale sorted from highest to lowest. */
export function parseScale(value: unknown): GradeRule[] {
  if (!Array.isArray(value) || value.length === 0) return DEFAULT_GRADING_SCALE;
  const rules = value.filter(
    (r): r is GradeRule =>
      r && typeof r.grade === "string" && typeof r.minPercent === "number" && typeof r.gpa === "number",
  );
  return rules.length ? [...rules].sort((a, b) => b.minPercent - a.minPercent) : DEFAULT_GRADING_SCALE;
}

const failRule = (scale: GradeRule[]) => scale[scale.length - 1];

export function gradeForPercent(percent: number, scale: GradeRule[]): GradeRule {
  return scale.find((r) => percent >= r.minPercent) ?? failRule(scale);
}

/** Overall letter from GPA: the best rule whose GPA the student reached. */
export function gradeForGpa(gpa: number, scale: GradeRule[]): GradeRule {
  return [...scale].sort((a, b) => b.gpa - a.gpa).find((r) => gpa >= r.gpa) ?? failRule(scale);
}

export type SubjectSpec = { id: string; name: string; fullMarks: number; passMarks: number };
export type MarkEntry = { obtained: number | null; isAbsent: boolean };

export type SubjectResult = {
  subjectId: string;
  obtained: number | null;
  isAbsent: boolean;
  missing: boolean;
  percent: number | null;
  passed: boolean;
  grade: string;
  gpa: number;
};

export type StudentResult = {
  subjects: SubjectResult[];
  complete: boolean; // every subject has a mark or is marked absent
  total: number;
  fullTotal: number;
  percent: number;
  passed: boolean;
  gpa: number; // 0 when any subject is failed (national-board rule)
  grade: string;
  failedCount: number;
};

export function subjectResult(spec: SubjectSpec, mark: MarkEntry | undefined, scale: GradeRule[]): SubjectResult {
  const fail = failRule(scale);
  if (!mark || (!mark.isAbsent && mark.obtained == null)) {
    return { subjectId: spec.id, obtained: null, isAbsent: false, missing: true, percent: null, passed: false, grade: "—", gpa: 0 };
  }
  if (mark.isAbsent) {
    return { subjectId: spec.id, obtained: null, isAbsent: true, missing: false, percent: 0, passed: false, grade: fail.grade, gpa: fail.gpa };
  }
  const obtained = mark.obtained!;
  const percent = spec.fullMarks > 0 ? (obtained / spec.fullMarks) * 100 : 0;
  const passed = obtained >= spec.passMarks;
  const rule = passed ? gradeForPercent(percent, scale) : fail;
  return { subjectId: spec.id, obtained, isAbsent: false, missing: false, percent, passed, grade: rule.grade, gpa: rule.gpa };
}

export function studentResult(
  specs: SubjectSpec[],
  marks: Map<string, MarkEntry>,
  scale: GradeRule[],
): StudentResult {
  const subjects = specs.map((s) => subjectResult(s, marks.get(s.id), scale));
  const complete = subjects.every((s) => !s.missing);
  const total = subjects.reduce((sum, s) => sum + (s.obtained ?? 0), 0);
  const fullTotal = specs.reduce((sum, s) => sum + s.fullMarks, 0);
  const failedCount = subjects.filter((s) => !s.missing && !s.passed).length;
  const passed = complete && failedCount === 0 && specs.length > 0;
  const avg = specs.length ? subjects.reduce((sum, s) => sum + s.gpa, 0) / specs.length : 0;
  // GPA is truncated (not rounded) to two decimals, as boards do.
  const gpa = passed ? Math.floor(avg * 100 + 1e-9) / 100 : 0;
  return {
    subjects,
    complete,
    total,
    fullTotal,
    percent: fullTotal ? (total / fullTotal) * 100 : 0,
    passed,
    gpa,
    grade: complete ? (passed ? gradeForGpa(gpa, scale).grade : failRule(scale).grade) : "—",
    failedCount,
  };
}

/** Competition ranking ("1, 2, 2, 4") over complete results: pass first, then GPA, then total marks. */
export function rankResults<T extends { result: StudentResult }>(rows: T[]): (T & { rank: number | null })[] {
  const ranked = rows
    .filter((r) => r.result.complete)
    .sort(
      (a, b) =>
        Number(b.result.passed) - Number(a.result.passed) ||
        b.result.gpa - a.result.gpa ||
        b.result.total - a.result.total,
    );
  const rankOf = new Map<T, number>();
  ranked.forEach((r, i) => {
    const prev = ranked[i - 1];
    const tie =
      prev &&
      prev.result.passed === r.result.passed &&
      prev.result.gpa === r.result.gpa &&
      prev.result.total === r.result.total;
    rankOf.set(r, tie ? rankOf.get(prev)! : i + 1);
  });
  return rows.map((r) => ({ ...r, rank: rankOf.get(r) ?? null }));
}
