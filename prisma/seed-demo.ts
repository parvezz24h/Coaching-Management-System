// Optional sample data for trying the app: `pnpm db:seed:demo`.
// Run `pnpm db:seed` first. Refuses to run if students already exist.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { nextStudentCode, nextTeacherCode } from "../src/lib/codes";
import { WEEKDAYS, weekdayOf } from "../src/lib/constants";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const FIRST = ["Rahim", "Karim", "Nusrat", "Tanvir", "Farhana", "Sakib", "Mim", "Arif", "Jannat", "Rafi", "Sadia", "Imran", "Tasnim", "Fahim", "Lamia", "Nafis", "Riya", "Shuvo"];
const LAST = ["Ahmed", "Hossain", "Islam", "Rahman", "Chowdhury", "Khan", "Akter", "Sarker", "Uddin"];

function utcDate(daysAgo: number) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysAgo));
}

async function main() {
  if ((await db.student.count()) > 0) {
    console.log("Students already exist — skipping demo data.");
    return;
  }
  const year = await db.academicYear.findFirst({ where: { isCurrent: true } });
  const ssc = await db.classLevel.findUnique({ where: { name: "SSC" } });
  const class9 = await db.classLevel.findUnique({ where: { name: "Class 9" } });
  const subjects = Object.fromEntries((await db.subject.findMany()).map((s) => [s.code, s]));
  if (!year || !ssc || !class9 || !subjects.PHY) throw new Error("Run `pnpm db:seed` first.");

  await db.$transaction(async (tx) => {
    const mkTeacher = async (name: string, phone: string, codes: string[]) =>
      tx.teacher.create({
        data: {
          name,
          phone,
          teacherCode: await nextTeacherCode(tx),
          qualification: "BSc (Hons)",
          subjects: { connect: codes.map((c) => ({ id: subjects[c].id })) },
        },
      });
    const physics = await mkTeacher("Md. Kamal Hossain", "01711000001", ["PHY", "HMATH"]);
    const math = await mkTeacher("Shirin Akter", "01711000002", ["MATH", "HMATH"]);
    const english = await mkTeacher("Abdul Karim", "01711000003", ["ENG"]);

    const mkBatch = (name: string, code: string, classLevelId: string, subjectId: string, teacherId: string, room: string, monthlyFee: number, scheduleNote: string) =>
      tx.batch.create({
        data: { name, code, classLevelId, subjectId, teacherId, room, monthlyFee, scheduleNote, academicYearId: year.id, capacity: 30, startDate: utcDate(60) },
      });
    const b1 = await mkBatch("SSC Physics — Evening", "SSC-PHY-E", ssc.id, subjects.PHY.id, physics.id, "Room 1", 1500, "Sat, Mon, Wed · 4:00–5:30 PM");
    const b2 = await mkBatch("SSC Math — Morning", "SSC-MATH-M", ssc.id, subjects.MATH.id, math.id, "Room 2", 1500, "Sun, Tue, Thu · 8:00–9:30 AM");
    const b3 = await mkBatch("Class 9 English", "C9-ENG", class9.id, subjects.ENG.id, english.id, "Room 1", 1000, "Sat, Tue · 6:00–7:00 PM");

    const slots: [typeof b1, (typeof WEEKDAYS)[number][], string, string][] = [
      [b1, ["SAT", "MON", "WED"], "16:00", "17:30"],
      [b2, ["SUN", "TUE", "THU"], "08:00", "09:30"],
      [b3, ["SAT", "TUE"], "18:00", "19:00"],
    ];
    for (const [b, days, startTime, endTime] of slots) {
      await tx.classSession.createMany({
        data: days.map((weekday) => ({ batchId: b.id, subjectId: b.subjectId, teacherId: b.teacherId, room: b.room, weekday, startTime, endTime })),
      });
    }

    for (let i = 0; i < 18; i++) {
      const isSsc = i < 12;
      const admission = utcDate(45);
      const student = await tx.student.create({
        data: {
          studentCode: await nextStudentCode(tx, admission.getUTCFullYear()),
          name: `${FIRST[i]} ${LAST[i % LAST.length]}`,
          gender: i % 3 === 2 ? "FEMALE" : i % 2 ? "FEMALE" : "MALE",
          classLevelId: isSsc ? ssc.id : class9.id,
          schoolName: i % 2 ? "Dhaka Residential Model College" : "Motijheel Govt. Boys' High School",
          guardianName: `${FIRST[(i + 5) % FIRST.length]} ${LAST[i % LAST.length]}`,
          guardianPhone: `0181${String(1000000 + i).slice(1)}`,
          guardianRelation: "Father",
          admissionDate: admission,
        },
      });
      const batchesFor = isSsc ? (i % 3 === 0 ? [b1] : [b1, b2]) : [b3];
      for (const b of batchesFor) {
        await tx.enrollment.create({
          data: { studentId: student.id, batchId: b.id, enrolledAt: admission, discount: i === 4 ? 300 : 0 },
        });
      }
    }
  });

  // Attendance for scheduled days over the last two weeks (not today).
  const sessions = await db.classSession.findMany({ select: { batchId: true, weekday: true } });
  const enrollments = await db.enrollment.findMany({ select: { studentId: true, batchId: true } });
  const rows = [];
  for (let ago = 14; ago >= 1; ago--) {
    const date = utcDate(ago);
    const wd = weekdayOf(date);
    for (const s of sessions.filter((x) => x.weekday === wd)) {
      for (const [n, e] of enrollments.filter((x) => x.batchId === s.batchId).entries()) {
        const roll = (n * 7 + ago * 3) % 10;
        rows.push({ studentId: e.studentId, batchId: s.batchId, date, status: roll === 0 ? "ABSENT" : roll === 1 ? "LATE" : "PRESENT" } as const);
      }
    }
  }
  await db.attendance.createMany({ data: rows, skipDuplicates: true });
  console.log(`Demo data created: 3 teachers, 3 batches, 18 students, ${rows.length} attendance records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
