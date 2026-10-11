import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileSpreadsheet, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { db } from "@/lib/db";
import { getExamResults } from "@/lib/exams";
import { formatDate, toDateInput } from "@/lib/format";
import { param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ExamDialog } from "../exam-dialog";
import { getExamOptions } from "../exam-options";
import { DeleteExamButton, PublishButton } from "./exam-controls";
import { MarksSheet } from "./marks-sheet";
import { DeleteExamSubject, ExamSubjectDialog } from "./subject-dialog";

export async function generateMetadata({ params }: PageProps<"/exams/[id]">): Promise<Metadata> {
  const { id } = await params;
  const e = await db.exam.findUnique({ where: { id }, select: { name: true } });
  return { title: e?.name ?? "Exam" };
}

export default async function ExamPage({ params, searchParams }: PageProps<"/exams/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const data = await getExamResults(id);
  if (!data) notFound();
  const { exam, specs, scale, rows } = data;

  const [options, allSubjects, markCounts, marks] = await Promise.all([
    getExamOptions(),
    db.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.mark.groupBy({ by: ["examSubjectId"], where: { examSubject: { examId: id } }, _count: true }),
    db.mark.findMany({ where: { examSubject: { examId: id } }, select: { examSubjectId: true, studentId: true, obtained: true, isAbsent: true } }),
  ]);
  const published = exam.status === "PUBLISHED";
  const countOf = (esId: string) => markCounts.find((m) => m.examSubjectId === esId)?._count ?? 0;
  const totalMarks = markCounts.reduce((sum, m) => sum + m._count, 0);
  const incomplete = rows.filter((r) => !r.result.complete).length;
  const usedSubjects = new Set(exam.subjects.map((s) => s.subjectId));
  const subjectOptions = (keep?: string) =>
    allSubjects.filter((s) => !usedSubjects.has(s.id) || s.id === keep).map((s) => ({ value: s.id, label: s.name }));

  const sp = await searchParams;
  const activeId = specs.some((s) => s.id === param(sp, "subject")) ? param(sp, "subject") : specs[0]?.id;
  const active = specs.find((s) => s.id === activeId);

  return (
    <>
      <PageHeader
        title={exam.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {exam.batch?.name ?? exam.classLevel?.name} · {exam.academicYear.name} · {formatDate(exam.startDate)}
            {exam.endDate && exam.endDate.getTime() !== exam.startDate.getTime() && ` – ${formatDate(exam.endDate)}`}
            {published ? (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Published</Badge>
            ) : (
              <Badge variant="secondary">Draft</Badge>
            )}
          </span>
        }
        actions={
          <>
            <Link href={`/results?exam=${exam.id}`} className={buttonVariants({ variant: "outline" })}>
              <FileSpreadsheet /> Results
            </Link>
            {!published && (
              <ExamDialog
                id={exam.id}
                academicYears={options.academicYears}
                classLevels={options.classLevels}
                batches={options.batches}
                defaultValues={{
                  name: exam.name,
                  academicYearId: exam.academicYearId,
                  classLevelId: exam.batchId ? "" : (exam.classLevelId ?? ""),
                  batchId: exam.batchId ?? "",
                  startDate: toDateInput(exam.startDate),
                  endDate: toDateInput(exam.endDate),
                }}
                trigger={
                  <Button variant="outline">
                    <Pencil /> Edit
                  </Button>
                }
              />
            )}
            <PublishButton id={exam.id} published={published} incomplete={incomplete} />
            {!published && <DeleteExamButton id={exam.id} name={exam.name} marks={totalMarks} />}
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Subjects</CardTitle>
          <CardDescription>
            {rows.length} candidate{rows.length === 1 ? "" : "s"}
            {exam.batch ? ` from ${exam.batch.name}` : exam.classLevel ? ` in ${exam.classLevel.name}` : ""}
          </CardDescription>
          {!published && (
            <CardAction>
              <ExamSubjectDialog
                examId={exam.id}
                subjects={subjectOptions()}
                defaultValues={{ subjectId: "", fullMarks: "100", passMarks: "33", examDate: "" }}
                trigger={
                  <Button size="sm">
                    <Plus /> Add subject
                  </Button>
                }
              />
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {specs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Add the subjects in this exam to start entering marks.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="hidden sm:table-cell">Date</TableHead>
                  <TableHead className="text-right">Full</TableHead>
                  <TableHead className="text-right">Pass</TableHead>
                  <TableHead className="text-right">Entered</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {exam.subjects.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.subject.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{s.examDate ? formatDate(s.examDate) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.fullMarks.toString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.passMarks.toString()}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", countOf(s.id) < rows.length && "text-amber-600 dark:text-amber-400")}>
                      {countOf(s.id)}/{rows.length}
                    </TableCell>
                    <TableCell className="text-right">
                      {!published && (
                        <div className="flex justify-end gap-1">
                          <ExamSubjectDialog
                            examId={exam.id}
                            id={s.id}
                            subjects={subjectOptions(s.subjectId)}
                            defaultValues={{
                              subjectId: s.subjectId,
                              fullMarks: s.fullMarks.toString(),
                              passMarks: s.passMarks.toString(),
                              examDate: toDateInput(s.examDate),
                            }}
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.subject.name}`}>
                                <Pencil />
                              </Button>
                            }
                          />
                          <DeleteExamSubject examId={exam.id} id={s.id} name={s.subject.name} marks={countOf(s.id)} />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {active && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Marks</CardTitle>
            <CardDescription>Pick a subject, type marks (Enter moves down), then save.</CardDescription>
          </CardHeader>
          <CardContent>
            <nav className="mb-3 flex flex-wrap gap-1" aria-label="Subjects">
              {specs.map((s) => (
                <Link
                  key={s.id}
                  href={`/exams/${exam.id}?subject=${s.id}`}
                  scroll={false}
                  aria-current={s.id === active.id ? "page" : undefined}
                  className={buttonVariants({ variant: s.id === active.id ? "default" : "outline", size: "sm" })}
                >
                  {s.name}
                  <span className="opacity-70">
                    {countOf(s.id)}/{rows.length}
                  </span>
                </Link>
              ))}
            </nav>
            {rows.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No candidates — enroll students in the batch or class first.</p>
            ) : (
              <MarksSheet
                key={active.id}
                examSubjectId={active.id}
                fullMarks={active.fullMarks}
                passMarks={active.passMarks}
                scale={scale}
                readOnly={published}
                students={rows.map(({ student }) => {
                  const m = marks.find((x) => x.examSubjectId === active.id && x.studentId === student.id);
                  return { ...student, obtained: m?.obtained?.toString() ?? "", absent: m?.isAbsent ?? false };
                })}
              />
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
