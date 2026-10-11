import { db } from "@/lib/db";
import type { BatchOptions } from "./batch-dialog";

export async function getBatchOptions(): Promise<BatchOptions & { currentYearId: string }> {
  const [years, levels, subjects, teachers] = await Promise.all([
    db.academicYear.findMany({ orderBy: { startDate: "desc" } }),
    db.classLevel.findMany({ orderBy: { sortOrder: "asc" } }),
    db.subject.findMany({ orderBy: { name: "asc" } }),
    db.teacher.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }] }),
  ]);
  return {
    currentYearId: years.find((y) => y.isCurrent)?.id ?? years[0]?.id ?? "",
    academicYears: years.map((y) => ({ value: y.id, label: y.isCurrent ? `${y.name} (current)` : y.name })),
    classLevels: levels.map((l) => ({ value: l.id, label: l.name })),
    subjects: subjects.map((s) => ({ value: s.id, label: s.name })),
    // Inactive teachers stay listed so existing assignments still display.
    teachers: teachers.map((t) => ({ value: t.id, label: t.status === "ACTIVE" ? t.name : `${t.name} (inactive)` })),
  };
}
