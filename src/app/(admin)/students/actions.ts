"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbError, validationError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { nextStudentCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { emptyToNull, parseDateInput, todayISO } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { enrollmentSchema, type StudentInput, studentSchema } from "@/lib/validations/student";

function toData(v: StudentInput) {
  return {
    name: v.name,
    gender: v.gender || null,
    dateOfBirth: parseDateInput(v.dateOfBirth),
    phone: emptyToNull(v.phone),
    email: emptyToNull(v.email),
    address: emptyToNull(v.address),
    schoolName: emptyToNull(v.schoolName),
    classLevelId: emptyToNull(v.classLevelId),
    guardianName: v.guardianName,
    guardianPhone: v.guardianPhone,
    guardianRelation: emptyToNull(v.guardianRelation),
    guardianOccupation: emptyToNull(v.guardianOccupation),
    admissionDate: parseDateInput(v.admissionDate)!,
    status: v.status,
    notes: emptyToNull(v.notes),
  };
}

export async function createStudent(input: StudentInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const data = toData(parsed.data);
  const student = await db.$transaction(async (tx) => {
    const studentCode = await nextStudentCode(tx, data.admissionDate.getUTCFullYear());
    const created = await tx.student.create({ data: { ...data, studentCode } });
    await audit(tx, {
      userId: session.user.id,
      action: "student.create",
      entity: "Student",
      entityId: created.id,
      details: { studentCode, name: created.name },
    });
    return created;
  });

  revalidatePath("/students");
  return { ok: true, data: { id: student.id }, message: `Registered ${student.name} (${student.studentCode})` };
}

export async function updateStudent(id: string, input: StudentInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  try {
    await db.$transaction(async (tx) => {
      await tx.student.update({ where: { id }, data: toData(parsed.data) });
      await audit(tx, { userId: session.user.id, action: "student.update", entity: "Student", entityId: id });
    });
  } catch (err) {
    return dbError(err);
  }
  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { ok: true, data: { id }, message: "Student updated" };
}

export async function enrollStudent(input: {
  studentId: string;
  batchId: string;
  enrolledAt: string;
  discount: string;
}): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = enrollmentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { studentId, batchId, enrolledAt, discount } = parsed.data;

  const batch = await db.batch.findUnique({
    where: { id: batchId },
    select: { status: true, capacity: true, _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
  });
  if (!batch) return { ok: false, error: "Batch not found." };
  if (batch.status !== "ACTIVE") return { ok: false, error: "This batch is inactive." };

  const existing = await db.enrollment.findUnique({ where: { studentId_batchId: { studentId, batchId } } });
  if (existing?.status === "ACTIVE") return { ok: false, error: "Student is already enrolled in this batch." };
  if (batch.capacity != null && batch._count.enrollments >= batch.capacity) {
    return { ok: false, error: `This batch is full (capacity ${batch.capacity}).` };
  }

  const data = {
    enrolledAt: parseDateInput(enrolledAt)!,
    discount: discount || "0",
    status: "ACTIVE" as const,
    endedAt: null,
  };
  await db.$transaction(async (tx) => {
    // Re-enrolling after a drop reactivates the existing row (studentId+batchId is unique).
    const enrollment = existing
      ? await tx.enrollment.update({ where: { id: existing.id }, data })
      : await tx.enrollment.create({ data: { ...data, studentId, batchId } });
    await audit(tx, {
      userId: session.user.id,
      action: "enrollment.create",
      entity: "Enrollment",
      entityId: enrollment.id,
      details: { studentId, batchId },
    });
  });

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/batches");
  return { ok: true, message: "Enrolled" };
}

export async function endEnrollment(id: string, status: "DROPPED" | "COMPLETED"): Promise<ActionResult> {
  const session = await requireAdmin();
  try {
    const enrollment = await db.$transaction(async (tx) => {
      const e = await tx.enrollment.update({
        where: { id },
        data: { status, endedAt: parseDateInput(todayISO()) },
      });
      await audit(tx, {
        userId: session.user.id,
        action: `enrollment.${status.toLowerCase()}`,
        entity: "Enrollment",
        entityId: id,
      });
      return e;
    });
    revalidatePath(`/students/${enrollment.studentId}`);
    revalidatePath("/batches");
  } catch (err) {
    return dbError(err);
  }
  return { ok: true, message: status === "DROPPED" ? "Removed from batch" : "Marked as completed" };
}
