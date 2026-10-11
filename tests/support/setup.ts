import { vi } from "vitest";

// Server actions call these Next.js APIs; outside a request they are no-ops.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  refresh: vi.fn(),
}));

// Pretend the request comes from the admin created by resetDatabase().
vi.mock("@/lib/session", async () => {
  const { TEST_ADMIN } = await import("./fixtures");
  const session = { user: TEST_ADMIN, session: { id: "test-session", userId: TEST_ADMIN.id } };
  return { getSession: vi.fn(async () => session), requireAdmin: vi.fn(async () => session) };
});
