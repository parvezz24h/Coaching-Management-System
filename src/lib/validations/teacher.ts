import { z } from "zod";
import { dateString, optionalEmail, optionalText, phone, requiredText } from "./common";

export const teacherSchema = z.object({
  name: requiredText("Name"),
  phone,
  email: optionalEmail,
  address: optionalText,
  qualification: optionalText,
  joiningDate: dateString,
  status: z.enum(["ACTIVE", "INACTIVE"]),
  subjectIds: z.array(z.string()),
  notes: optionalText,
});
export type TeacherInput = z.infer<typeof teacherSchema>;
