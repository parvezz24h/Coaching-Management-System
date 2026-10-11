"use server";

import { revalidatePath } from "next/cache";
import { type Prisma, Prisma as P } from "@/generated/prisma/client";
import { type ActionResult, UserError, validationError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { nextReceiptNo } from "@/lib/codes";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { feeBalance, feeNet, feeStatus, fromPaisa, toPaisa } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import {
  type CollectPaymentInput,
  collectPaymentSchema,
  type ReversePaymentInput,
  reversePaymentSchema,
} from "@/lib/validations/fees";

/** Row-lock fees so concurrent payments can't both spend the same balance. */
async function lockFees(tx: Prisma.TransactionClient, ids: string[]) {
  await tx.$queryRaw`SELECT id FROM "StudentFee" WHERE id IN (${P.join(ids)}) FOR UPDATE`;
}

function revalidatePayment(studentId: string) {
  revalidatePath("/payments");
  revalidatePath("/fees");
  revalidatePath("/dashboard");
  revalidatePath(`/students/${studentId}`);
}

export async function collectPayment(input: CollectPaymentInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const parsed = collectPaymentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { studentId, allocations, note } = parsed.data;

  const today = todayISO();
  if (parsed.data.paidAt > today) return { ok: false, error: "Payment date can't be in the future." };
  const ids = allocations.map((a) => a.studentFeeId);
  if (new Set(ids).size !== ids.length) return { ok: false, error: "A fee appears twice." };
  // Today's payments get the real time; back-dated ones are recorded at noon local time.
  const paidAt = parsed.data.paidAt === today ? new Date() : new Date(`${parsed.data.paidAt}T12:00:00+06:00`);
  const total = allocations.reduce((sum, a) => sum + toPaisa(a.amount), 0);

  try {
    const payment = await db.$transaction(async (tx) => {
      await lockFees(tx, ids);
      const fees = await tx.studentFee.findMany({ where: { id: { in: ids }, studentId } });
      if (fees.length !== ids.length) throw new UserError("Some fees don't belong to this student. Reload and try again.");
      const byId = new Map(fees.map((f) => [f.id, f]));

      for (const a of allocations) {
        const fee = byId.get(a.studentFeeId)!;
        const balance = feeBalance(fee);
        if (fee.status === "WAIVED") throw new UserError(`"${fee.title}" has been waived.`);
        if (toPaisa(a.amount) > balance) {
          throw new UserError(`"${fee.title}" only has ${fromPaisa(balance)} outstanding. Reload and try again.`);
        }
      }

      const receiptNo = await nextReceiptNo(tx, Number(parsed.data.paidAt.slice(0, 4)));
      const created = await tx.payment.create({
        data: {
          receiptNo,
          studentId,
          amount: fromPaisa(total),
          paidAt,
          note: note || null,
          receivedById: session.user.id,
          allocations: { create: allocations.map((a) => ({ studentFeeId: a.studentFeeId, amount: a.amount })) },
        },
      });
      for (const a of allocations) {
        const fee = byId.get(a.studentFeeId)!;
        const paid = toPaisa(fee.paidAmount) + toPaisa(a.amount);
        await tx.studentFee.update({
          where: { id: fee.id },
          data: { paidAmount: fromPaisa(paid), status: feeStatus(feeNet(fee), paid, fee.status) },
        });
      }
      await audit(tx, {
        userId: session.user.id,
        action: "payment.collect",
        entity: "Payment",
        entityId: created.id,
        details: { receiptNo, studentId, amount: fromPaisa(total), fees: allocations.length },
      });
      return created;
    });
    revalidatePayment(studentId);
    return { ok: true, data: { id: payment.id }, message: `Payment recorded — receipt ${payment.receiptNo}` };
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message };
    throw err;
  }
}

/**
 * Payments are never deleted. A reversal is a new negative payment linked to
 * the original; it takes the amounts back off the fees it paid.
 */
export async function reversePayment(input: ReversePaymentInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const parsed = reversePaymentSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { paymentId, reason } = parsed.data;

  try {
    const reversal = await db.$transaction(async (tx) => {
      // Lock the original first so two reversals can't race.
      await tx.$queryRaw`SELECT id FROM "Payment" WHERE id = ${paymentId} FOR UPDATE`;
      const original = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { allocations: true, reversedBy: { select: { id: true } } },
      });
      if (!original) throw new UserError("Payment not found.");
      if (original.type !== "PAYMENT") throw new UserError("A reversal can't itself be reversed.");
      if (original.reversedBy) throw new UserError("This payment has already been reversed.");

      const feeIds = original.allocations.map((a) => a.studentFeeId);
      if (feeIds.length) await lockFees(tx, feeIds);
      const fees = new Map((await tx.studentFee.findMany({ where: { id: { in: feeIds } } })).map((f) => [f.id, f]));

      const receiptNo = await nextReceiptNo(tx, Number(todayISO().slice(0, 4)));
      const created = await tx.payment.create({
        data: {
          receiptNo,
          type: "REVERSAL",
          studentId: original.studentId,
          amount: fromPaisa(-toPaisa(original.amount)),
          note: reason,
          receivedById: session.user.id,
          reversalOfId: original.id,
          allocations: {
            create: original.allocations.map((a) => ({
              studentFeeId: a.studentFeeId,
              amount: fromPaisa(-toPaisa(a.amount)),
            })),
          },
        },
      });
      for (const a of original.allocations) {
        const fee = fees.get(a.studentFeeId)!;
        const paid = toPaisa(fee.paidAmount) - toPaisa(a.amount);
        await tx.studentFee.update({
          where: { id: fee.id },
          data: { paidAmount: fromPaisa(paid), status: feeStatus(feeNet(fee), paid, fee.status) },
        });
      }
      await audit(tx, {
        userId: session.user.id,
        action: "payment.reverse",
        entity: "Payment",
        entityId: original.id,
        details: { originalReceipt: original.receiptNo, reversalReceipt: receiptNo, amount: original.amount.toString(), reason },
      });
      return created;
    });
    revalidatePayment(reversal.studentId);
    revalidatePath(`/payments/${paymentId}`);
    return { ok: true, data: { id: reversal.id }, message: `Payment reversed — ${reversal.receiptNo}` };
  } catch (err) {
    if (err instanceof UserError) return { ok: false, error: err.message };
    if (err instanceof P.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "This payment has already been reversed." };
    }
    throw err;
  }
}
