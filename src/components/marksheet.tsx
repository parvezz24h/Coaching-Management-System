import type { GradeRule } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { StudentResult, SubjectSpec } from "@/lib/grading";
import { cn } from "@/lib/utils";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** A printable marksheet for one student. Server component (no hooks). */
export function Marksheet({
  center,
  exam,
  student,
  specs,
  result,
  rank,
  candidates,
  scale,
  draft,
}: {
  center: { name: string; address: string | null; phone: string | null };
  exam: { name: string; scope: string; year: string; startDate: Date };
  student: { name: string; studentCode: string };
  specs: (SubjectSpec & { code: string })[];
  result: StudentResult;
  rank: number | null;
  candidates: number;
  scale: GradeRule[];
  draft: boolean;
}) {
  return (
    <article className="relative mx-auto max-w-2xl overflow-hidden rounded-xl border bg-card p-6 text-sm break-after-page sm:p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
      {draft && (
        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="-rotate-12 text-7xl font-black tracking-widest text-muted-foreground/10">DRAFT</span>
        </div>
      )}
      <header className="border-b pb-4 text-center">
        <h2 className="text-lg font-semibold">{center.name}</h2>
        {center.address && <p className="text-muted-foreground">{center.address}</p>}
        {center.phone && <p className="text-muted-foreground">{center.phone}</p>}
        <p className="mt-2 text-xs font-semibold tracking-widest uppercase">Academic transcript</p>
        <p className="mt-1 font-medium">{exam.name}</p>
      </header>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 py-4">
        <div>
          <dt className="text-xs text-muted-foreground">Student</dt>
          <dd className="font-medium">{student.name}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-muted-foreground">Student ID</dt>
          <dd className="font-mono">{student.studentCode}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Batch / class</dt>
          <dd>{exam.scope}</dd>
        </div>
        <div className="text-right">
          <dt className="text-xs text-muted-foreground">Session · date</dt>
          <dd>
            {exam.year} · {formatDate(exam.startDate)}
          </dd>
        </div>
      </dl>

      <table className="w-full border text-sm">
        <thead className="bg-muted/50 text-xs">
          <tr>
            <th className="border px-2 py-1.5 text-left font-medium">Subject</th>
            <th className="border px-2 py-1.5 text-right font-medium">Full</th>
            <th className="border px-2 py-1.5 text-right font-medium">Pass</th>
            <th className="border px-2 py-1.5 text-right font-medium">Obtained</th>
            <th className="border px-2 py-1.5 text-center font-medium">Grade</th>
            <th className="border px-2 py-1.5 text-right font-medium">GP</th>
          </tr>
        </thead>
        <tbody>
          {specs.map((s, i) => {
            const r = result.subjects[i];
            return (
              <tr key={s.id}>
                <td className="border px-2 py-1.5">{s.name}</td>
                <td className="border px-2 py-1.5 text-right tabular-nums">{fmt(s.fullMarks)}</td>
                <td className="border px-2 py-1.5 text-right tabular-nums">{fmt(s.passMarks)}</td>
                <td className={cn("border px-2 py-1.5 text-right tabular-nums", !r.missing && !r.passed && "font-semibold text-destructive")}>
                  {r.missing ? "—" : r.isAbsent ? "Absent" : fmt(r.obtained!)}
                </td>
                <td className={cn("border px-2 py-1.5 text-center font-medium", !r.missing && !r.passed && "text-destructive")}>{r.grade}</td>
                <td className="border px-2 py-1.5 text-right tabular-nums">{r.missing ? "—" : r.gpa.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="font-semibold">
          <tr>
            <td className="border px-2 py-1.5">Total</td>
            <td className="border px-2 py-1.5 text-right tabular-nums">{fmt(result.fullTotal)}</td>
            <td className="border px-2 py-1.5" />
            <td className="border px-2 py-1.5 text-right tabular-nums">{fmt(result.total)}</td>
            <td className="border px-2 py-1.5 text-center">{result.grade}</td>
            <td className="border px-2 py-1.5 text-right tabular-nums">{result.complete ? result.gpa.toFixed(2) : "—"}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Result", result.complete ? (result.passed ? "Passed" : "Failed") : "Incomplete"],
          ["GPA", result.complete ? result.gpa.toFixed(2) : "—"],
          ["Percentage", result.complete ? `${result.percent.toFixed(2)}%` : "—"],
          ["Position", rank ? `${rank} of ${candidates}` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border p-2 text-center">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn("font-semibold", value === "Failed" && "text-destructive")}>{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        <p className="mb-1 font-medium text-foreground">Grading scale</p>
        <p>{scale.map((g) => `${g.grade} ≥${g.minPercent}% (${g.gpa.toFixed(2)})`).join(" · ")}</p>
        <p className="mt-1">A failed or absent subject gives an overall GPA of 0.00.</p>
      </div>

      <footer className="mt-12 flex items-end justify-between text-xs text-muted-foreground">
        <p className="border-t border-foreground/40 px-6 pt-1">Class teacher</p>
        <p className="border-t border-foreground/40 px-6 pt-1">Principal / Director</p>
      </footer>
    </article>
  );
}
