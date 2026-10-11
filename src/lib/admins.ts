// Admin account helpers shared by the app and the seed script (no server-only).
import { hashPassword } from "better-auth/crypto";
import type { PrismaClient } from "@/generated/prisma/client";

export const isActiveAdmin = { accounts: { some: { providerId: "credential" } } } as const;

/**
 * Create an admin, or reactivate a removed one (removal deletes the login but
 * keeps the user row so receipts keep showing who collected the money).
 */
export async function createOrReactivateAdmin(
  db: Pick<PrismaClient, "user" | "account">,
  input: { name: string; email: string; password: string },
) {
  const email = input.email.trim().toLowerCase();
  const password = await hashPassword(input.password);
  const existing = await db.user.findUnique({ where: { email }, include: { accounts: { where: { providerId: "credential" } } } });
  if (existing?.accounts.length) return { status: "exists" as const, user: existing };

  if (existing) {
    await db.account.create({
      data: { id: crypto.randomUUID(), accountId: existing.id, providerId: "credential", password, userId: existing.id },
    });
    const user = await db.user.update({ where: { id: existing.id }, data: { name: input.name } });
    return { status: "reactivated" as const, user };
  }
  const id = crypto.randomUUID();
  const user = await db.user.create({
    data: {
      id,
      name: input.name,
      email,
      emailVerified: true,
      accounts: { create: { id: crypto.randomUUID(), accountId: id, providerId: "credential", password } },
    },
  });
  return { status: "created" as const, user };
}
