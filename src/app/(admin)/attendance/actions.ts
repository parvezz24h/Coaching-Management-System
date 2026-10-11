"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, validationError } from "@/lib/action";
import { getBatchRoster } from "@/lib/attendance";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseDateInput, todayISO } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { type AttendanceInput, attendanceSchema } from "@/lib/validations/schedule";

export async function saveAttendance(input: AttendanceInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { batchId, records } = parsed.data;

  if (parsed.data.date > todayISO()) return { ok: false, error: "Attendance can't be marked for a future date." };
  const date = parseDateInput(parsed.data.date)!;

  const batch = await db.batch.findUnique({ where: { id: batchId }, select: { id: true } });
  if (!batch) return { ok: false, error: "Batch not found." };

  // Only students who were in the batch on that date can be marked.
  const roster = new Set((await getBatchRoster(batchId, date)).map((s) => s.id));
  if (records.some((r) => !roster.has(r.studentId))) {
    return { ok: false, error: "Some students weren't enrolled in this batch on that date. Reload and try again." };
  }

  const marks = records.filter((r) => r.status !== "");
  const cleared = records.filter((r) => r.status === "").map((r) => r.studentId);

  await db.$transaction(async (tx) => {
    for (const r of marks) {
      const status = r.status as Exclude<typeof r.status, "">;
      await tx.attendance.upsert({
        where: { studentId_batchId_date: { studentId: r.studentId, batchId, date } },
        create: { studentId: r.studentId, batchId, date, status },
        update: { status },
      });
    }
    if (cleared.length) {
      await tx.attendance.deleteMany({ where: { batchId, date, studentId: { in: cleared } } });
    }
    await audit(tx, {
      userId: session.user.id,
      action: "attendance.save",
      entity: "Batch",
      entityId: batchId,
      details: {
        date: parsed.data.date,
        present: marks.filter((r) => r.status === "PRESENT").length,
        late: marks.filter((r) => r.status === "LATE").length,
        absent: marks.filter((r) => r.status === "ABSENT").length,
        cleared: cleared.length,
      },
    });
  });

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  return { ok: true, message: `Attendance saved for ${marks.length} student${marks.length === 1 ? "" : "s"}` };
}
