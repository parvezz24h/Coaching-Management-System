import { z } from "zod";
import {
  dateString,
  optionalDate,
  optionalId,
  optionalInt,
  optionalMoney,
  optionalText,
  requiredId,
  requiredText,
} from "./common";

export const academicYearSchema = z
  .object({
    name: requiredText("Name", 50),
    startDate: dateString,
    endDate: dateString,
    isCurrent: z.boolean(),
  })
  .refine((v) => v.endDate > v.startDate, { path: ["endDate"], message: "End date must be after start date" });
export type AcademicYearInput = z.infer<typeof academicYearSchema>;

export const classLevelSchema = z.object({
  name: requiredText("Name", 50),
  sortOrder: z.string().regex(/^-?\d+$/, "Enter a whole number"),
});
export type ClassLevelInput = z.infer<typeof classLevelSchema>;

export const subjectSchema = z.object({
  name: requiredText("Name", 100),
  code: requiredText("Code", 20).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
});
export type SubjectInput = z.infer<typeof subjectSchema>;

export const batchSchema = z.object({
  name: requiredText("Name", 100),
  code: requiredText("Code", 30).regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
  academicYearId: requiredId("academic year"),
  classLevelId: requiredId("class"),
  subjectId: optionalId,
  teacherId: optionalId,
  room: optionalText,
  scheduleNote: optionalText,
  capacity: optionalInt,
  monthlyFee: optionalMoney,
  startDate: optionalDate,
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
export type BatchInput = z.infer<typeof batchSchema>;
