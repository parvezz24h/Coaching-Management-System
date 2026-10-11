import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export function validationError(error: z.ZodError): ActionResult<never> {
  return {
    ok: false,
    error: "Please fix the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[] | undefined>,
  };
}

/** Turn known database errors into a user-facing message; rethrow the rest. */
export function dbError(err: unknown, messages: { unique?: string; foreignKey?: string } = {}): ActionResult<never> {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return { ok: false, error: messages.unique ?? "That record already exists." };
    if (err.code === "P2003" || err.code === "P2014")
      return { ok: false, error: messages.foreignKey ?? "This record is in use and can't be removed." };
    if (err.code === "P2025") return { ok: false, error: "Record not found." };
  }
  throw err;
}

/** Thrown inside a transaction to abort it with a message for the user. */
export class UserError extends Error {}
