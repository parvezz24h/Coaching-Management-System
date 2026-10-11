import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getExamResults } from "@/lib/exams";
import { currentMonthISO, parseDateInput, todayISO } from "@/lib/format";
import { feeBalance, fromPaisa, toPaisa } from "@/lib/money";
import type { SearchParams } from "@/lib/search-params";
import { param } from "@/lib/search-params";

// Each report is computed once here and rendered either as a table (page) or
// as CSV (export route), so both always agree.

export type ColumnType = "text" | "number" | "money" | "percent" | "date";
export type Column = { key: string; label: string; type?: ColumnType };
export type Row = Record<string, string | number | null>;
export type Report = {
  title: string;
  columns: Column[];
  rows: Row[];
  summary: { label: string; value: string | number; type?: ColumnType }[];
  note?: string;
};

export const REPORTS = [
  { key: "students", label: "Student list" },
  { key: "attendance", label: "Attendance summary" },
  { key: "collection", label: "Fee collection" },
  { key: "dues", label: "Outstanding dues" },
  { key: "exams", label: "Exam results" },
] as const;
export type ReportKey = (typeof REPORTS)[number]["key"];

export function reportKey(sp: SearchParams): ReportKey {
  const k = param(sp, "report");
  return (REPORTS.find((r) => r.key === k)?.key ?? "students") as ReportKey;
}

/** Date range from ?from=&to= (calendar days), defaulting to this month so far. */
export function dateRange(sp: SearchParams) {
  const today = todayISO();
  const from = parseDateInput(param(sp, "from")) ? param(sp, "from") : `${currentMonthISO()}-01`;
  const to = parseDateInput(param(sp, "to")) ? param(sp, "to") : today;
  return { from, to };
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
const pct = (num: number, den: number) => (den ? Math.round((num / den) * 1000) / 10 : null);

async function studentsReport(sp: SearchParams): Promise<Report> {
  const classLevelId = param(sp, "class");
  const batchId = param(sp, "batch");
  const status = param(sp, "status");
  const where: Prisma.StudentWhereInput = {
    ...(classLevelId && { classLevelId }),
    ...(batchId && { enrollments: { some: { batchId, status: "ACTIVE" } } }),
    ...((status === "ACTIVE" || status === "INACTIVE" || status === "LEFT") && { status }),
  };
  const students = await db.student.findMany({
    where,
    orderBy: [{ classLevel: { sortOrder: "asc" } }, { name: "asc" }],
    include: {
      classLevel: { select: { name: true } },
      enrollments: { where: { status: "ACTIVE" }, select: { batch: { select: { name: true } } } },
    },
  });
  return {
    title: "Student list",
    columns: [
      { key: "code", label: "Student ID" },
      { key: "name", label: "Name" },
      { key: "class", label: "Class" },
      { key: "batches", label: "Batches" },
      { key: "guardian", label: "Guardian" },
      { key: "guardianPhone", label: "Guardian phone" },
      { key: "phone", label: "Phone" },
      { key: "school", label: "School / college" },
      { key: "admitted", label: "Admitted", type: "date" },
      { key: "status", label: "Status" },
    ],
    rows: students.map((s) => ({
      code: s.studentCode,
      name: s.name,
      class: s.classLevel?.name ?? null,
      batches: s.enrollments.map((e) => e.batch.name).join("; ") || null,
      guardian: s.guardianRelation ? `${s.guardianName} (${s.guardianRelation})` : s.guardianName,
      guardianPhone: s.guardianPhone,
      phone: s.phone,
      school: s.schoolName,
      admitted: iso(s.admissionDate),
      status: s.status,
    })),
    summary: [
      { label: "Students", value: students.length, type: "number" },
      { label: "Active", value: students.filter((s) => s.status === "ACTIVE").length, type: "number" },
    ],
  };
}

async function attendanceReport(sp: SearchParams): Promise<Report> {
  const { from, to } = dateRange(sp);
  const batchId = param(sp, "batch");
  const grouped = await db.attendance.groupBy({
    by: ["studentId", "batchId", "status"],
    where: { date: { gte: parseDateInput(from)!, lte: parseDateInput(to)! }, ...(batchId && { batchId }) },
    _count: true,
  });
  const studentIds = [...new Set(grouped.map((g) => g.studentId))];
  const batchIds = [...new Set(grouped.map((g) => g.batchId))];
  const [students, batches] = await Promise.all([
    db.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, name: true, studentCode: true, guardianPhone: true } }),
    db.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, name: true } }),
  ]);
  const sName = new Map(students.map((s) => [s.id, s]));
  const bName = new Map(batches.map((b) => [b.id, b.name]));

  const byPair = new Map<string, { studentId: string; batchId: string; PRESENT: number; LATE: number; ABSENT: number }>();
  for (const g of grouped) {
    const k = `${g.studentId}:${g.batchId}`;
    if (!byPair.has(k)) byPair.set(k, { studentId: g.studentId, batchId: g.batchId, PRESENT: 0, LATE: 0, ABSENT: 0 });
    byPair.get(k)![g.status] += g._count;
  }
  const rows = [...byPair.values()]
    .map((p) => {
      const total = p.PRESENT + p.LATE + p.ABSENT;
      const s = sName.get(p.studentId)!;
      return {
        code: s.studentCode,
        name: s.name,
        batch: bName.get(p.batchId) ?? "",
        present: p.PRESENT,
        late: p.LATE,
        absent: p.ABSENT,
        total,
        rate: pct(p.PRESENT + p.LATE, total),
        guardianPhone: s.guardianPhone,
      };
    })
    .sort((a, b) => a.batch.localeCompare(b.batch) || (a.rate ?? 0) - (b.rate ?? 0) || a.name.localeCompare(b.name));
  const t = rows.reduce((acc, r) => ({ p: acc.p + r.present + r.late, n: acc.n + r.total }), { p: 0, n: 0 });
  return {
    title: `Attendance summary, ${from} to ${to}`,
    columns: [
      { key: "code", label: "Student ID" },
      { key: "name", label: "Name" },
      { key: "batch", label: "Batch" },
      { key: "present", label: "Present", type: "number" },
      { key: "late", label: "Late", type: "number" },
      { key: "absent", label: "Absent", type: "number" },
      { key: "total", label: "Classes", type: "number" },
      { key: "rate", label: "Attendance %", type: "percent" },
      { key: "guardianPhone", label: "Guardian phone" },
    ],
    rows,
    summary: [
      { label: "Students", value: new Set(rows.map((r) => r.code)).size, type: "number" },
      { label: "Marks recorded", value: t.n, type: "number" },
      { label: "Overall attendance", value: pct(t.p, t.n) ?? "—", type: "percent" },
      { label: "Below 75%", value: rows.filter((r) => r.rate != null && r.rate < 75).length, type: "number" },
    ],
    note: "Late counts as attended. Sorted by batch, lowest attendance first.",
  };
}

async function collectionReport(sp: SearchParams): Promise<Report> {
  const { from, to } = dateRange(sp);
  const payments = await db.payment.findMany({
    where: { paidAt: { gte: new Date(`${from}T00:00:00+06:00`), lte: new Date(`${to}T23:59:59.999+06:00`) } },
    select: { paidAt: true, amount: true, type: true },
    orderBy: { paidAt: "asc" },
  });
  const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);
  const byDay = new Map<string, { receipts: number; collected: number; reversed: number }>();
  for (const p of payments) {
    const k = day(p.paidAt);
    if (!byDay.has(k)) byDay.set(k, { receipts: 0, collected: 0, reversed: 0 });
    const e = byDay.get(k)!;
    if (p.type === "PAYMENT") {
      e.receipts += 1;
      e.collected += toPaisa(p.amount);
    } else e.reversed += toPaisa(p.amount);
  }
  const rows = [...byDay.entries()].map(([date, e]) => ({
    date,
    receipts: e.receipts,
    collected: Number(fromPaisa(e.collected)),
    reversed: Number(fromPaisa(e.reversed)),
    net: Number(fromPaisa(e.collected + e.reversed)),
  }));
  const sum = (k: "collected" | "reversed" | "net") => Number(fromPaisa(rows.reduce((s, r) => s + toPaisa(r[k]), 0)));
  return {
    title: `Fee collection, ${from} to ${to}`,
    columns: [
      { key: "date", label: "Date", type: "date" },
      { key: "receipts", label: "Receipts", type: "number" },
      { key: "collected", label: "Collected", type: "money" },
      { key: "reversed", label: "Reversed", type: "money" },
      { key: "net", label: "Net cash", type: "money" },
    ],
    rows,
    summary: [
      { label: "Receipts", value: rows.reduce((s, r) => s + r.receipts, 0), type: "number" },
      { label: "Collected", value: sum("collected"), type: "money" },
      { label: "Reversed", value: sum("reversed"), type: "money" },
      { label: "Net cash", value: sum("net"), type: "money" },
    ],
    note: "Days in the center's timezone. Reversals appear on the day they were recorded.",
  };
}

async function duesReport(sp: SearchParams): Promise<Report> {
  const batchId = param(sp, "batch");
  const overdueOnly = param(sp, "overdue") === "1";
  const today = parseDateInput(todayISO())!;
  const fees = await db.studentFee.findMany({
    where: {
      status: { in: ["UNPAID", "PARTIAL"] },
      ...(overdueOnly && { dueDate: { lt: today } }),
      ...(batchId && { student: { enrollments: { some: { batchId, status: "ACTIVE" } } } }),
    },
    select: {
      amount: true,
      discount: true,
      paidAmount: true,
      status: true,
      dueDate: true,
      student: { select: { id: true, name: true, studentCode: true, guardianName: true, guardianPhone: true } },
    },
  });
  const byStudent = new Map<string, { s: (typeof fees)[number]["student"]; count: number; due: number; overdue: number; oldest: Date }>();
  for (const f of fees) {
    const e = byStudent.get(f.student.id) ?? { s: f.student, count: 0, due: 0, overdue: 0, oldest: f.dueDate };
    const bal = feeBalance(f);
    e.count += 1;
    e.due += bal;
    if (f.dueDate < today) e.overdue += bal;
    if (f.dueDate < e.oldest) e.oldest = f.dueDate;
    byStudent.set(f.student.id, e);
  }
  const rows = [...byStudent.values()]
    .sort((a, b) => b.due - a.due)
    .map((e) => ({
      code: e.s.studentCode,
      name: e.s.name,
      guardian: e.s.guardianName,
      guardianPhone: e.s.guardianPhone,
      fees: e.count,
      outstanding: Number(fromPaisa(e.due)),
      overdue: Number(fromPaisa(e.overdue)),
      oldest: iso(e.oldest),
    }));
  return {
    title: overdueOnly ? "Overdue dues" : "Outstanding dues",
    columns: [
      { key: "code", label: "Student ID" },
      { key: "name", label: "Name" },
      { key: "guardian", label: "Guardian" },
      { key: "guardianPhone", label: "Guardian phone" },
      { key: "fees", label: "Unpaid fees", type: "number" },
      { key: "outstanding", label: "Outstanding", type: "money" },
      { key: "overdue", label: "Overdue", type: "money" },
      { key: "oldest", label: "Oldest due", type: "date" },
    ],
    rows,
    summary: [
      { label: "Students owing", value: rows.length, type: "number" },
      { label: "Outstanding", value: Number(fromPaisa(rows.reduce((s, r) => s + toPaisa(r.outstanding), 0))), type: "money" },
      { label: "Overdue", value: Number(fromPaisa(rows.reduce((s, r) => s + toPaisa(r.overdue), 0))), type: "money" },
    ],
    note: "Highest balance first. Use the guardian phone numbers for follow-up calls.",
  };
}

async function examsReport(sp: SearchParams): Promise<Report> {
  const year = param(sp, "year");
  const exams = await db.exam.findMany({
    where: { ...(year && { academicYearId: year }) },
    orderBy: { startDate: "desc" },
    select: { id: true },
    take: 50,
  });
  const results = (await Promise.all(exams.map((e) => getExamResults(e.id)))).filter((r) => r !== null);
  const rows = results.map(({ exam, rows: rs, specs }) => {
    const complete = rs.filter((r) => r.result.complete);
    const passed = complete.filter((r) => r.result.passed);
    const gpas = passed.map((r) => r.result.gpa);
    return {
      exam: exam.name,
      for: exam.batch?.name ?? exam.classLevel?.name ?? "",
      date: iso(exam.startDate),
      status: exam.status === "PUBLISHED" ? "Published" : "Draft",
      subjects: specs.length,
      candidates: rs.length,
      complete: complete.length,
      passed: passed.length,
      passRate: pct(passed.length, complete.length),
      avgGpa: gpas.length ? Math.round((gpas.reduce((s, g) => s + g, 0) / gpas.length) * 100) / 100 : null,
      topGpa: gpas.length ? Math.max(...gpas) : null,
    };
  });
  return {
    title: "Exam results summary",
    columns: [
      { key: "exam", label: "Exam" },
      { key: "for", label: "Batch / class" },
      { key: "date", label: "Date", type: "date" },
      { key: "status", label: "Status" },
      { key: "subjects", label: "Subjects", type: "number" },
      { key: "candidates", label: "Candidates", type: "number" },
      { key: "complete", label: "Complete", type: "number" },
      { key: "passed", label: "Passed", type: "number" },
      { key: "passRate", label: "Pass rate", type: "percent" },
      { key: "avgGpa", label: "Avg GPA (passed)", type: "number" },
      { key: "topGpa", label: "Top GPA", type: "number" },
    ],
    rows,
    summary: [{ label: "Exams", value: rows.length, type: "number" }],
    note: "Average GPA counts only students who passed. Open Results for full tabulation sheets.",
  };
}

export async function buildReport(key: ReportKey, sp: SearchParams): Promise<Report> {
  switch (key) {
    case "attendance":
      return attendanceReport(sp);
    case "collection":
      return collectionReport(sp);
    case "dues":
      return duesReport(sp);
    case "exams":
      return examsReport(sp);
    default:
      return studentsReport(sp);
  }
}
