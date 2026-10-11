import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDate, formatMoney, toDateInput, toNumber } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { EnrollmentActions } from "../../students/[id]/enrollment-actions";
import { BatchDialog, DeleteBatch } from "../batch-dialog";
import { getBatchOptions } from "../batch-options";
import { AddStudentDialog } from "./add-student-dialog";

export async function generateMetadata({ params }: PageProps<"/batches/[id]">): Promise<Metadata> {
  const { id } = await params;
  const b = await db.batch.findUnique({ where: { id }, select: { name: true } });
  return { title: b?.name ?? "Batch" };
}

export default async function BatchDetailPage({ params }: PageProps<"/batches/[id]">) {
  await requireAdmin();
  const { id } = await params;

  const batch = await db.batch.findUnique({
    where: { id },
    include: {
      academicYear: true,
      classLevel: true,
      subject: true,
      teacher: true,
      enrollments: {
        where: { status: "ACTIVE" },
        orderBy: { student: { name: "asc" } },
        include: { student: { select: { id: true, name: true, studentCode: true, guardianPhone: true } } },
      },
    },
  });
  if (!batch) notFound();

  const [candidates, options, settings] = await Promise.all([
    db.student.findMany({
      where: { status: "ACTIVE", enrollments: { none: { batchId: id, status: "ACTIVE" } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, studentCode: true, classLevelId: true },
    }),
    getBatchOptions(),
    db.centerSettings.findUnique({ where: { id: "default" }, select: { currencySymbol: true } }),
  ]);
  const symbol = settings?.currencySymbol ?? "৳";
  // Students from the batch's class first, then everyone else.
  const studentOptions = [
    ...candidates.filter((s) => s.classLevelId === batch.classLevelId),
    ...candidates.filter((s) => s.classLevelId !== batch.classLevelId),
  ].map((s) => ({ value: s.id, label: `${s.name} (${s.studentCode})` }));

  const facts: [string, React.ReactNode][] = [
    ["Class", batch.classLevel.name],
    ["Academic year", batch.academicYear.name],
    ["Subject", batch.subject?.name],
    ["Teacher", batch.teacher?.name],
    ["Schedule", batch.scheduleNote],
    ["Room", batch.room],
    ["Monthly fee", batch.monthlyFee != null ? formatMoney(batch.monthlyFee, symbol) : null],
    ["Capacity", batch.capacity != null ? `${batch.enrollments.length} / ${batch.capacity}` : "No limit"],
    ["Start date", batch.startDate && formatDate(batch.startDate)],
  ];

  return (
    <>
      <PageHeader
        title={batch.name}
        meta={
          <span className="flex items-center gap-2">
            <span className="font-mono">{batch.code}</span>
            <StatusBadge status={batch.status} />
          </span>
        }
        actions={
          <>
            <BatchDialog
              id={batch.id}
              options={options}
              defaultValues={{
                name: batch.name,
                code: batch.code,
                academicYearId: batch.academicYearId,
                classLevelId: batch.classLevelId,
                subjectId: batch.subjectId ?? "",
                teacherId: batch.teacherId ?? "",
                room: batch.room ?? "",
                scheduleNote: batch.scheduleNote ?? "",
                capacity: batch.capacity != null ? String(batch.capacity) : "",
                monthlyFee: batch.monthlyFee != null ? batch.monthlyFee.toString() : "",
                startDate: toDateInput(batch.startDate),
                status: batch.status,
              }}
              trigger={
                <Button variant="outline">
                  <Pencil /> Edit
                </Button>
              }
            />
            <DeleteBatch id={batch.id} name={batch.name} onDeleted="/batches" />
          </>
        }
      />

      <Card>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 text-sm">{value || "—"}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Students ({batch.enrollments.length})</CardTitle>
          <CardAction>
            {batch.status === "ACTIVE" && <AddStudentDialog batchId={batch.id} students={studentOptions} />}
          </CardAction>
        </CardHeader>
        <CardContent>
          {batch.enrollments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No students enrolled yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden sm:table-cell">Guardian phone</TableHead>
                  <TableHead className="hidden md:table-cell">Enrolled</TableHead>
                  <TableHead className="text-right">Monthly fee</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.enrollments.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Link href={`/students/${e.student.id}`} className="font-medium hover:underline">
                        {e.student.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{e.student.studentCode}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{e.student.guardianPhone}</TableCell>
                    <TableCell className="hidden md:table-cell">{formatDate(e.enrolledAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {batch.monthlyFee != null
                        ? formatMoney(toNumber(batch.monthlyFee) - toNumber(e.discount), symbol)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <EnrollmentActions enrollmentId={e.id} batchName={batch.name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
