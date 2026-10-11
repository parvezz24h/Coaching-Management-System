import { db } from "@/lib/db";
import { DEFAULT_GRADING_SCALE } from "@/lib/constants";

export const TEST_ADMIN = { id: "test-admin", name: "Test Admin", email: "admin@test.local" };

const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const daysAgo = (n: number) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - n));
};

/** Empty every table, then create a small, known data set. */
export async function resetDatabase() {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);

  await db.user.create({
    data: {
      ...TEST_ADMIN,
      emailVerified: true,
      accounts: { create: { id: "test-admin-account", accountId: TEST_ADMIN.id, providerId: "credential", password: "x" } },
    },
  });
  await db.centerSettings.create({ data: { id: "default", name: "Test Center", gradingScale: DEFAULT_GRADING_SCALE } });
  const year = await db.academicYear.create({ data: { name: "2026", startDate: utc("2026-01-01"), endDate: utc("2026-12-31"), isCurrent: true } });
  const ssc = await db.classLevel.create({ data: { name: "SSC", sortOrder: 1 } });
  const [physics, math] = await Promise.all([
    db.subject.create({ data: { name: "Physics", code: "PHY" } }),
    db.subject.create({ data: { name: "Mathematics", code: "MATH" } }),
  ]);
  const teacher = await db.teacher.create({ data: { name: "Kamal", phone: "01700000001", teacherCode: "TCH-0001" } });
  const batch = await db.batch.create({
    data: {
      name: "SSC Physics",
      code: "SSC-PHY",
      academicYearId: year.id,
      classLevelId: ssc.id,
      subjectId: physics.id,
      teacherId: teacher.id,
      room: "Room 1",
      monthlyFee: "1500",
      capacity: 10,
    },
  });
  const students = [];
  for (let i = 1; i <= 3; i++) {
    const s = await db.student.create({
      data: {
        studentCode: `STU-2026-000${i}`,
        name: `Student ${i}`,
        classLevelId: ssc.id,
        guardianName: `Guardian ${i}`,
        guardianPhone: `0181000000${i}`,
        admissionDate: daysAgo(60),
      },
    });
    await db.enrollment.create({
      data: { studentId: s.id, batchId: batch.id, enrolledAt: daysAgo(60), discount: i === 1 ? "300" : "0" },
    });
    students.push(s);
  }
  return { year, ssc, physics, math, teacher, batch, students };
}

export type Fixtures = Awaited<ReturnType<typeof resetDatabase>>;
