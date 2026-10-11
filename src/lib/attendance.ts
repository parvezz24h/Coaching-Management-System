import "server-only";
import { db } from "@/lib/db";

/**
 * Students who belonged to a batch at any point between `from` and `to`
 * (inclusive), plus anyone who already has attendance in that range — so
 * history stays visible after a student is dropped.
 */
export function getBatchRoster(batchId: string, from: Date, to: Date = from) {
  return db.student.findMany({
    where: {
      OR: [
        {
          enrollments: {
            some: {
              batchId,
              enrolledAt: { lte: to },
              OR: [{ status: "ACTIVE" }, { endedAt: { gte: from } }],
            },
          },
        },
        { attendances: { some: { batchId, date: { gte: from, lte: to } } } },
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, studentCode: true },
  });
}
