import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { todayISO } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Register student" };

export default async function NewStudentPage() {
  await requireAdmin();
  const classLevels = await db.classLevel.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Register student" />
      <StudentForm
        classLevels={classLevels.map((c) => ({ value: c.id, label: c.name }))}
        defaultValues={{
          name: "",
          gender: "",
          dateOfBirth: "",
          phone: "",
          email: "",
          address: "",
          schoolName: "",
          classLevelId: "",
          guardianName: "",
          guardianPhone: "",
          guardianRelation: "",
          guardianOccupation: "",
          admissionDate: todayISO(),
          status: "ACTIVE",
          notes: "",
        }}
      />
    </div>
  );
}
