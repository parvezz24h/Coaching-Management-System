import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { toDateInput } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { StudentForm } from "../../student-form";

export const metadata: Metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: PageProps<"/students/[id]/edit">) {
  await requireAdmin();
  const { id } = await params;
  const [student, classLevels] = await Promise.all([
    db.student.findUnique({ where: { id } }),
    db.classLevel.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!student) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Edit ${student.name}`} description={student.studentCode} />
      <StudentForm
        studentId={student.id}
        classLevels={classLevels.map((c) => ({ value: c.id, label: c.name }))}
        defaultValues={{
          name: student.name,
          gender: student.gender ?? "",
          dateOfBirth: toDateInput(student.dateOfBirth),
          phone: student.phone ?? "",
          email: student.email ?? "",
          address: student.address ?? "",
          schoolName: student.schoolName ?? "",
          classLevelId: student.classLevelId ?? "",
          guardianName: student.guardianName,
          guardianPhone: student.guardianPhone,
          guardianRelation: student.guardianRelation ?? "",
          guardianOccupation: student.guardianOccupation ?? "",
          admissionDate: toDateInput(student.admissionDate),
          status: student.status,
          notes: student.notes ?? "",
        }}
      />
    </div>
  );
}
