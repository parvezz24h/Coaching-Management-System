import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CalendarX, FileBarChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { UrlFilter } from "@/components/url-filter";
import { UrlInput } from "@/components/url-input";
import { getBatchRoster } from "@/lib/attendance";
import { WEEKDAY_LABELS, weekdayOf } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDate, formatTime, formatTimeRange, parseDateInput, todayISO } from "@/lib/format";
import { param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { AttendanceSheet } from "./attendance-sheet";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendancePage({ searchParams }: PageProps<"/attendance">) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const rawDate = param(sp, "date");
  const dateISO = parseDateInput(rawDate) ? rawDate : today;
  const date = parseDateInput(dateISO)!;
  const weekday = weekdayOf(date);
  const batchId = param(sp, "batch");

  const batches = await db.batch.findMany({
    where: { status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true },
  });
  const batchOptions = batches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }));

  const header = (
    <>
      <PageHeader
        title="Attendance"
        description={`${WEEKDAY_LABELS[weekday]}, ${formatDate(date)}`}
        actions={
          <Link
            href={`/attendance/report${batchId ? `?batch=${batchId}` : ""}`}
            className={buttonVariants({ variant: "outline" })}
          >
            <FileBarChart /> Monthly report
          </Link>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <UrlFilter param="batch" options={batchOptions} allLabel="All batches (overview)" />
        <UrlInput param="date" type="date" defaultValue={today} max={today} label="Attendance date" />
      </div>
    </>
  );

  if (dateISO > today) {
    return (
      <>
        {header}
        <EmptyState icon={CalendarX} title="That date is in the future" description="Pick today or an earlier date." />
      </>
    );
  }

  if (!batchId) return <>{header}<Overview date={date} dateISO={dateISO} weekday={weekday} /></>;

  const batch = await db.batch.findUnique({
    where: { id: batchId },
    include: { classSessions: { where: { weekday }, orderBy: { startTime: "asc" } } },
  });
  if (!batch) return <>{header}<EmptyState icon={CalendarX} title="Batch not found" /></>;

  const [roster, records] = await Promise.all([
    getBatchRoster(batchId, date),
    db.attendance.findMany({ where: { batchId, date }, select: { studentId: true, status: true } }),
  ]);
  const statusOf = new Map(records.map((r) => [r.studentId, r.status]));

  return (
    <>
      {header}
      <Card>
        <CardHeader>
          <CardTitle>{batch.name}</CardTitle>
          <CardDescription>
            {batch.classSessions.length > 0 ? (
              <>
                Scheduled{" "}
                {batch.classSessions.map((s) => formatTimeRange(s.startTime, s.endTime)).join(", ")}
              </>
            ) : (
              <span className="text-amber-600 dark:text-amber-400">
                No class on the timetable for {WEEKDAY_LABELS[weekday]}. You can still take attendance (e.g. an
                extra class).
              </span>
            )}
          </CardDescription>
          {batch.status !== "ACTIVE" && (
            <CardAction>
              <Badge variant="secondary">Inactive batch</Badge>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {roster.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No students were enrolled in this batch on {formatDate(date)}.{" "}
              <Link href={`/batches/${batch.id}`} className="text-primary hover:underline">
                Manage enrollments
              </Link>
            </p>
          ) : (
            <AttendanceSheet
              key={`${batchId}:${dateISO}`}
              batchId={batchId}
              date={dateISO}
              students={roster.map((s) => ({ ...s, status: statusOf.get(s.id) ?? "" }))}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** Every active batch for the day: whether it's scheduled and how far attendance has got. */
async function Overview({ date, dateISO, weekday }: { date: Date; dateISO: string; weekday: keyof typeof WEEKDAY_LABELS }) {
  const [batches, counts] = await Promise.all([
    db.batch.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      include: {
        classSessions: { where: { weekday }, orderBy: { startTime: "asc" } },
        teacher: { select: { name: true } },
        _count: {
          select: {
            enrollments: {
              where: { enrolledAt: { lte: date }, OR: [{ status: "ACTIVE" }, { endedAt: { gte: date } }] },
            },
          },
        },
      },
    }),
    db.attendance.groupBy({ by: ["batchId", "status"], where: { date }, _count: true }),
  ]);

  if (batches.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="No active batches"
        description="Create batches and enroll students to start taking attendance."
      />
    );
  }

  const tally = (batchId: string, status: string) =>
    counts.find((c) => c.batchId === batchId && c.status === status)?._count ?? 0;
  // Scheduled batches first, in timetable order.
  const sorted = [...batches].sort((a, b) => {
    const at = a.classSessions[0]?.startTime ?? "99";
    const bt = b.classSessions[0]?.startTime ?? "99";
    return at.localeCompare(bt) || a.name.localeCompare(b.name);
  });

  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Batch</TableHead>
            <TableHead className="hidden sm:table-cell">Class time</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead className="hidden md:table-cell">Present · Late · Absent</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((b) => {
            const present = tally(b.id, "PRESENT");
            const late = tally(b.id, "LATE");
            const absent = tally(b.id, "ABSENT");
            const marked = present + late + absent;
            const total = Math.max(b._count.enrollments, marked);
            const done = total > 0 && marked >= total;
            return (
              <TableRow key={b.id}>
                <TableCell className="pl-4">
                  <span className="font-medium">{b.name}</span>
                  <p className="text-xs text-muted-foreground">{b.teacher?.name ?? b.code}</p>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  {b.classSessions.length ? (
                    b.classSessions.map((s) => formatTime(s.startTime)).join(", ")
                  ) : (
                    <span className="text-muted-foreground">Not scheduled</span>
                  )}
                </TableCell>
                <TableCell>
                  {total === 0 ? (
                    <span className="text-muted-foreground">No students</span>
                  ) : done ? (
                    <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Done</Badge>
                  ) : (
                    <span className="tabular-nums">
                      {marked} / {total}
                    </span>
                  )}
                </TableCell>
                <TableCell className="hidden tabular-nums md:table-cell">
                  {marked ? `${present} · ${late} · ${absent}` : "—"}
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <Link
                    href={`/attendance?batch=${b.id}&date=${dateISO}`}
                    className={buttonVariants({ variant: done ? "ghost" : "outline", size: "sm" })}
                  >
                    {done ? "Review" : "Take attendance"}
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
