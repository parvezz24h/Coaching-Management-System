import type { Metadata } from "next";
import { BookOpen, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { DeleteSubject, SubjectDialog } from "./subject-dialog";

export const metadata: Metadata = { title: "Subjects" };

export default async function SubjectsPage() {
  await requireAdmin();
  const subjects = await db.subject.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { teachers: true, batches: true } } },
  });
  const addButton = (
    <SubjectDialog
      defaultValues={{ name: "", code: "" }}
      trigger={
        <Button>
          <Plus /> Add subject
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader title="Subjects" actions={addButton} />
      {subjects.length === 0 ? (
        <EmptyState icon={BookOpen} title="No subjects yet" action={addButton} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Subject</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Teachers</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Batches</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-4 font-medium">{s.name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.code}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{s._count.teachers}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{s._count.batches}</TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <SubjectDialog
                        id={s.id}
                        defaultValues={{ name: s.name, code: s.code }}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.name}`}>
                            <Pencil />
                          </Button>
                        }
                      />
                      <DeleteSubject id={s.id} name={s.name} />
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
