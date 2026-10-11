import { z } from "zod";

// Form values are kept as strings (what inputs produce); server actions convert
// them to dates/numbers after validation.
export const optionalText = z.string().trim().max(500);
export const requiredText = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} is required`).max(max);

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s-]{6,20}$/, "Enter a valid phone number");
export const optionalPhone = z.union([z.literal(""), phone]);
export const optionalEmail = z.union([z.literal(""), z.email("Enter a valid email")]);

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
export const optionalDate = z.union([z.literal(""), dateString]);

export const optionalId = z.string().trim(); // "" means none
export const requiredId = (label: string) => z.string().trim().min(1, `Select a ${label}`);

export const optionalMoney = z.union([
  z.literal(""),
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount"),
]);
export const optionalInt = z.union([z.literal(""), z.string().regex(/^\d+$/, "Enter a whole number")]);
