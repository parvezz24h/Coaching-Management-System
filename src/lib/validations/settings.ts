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
