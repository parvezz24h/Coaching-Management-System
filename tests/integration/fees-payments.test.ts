import { beforeEach, describe, expect, it } from "vitest";
import { adjustFee, generateTuition, setFeeWaived } from "@/app/(admin)/fees/actions";
import { collectPayment, reversePayment } from "@/app/(admin)/payments/actions";
import { db } from "@/lib/db";
import { monthDays, todayISO } from "@/lib/format";
import { type Fixtures, resetDatabase } from "../support/fixtures";

const month = todayISO().slice(0, 7);
let fx: Fixtures;

async function tuitionFor(studentId: string) {
  return db.studentFee.findFirstOrThrow({ where: { studentId, period: month } });
}
const pay = (studentId: string, ...allocations: [string, string][]) =>
  collectPayment({ studentId, paidAt: todayISO(), note: "", allocations: allocations.map(([studentFeeId, amount]) => ({ studentFeeId, amount })) });

/** Every fee's paidAmount must equal the sum of its allocations. */
async function expectLedgerConsistent() {
  const [{ broken }] = await db.$queryRaw<{ broken: bigint }[]>`
    SELECT count(*) AS broken FROM "StudentFee" f
    WHERE f."paidAmount" <> COALESCE((SELECT sum(a.amount) FROM "PaymentAllocation" a WHERE a."studentFeeId" = f.id), 0)`;
  expect(Number(broken)).toBe(0);
}

beforeEach(async () => {
  fx = await resetDatabase();
});

describe("tuition generation", () => {
  it("charges each enrollment once, applying its discount, and is idempotent", async () => {
    const preview = await generateTuition({ month, dueDay: "10", batchId: "" }, true);
    expect(preview).toMatchObject({ ok: true, data: { toCreate: 3, total: "4200.00" } }); // 1200 + 1500 + 1500

    expect((await generateTuition({ month, dueDay: "10", batchId: "" }, false)).ok).toBe(true);
    const again = await generateTuition({ month, dueDay: "10", batchId: "" }, false);
    expect(again).toMatchObject({ ok: true, data: { toCreate: 0, alreadyCharged: 3 } });
    expect(await db.studentFee.count()).toBe(3);

    const discounted = await tuitionFor(fx.students[0].id);
    expect(discounted.discount.toString()).toBe("300");
  });

  it("clamps the due day to the end of the month", async () => {
    const [y, m] = month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    await generateTuition({ month: next, dueDay: "31", batchId: "" }, false);
    const fee = await db.studentFee.findFirstOrThrow({ where: { period: next } });
    expect(fee.dueDate.toISOString().slice(0, 10)).toBe(monthDays(next).last.toISOString().slice(0, 10));
  });
});

describe("payments", () => {
  beforeEach(async () => {
    await generateTuition({ month, dueDay: "10", batchId: "" }, false);
  });

  it("records partial and full payments and updates fee status", async () => {
    const fee = await tuitionFor(fx.students[1].id); // 1500, no discount
    expect((await pay(fx.students[1].id, [fee.id, "500"])).ok).toBe(true);
    expect(await db.studentFee.findUniqueOrThrow({ where: { id: fee.id } })).toMatchObject({ status: "PARTIAL" });

    expect((await pay(fx.students[1].id, [fee.id, "1000"])).ok).toBe(true);
    const paid = await db.studentFee.findUniqueOrThrow({ where: { id: fee.id } });
    expect(paid.status).toBe("PAID");
    expect(paid.paidAmount.toString()).toBe("1500");
    expect(await db.payment.findMany({ select: { receiptNo: true }, orderBy: { receiptNo: "asc" } })).toEqual([
      { receiptNo: "RCP-2026-000001" },
      { receiptNo: "RCP-2026-000002" },
    ]);
    await expectLedgerConsistent();
  });

  it("rejects overpayment, other students' fees, future dates and duplicates", async () => {
    const fee = await tuitionFor(fx.students[0].id); // net 1200
    const other = await tuitionFor(fx.students[1].id);
    expect(await pay(fx.students[0].id, [fee.id, "1200.01"])).toMatchObject({ ok: false });
    expect(await pay(fx.students[0].id, [other.id, "10"])).toMatchObject({ ok: false });
    expect(await pay(fx.students[0].id, [fee.id, "1"], [fee.id, "1"])).toMatchObject({ ok: false, error: "A fee appears twice." });
    expect(
      await collectPayment({ studentId: fx.students[0].id, paidAt: "2999-01-01", note: "", allocations: [{ studentFeeId: fee.id, amount: "1" }] }),
    ).toMatchObject({ ok: false });
    expect(await db.payment.count()).toBe(0);
  });

  it("lets only one of several simultaneous payments spend the same balance", async () => {
    const fee = await tuitionFor(fx.students[2].id);
    const results = await Promise.all(Array.from({ length: 5 }, () => pay(fx.students[2].id, [fee.id, "1500"])));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await db.paymentAllocation.count({ where: { studentFeeId: fee.id } })).toBe(1);
    await expectLedgerConsistent();
  });

  it("reverses a payment exactly once and restores the balances", async () => {
    const fee = await tuitionFor(fx.students[1].id);
    const res = await pay(fx.students[1].id, [fee.id, "1500"]);
    const paymentId = res.ok ? res.data!.id : "";

    expect((await reversePayment({ paymentId, reason: "Wrong student" })).ok).toBe(true);
    expect(await db.studentFee.findUniqueOrThrow({ where: { id: fee.id } })).toMatchObject({ status: "UNPAID" });
    expect(await reversePayment({ paymentId, reason: "again" })).toMatchObject({ ok: false });

    const reversal = await db.payment.findFirstOrThrow({ where: { type: "REVERSAL" } });
    expect(reversal.amount.toString()).toBe("-1500");
    expect(await reversePayment({ paymentId: reversal.id, reason: "x" })).toMatchObject({ ok: false });
    expect(await db.payment.count()).toBe(2); // original kept, never deleted
    await expectLedgerConsistent();
  });

  it("won't let a discount push a fee below what's been paid, and blocks paying waived fees", async () => {
    const fee = await tuitionFor(fx.students[1].id);
    await pay(fx.students[1].id, [fee.id, "1000"]);
    expect(await adjustFee(fee.id, { discount: "600", dueDate: todayISO(), note: "" })).toMatchObject({ ok: false });
    expect((await adjustFee(fee.id, { discount: "500", dueDate: todayISO(), note: "" })).ok).toBe(true);
    expect(await db.studentFee.findUniqueOrThrow({ where: { id: fee.id } })).toMatchObject({ status: "PAID" });

    const other = await tuitionFor(fx.students[2].id);
    await setFeeWaived(other.id, true);
    expect(await pay(fx.students[2].id, [other.id, "1"])).toMatchObject({ ok: false });
  });

  it("is backed by database CHECK constraints", async () => {
    const fee = await tuitionFor(fx.students[1].id);
    await expect(db.studentFee.update({ where: { id: fee.id }, data: { paidAmount: "99999" } })).rejects.toThrow();
    await expect(db.studentFee.update({ where: { id: fee.id }, data: { discount: "5000" } })).rejects.toThrow();
  });
});
