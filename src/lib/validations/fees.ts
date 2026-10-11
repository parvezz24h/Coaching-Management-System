import { z } from "zod";
import { dateString, optionalId, optionalText, requiredId, requiredText } from "./common";

const money = z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount");
const positiveMoney = money.refine((v) => Number(v) > 0, "Must be more than zero");
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month");

export const feePlanSchema = z.object({
  name: requiredText("Name", 100),
  type: z.enum(["MONTHLY_TUITION", "ADMISSION", "EXAM", "OTHER"]),
  amount: money,
  batchId: optionalId,
  classLevelId: optionalId,
  isActive: z.boolean(),
});
export type FeePlanInput = z.infer<typeof feePlanSchema>;

export const generateTuitionSchema = z.object({
  month,
  dueDay: z.string().regex(/^([1-9]|[12]\d|3[01])$/, "Day 1–31"),
  batchId: optionalId, // "" = all active batches
});
export type GenerateTuitionInput = z.infer<typeof generateTuitionSchema>;

export const chargeFeeSchema = z.object({
  feePlanId: requiredId("fee plan"),
  scope: z.enum(["batch", "class", "student"]),
  targetId: requiredId("target"),
  dueDate: dateString,
  period: z.union([z.literal(""), month]),
});
export type ChargeFeeInput = z.infer<typeof chargeFeeSchema>;

export const adjustFeeSchema = z.object({
  discount: money,
  dueDate: dateString,
  note: optionalText,
});
export type AdjustFeeInput = z.infer<typeof adjustFeeSchema>;

export const collectPaymentSchema = z.object({
  studentId: requiredId("student"),
  paidAt: dateString,
  note: optionalText,
  allocations: z
    .array(z.object({ studentFeeId: z.string().min(1), amount: positiveMoney }))
    .min(1, "Select at least one fee to pay")
    .max(100),
});
export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>;

export const reversePaymentSchema = z.object({
  paymentId: requiredId("payment"),
  reason: requiredText("Reason", 300),
});
export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
