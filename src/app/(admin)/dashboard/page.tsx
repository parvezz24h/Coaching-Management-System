import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CalendarCheck, Layers, UserRound, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { weekdayOf } from "@/lib/constants";
import { db } from "@/lib/db";
import {
  currentMonthRange,
  formatDate,
  formatMoney,
  formatTimeRange,
  parseDateInput,
  toNumber,
  todayISO,
} from "@/lib/format";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  href,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const body = (
    <Card className="h-full transition-colors hover:bg-muted/40">
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground sm:text-sm">{title}</p>
          <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
          {hint && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
          <Icon className="size-4.5" />
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function DashboardPage() {
  await requireAdmin();
  const today = parseDateInput(todayISO())!;
  const month = currentMonthRange();
  const weekday = weekdayOf(today);

  const [
    students,
    teachers,
    batches,
    attendance,
    collected,
    dues,
    overdueCount,
    recentStudents,
    todaysClasses,
    settings,
  ] = await Promise.all([
    db.student.count({ where: { status: "ACTIVE" } }),
    db.teacher.count({ where: { status: "ACTIVE" } }),
    db.batch.count({ where: { status: "ACTIVE" } }),
    db.attendance.groupBy({ by: ["status"], where: { date: today }, _count: true }),
    db.payment.aggregate({ where: { paidAt: { gte: month.start, lt: month.end } }, _sum: { amount: true } }),
    db.studentFee.aggregate({
      where: { status: { in: ["UNPAID", "PARTIAL"] } },
      _sum: { amount: true, discount: true, paidAmount: true },
    }),
    db.studentFee.count({ where: { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today } } }),
    db.student.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, studentCode: true, admissionDate: true, classLevel: { select: { name: true } } },
    }),
    db.classSession.findMany({
      where: { weekday, batch: { status: "ACTIVE" } },
      orderBy: { startTime: "asc" },
      include: { batch: { select: { name: true } }, subject: { select: { name: true } }, teacher: { select: { name: true } } },
    }),
    db.centerSettings.findUnique({ where: { id: "default" }, select: { currencySymbol: true } }),
  ]);

  const symbol = settings?.currencySymbol ?? "৳";
  const counts = Object.fromEntries(attendance.map((a) => [a.status, a._count]));
  const marked = (counts.PRESENT ?? 0) + (counts.ABSENT ?? 0) + (counts.LATE ?? 0);
  const attended = (counts.PRESENT ?? 0) + (counts.LATE ?? 0);
  const outstanding =
    toNumber(dues._sum.amount) - toNumber(dues._sum.discount) - toNumber(dues._sum.paidAmount);
  const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(today);

  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard title="Active students" value={String(students)} icon={Users} href="/students" />
        <StatCard title="Active teachers" value={String(teachers)} icon={UserRound} href="/teachers" />
        <StatCard title="Active batches" value={String(batches)} icon={Layers} href="/batches" />
        <StatCard
          title="Today's attendance"
          value={marked ? `${Math.round((attended / marked) * 100)}%` : "—"}
          hint={
            marked
              ? `${counts.PRESENT ?? 0} present · ${counts.LATE ?? 0} late · ${counts.ABSENT ?? 0} absent`
              : "Not taken yet today"
          }
          icon={CalendarCheck}
          href="/attendance"
        />
        <StatCard
          title={`Collected in ${monthName}`}
          value={formatMoney(collected._sum.amount, symbol)}
          hint="Cash payments, net of reversals"
          icon={Wallet}
          href="/payments"
        />
        <StatCard
          title="Outstanding dues"
          value={formatMoney(outstanding, symbol)}
          hint={overdueCount ? `${overdueCount} fee${overdueCount === 1 ? "" : "s"} past due date` : "Nothing overdue"}
          icon={AlertCircle}
          href="/fees"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent admissions</CardTitle>
            <CardDescription>The last five students registered</CardDescription>
          </CardHeader>
          <CardContent>
            {recentStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No students yet.{" "}
                <Link href="/students/new" className="text-primary hover:underline">
                  Register the first one
                </Link>
                .
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead className="hidden sm:table-cell">Class</TableHead>
                    <TableHead className="text-right">Admitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentStudents.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link href={`/students/${s.id}`} className="font-medium hover:underline">
                          {s.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{s.studentCode}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{s.classLevel?.name ?? "—"}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">{formatDate(s.admissionDate)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s classes</CardTitle>
            <CardDescription>From the weekly timetable</CardDescription>
          </CardHeader>
          <CardContent>
            {todaysClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground">No classes scheduled for today.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="hidden sm:table-cell">Teacher</TableHead>
                    <TableHead className="hidden sm:table-cell">Room</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todaysClasses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatTimeRange(c.startTime, c.endTime)}
                      </TableCell>
                      <TableCell>
                        {c.batch.name}
                        {c.subject && <p className="text-xs text-muted-foreground">{c.subject.name}</p>}
                        <p className="text-xs text-muted-foreground sm:hidden">
                          {[c.teacher?.name, c.room].filter(Boolean).join(" · ")}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{c.teacher?.name ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{c.room ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
