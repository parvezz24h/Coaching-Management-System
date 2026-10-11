import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileBarChart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { UrlFilter } from "@/components/url-filter";
import { UrlInput } from "@/components/url-input";
import { getBatchRoster } from "@/lib/attendance";
import { weekdayOf } from "@/lib/constants";
import { db } from "@/lib/db";
import { currentMonthISO, monthDays, todayISO } from "@/lib/format";
import { param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Monthly attendance report" };

const CELL: Record<string, { label: string; className: string }> = {
  PRESENT: { label: "P", className: "text-emerald-700 dark:text-emerald-400" },
  LATE: { label: "L", className: "text-amber-600 dark:text-amber-400 font-semibold" },
  ABSENT: { label: "A", className: "bg-red-500/10 text-red-600 dark:text-red-400 font-semibold" },
};

export default async function AttendanceReportPage({ searchParams }: PageProps<"/attendance/report">) {
  await requireAdmin();
  const sp = await searchParams;
  const thisMonth = currentMonthISO();
  const rawMonth = param(sp, "month");
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : thisMonth;
  const batchId = param(sp, "batch");

  const [batches, settings] = await Promise.all([
    db.batch.findMany({ orderBy: [{ status: "asc" }, { name: "asc" }], select: { id: true, name: true, code: true, status: true } }),
    db.centerSettings.findUnique({ where: { id: "default" }, select: { name: true } }),
  ]);
  const batchOptions = batches.map((b) => ({
    value: b.id,
    label: `${b.name} (${b.code})${b.status === "ACTIVE" ? "" : " — inactive"}`,
  }));

  const header = (
    <>
      <PageHeader
        title="Monthly attendance report"
        description="Day-by-day attendance for one batch"
        actions={
          <>
            <Link href="/attendance" className={cn(buttonVariants({ variant: "ghost" }), "print:hidden")}>
              <ArrowLeft /> Attendance
            </Link>
            {batchId && <PrintButton />}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center print:hidden">
        <UrlFilter param="batch" options={batchOptions} allLabel="Select a batch" wide />
        <UrlInput param="month" type="month" defaultValue={thisMonth} max={thisMonth} label="Month" />
      </div>
    </>
  );

  const batch = batchId
    ? await db.batch.findUnique({
        where: { id: batchId },
        include: {
          classSessions: { select: { weekday: true } },
          teacher: { select: { name: true } },
          classLevel: { select: { name: true } },
        },
      })
    : null;
  if (!batch) {
    return (
      <>
        {header}
        <EmptyState icon={FileBarChart} title="Pick a batch" description="Choose a batch and month to see the report." />
      </>
    );
  }

  const { first, last, days } = monthDays(month);
  const [roster, records] = await Promise.all([
    getBatchRoster(batch.id, first, last),
    db.attendance.findMany({
      where: { batchId: batch.id, date: { gte: first, lte: last } },
      select: { studentId: true, date: true, status: true },
    }),
  ]);

  const key = (studentId: string, d: Date) => `${studentId}:${d.toISOString().slice(0, 10)}`;
  const byCell = new Map(records.map((r) => [key(r.studentId, r.date), r.status]));
  const scheduledDays = new Set(batch.classSessions.map((s) => s.weekday));
  const takenDates = new Set(records.map((r) => r.date.toISOString().slice(0, 10)));
  const today = todayISO();
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(first);

  const rows = roster.map((s) => {
    const marks = days.map((d) => byCell.get(key(s.id, d)));
    const present = marks.filter((m) => m === "PRESENT").length;
    const late = marks.filter((m) => m === "LATE").length;
    const absent = marks.filter((m) => m === "ABSENT").length;
    const total = present + late + absent;
    return { ...s, marks, present, late, absent, rate: total ? Math.round(((present + late) / total) * 100) : null };
  });
  const totals = rows.reduce(
    (t, r) => ({ present: t.present + r.present, late: t.late + r.late, absent: t.absent + r.absent }),
    { present: 0, late: 0, absent: 0 },
  );
  const overall = totals.present + totals.late + totals.absent;

  return (
    <>
      {header}
      <Card className="print:border-0 print:shadow-none print:ring-0">
        <CardHeader>
          <p className="hidden text-sm font-semibold print:block">{settings?.name}</p>
          <CardTitle>
            {batch.name} — {monthLabel}
          </CardTitle>
          <CardDescription>
            {batch.classLevel.name}
            {batch.teacher && ` · ${batch.teacher.name}`} · {takenDates.size} day{takenDates.size === 1 ? "" : "s"} of
            attendance taken · overall {overall ? `${Math.round(((totals.present + totals.late) / overall) * 100)}%` : "—"}{" "}
            attendance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No students in this batch during {monthLabel}.</p>
          ) : (
            <>
              <div className="overflow-x-auto rounded-lg border print:overflow-visible">
                <table className="w-full border-collapse text-xs print:text-[9px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="sticky left-0 z-10 min-w-40 border-b bg-muted px-2 py-1.5 text-left font-medium">
                        Student
                      </th>
                      {days.map((d) => {
                        const iso = d.toISOString().slice(0, 10);
                        const scheduled = scheduledDays.has(weekdayOf(d));
                        return (
                          <th
                            key={iso}
                            className={cn(
                              "min-w-6 border-b border-l px-0.5 py-1 text-center font-normal tabular-nums",
                              scheduled ? "text-foreground" : "text-muted-foreground/60",
                              iso === today && "bg-primary/10",
                            )}
                            title={scheduled ? "Scheduled class day" : undefined}
                          >
                            <div className="text-[10px] uppercase">{weekdayOf(d).slice(0, 2)}</div>
                            <div className={cn(scheduled && "font-semibold")}>{d.getUTCDate()}</div>
                          </th>
                        );
                      })}
                      <th className="border-b border-l px-1.5 text-center font-medium">P</th>
                      <th className="border-b border-l px-1.5 text-center font-medium">L</th>
                      <th className="border-b border-l px-1.5 text-center font-medium">A</th>
                      <th className="border-b border-l px-1.5 text-center font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="sticky left-0 z-10 border-b bg-card px-2 py-1">
                          <Link href={`/students/${r.id}`} className="font-medium hover:underline">
                            {r.name}
                          </Link>
                          <div className="font-mono text-[10px] text-muted-foreground">{r.studentCode}</div>
                        </td>
                        {r.marks.map((m, i) => (
                          <td
                            key={i}
                            className={cn("border-b border-l text-center", m ? CELL[m].className : "text-muted-foreground/40")}
                          >
                            {m ? CELL[m].label : "·"}
                          </td>
                        ))}
                        <td className="border-b border-l text-center tabular-nums">{r.present}</td>
                        <td className="border-b border-l text-center tabular-nums">{r.late}</td>
                        <td className="border-b border-l text-center tabular-nums">{r.absent}</td>
                        <td
                          className={cn(
                            "border-b border-l px-1 text-center font-medium tabular-nums",
                            r.rate != null && r.rate < 75 && "text-red-600 dark:text-red-400",
                          )}
                        >
                          {r.rate ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                P present · L late (counted as attended) · A absent · bold dates are timetable days · rates under 75% are
                highlighted.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
