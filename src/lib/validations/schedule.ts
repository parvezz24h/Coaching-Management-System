import { z } from "zod";
import { ATTENDANCE_STATUSES, WEEKDAYS } from "@/lib/constants";
import { dateString, optionalId, optionalText, requiredId } from "./common";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time");

export const classSessionSchema = z
  .object({
    batchId: requiredId("batch"),
    subjectId: optionalId,
    teacherId: optionalId,
    weekdays: z.array(z.enum(WEEKDAYS)).min(1, "Pick at least one day"),
    startTime: time,
    endTime: time,
    room: optionalText,
  })
  .refine((v) => v.endTime > v.startTime, { path: ["endTime"], message: "End time must be after start time" });
export type ClassSessionInput = z.infer<typeof classSessionSchema>;

export const attendanceSchema = z.object({
  batchId: requiredId("batch"),
  date: dateString,
  // "" clears a previously saved mark.
  records: z
    .array(z.object({ studentId: z.string().min(1), status: z.enum(["", ...ATTENDANCE_STATUSES]) }))
    .min(1, "Nothing to save")
    .max(500),
});
export type AttendanceInput = z.infer<typeof attendanceSchema>;
