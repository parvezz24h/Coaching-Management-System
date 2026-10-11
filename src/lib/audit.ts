import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Client = Prisma.TransactionClient | typeof db;

export async function audit(
  client: Client,
  entry: {
    userId: string;
    action: string;
    entity: string;
    entityId?: string;
    details?: Prisma.InputJsonValue;
  },
) {
  await client.auditLog.create({ data: entry });
}
