import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { FilterPanel } from "@/components/filter-panel";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/status-badge";
import { UrlFilter } from "@/components/url-filter";
import type { Prisma, StudentStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { pageParam, param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Students" };

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "LEFT", label: "Left" },
];

export default async function StudentsPage({ searchParams }: PageProps<"/students">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp, "q");
  const status = param(sp, "status");
  const classLevelId = param(sp, "class");
  const batchId = param(sp, "batch");
  const page = pageParam(sp);

  const where: Prisma.StudentWhereInput = {
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { studentCode: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { guardianPhone: { contains: q } },
        { guardianName: { contains: q, mode: "insensitive" } },
      ],
    }),
    ...(STATUS_OPTIONS.some((o) => o.value === status) && { status: status as StudentStatus }),
    ...(classLevelId && { classLevelId }),
    ...(batchId && { enrollments: { some: { batchId, status: "ACTIVE" } } }),
  };

  const [students, total, classLevels, batches] = await Promise.all([
    db.student.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        classLevel: { select: { name: true } },
        enrollments: { where: { status: "ACTIVE" }, select: { batch: { select: { name: true } } } },
      },
    }),
    db.student.count({ where }),
    db.classLevel.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.batch.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const filtered = Boolean(q || status || classLevelId || batchId);

  return (
    <>
      <PageHeader
        title="Students"
        actions={
          <Link href="/students/new" className={buttonVariants()}>
            <Plus /> Register student
          </Link>
        }
      />

      <FilterPanel params={["q", "status", "class", "batch"]}>
        <SearchInput placeholder="Search name, ID or phone" />
        <UrlFilter param="status" options={STATUS_OPTIONS} allLabel="All statuses" />
        <UrlFilter
          param="class"
          options={classLevels.map((c) => ({ value: c.id, label: c.name }))}
          allLabel="All classes"
        />
        <UrlFilter param="batch" options={batches.map((b) => ({ value: b.id, label: b.name }))} allLabel="All batches" />
      </FilterPanel>

      {students.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filtered ? "No students match these filters" : "No students yet"}
          description={filtered ? "Try a different search or clear the filters." : "Register your first student to get started."}
          action={
            !filtered && (
              <Link href="/students/new" className={buttonVariants()}>
                <Plus /> Register student
              </Link>
            )
          }
        />
      ) : (
        <>
          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="hidden md:table-cell">Batches</TableHead>
                  <TableHead className="hidden sm:table-cell">Guardian</TableHead>
                  <TableHead className="hidden lg:table-cell">Admitted</TableHead>
                  <TableHead className="pr-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s) => (
                  <TableRow key={s.id} className="relative cursor-pointer">
                    <TableCell className="pl-4">
                      <Link href={`/students/${s.id}`} className="font-medium hover:underline after:absolute after:inset-0 after:content-['']">
                        {s.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{s.studentCode}</p>
                    </TableCell>
                    <TableCell>{s.classLevel?.name ?? "—"}</TableCell>
                    <TableCell className="hidden max-w-56 truncate md:table-cell">
                      {s.enrollments.map((e) => e.batch.name).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {s.guardianName}
                      <p className="text-xs text-muted-foreground">{s.guardianPhone}</p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{formatDate(s.admissionDate)}</TableCell>
                    <TableCell className="pr-4">
                      <StatusBadge status={s.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} searchParams={sp} />
        </>
      )}
    </>
  );
}
