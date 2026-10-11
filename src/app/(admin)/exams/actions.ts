"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbError, validationError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getExamCandidates } from "@/lib/exams";
import { emptyToNull, parseDateInput, toNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import {
  type ExamInput,
  examSchema,
  type ExamSubjectInput,
  examSubjectSchema,
  type MarksInput,
  marksSchema,
} from "@/lib/validations/exams";

function revalidateExam(id: string) {
  revalidatePath("/exams");
  revalidatePath(`/exams/${id}`);
  revalidatePath("/results");
}

async function draftExam(id: string) {
  const exam = await db.exam.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!exam) return { error: "Exam not found." } as const;
  if (exam.status === "PUBLISHED") return { error: "This exam is published. Unpublish it to make changes." } as const;
  return { exam } as const;
}

export async function saveExam(id: string | null, input: ExamInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const parsed = examSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;

  let classLevelId = emptyToNull(v.classLevelId);
  const batchId = emptyToNull(v.batchId);
  if (batchId) {
    // Keep the batch's class too, so the exam still has a scope if the batch is removed.
    const batch = await db.batch.findUnique({ where: { id: batchId }, select: { classLevelId: true } });
    if (!batch) return { ok: false, error: "Batch not found." };
    classLevelId = batch.classLevelId;
  }
  if (id) {
    const check = await draftExam(id);
    if ("error" in check) return { ok: false, error: check.error! };
  }
  const data = {
    name: v.name,
    academicYearId: v.academicYearId,
    classLevelId,
    batchId,
    startDate: parseDateInput(v.startDate)!,
    endDate: parseDateInput(v.endDate),
  };
  try {
    const exam = await db.$transaction(async (tx) => {
      const e = id ? await tx.exam.update({ where: { id }, data }) : await tx.exam.create({ data });
      await audit(tx, { userId: session.user.id, action: id ? "exam.update" : "exam.create", entity: "Exam", entityId: e.id, details: { name: e.name } });
      return e;
    });
    revalidateExam(exam.id);
    return { ok: true, data: { id: exam.id }, message: id ? "Exam updated" : "Exam created — now add its subjects" };
  } catch (err) {
    return dbError(err);
  }
}

export async function deleteExam(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const check = await draftExam(id);
  if ("error" in check) return { ok: false, error: check.error! };
  const marks = await db.mark.count({ where: { examSubject: { examId: id } } });
  await db.$transaction(async (tx) => {
    const e = await tx.exam.delete({ where: { id } }); // subjects and marks cascade
    await audit(tx, { userId: session.user.id, action: "exam.delete", entity: "Exam", entityId: id, details: { name: e.name, marksDeleted: marks } });
  });
  revalidatePath("/exams");
  revalidatePath("/results");
  return { ok: true, message: "Exam deleted" };
}

export async function setExamPublished(id: string, published: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  const exam = await db.exam.findUnique({ where: { id }, include: { _count: { select: { subjects: true } } } });
  if (!exam) return { ok: false, error: "Exam not found." };
  if (published && exam._count.subjects === 0) return { ok: false, error: "Add at least one subject before publishing." };

  await db.$transaction(async (tx) => {
    await tx.exam.update({ where: { id }, data: { status: published ? "PUBLISHED" : "DRAFT" } });
    await audit(tx, { userId: session.user.id, action: published ? "exam.publish" : "exam.unpublish", entity: "Exam", entityId: id });
  });
  revalidateExam(id);
  return { ok: true, message: published ? "Results published — marks are now locked" : "Unpublished — marks can be edited" };
}

export async function saveExamSubject(examId: string, id: string | null, input: ExamSubjectInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = examSubjectSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const check = await draftExam(examId);
  if ("error" in check) return { ok: false, error: check.error! };

  if (id) {
    const highest = await db.mark.aggregate({ where: { examSubjectId: id }, _max: { obtained: true } });
    const max = toNumber(highest._max.obtained);
    if (max > Number(parsed.data.fullMarks)) {
      return {
        ok: false,
        error: "Please fix the highlighted fields.",
        fieldErrors: { fullMarks: [`A student already scored ${max}; full marks can't be lower`] },
      };
    }
  }
  const data = {
    subjectId: parsed.data.subjectId,
    fullMarks: parsed.data.fullMarks,
    passMarks: parsed.data.passMarks,
    examDate: parseDateInput(parsed.data.examDate),
  };
  try {
    await db.$transaction(async (tx) => {
      const s = id
        ? await tx.examSubject.update({ where: { id, examId }, data })
        : await tx.examSubject.create({ data: { ...data, examId } });
      await audit(tx, {
        userId: session.user.id,
        action: id ? "examSubject.update" : "examSubject.create",
        entity: "Exam",
        entityId: examId,
        details: { examSubjectId: s.id, fullMarks: data.fullMarks, passMarks: data.passMarks },
      });
    });
  } catch (err) {
    return dbError(err, { unique: "That subject is already part of this exam." });
  }
  revalidateExam(examId);
  return { ok: true, message: "Subject saved" };
}

export async function deleteExamSubject(examId: string, id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const check = await draftExam(examId);
  if ("error" in check) return { ok: false, error: check.error! };
  try {
    await db.$transaction(async (tx) => {
      const marks = await tx.mark.count({ where: { examSubjectId: id } });
      await tx.examSubject.delete({ where: { id, examId } }); // marks cascade
      await audit(tx, { userId: session.user.id, action: "examSubject.delete", entity: "Exam", entityId: examId, details: { examSubjectId: id, marksDeleted: marks } });
    });
  } catch (err) {
    return dbError(err);
  }
  revalidateExam(examId);
  return { ok: true, message: "Subject removed" };
}

export async function saveMarks(input: MarksInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = marksSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { examSubjectId, rows } = parsed.data;

  const subject = await db.examSubject.findUnique({
    where: { id: examSubjectId },
    include: { exam: true, subject: { select: { name: true } } },
  });
  if (!subject) return { ok: false, error: "Exam subject not found." };
  if (subject.exam.status === "PUBLISHED") return { ok: false, error: "This exam is published. Unpublish it to edit marks." };

  const candidates = new Set((await getExamCandidates(subject.exam)).map((s) => s.id));
  if (rows.some((r) => !candidates.has(r.studentId))) {
    return { ok: false, error: "Some students aren't candidates for this exam. Reload and try again." };
  }
  const full = toNumber(subject.fullMarks);
  const over = rows.filter((r) => !r.absent && r.obtained !== "" && Number(r.obtained) > full);
  if (over.length) return { ok: false, error: `Marks can't exceed ${full} (full marks for ${subject.subject.name}).` };

  const toSave = rows.filter((r) => r.absent || r.obtained !== "");
  const cleared = rows.filter((r) => !r.absent && r.obtained === "").map((r) => r.studentId);

  const removed = await db.$transaction(async (tx) => {
    for (const r of toSave) {
      const data = { obtained: r.absent ? null : r.obtained, isAbsent: r.absent };
      await tx.mark.upsert({
        where: { examSubjectId_studentId: { examSubjectId, studentId: r.studentId } },
        create: { examSubjectId, studentId: r.studentId, ...data },
        update: data,
      });
    }
    const { count } = cleared.length
      ? await tx.mark.deleteMany({ where: { examSubjectId, studentId: { in: cleared } } })
      : { count: 0 };
    await audit(tx, {
      userId: session.user.id,
      action: "marks.save",
      entity: "Exam",
      entityId: subject.examId,
      details: { subject: subject.subject.name, saved: toSave.length, cleared: count },
    });
    return count;
  });
  revalidateExam(subject.examId);
  const parts = [
    toSave.length && `saved marks for ${toSave.length} student${toSave.length === 1 ? "" : "s"}`,
    removed && `cleared ${removed}`,
  ].filter(Boolean);
  const message = parts.join(", ") || "Nothing changed";
  return { ok: true, message: message.charAt(0).toUpperCase() + message.slice(1) };
}
