import type { Metadata } from "next";
import Link from "next/link";
import { Layers, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/status-badge";
import { UrlFilter } from "@/components/url-filter";
import type { ActiveStatus, Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatMoney, toDateInput } from "@/lib/format";
import { param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { BatchDialog, DeleteBatch } from "./batch-dialog";
import { getBatchOptions } from "./batch-options";

export const metadata: Metadata = { title: "Batches" };

export default async function BatchesPage({ searchParams }: PageProps<"/batches">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp, "q");
  const year = param(sp, "year");
  const classLevelId = param(sp, "class");
  const status = param(sp, "status");

  const where: Prisma.BatchWhereInput = {
    ...(q && {
      OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }],
    }),
    ...(year && { academicYearId: year }),
    ...(classLevelId && { classLevelId }),
    ...((status === "ACTIVE" || status === "INACTIVE") && { status: status as ActiveStatus }),
  };

  const [batches, options, settings] = await Promise.all([
    db.batch.findMany({
      where,
      orderBy: [{ status: "asc" }, { classLevel: { sortOrder: "asc" } }, { name: "asc" }],
      include: {
        academicYear: { select: { name: true } },
        classLevel: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { select: { name: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
    }),
    getBatchOptions(),
    db.centerSettings.findUnique({ where: { id: "default" }, select: { currencySymbol: true } }),
  ]);
  const symbol = settings?.currencySymbol ?? "৳";
  const filtered = Boolean(q || year || classLevelId || status);

  const addButton = (
    <BatchDialog
      options={options}
      defaultValues={{
        name: "",
        code: "",
        academicYearId: options.currentYearId,
        classLevelId: "",
        subjectId: "",
        teacherId: "",
        room: "",
        scheduleNote: "",
        capacity: "",
        monthlyFee: "",
        startDate: "",
        status: "ACTIVE",
      }}
      trigger={
        <Button>
          <Plus /> Create batch
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader title="Batches" description="Groups of students taught together" actions={addButton} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <SearchInput placeholder="Search name or code" />
        <UrlFilter param="year" options={options.academicYears} allLabel="All years" />
        <UrlFilter param="class" options={options.classLevels} allLabel="All classes" />
        <UrlFilter
          param="status"
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
          allLabel="All statuses"
        />
      </div>

      {batches.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={filtered ? "No batches match these filters" : "No batches yet"}
          description={filtered ? undefined : "Create a batch, then enroll students in it."}
          action={!filtered && addButton}
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Batch</TableHead>
                <TableHead>Class</TableHead>
                <TableHead className="hidden md:table-cell">Teacher</TableHead>
                <TableHead className="hidden lg:table-cell">Schedule</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Monthly fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="pl-4">
                    <Link href={`/batches/${b.id}`} className="font-medium hover:underline">
                      {b.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{b.code}</span> · {b.academicYear.name}
                      {b.subject && ` · ${b.subject.name}`}
                    </p>
                  </TableCell>
                  <TableCell>{b.classLevel.name}</TableCell>
                  <TableCell className="hidden md:table-cell">{b.teacher?.name ?? "—"}</TableCell>
                  <TableCell className="hidden max-w-52 lg:table-cell">
                    <span className="line-clamp-2">{b.scheduleNote ?? "—"}</span>
                    {b.room && <p className="text-xs text-muted-foreground">{b.room}</p>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b._count.enrollments}
                    {b.capacity != null && <span className="text-muted-foreground"> / {b.capacity}</span>}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {b.monthlyFee != null ? formatMoney(b.monthlyFee, symbol) : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={b.status} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <BatchDialog
                        id={b.id}
                        options={options}
                        defaultValues={{
                          name: b.name,
                          code: b.code,
                          academicYearId: b.academicYearId,
                          classLevelId: b.classLevelId,
                          subjectId: b.subjectId ?? "",
                          teacherId: b.teacherId ?? "",
                          room: b.room ?? "",
                          scheduleNote: b.scheduleNote ?? "",
                          capacity: b.capacity != null ? String(b.capacity) : "",
                          monthlyFee: b.monthlyFee != null ? b.monthlyFee.toString() : "",
                          startDate: toDateInput(b.startDate),
                          status: b.status,
                        }}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${b.name}`}>
                            <Pencil />
                          </Button>
                        }
                      />
                      <DeleteBatch id={b.id} name={b.name} />
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
