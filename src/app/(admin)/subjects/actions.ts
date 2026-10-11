"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbError, validationError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { type SubjectInput, subjectSchema } from "@/lib/validations/academic";

export async function saveSubject(id: string | null, input: SubjectInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const data = { name: parsed.data.name, code: parsed.data.code.toUpperCase() };

  try {
    await db.$transaction(async (tx) => {
      const s = id ? await tx.subject.update({ where: { id }, data }) : await tx.subject.create({ data });
      await audit(tx, { userId: session.user.id, action: "subject.save", entity: "Subject", entityId: s.id });
    });
  } catch (err) {
    return dbError(err, { unique: "A subject with this code already exists." });
  }
  revalidatePath("/subjects");
  return { ok: true, message: "Subject saved" };
}

export async function deleteSubject(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await db.$transaction(async (tx) => {
      await tx.subject.delete({ where: { id } });
      await audit(tx, { userId: session.user.id, action: "subject.delete", entity: "Subject", entityId: id });
    });
  } catch (err) {
    return dbError(err, { foreignKey: "This subject is used in exams and can't be deleted." });
  }
  revalidatePath("/subjects");
  return { ok: true, message: "Subject deleted" };
}
