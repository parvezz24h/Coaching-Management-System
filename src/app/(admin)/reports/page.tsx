import type { Metadata } from "next";
import { ComingSoon } from "@/components/coming-soon";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Reports" };

export default async function Page() {
  await requireAdmin();
  return <ComingSoon title="Reports" phase={6} description="Student lists, attendance summaries, fee collection, dues and exam results." />;
}
