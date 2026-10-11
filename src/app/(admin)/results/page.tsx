import type { Metadata } from "next";
import Link from "next/link";
import { FileSpreadsheet, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { UrlFilter } from "@/components/url-filter";
import { db } from "@/lib/db";
import { getExamResults } from "@/lib/exams";
import { formatDate } from "@/lib/format";
import { param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Results" };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default async function ResultsPage({ searchParams }: PageProps<"/results">) {
  await requireAdmin();
  const sp = await searchParams;
  const exams = await db.exam.findMany({
    orderBy: [{ startDate: "desc" }],
    select: { id: true, name: true, status: true, startDate: true, batch: { select: { name: true } }, classLevel: { select: { name: true } } },
  });
  const examOptions = exams.map((e) => ({
    value: e.id,
    label: `${e.name} — ${e.batch?.name ?? e.classLevel?.name}${e.status === "DRAFT" ? " (draft)" : ""}`,
  }));
  const examId = param(sp, "exam") || exams.find((e) => e.status === "PUBLISHED")?.id || exams[0]?.id;
  const data = examId ? await getExamResults(examId) : null;

  const header = (
    <PageHeader
      title="Results"
      description="Tabulation sheet and marksheets"
      actions={
        data && (
          <div className="flex gap-2 print:hidden">
            <PrintButton label="Print tabulation" />
            <Link href={`/results/${data.exam.id}/marksheets`} className={buttonVariants()}>
              <Printer /> All marksheets
            </Link>
          </div>
        )
      }
    />
  );

  if (!data) {
    return (
      <>
        {header}
        <EmptyState icon={FileSpreadsheet} title="No exams yet" description="Create an exam and enter marks to see results." />
      </>
    );
  }
  const { exam, specs, rows } = data;
  const complete = rows.filter((r) => r.result.complete);
  const passed = complete.filter((r) => r.result.passed);
  const sorted = [...rows].sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.student.name.localeCompare(b.student.name));
  const gradeCounts = Object.entries(
    complete.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.result.grade]: (acc[r.result.grade] ?? 0) + 1 }), {}),
  );

  return (
    <>
      {header}
      <div className="mb-4 print:hidden">
        <UrlFilter param="exam" options={examOptions} allLabel="Select exam" />
      </div>

      <Card className="mb-4" size="sm">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-2">
          <div>
            <p className="font-semibold">
              {exam.name}{" "}
              {exam.status === "DRAFT" && (
                <Badge variant="secondary" className="ml-1">
                  Draft — not published
                </Badge>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {exam.batch?.name ?? exam.classLevel?.name} · {exam.academicYear.name} · {formatDate(exam.startDate)}
            </p>
          </div>
          {[
            ["Candidates", rows.length],
            ["Passed", `${passed.length}/${complete.length}`],
            ["Pass rate", complete.length ? `${Math.round((passed.length / complete.length) * 100)}%` : "—"],
            ["Incomplete", rows.length - complete.length],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-semibold tabular-nums">{value}</p>
            </div>
          ))}
          {gradeCounts.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground">Grades</p>
              <p className="text-sm tabular-nums">{gradeCounts.map(([g, n]) => `${g}: ${n}`).join(" · ")}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {specs.length === 0 || rows.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={specs.length === 0 ? "This exam has no subjects yet" : "No candidates"}
          action={
            <Link href={`/exams/${exam.id}`} className={buttonVariants({ variant: "outline" })}>
              Open exam
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Pos.</th>
                <th className="px-3 py-2 font-medium">Student</th>
                {specs.map((s) => (
                  <th key={s.id} className="px-2 py-2 text-right font-medium" title={`${s.name} (full ${s.fullMarks}, pass ${s.passMarks})`}>
                    {s.code}
                    <span className="block font-normal text-muted-foreground">/{fmt(s.fullMarks)}</span>
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-medium">Total</th>
                <th className="px-2 py-2 text-right font-medium">%</th>
                <th className="px-2 py-2 text-right font-medium">GPA</th>
                <th className="px-2 py-2 text-center font-medium">Grade</th>
                <th className="px-3 py-2 print:hidden" />
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ student, result, rank }) => (
                <tr key={student.id} className="border-t">
                  <td className="px-3 py-2 tabular-nums">{rank ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{student.name}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{student.studentCode}</span>
                  </td>
                  {result.subjects.map((r) => (
                    <td
                      key={r.subjectId}
                      className={cn("px-2 py-2 text-right tabular-nums", !r.missing && !r.passed && "font-semibold text-destructive", r.missing && "text-muted-foreground")}
                    >
                      {r.missing ? "—" : r.isAbsent ? "Ab" : fmt(r.obtained!)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-right font-medium tabular-nums">{fmt(result.total)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{result.complete ? result.percent.toFixed(1) : "—"}</td>
                  <td className="px-2 py-2 text-right font-medium tabular-nums">{result.complete ? result.gpa.toFixed(2) : "—"}</td>
                  <td className={cn("px-2 py-2 text-center font-semibold", result.complete && !result.passed && "text-destructive")}>
                    {result.complete ? result.grade : <span className="text-xs font-normal text-muted-foreground">Incomplete</span>}
                  </td>
                  <td className="px-3 py-2 text-right print:hidden">
                    <Link href={`/results/${exam.id}/${student.id}`} className="text-xs text-primary hover:underline">
                      Marksheet
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
