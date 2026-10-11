import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

async function next(tx: Tx, key: string) {
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

async function prefixes(tx: Tx) {
  const s = await tx.centerSettings.findUnique({ where: { id: "default" } });
  return {
    student: s?.studentIdPrefix ?? "STU",
    teacher: s?.teacherIdPrefix ?? "TCH",
    receipt: s?.receiptPrefix ?? "RCP",
  };
}

/** e.g. STU-2026-0001 — numbering restarts each admission year. */
export async function nextStudentCode(tx: Tx, admissionYear: number) {
  const n = await next(tx, `student-${admissionYear}`);
  return `${(await prefixes(tx)).student}-${admissionYear}-${String(n).padStart(4, "0")}`;
}

/** e.g. TCH-0001 */
export async function nextTeacherCode(tx: Tx) {
  const n = await next(tx, "teacher");
  return `${(await prefixes(tx)).teacher}-${String(n).padStart(4, "0")}`;
}

/** e.g. RCP-2026-000001 */
export async function nextReceiptNo(tx: Tx, year: number) {
  const n = await next(tx, `receipt-${year}`);
  return `${(await prefixes(tx)).receipt}-${year}-${String(n).padStart(6, "0")}`;
}
