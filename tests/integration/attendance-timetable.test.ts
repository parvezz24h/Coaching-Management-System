import { beforeEach, describe, expect, it } from "vitest";
import { saveAttendance } from "@/app/(admin)/attendance/actions";
import { endEnrollment } from "@/app/(admin)/students/actions";
import { saveClassSession } from "@/app/(admin)/timetable/actions";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { daysAgo, type Fixtures, resetDatabase } from "../support/fixtures";

let fx: Fixtures;
beforeEach(async () => {
  fx = await resetDatabase();
});

const slot = (over: Record<string, unknown> = {}) => ({
  batchId: fx.batch.id,
  subjectId: "",
  teacherId: "",
  weekdays: ["SAT" as const],
  startTime: "16:00",
  endTime: "17:30",
  room: "",
  ...over,
});

describe("timetable", () => {
  it("rejects overlapping slots for the same batch, teacher or room", async () => {
    expect((await saveClassSession(null, slot({ teacherId: fx.teacher.id, room: "Room 1" }))).ok).toBe(true);

    const other = await db.batch.create({
      data: { name: "SSC Math", code: "SSC-MATH", academicYearId: fx.year.id, classLevelId: fx.ssc.id },
    });
    expect(await saveClassSession(null, slot({ startTime: "17:00", endTime: "18:00" }))).toMatchObject({ ok: false });
    expect(await saveClassSession(null, slot({ batchId: other.id, teacherId: fx.teacher.id, startTime: "16:30" }))).toMatchObject({ ok: false });
    expect(await saveClassSession(null, slot({ batchId: other.id, room: "room 1", startTime: "17:00", endTime: "18:00" }))).toMatchObject({ ok: false });
    // Back-to-back is fine.
    expect((await saveClassSession(null, slot({ batchId: other.id, room: "Room 1", startTime: "17:30", endTime: "18:30" }))).ok).toBe(true);
  });

  it("creates one slot per selected day", async () => {
    await saveClassSession(null, slot({ weekdays: ["SAT", "MON", "WED"] }));
    expect(await db.classSession.count({ where: { batchId: fx.batch.id } })).toBe(3);
  });
});

describe("attendance", () => {
  const records = (status: "PRESENT" | "ABSENT" | "") => fx.students.map((s) => ({ studentId: s.id, status }));

  it("saves, updates and clears marks", async () => {
    expect((await saveAttendance({ batchId: fx.batch.id, date: todayISO(), records: records("PRESENT") })).ok).toBe(true);
    expect(await db.attendance.count()).toBe(3);
    await saveAttendance({ batchId: fx.batch.id, date: todayISO(), records: [{ studentId: fx.students[0].id, status: "ABSENT" }] });
    expect(await db.attendance.findFirst({ where: { studentId: fx.students[0].id } })).toMatchObject({ status: "ABSENT" });
    await saveAttendance({ batchId: fx.batch.id, date: todayISO(), records: records("") });
    expect(await db.attendance.count()).toBe(0);
  });

  it("rejects future dates and students not in the batch on that date", async () => {
    expect(await saveAttendance({ batchId: fx.batch.id, date: "2999-01-01", records: records("PRESENT") })).toMatchObject({ ok: false });
    expect(await saveAttendance({ batchId: fx.batch.id, date: "2020-01-01", records: records("PRESENT") })).toMatchObject({ ok: false });
  });

  it("allows attendance up to the day a student was dropped, not after", async () => {
    const enrollment = await db.enrollment.findFirstOrThrow({ where: { studentId: fx.students[0].id } });
    await endEnrollment(enrollment.id, "DROPPED");
    // Pretend the drop happened three days ago.
    await db.enrollment.update({ where: { id: enrollment.id }, data: { endedAt: daysAgo(3) } });
    const mark = (date: Date) =>
      saveAttendance({ batchId: fx.batch.id, date: date.toISOString().slice(0, 10), records: [{ studentId: fx.students[0].id, status: "PRESENT" }] });
    expect((await mark(daysAgo(7))).ok).toBe(true);
    expect((await mark(daysAgo(3))).ok).toBe(true);
    expect(await mark(daysAgo(1))).toMatchObject({ ok: false });
  });
});
