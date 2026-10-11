"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbError, validationError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { nextTeacherCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { emptyToNull, parseDateInput } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { type TeacherInput, teacherSchema } from "@/lib/validations/teacher";

function toData(v: TeacherInput) {
  return {
    name: v.name,
    phone: v.phone,
    email: emptyToNull(v.email),
    address: emptyToNull(v.address),
    qualification: emptyToNull(v.qualification),
    joiningDate: parseDateInput(v.joiningDate)!,
    status: v.status,
    notes: emptyToNull(v.notes),
  };
}

export async function saveTeacher(id: string | null, input: TeacherInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = teacherSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const subjects = parsed.data.subjectIds.map((sid) => ({ id: sid }));

  try {
    await db.$transaction(async (tx) => {
      if (id) {
        await tx.teacher.update({ where: { id }, data: { ...toData(parsed.data), subjects: { set: subjects } } });
      } else {
        const teacherCode = await nextTeacherCode(tx);
        const t = await tx.teacher.create({
          data: { ...toData(parsed.data), teacherCode, subjects: { connect: subjects } },
        });
        id = t.id;
      }
      await audit(tx, {
        userId: session.user.id,
        action: "teacher.save",
        entity: "Teacher",
        entityId: id!,
      });
    });
  } catch (err) {
    return dbError(err);
  }
  revalidatePath("/teachers");
  return { ok: true, message: "Teacher saved" };
}

export async function deleteTeacher(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const assigned = await db.batch.count({ where: { teacherId: id } });
  if (assigned > 0) {
    return { ok: false, error: `Assigned to ${assigned} batch(es). Reassign them or mark the teacher inactive.` };
  }
  try {
    await db.$transaction(async (tx) => {
      const t = await tx.teacher.delete({ where: { id } });
      await audit(tx, {
        userId: session.user.id,
        action: "teacher.delete",
        entity: "Teacher",
        entityId: id,
        details: { name: t.name, teacherCode: t.teacherCode },
      });
    });
  } catch (err) {
    return dbError(err);
  }
  revalidatePath("/teachers");
  return { ok: true, message: "Teacher deleted" };
}
