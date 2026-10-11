"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, dbError, validationError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { emptyToNull, formatMonth, monthDays, parseDateInput } from "@/lib/format";
import { feeNet, feeStatus, fromPaisa, toPaisa } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import {
  type AdjustFeeInput,
  adjustFeeSchema,
  type ChargeFeeInput,
  chargeFeeSchema,
  type FeePlanInput,
  feePlanSchema,
  type GenerateTuitionInput,
  generateTuitionSchema,
} from "@/lib/validations/fees";

function revalidateFees(studentIds: string[] = []) {
  revalidatePath("/fees");
  revalidatePath("/dashboard");
  for (const id of studentIds.slice(0, 50)) revalidatePath(`/students/${id}`);
}

// ── Fee plans ────────────────────────────────────────────────

export async function saveFeePlan(id: string | null, input: FeePlanInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = feePlanSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const data = {
    ...parsed.data,
    batchId: emptyToNull(parsed.data.batchId),
    classLevelId: emptyToNull(parsed.data.classLevelId),
  };
  try {
    await db.$transaction(async (tx) => {
      const plan = id ? await tx.feePlan.update({ where: { id }, data }) : await tx.feePlan.create({ data });
      await audit(tx, {
        userId: session.user.id,
        action: id ? "feePlan.update" : "feePlan.create",
        entity: "FeePlan",
        entityId: plan.id,
        details: { name: plan.name, amount: data.amount },
      });
    });
  } catch (err) {
    return dbError(err);
  }
  revalidatePath("/fees");
  return { ok: true, message: "Fee plan saved" };
}

export async function deleteFeePlan(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const used = await db.studentFee.count({ where: { feePlanId: id } });
  if (used > 0) return { ok: false, error: `Charged to ${used} student(s). Mark the plan inactive instead.` };
  try {
    await db.$transaction(async (tx) => {
      const plan = await tx.feePlan.delete({ where: { id } });
      await audit(tx, { userId: session.user.id, action: "feePlan.delete", entity: "FeePlan", entityId: id, details: { name: plan.name } });
    });
  } catch (err) {
    return dbError(err);
  }
  revalidatePath("/fees");
  return { ok: true, message: "Fee plan deleted" };
}

// ── Monthly tuition ──────────────────────────────────────────

export type TuitionPreview = { toCreate: number; alreadyCharged: number; total: string; batches: number };

/**
 * Creates one tuition fee per enrollment for the month from each batch's
 * monthly fee, minus the enrollment's discount. Safe to re-run: enrollments
 * already charged for the month are skipped (and a unique index enforces it).
 */
export async function generateTuition(
  input: GenerateTuitionInput,
  dryRun: boolean,
): Promise<ActionResult<TuitionPreview>> {
  const session = await requireAdmin();
  const parsed = generateTuitionSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { month, dueDay, batchId } = parsed.data;

  const { first, last, days } = monthDays(month);
  const dueDate = days[Math.min(Number(dueDay), days.length) - 1];

  const enrollments = await db.enrollment.findMany({
    where: {
      enrolledAt: { lte: last },
      OR: [{ status: "ACTIVE" }, { endedAt: { gte: first } }],
      student: { status: "ACTIVE" },
      batch: { status: "ACTIVE", monthlyFee: { gt: 0 }, ...(batchId && { id: batchId }) },
    },
    include: { batch: { select: { name: true, monthlyFee: true } } },
  });
  const charged = new Set(
    (
      await db.studentFee.findMany({
        where: { period: month, enrollmentId: { in: enrollments.map((e) => e.id) } },
        select: { enrollmentId: true },
      })
    ).map((f) => f.enrollmentId),
  );

  const label = formatMonth(month);
  const rows = enrollments
    .filter((e) => !charged.has(e.id))
    .map((e) => {
      const amount = toPaisa(e.batch.monthlyFee);
      const discount = Math.min(toPaisa(e.discount), amount);
      return {
        studentId: e.studentId,
        enrollmentId: e.id,
        title: `Tuition — ${e.batch.name} — ${label}`,
        period: month,
        amount: fromPaisa(amount),
        discount: fromPaisa(discount),
        dueDate,
        status: feeStatus(amount - discount, 0),
      };
    });
  const preview: TuitionPreview = {
    toCreate: rows.length,
    alreadyCharged: charged.size,
    total: fromPaisa(rows.reduce((sum, r) => sum + toPaisa(r.amount) - toPaisa(r.discount), 0)),
    batches: new Set(enrollments.filter((e) => !charged.has(e.id)).map((e) => e.batchId)).size,
  };
  if (dryRun || rows.length === 0) return { ok: true, data: preview };

  const created = await db.$transaction(async (tx) => {
    const { count } = await tx.studentFee.createMany({ data: rows, skipDuplicates: true });
    await audit(tx, {
      userId: session.user.id,
      action: "fees.generateTuition",
      entity: "StudentFee",
      details: { month, batchId: batchId || "all", created: count, total: preview.total },
    });
    return count;
  });
  revalidateFees();
  return {
    ok: true,
    data: { ...preview, toCreate: created },
    message: `Created ${created} tuition fee${created === 1 ? "" : "s"} for ${label}`,
  };
}

// ── Charge a fee plan ────────────────────────────────────────

export async function chargeFeePlan(input: ChargeFeeInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = chargeFeeSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { feePlanId, scope, targetId, dueDate, period } = parsed.data;

  const plan = await db.feePlan.findUnique({ where: { id: feePlanId } });
  if (!plan || !plan.isActive) return { ok: false, error: "That fee plan is inactive or missing." };

  const students = await db.student.findMany({
    where:
      scope === "student"
        ? { id: targetId }
        : scope === "class"
          ? { classLevelId: targetId, status: "ACTIVE" }
          : { status: "ACTIVE", enrollments: { some: { batchId: targetId, status: "ACTIVE" } } },
    select: { id: true },
  });
  if (students.length === 0) return { ok: false, error: "No active students to charge." };

  // A plan is charged once per student per period ("" = once ever).
  const already = new Set(
    (
      await db.studentFee.findMany({
        where: { feePlanId, period: period || null, studentId: { in: students.map((s) => s.id) } },
        select: { studentId: true },
      })
    ).map((f) => f.studentId),
  );
  const targets = students.filter((s) => !already.has(s.id));
  if (targets.length === 0) {
    return { ok: false, error: "Everyone selected has already been charged this fee for that period." };
  }

  const amount = toPaisa(plan.amount);
  await db.$transaction(async (tx) => {
    await tx.studentFee.createMany({
      data: targets.map((s) => ({
        studentId: s.id,
        feePlanId,
        title: period ? `${plan.name} — ${formatMonth(period)}` : plan.name,
        period: period || null,
        amount: plan.amount,
        dueDate: parseDateInput(dueDate)!,
        status: feeStatus(amount, 0),
      })),
      skipDuplicates: true,
    });
    await audit(tx, {
      userId: session.user.id,
      action: "fees.chargePlan",
      entity: "FeePlan",
      entityId: feePlanId,
      details: { scope, targetId, period, students: targets.length },
    });
  });
  revalidateFees(targets.map((s) => s.id));
  const skipped = already.size ? ` (${already.size} already charged, skipped)` : "";
  return { ok: true, message: `Charged ${plan.name} to ${targets.length} student${targets.length === 1 ? "" : "s"}${skipped}` };
}

// ── Individual fees ──────────────────────────────────────────

export async function adjustFee(id: string, input: AdjustFeeInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = adjustFeeSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const fee = await db.studentFee.findUnique({ where: { id } });
  if (!fee) return { ok: false, error: "Fee not found." };
  const discount = toPaisa(parsed.data.discount);
  const net = toPaisa(fee.amount) - discount;
  const paid = toPaisa(fee.paidAmount);
  if (net < 0) return { ok: false, fieldErrors: { discount: ["Discount can't exceed the fee amount"] }, error: "Please fix the highlighted fields." };
  if (net < paid) {
    return {
      ok: false,
      fieldErrors: { discount: [`${fromPaisa(paid)} has already been paid; the discount can't push the fee below that`] },
      error: "Please fix the highlighted fields.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.studentFee.update({
      where: { id },
      data: {
        discount: fromPaisa(discount),
        dueDate: parseDateInput(parsed.data.dueDate)!,
        note: emptyToNull(parsed.data.note),
        status: feeStatus(net, paid, fee.status),
      },
    });
    await audit(tx, {
      userId: session.user.id,
      action: "fee.adjust",
      entity: "StudentFee",
      entityId: id,
      details: { discountFrom: fee.discount.toString(), discountTo: fromPaisa(discount), dueDate: parsed.data.dueDate },
    });
  });
  revalidateFees([fee.studentId]);
  return { ok: true, message: "Fee updated" };
}

export async function setFeeWaived(id: string, waived: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  const fee = await db.studentFee.findUnique({ where: { id } });
  if (!fee) return { ok: false, error: "Fee not found." };
  if (waived && fee.status === "PAID") return { ok: false, error: "This fee is already fully paid." };

  const status = waived ? "WAIVED" : feeStatus(feeNet(fee), toPaisa(fee.paidAmount));
  await db.$transaction(async (tx) => {
    await tx.studentFee.update({ where: { id }, data: { status } });
    await audit(tx, {
      userId: session.user.id,
      action: waived ? "fee.waive" : "fee.reinstate",
      entity: "StudentFee",
      entityId: id,
      details: { title: fee.title, balanceWaived: waived ? fromPaisa(feeNet(fee) - toPaisa(fee.paidAmount)) : undefined },
    });
  });
  revalidateFees([fee.studentId]);
  return { ok: true, message: waived ? "Remaining balance waived" : "Fee reinstated" };
}

export async function deleteFee(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const fee = await db.studentFee.findUnique({ where: { id }, include: { _count: { select: { allocations: true } } } });
  if (!fee) return { ok: false, error: "Fee not found." };
  if (fee._count.allocations > 0) {
    return { ok: false, error: "Payments were recorded against this fee. Reverse them first, or waive the balance." };
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.studentFee.delete({ where: { id } });
      await audit(tx, {
        userId: session.user.id,
        action: "fee.delete",
        entity: "StudentFee",
        entityId: id,
        details: { studentId: fee.studentId, title: fee.title, amount: fee.amount.toString() },
      });
    });
  } catch (err) {
    return dbError(err);
  }
  revalidateFees([fee.studentId]);
  return { ok: true, message: "Charge removed" };
}
