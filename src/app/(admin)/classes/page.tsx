import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { formatDate, toDateInput } from "@/lib/format";
import { requireAdmin } from "@/lib/session";
import { AcademicYearDialog, ClassLevelDialog, DeleteButton } from "./dialogs";

export const metadata: Metadata = { title: "Classes & academic years" };

export default async function ClassesPage() {
  await requireAdmin();
  const [years, levels] = await Promise.all([
    db.academicYear.findMany({ orderBy: { startDate: "desc" }, include: { _count: { select: { batches: true } } } }),
    db.classLevel.findMany({
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { students: true, batches: true } } },
    }),
  ]);
  const nextYear = new Date().getFullYear() + 1;
  const editIcon = (label: string) => (
    <Button variant="ghost" size="icon-sm" aria-label={label}>
      <Pencil />
    </Button>
  );

  return (
    <>
      <PageHeader title="Classes & years" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Academic years</CardTitle>
            <CardDescription>Batches and exams belong to an academic year.</CardDescription>
            <CardAction>
              <AcademicYearDialog
                defaultValues={{
                  name: String(nextYear),
                  startDate: `${nextYear}-01-01`,
                  endDate: `${nextYear}-12-31`,
                  isCurrent: false,
                }}
                trigger={
                  <Button size="sm">
                    <Plus /> Add year
                  </Button>
                }
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="hidden sm:table-cell">Period</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {years.map((y) => (
                  <TableRow key={y.id}>
                    <TableCell className="font-medium">
                      {y.name}
                      {y.isCurrent && <Badge className="ml-2">Current</Badge>}
                      <p className="text-xs font-normal text-muted-foreground sm:hidden">
                        {formatDate(y.startDate)} – {formatDate(y.endDate)}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatDate(y.startDate)} – {formatDate(y.endDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{y._count.batches}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <AcademicYearDialog
                          id={y.id}
                          defaultValues={{
                            name: y.name,
                            startDate: toDateInput(y.startDate),
                            endDate: toDateInput(y.endDate),
                            isCurrent: y.isCurrent,
                          }}
                          trigger={editIcon(`Edit ${y.name}`)}
                        />
                        <DeleteButton kind="year" id={y.id} name={y.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
            <CardDescription>Class 1–12, SSC and HSC by default.</CardDescription>
            <CardAction>
              <ClassLevelDialog
                defaultValues={{ name: "", sortOrder: String((levels.at(-1)?.sortOrder ?? 0) + 1) }}
                trigger={
                  <Button size="sm">
                    <Plus /> Add class
                  </Button>
                }
              />
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Students</TableHead>
                  <TableHead className="text-right">Batches</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{l._count.students}</TableCell>
                    <TableCell className="text-right tabular-nums">{l._count.batches}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <ClassLevelDialog
                          id={l.id}
                          defaultValues={{ name: l.name, sortOrder: String(l.sortOrder) }}
                          trigger={editIcon(`Edit ${l.name}`)}
                        />
                        <DeleteButton kind="class" id={l.id} name={l.name} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
