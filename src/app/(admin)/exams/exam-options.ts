import { db } from "@/lib/db";

export async function getExamOptions() {
  const [years, levels, batches] = await Promise.all([
    db.academicYear.findMany({ orderBy: { startDate: "desc" } }),
    db.classLevel.findMany({ orderBy: { sortOrder: "asc" } }),
    db.batch.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
  ]);
  return {
    currentYearId: years.find((y) => y.isCurrent)?.id ?? years[0]?.id ?? "",
    academicYears: years.map((y) => ({ value: y.id, label: y.isCurrent ? `${y.name} (current)` : y.name })),
    classLevels: levels.map((l) => ({ value: l.id, label: l.name })),
    batches: batches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })),
  };
}
