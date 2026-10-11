import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { parseScale } from "@/lib/grading";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { GradingEditor } from "./grading-editor";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireAdmin();
  const s = await db.centerSettings.findUnique({ where: { id: "default" } });
  const scale = parseScale(s?.gradingScale);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Coaching center information and grading" />
      <SettingsForm
        defaultValues={{
          name: s?.name ?? "My Coaching Center",
          address: s?.address ?? "",
          phone: s?.phone ?? "",
          email: s?.email ?? "",
          studentIdPrefix: s?.studentIdPrefix ?? "STU",
          teacherIdPrefix: s?.teacherIdPrefix ?? "TCH",
          receiptPrefix: s?.receiptPrefix ?? "RCP",
          currencySymbol: s?.currencySymbol ?? "৳",
        }}
      />
      <GradingEditor scale={scale} />
    </div>
  );
}
