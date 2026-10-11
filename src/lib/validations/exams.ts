import { z } from "zod";
import { dateString, optionalDate, optionalId, requiredId, requiredText } from "./common";

const marks = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a number");

export const examSchema = z
  .object({
    name: requiredText("Name", 100),
    academicYearId: requiredId("academic year"),
    classLevelId: optionalId,
    batchId: optionalId,
    startDate: dateString,
    endDate: optionalDate,
  })
  .refine((v) => v.classLevelId || v.batchId, { path: ["batchId"], message: "Choose a batch or a class" })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { path: ["endDate"], message: "Ends before it starts" });
export type ExamInput = z.infer<typeof examSchema>;

export const examSubjectSchema = z
  .object({
    subjectId: requiredId("subject"),
    fullMarks: marks.refine((v) => Number(v) > 0 && Number(v) <= 1000, "Between 1 and 1000"),
    passMarks: marks,
    examDate: optionalDate,
  })
  .refine((v) => Number(v.passMarks) <= Number(v.fullMarks), { path: ["passMarks"], message: "Can't exceed full marks" });
export type ExamSubjectInput = z.infer<typeof examSubjectSchema>;

export const marksSchema = z.object({
  examSubjectId: requiredId("subject"),
  // obtained "" and absent false clears the mark.
  rows: z
    .array(z.object({ studentId: z.string().min(1), obtained: z.union([z.literal(""), marks]), absent: z.boolean() }))
    .min(1, "Nothing to save")
    .max(1000),
});
export type MarksInput = z.infer<typeof marksSchema>;

export const gradingScaleSchema = z
  .array(
    z.object({
      grade: z.string().trim().min(1, "Every grade needs a name").max(12, "Grade names can be up to 12 characters"),
      minPercent: z.number().min(0).max(100),
      gpa: z.number().min(0).max(10),
    }),
  )
  .min(2, "Add at least two grades")
  .max(15)
  .superRefine((rows, ctx) => {
    const sorted = [...rows].sort((a, b) => b.minPercent - a.minPercent);
    if (sorted[sorted.length - 1].minPercent !== 0) ctx.addIssue({ code: "custom", message: "The lowest grade must start at 0%" });
    if (new Set(rows.map((r) => r.minPercent)).size !== rows.length) ctx.addIssue({ code: "custom", message: "Two grades share the same minimum %" });
    if (new Set(rows.map((r) => r.grade.toUpperCase())).size !== rows.length) ctx.addIssue({ code: "custom", message: "Grade names must be unique" });
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].gpa > sorted[i - 1].gpa) ctx.addIssue({ code: "custom", message: "A lower grade can't have a higher GPA" });
    }
  });
