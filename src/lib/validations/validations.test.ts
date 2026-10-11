import { describe, expect, it } from "vitest";
import { examSchema, examSubjectSchema, gradingScaleSchema } from "./exams";
import { collectPaymentSchema } from "./fees";
import { classSessionSchema } from "./schedule";
import { studentSchema } from "./student";

const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message;

describe("validation schemas", () => {
  it("requires guardian details and a valid phone for students", () => {
    const r = studentSchema.safeParse({
      name: "A", gender: "", dateOfBirth: "", phone: "", email: "", address: "", schoolName: "", classLevelId: "",
      guardianName: "", guardianPhone: "abc", guardianRelation: "", guardianOccupation: "", admissionDate: "2026-01-01", status: "ACTIVE", notes: "",
    });
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => i.path[0])).toEqual(expect.arrayContaining(["guardianName", "guardianPhone"]));
  });

  it("rejects class sessions that end before they start", () => {
    const r = classSessionSchema.safeParse({ batchId: "b", subjectId: "", teacherId: "", weekdays: ["SAT"], startTime: "17:00", endTime: "16:00", room: "" });
    expect(firstError(r)).toBe("End time must be after start time");
  });

  it("rejects zero and malformed payment amounts", () => {
    const base = { studentId: "s", paidAt: "2026-10-01", note: "" };
    expect(collectPaymentSchema.safeParse({ ...base, allocations: [{ studentFeeId: "f", amount: "0" }] }).success).toBe(false);
    expect(collectPaymentSchema.safeParse({ ...base, allocations: [{ studentFeeId: "f", amount: "1.234" }] }).success).toBe(false);
    expect(collectPaymentSchema.safeParse({ ...base, allocations: [{ studentFeeId: "f", amount: "10.5" }] }).success).toBe(true);
  });

  it("needs a batch or class for an exam, and pass marks within full marks", () => {
    expect(examSchema.safeParse({ name: "T", academicYearId: "y", classLevelId: "", batchId: "", startDate: "2026-01-01", endDate: "" }).success).toBe(false);
    expect(firstError(examSubjectSchema.safeParse({ subjectId: "s", fullMarks: "50", passMarks: "60", examDate: "" }))).toBe("Can't exceed full marks");
  });

  it("validates grading scales", () => {
    const ok = [{ grade: "Distinction", minPercent: 75, gpa: 4 }, { grade: "Pass", minPercent: 40, gpa: 2 }, { grade: "Fail", minPercent: 0, gpa: 0 }];
    expect(gradingScaleSchema.safeParse(ok).success).toBe(true);
    expect(firstError(gradingScaleSchema.safeParse([{ grade: "A", minPercent: 50, gpa: 4 }, { grade: "B", minPercent: 10, gpa: 2 }]))).toBe("The lowest grade must start at 0%");
    expect(firstError(gradingScaleSchema.safeParse([{ grade: "A", minPercent: 50, gpa: 2 }, { grade: "B", minPercent: 0, gpa: 3 }]))).toBe("A lower grade can't have a higher GPA");
  });
});
