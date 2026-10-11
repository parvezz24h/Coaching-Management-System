import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { UrlFilter } from "@/components/url-filter";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { formatDate, todayISO } from "@/lib/format";
import { param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { ExamDialog } from "./exam-dialog";
import { getExamOptions } from "./exam-options";

export const metadata: Metadata = { title: "Exams" };

export default async function ExamsPage({ searchParams }: PageProps<"/exams">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = param(sp, "q");
  const year = param(sp, "year");
  const status = param(sp, "status");

  const where: Prisma.ExamWhereInput = {
    ...(q && { name: { contains: q, mode: "insensitive" } }),
    ...(year && { academicYearId: year }),
    ...((status === "DRAFT" || status === "PUBLISHED") && { status }),
  };
  const [exams, options] = await Promise.all([
    db.exam.findMany({
      where,
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
      include: {
        classLevel: { select: { name: true } },
        batch: { select: { name: true } },
        academicYear: { select: { name: true } },
        subjects: { select: { _count: { select: { marks: true } } } },
      },
    }),
    getExamOptions(),
  ]);
  const filtered = Boolean(q || year || status);
  const addButton = (
    <ExamDialog
      academicYears={options.academicYears}
      classLevels={options.classLevels}
      batches={options.batches}
      defaultValues={{ name: "", academicYearId: options.currentYearId, classLevelId: "", batchId: "", startDate: todayISO(), endDate: "" }}
      trigger={
        <Button>
          <Plus /> New exam
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader title="Exams" description="Create exams, set subjects and enter marks" actions={addButton} />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Search exams" />
        <UrlFilter param="year" options={options.academicYears} allLabel="All years" />
        <UrlFilter
          param="status"
          options={[
            { value: "DRAFT", label: "Draft" },
            { value: "PUBLISHED", label: "Published" },
          ]}
          allLabel="All statuses"
        />
      </div>
      {exams.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={filtered ? "No exams match these filters" : "No exams yet"}
          description={filtered ? undefined : "Create an exam for a batch or a whole class."}
          action={!filtered && addButton}
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Exam</TableHead>
                <TableHead className="hidden sm:table-cell">For</TableHead>
                <TableHead className="hidden md:table-cell">Dates</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Subjects</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Marks entered</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exams.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="pl-4">
                    <Link href={`/exams/${e.id}`} className="font-medium hover:underline">
                      {e.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {e.academicYear.name}
                      <span className="sm:hidden"> · {e.batch?.name ?? e.classLevel?.name}</span>
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{e.batch?.name ?? e.classLevel?.name ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatDate(e.startDate)}
                    {e.endDate && e.endDate.getTime() !== e.startDate.getTime() && ` – ${formatDate(e.endDate)}`}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{e.subjects.length}</TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">
                    {e.subjects.reduce((sum, s) => sum + s._count.marks, 0)}
                  </TableCell>
                  <TableCell className="pr-4">
                    {e.status === "PUBLISHED" ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Published</Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
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
