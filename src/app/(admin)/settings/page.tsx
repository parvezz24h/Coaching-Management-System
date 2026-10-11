import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { parseScale } from "@/lib/grading";
import { db } from "@/lib/db";
import { isActiveAdmin } from "@/lib/admins";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { AdminsCard } from "./admins-card";
import { PasswordCard } from "./password-card";
import { GradingEditor } from "./grading-editor";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireAdmin();
  const [s, admins] = await Promise.all([
    db.centerSettings.findUnique({ where: { id: "default" } }),
    db.user.findMany({
      where: isActiveAdmin,
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, createdAt: true, sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } } },
    }),
  ]);
  const scale = parseScale(s?.gradingScale);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" />
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
      <AdminsCard
        currentUserId={session.user.id}
        admins={admins.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          createdAt: a.createdAt.toISOString(),
          lastSeen: a.sessions[0] ? formatDateTime(a.sessions[0].updatedAt) : null,
        }))}
      />
      <PasswordCard />
    </div>
  );
}
