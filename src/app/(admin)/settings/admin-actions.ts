"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, validationError } from "@/lib/action";
import { createOrReactivateAdmin, isActiveAdmin } from "@/lib/admins";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { type NewAdminInput, newAdminSchema } from "@/lib/validations/settings";

export async function addAdmin(input: NewAdminInput): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = newAdminSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);

  const result = await db.$transaction(async (tx) => {
    const r = await createOrReactivateAdmin(tx, parsed.data);
    if (r.status !== "exists") {
      await audit(tx, { userId: session.user.id, action: `admin.${r.status}`, entity: "User", entityId: r.user.id, details: { email: r.user.email } });
    }
    return r;
  });
  if (result.status === "exists") {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: { email: ["This email already belongs to an admin"] } };
  }
  revalidatePath("/settings");
  return { ok: true, message: result.status === "reactivated" ? `Restored access for ${result.user.email}` : `Added ${result.user.email}` };
}

export async function removeAdmin(userId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  if (userId === session.user.id) return { ok: false, error: "You can't remove your own account." };

  return db.$transaction(async (tx) => {
    const others = await tx.user.count({ where: { ...isActiveAdmin, id: { not: userId } } });
    if (others === 0) return { ok: false, error: "There must be at least one admin." } as const;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, error: "Admin not found." } as const;
    // Keep the user row (it's referenced by receipts and the audit log); remove the login.
    await tx.account.deleteMany({ where: { userId } });
    await tx.session.deleteMany({ where: { userId } });
    await audit(tx, { userId: session.user.id, action: "admin.remove", entity: "User", entityId: userId, details: { email: user.email } });
    revalidatePath("/settings");
    return { ok: true, message: `Removed ${user.email}` } as const;
  });
}
