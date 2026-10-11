"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, validationError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { DEFAULT_GRADING_SCALE, type GradeRule } from "@/lib/constants";
import { db } from "@/lib/db";
import { emptyToNull } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { gradingScaleSchema } from "@/lib/validations/exams";
import { type CenterSettingsInput, centerSettingsSchema } from "@/lib/validations/settings";

export async function saveCenterSettings(input: CenterSettingsInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = centerSettingsSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const data = {
    ...parsed.data,
    address: emptyToNull(parsed.data.address),
    phone: emptyToNull(parsed.data.phone),
    email: emptyToNull(parsed.data.email),
  };

  await db.$transaction(async (tx) => {
    await tx.centerSettings.upsert({
      where: { id: "default" },
      create: { id: "default", ...data, gradingScale: DEFAULT_GRADING_SCALE },
      update: data,
    });
    await audit(tx, { userId: session.user.id, action: "settings.update", entity: "CenterSettings", entityId: "default" });
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved" };
}

export async function saveGradingScale(rows: GradeRule[]): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = gradingScaleSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid grading scale." };
  const scale = [...parsed.data].sort((a, b) => b.minPercent - a.minPercent);

  await db.$transaction(async (tx) => {
    await tx.centerSettings.upsert({
      where: { id: "default" },
      create: { id: "default", gradingScale: scale },
      update: { gradingScale: scale },
    });
    await audit(tx, { userId: session.user.id, action: "settings.gradingScale", entity: "CenterSettings", entityId: "default", details: { scale } });
  });
  revalidatePath("/settings");
  revalidatePath("/results", "layout");
  return { ok: true, message: "Grading scale saved" };
}
