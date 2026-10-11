"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbError, validationError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { emptyToNull, parseDateInput } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { type BatchInput, batchSchema } from "@/lib/validations/academic";

export async function saveBatch(id: string | null, input: BatchInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const parsed = batchSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;
  const data = {
    name: v.name,
    code: v.code.toUpperCase(),
    academicYearId: v.academicYearId,
    classLevelId: v.classLevelId,
    subjectId: emptyToNull(v.subjectId),
    teacherId: emptyToNull(v.teacherId),
    room: emptyToNull(v.room),
    scheduleNote: emptyToNull(v.scheduleNote),
    capacity: v.capacity ? Number(v.capacity) : null,
    monthlyFee: v.monthlyFee || null,
    startDate: parseDateInput(v.startDate),
    status: v.status,
  };

  try {
    const batch = await db.$transaction(async (tx) => {
      const b = id ? await tx.batch.update({ where: { id }, data }) : await tx.batch.create({ data });
      await audit(tx, {
        userId: session.user.id,
        action: id ? "batch.update" : "batch.create",
        entity: "Batch",
        entityId: b.id,
        details: { code: b.code, monthlyFee: v.monthlyFee || null },
      });
      return b;
    });
    revalidatePath("/batches");
    revalidatePath(`/batches/${batch.id}`);
    return { ok: true, data: { id: batch.id }, message: "Batch saved" };
  } catch (err) {
    return dbError(err, { unique: "A batch with this code already exists." });
  }
}

export async function deleteBatch(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const enrollments = await db.enrollment.count({ where: { batchId: id } });
  if (enrollments > 0) {
    return { ok: false, error: "This batch has enrollment history. Mark it inactive instead of deleting." };
  }
  try {
    await db.$transaction(async (tx) => {
      const b = await tx.batch.delete({ where: { id } });
      await audit(tx, { userId: session.user.id, action: "batch.delete", entity: "Batch", entityId: id, details: { code: b.code } });
    });
  } catch (err) {
    return dbError(err, { foreignKey: "This batch is in use and can't be deleted. Mark it inactive instead." });
  }
  revalidatePath("/batches");
  return { ok: true, message: "Batch deleted" };
}
