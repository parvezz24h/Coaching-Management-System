import { z } from "zod";
import {
  dateString,
  optionalDate,
  optionalEmail,
  optionalId,
  optionalMoney,
  optionalPhone,
  optionalText,
  phone,
  requiredId,
  requiredText,
} from "./common";

export const studentSchema = z.object({
  name: requiredText("Name"),
  gender: z.enum(["", "MALE", "FEMALE", "OTHER"]),
  dateOfBirth: optionalDate,
  phone: optionalPhone,
  email: optionalEmail,
  address: optionalText,
  schoolName: optionalText,
  classLevelId: optionalId,
  guardianName: requiredText("Guardian name"),
  guardianPhone: phone,
  guardianRelation: optionalText,
  guardianOccupation: optionalText,
  admissionDate: dateString,
  status: z.enum(["ACTIVE", "INACTIVE", "LEFT"]),
  notes: optionalText,
});
export type StudentInput = z.infer<typeof studentSchema>;

export const enrollmentSchema = z.object({
  studentId: requiredId("student"),
  batchId: requiredId("batch"),
  enrolledAt: dateString,
  discount: optionalMoney,
});
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
