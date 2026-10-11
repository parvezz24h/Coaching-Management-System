import type { Metadata } from "next";
import { Pencil, Plus, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { FilterPanel } from "@/components/filter-panel";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/status-badge";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate, toDateInput, todayISO } from "@/lib/format";
import { param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { DeleteTeacher } from "./delete-teacher";
import { TeacherDialog } from "./teacher-dialog";

export const metadata: Metadata = { title: "Teachers" };

export default async function TeachersPage({ searchParams }: PageProps<"/teachers">) {
  await requireAdmin();
  const q = param(await searchParams, "q");
  const where: Prisma.TeacherWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { teacherCode: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      }
    : {};

  const [teachers, subjects] = await Promise.all([
    db.teacher.findMany({
      where,
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        subjects: { select: { id: true, name: true }, orderBy: { name: "asc" } },
        batches: { where: { status: "ACTIVE" }, select: { id: true, name: true } },
      },
    }),
    db.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));
  const blank = {
    name: "",
    phone: "",
    email: "",
    address: "",
    qualification: "",
    joiningDate: todayISO(),
    status: "ACTIVE" as const,
    subjectIds: [],
    notes: "",
  };
  const addButton = (
    <TeacherDialog
      defaultValues={blank}
      subjects={subjectOptions}
      trigger={
        <Button>
          <Plus /> Add teacher
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader title="Teachers" actions={addButton} />
      <FilterPanel params={["q"]}>
        <SearchInput placeholder="Search name, ID or phone" />
      </FilterPanel>

      {teachers.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title={q ? "No teachers match your search" : "No teachers yet"}
          description={q ? undefined : "Add teachers so you can assign them to batches."}
          action={!q && addButton}
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Teacher</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Subjects</TableHead>
                <TableHead className="hidden lg:table-cell">Active batches</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="pl-4">
                    <span className="font-medium">{t.name}</span>
                    <p className="font-mono text-xs text-muted-foreground">{t.teacherCode}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {t.phone}
                    {t.email && <p className="text-xs text-muted-foreground">{t.email}</p>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {t.subjects.length
                        ? t.subjects.map((s) => (
                            <Badge key={s.id} variant="outline">
                              {s.name}
                            </Badge>
                          ))
                        : "—"}
                    </div>
                  </TableCell>
                  <TableCell className="hidden max-w-56 truncate lg:table-cell">
                    {t.batches.map((b) => b.name).join(", ") || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                    <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">Since {formatDate(t.joiningDate)}</p>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <TeacherDialog
                        teacherId={t.id}
                        subjects={subjectOptions}
                        defaultValues={{
                          name: t.name,
                          phone: t.phone,
                          email: t.email ?? "",
                          address: t.address ?? "",
                          qualification: t.qualification ?? "",
                          joiningDate: toDateInput(t.joiningDate),
                          status: t.status,
                          subjectIds: t.subjects.map((s) => s.id),
                          notes: t.notes ?? "",
                        }}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${t.name}`}>
                            <Pencil />
                          </Button>
                        }
                      />
                      <DeleteTeacher id={t.id} name={t.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
