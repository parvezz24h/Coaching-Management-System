"use server";

import { revalidatePath } from "next/cache";
import type { Weekday } from "@/generated/prisma/client";
import { type ActionResult, dbError, validationError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { WEEKDAY_LABELS } from "@/lib/constants";
import { db } from "@/lib/db";
import { emptyToNull, formatTimeRange } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { type ClassSessionInput, classSessionSchema } from "@/lib/validations/schedule";

type Slot = {
  batchId: string;
  teacherId: string | null;
  room: string | null;
  startTime: string;
  endTime: string;
};

/** Overlapping slots (in active batches) that share the batch, teacher or room. */
async function findConflicts(slot: Slot, weekdays: Weekday[], excludeId?: string) {
  const clashes = await db.classSession.findMany({
    where: {
      weekday: { in: weekdays },
      ...(excludeId && { id: { not: excludeId } }),
      startTime: { lt: slot.endTime },
      endTime: { gt: slot.startTime },
      batch: { status: "ACTIVE" },
      OR: [
        { batchId: slot.batchId },
        ...(slot.teacherId ? [{ teacherId: slot.teacherId }] : []),
        ...(slot.room ? [{ room: { equals: slot.room, mode: "insensitive" as const } }] : []),
      ],
    },
    include: { batch: { select: { name: true } }, teacher: { select: { name: true } } },
  });

  return clashes.map((c) => {
    const reason =
      c.batchId === slot.batchId
        ? "this batch already has a class"
        : slot.teacherId && c.teacherId === slot.teacherId
          ? `${c.teacher?.name} is teaching ${c.batch.name}`
          : `${c.room} is used by ${c.batch.name}`;
    return `${WEEKDAY_LABELS[c.weekday]} ${formatTimeRange(c.startTime, c.endTime)}: ${reason}`;
  });
}

export async function saveClassSession(id: string | null, input: ClassSessionInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = classSessionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const v = parsed.data;
  if (id && v.weekdays.length !== 1) return { ok: false, error: "An existing slot belongs to exactly one day." };

  const slot: Slot = {
    batchId: v.batchId,
    teacherId: emptyToNull(v.teacherId),
    room: emptyToNull(v.room),
    startTime: v.startTime,
    endTime: v.endTime,
  };
  const data = { ...slot, subjectId: emptyToNull(v.subjectId) };

  const conflicts = await findConflicts(slot, v.weekdays, id ?? undefined);
  if (conflicts.length) {
    return { ok: false, error: `Time clash — ${conflicts.slice(0, 3).join("; ")}${conflicts.length > 3 ? "; …" : ""}` };
  }

  try {
    await db.$transaction(async (tx) => {
      if (id) {
        await tx.classSession.update({ where: { id }, data: { ...data, weekday: v.weekdays[0] } });
      } else {
        await tx.classSession.createMany({ data: v.weekdays.map((weekday) => ({ ...data, weekday })) });
      }
      await audit(tx, {
        userId: session.user.id,
        action: id ? "classSession.update" : "classSession.create",
        entity: "Batch",
        entityId: v.batchId,
        details: { weekdays: v.weekdays, startTime: v.startTime, endTime: v.endTime },
      });
    });
  } catch (err) {
    return dbError(err);
  }
  revalidatePath("/timetable");
  revalidatePath("/dashboard");
  return { ok: true, message: id ? "Class updated" : v.weekdays.length > 1 ? `${v.weekdays.length} classes added` : "Class added" };
}

export async function deleteClassSession(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    await db.$transaction(async (tx) => {
      const s = await tx.classSession.delete({ where: { id } });
      await audit(tx, {
        userId: session.user.id,
        action: "classSession.delete",
        entity: "Batch",
        entityId: s.batchId,
        details: { weekday: s.weekday, startTime: s.startTime, endTime: s.endTime },
      });
    });
  } catch (err) {
    return dbError(err);
  }
  revalidatePath("/timetable");
  revalidatePath("/dashboard");
  return { ok: true, message: "Class removed" };
}
