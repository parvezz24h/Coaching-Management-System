import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

// Full session check against the database. Call this in every protected page
// and server action — the proxy only does a fast cookie-presence redirect.
export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
