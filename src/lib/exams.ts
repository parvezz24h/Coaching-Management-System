import "server-only";
import { getBatchRoster } from "@/lib/attendance";
import { db } from "@/lib/db";
import { parseScale, rankResults, type MarkEntry, type SubjectSpec, studentResult } from "@/lib/grading";
import { toNumber } from "@/lib/format";

type ExamScope = { id: string; batchId: string | null; classLevelId: string | null; startDate: Date; endDate: Date | null };

/**
 * Who sits the exam: the batch's students during the exam period, or the
 * class's active students — plus anyone who already has marks, so results
 * survive a later drop or class change.
 */
export async function getExamCandidates(exam: ExamScope) {
  const withMarks = await db.student.findMany({
    where: { marks: { some: { examSubject: { examId: exam.id } } } },
    select: { id: true, name: true, studentCode: true },
  });
  const base = exam.batchId
    ? await getBatchRoster(exam.batchId, exam.startDate, exam.endDate ?? exam.startDate)
    : await db.student.findMany({
        where: { classLevelId: exam.classLevelId!, status: "ACTIVE" },
        select: { id: true, name: true, studentCode: true },
      });
  const byId = new Map([...base, ...withMarks].map((s) => [s.id, s]));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Everything needed to show results: specs, candidates, marks and computed, ranked results. */
export async function getExamResults(examId: string) {
  const [exam, settings] = await Promise.all([
    db.exam.findUnique({
      where: { id: examId },
      include: {
        academicYear: { select: { name: true } },
        classLevel: { select: { name: true } },
        batch: { select: { name: true } },
        subjects: { include: { subject: { select: { name: true, code: true } } }, orderBy: [{ examDate: "asc" }, { subject: { name: "asc" } }] },
      },
    }),
    db.centerSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!exam) return null;

  const scale = parseScale(settings?.gradingScale);
  const specs: (SubjectSpec & { code: string; examDate: Date | null })[] = exam.subjects.map((s) => ({
    id: s.id,
    name: s.subject.name,
    code: s.subject.code,
    fullMarks: toNumber(s.fullMarks),
    passMarks: toNumber(s.passMarks),
    examDate: s.examDate,
  }));
  const [candidates, marks] = await Promise.all([
    getExamCandidates(exam),
    db.mark.findMany({ where: { examSubject: { examId } }, select: { studentId: true, examSubjectId: true, obtained: true, isAbsent: true } }),
  ]);
  const marksByStudent = new Map<string, Map<string, MarkEntry>>();
  for (const m of marks) {
    if (!marksByStudent.has(m.studentId)) marksByStudent.set(m.studentId, new Map());
    marksByStudent.get(m.studentId)!.set(m.examSubjectId, {
      obtained: m.obtained == null ? null : toNumber(m.obtained),
      isAbsent: m.isAbsent,
    });
  }
  const rows = rankResults(
    candidates.map((student) => ({
      student,
      result: studentResult(specs, marksByStudent.get(student.id) ?? new Map(), scale),
    })),
  );
  return { exam, specs, scale, settings, rows };
}
