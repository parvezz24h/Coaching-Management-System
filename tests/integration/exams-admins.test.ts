import { beforeEach, describe, expect, it } from "vitest";
import { saveExam, saveExamSubject, saveMarks, setExamPublished } from "@/app/(admin)/exams/actions";
import { addAdmin, removeAdmin } from "@/app/(admin)/settings/admin-actions";
import { db } from "@/lib/db";
import { getExamResults } from "@/lib/exams";
import { todayISO } from "@/lib/format";
import { type Fixtures, resetDatabase, TEST_ADMIN } from "../support/fixtures";

let fx: Fixtures;
beforeEach(async () => {
  fx = await resetDatabase();
});

describe("exams", () => {
  async function setup() {
    const exam = await saveExam(null, { name: "Monthly", academicYearId: fx.year.id, classLevelId: "", batchId: fx.batch.id, startDate: todayISO(), endDate: "" });
    const examId = exam.ok ? exam.data!.id : "";
    await saveExamSubject(examId, null, { subjectId: fx.physics.id, fullMarks: "100", passMarks: "33", examDate: "" });
    await saveExamSubject(examId, null, { subjectId: fx.math.id, fullMarks: "50", passMarks: "17", examDate: "" });
    const [phy, math] = await db.examSubject.findMany({ where: { examId }, orderBy: { fullMarks: "desc" } });
    return { examId, phy, math };
  }

  it("stores the batch's class so the exam keeps a scope", async () => {
    const { examId } = await setup();
    expect(await db.exam.findUniqueOrThrow({ where: { id: examId } })).toMatchObject({ classLevelId: fx.ssc.id, batchId: fx.batch.id });
  });

  it("computes GPA, grades and positions from saved marks", async () => {
    const { examId, phy, math } = await setup();
    const [a, b, c] = fx.students.map((s) => s.id);
    await saveMarks({ examSubjectId: phy.id, rows: [{ studentId: a, obtained: "95", absent: false }, { studentId: b, obtained: "20", absent: false }, { studentId: c, obtained: "", absent: true }] });
    await saveMarks({ examSubjectId: math.id, rows: [{ studentId: a, obtained: "48", absent: false }, { studentId: b, obtained: "40", absent: false }] });

    const results = await getExamResults(examId);
    const byId = Object.fromEntries(results!.rows.map((r) => [r.student.id, r]));
    expect(byId[a].result).toMatchObject({ gpa: 5, grade: "A+", passed: true });
    expect(byId[a].rank).toBe(1);
    expect(byId[b].result).toMatchObject({ gpa: 0, grade: "F", passed: false }); // failed Physics
    expect(byId[c].result).toMatchObject({ complete: false }); // absent Physics, no Math mark yet
    expect(byId[c].rank).toBeNull();
  });

  it("rejects marks above full marks and locks marks once published", async () => {
    const { examId, math } = await setup();
    const student = fx.students[0].id;
    expect(await saveMarks({ examSubjectId: math.id, rows: [{ studentId: student, obtained: "51", absent: false }] })).toMatchObject({ ok: false });
    await saveMarks({ examSubjectId: math.id, rows: [{ studentId: student, obtained: "45", absent: false }] });
    expect(await saveExamSubject(examId, math.id, { subjectId: fx.math.id, fullMarks: "40", passMarks: "10", examDate: "" })).toMatchObject({ ok: false });

    expect((await setExamPublished(examId, true)).ok).toBe(true);
    expect(await saveMarks({ examSubjectId: math.id, rows: [{ studentId: student, obtained: "10", absent: false }] })).toMatchObject({ ok: false });
    expect((await setExamPublished(examId, false)).ok).toBe(true);
    expect((await saveMarks({ examSubjectId: math.id, rows: [{ studentId: student, obtained: "10", absent: false }] })).ok).toBe(true);
  });
});

describe("admin accounts", () => {
  it("can't remove yourself or the last admin", async () => {
    expect(await removeAdmin(TEST_ADMIN.id)).toMatchObject({ ok: false });
  });

  it("adds, removes (keeping the user row) and reactivates an admin", async () => {
    expect((await addAdmin({ name: "Second", email: "Second@Test.local", password: "password123" })).ok).toBe(true);
    expect(await addAdmin({ name: "Dup", email: "second@test.local", password: "password123" })).toMatchObject({ ok: false });
    const second = await db.user.findUniqueOrThrow({ where: { email: "second@test.local" } });

    expect((await removeAdmin(second.id)).ok).toBe(true);
    expect(await db.account.count({ where: { userId: second.id } })).toBe(0);
    expect(await db.user.count({ where: { id: second.id } })).toBe(1);

    expect(await addAdmin({ name: "Second Again", email: "second@test.local", password: "password456" })).toMatchObject({ ok: true, message: expect.stringContaining("Restored") });
    expect(await db.account.count({ where: { userId: second.id } })).toBe(1);
  });
});
