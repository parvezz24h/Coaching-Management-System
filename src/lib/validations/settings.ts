import { z } from "zod";
import { optionalEmail, optionalPhone, optionalText, requiredText } from "./common";

const prefix = requiredText("Prefix", 10).regex(/^[A-Z0-9]+$/, "Uppercase letters and numbers only");

export const centerSettingsSchema = z.object({
  name: requiredText("Center name"),
  address: optionalText,
  phone: optionalPhone,
  email: optionalEmail,
  studentIdPrefix: prefix,
  teacherIdPrefix: prefix,
  receiptPrefix: prefix,
  currencySymbol: requiredText("Currency symbol", 5),
});
export type CenterSettingsInput = z.infer<typeof centerSettingsSchema>;

export const newAdminSchema = z.object({
  name: requiredText("Name", 100),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").max(128),
});
export type NewAdminInput = z.infer<typeof newAdminSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "At least 8 characters").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ["newPassword"], message: "Choose a different password" });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
