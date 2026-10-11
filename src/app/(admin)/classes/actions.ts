"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbError, validationError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseDateInput } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import {
  type AcademicYearInput,
  academicYearSchema,
  type ClassLevelInput,
  classLevelSchema,
} from "@/lib/validations/academic";

export async function saveAcademicYear(id: string | null, input: AcademicYearInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = academicYearSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const data = {
    name: parsed.data.name,
    startDate: parseDateInput(parsed.data.startDate)!,
    endDate: parseDateInput(parsed.data.endDate)!,
    isCurrent: parsed.data.isCurrent,
  };

  try {
    await db.$transaction(async (tx) => {
      // Only one academic year can be current.
      if (data.isCurrent) await tx.academicYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      const year = id
        ? await tx.academicYear.update({ where: { id }, data })
        : await tx.academicYear.create({ data });
      await audit(tx, { userId: session.user.id, action: "academicYear.save", entity: "AcademicYear", entityId: year.id });
    });
  } catch (err) {
    return dbError(err, { unique: "An academic year with this name already exists." });
  }
  revalidatePath("/classes");
  return { ok: true, message: "Academic year saved" };
}

export async function deleteAcademicYear(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await db.$transaction(async (tx) => {
      await tx.academicYear.delete({ where: { id } });
      await audit(tx, { userId: session.user.id, action: "academicYear.delete", entity: "AcademicYear", entityId: id });
    });
  } catch (err) {
    return dbError(err, { foreignKey: "This year has batches or exams and can't be deleted." });
  }
  revalidatePath("/classes");
  return { ok: true, message: "Academic year deleted" };
}

export async function saveClassLevel(id: string | null, input: ClassLevelInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = classLevelSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const data = { name: parsed.data.name, sortOrder: Number(parsed.data.sortOrder) };

  try {
    await db.$transaction(async (tx) => {
      const level = id ? await tx.classLevel.update({ where: { id }, data }) : await tx.classLevel.create({ data });
      await audit(tx, { userId: session.user.id, action: "classLevel.save", entity: "ClassLevel", entityId: level.id });
    });
  } catch (err) {
    return dbError(err, { unique: "A class with this name already exists." });
  }
  revalidatePath("/classes");
  return { ok: true, message: "Class saved" };
}

export async function deleteClassLevel(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const [students, exams] = await Promise.all([
    db.student.count({ where: { classLevelId: id } }),
    db.exam.count({ where: { classLevelId: id } }),
  ]);
  if (students > 0) return { ok: false, error: `${students} student(s) are in this class. Move them first.` };
  if (exams > 0) return { ok: false, error: `${exams} exam(s) belong to this class and can't lose it.` };
  try {
    await db.$transaction(async (tx) => {
      await tx.classLevel.delete({ where: { id } });
      await audit(tx, { userId: session.user.id, action: "classLevel.delete", entity: "ClassLevel", entityId: id });
    });
  } catch (err) {
    return dbError(err, { foreignKey: "This class has batches and can't be deleted." });
  }
  revalidatePath("/classes");
  return { ok: true, message: "Class deleted" };
}
