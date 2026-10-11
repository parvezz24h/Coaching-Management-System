import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney, parseDateInput, toDateInput, toNumber, todayISO } from "@/lib/format";
import { feeBalance, fromPaisa } from "@/lib/money";
import { FeeRowActions } from "../../fees/fee-row-actions";
import { requireAdmin } from "@/lib/session";
import { EnrollDialog } from "./enroll-dialog";
import { EnrollmentActions } from "./enrollment-actions";

export async function generateMetadata({ params }: PageProps<"/students/[id]">): Promise<Metadata> {
  const { id } = await params;
  const s = await db.student.findUnique({ where: { id }, select: { name: true } });
  return { title: s?.name ?? "Student" };
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || "—"}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export default async function StudentDetailPage({ params }: PageProps<"/students/[id]">) {
  await requireAdmin();
  const { id } = await params;

  const student = await db.student.findUnique({
    where: { id },
    include: {
      classLevel: true,
      enrollments: {
        orderBy: [{ status: "asc" }, { enrolledAt: "desc" }],
        include: {
          batch: {
            include: { subject: { select: { name: true } }, teacher: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!student) notFound();

  const [attendanceCounts, recentAttendance, fees, payments, marks, availableBatches, settings] = await Promise.all([
    db.attendance.groupBy({ by: ["status"], where: { studentId: id }, _count: true }),
    db.attendance.findMany({
      where: { studentId: id },
      orderBy: { date: "desc" },
      take: 30,
      include: { batch: { select: { name: true } } },
    }),
    db.studentFee.findMany({
      where: { studentId: id },
      orderBy: { dueDate: "desc" },
      include: { _count: { select: { allocations: true } } },
    }),
    db.payment.findMany({ where: { studentId: id }, orderBy: { paidAt: "desc" }, take: 50 }),
    db.mark.findMany({
      where: { studentId: id },
      orderBy: { examSubject: { exam: { startDate: "desc" } } },
      include: { examSubject: { include: { exam: { select: { id: true, name: true, status: true } }, subject: { select: { name: true } } } } },
    }),
    db.batch.findMany({
      where: {
        status: "ACTIVE",
        enrollments: { none: { studentId: id, status: "ACTIVE" } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    db.centerSettings.findUnique({ where: { id: "default" }, select: { currencySymbol: true } }),
  ]);

  const symbol = settings?.currencySymbol ?? "৳";
  const counts = Object.fromEntries(attendanceCounts.map((a) => [a.status, a._count]));
  const totalAttendance = (counts.PRESENT ?? 0) + (counts.LATE ?? 0) + (counts.ABSENT ?? 0);
  const today = parseDateInput(todayISO())!;
  const due = fromPaisa(fees.reduce((sum, f) => sum + feeBalance(f), 0));

  return (
    <>
      <PageHeader
        title={student.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{student.studentCode}</span>
            <StatusBadge status={student.status} />
          </span>
        }
        actions={
          <>
            <Link href={`/payments/new?student=${id}`} className={buttonVariants({ variant: "outline" })}>
              <Banknote /> Collect payment
            </Link>
            <Link href={`/students/${id}/edit`} className={buttonVariants({ variant: "outline" })}>
              <Pencil /> Edit
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Detail label="Class" value={student.classLevel?.name} />
              <Detail label="School / college" value={student.schoolName} />
              <Detail label="Admission date" value={formatDate(student.admissionDate)} />
              <Detail
                label="Gender"
                value={student.gender && student.gender[0] + student.gender.slice(1).toLowerCase()}
              />
              <Detail label="Date of birth" value={student.dateOfBirth && formatDate(student.dateOfBirth)} />
              <Detail label="Phone" value={student.phone} />
              <Detail label="Email" value={student.email} />
              <Detail label="Address" value={student.address} />
            </dl>
            {student.notes && (
              <p className="mt-4 rounded-md bg-muted/60 p-3 text-sm whitespace-pre-line">{student.notes}</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Guardian</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3">
                <Detail
                  label="Name"
                  value={`${student.guardianName}${student.guardianRelation ? ` (${student.guardianRelation})` : ""}`}
                />
                <Detail
                  label="Phone"
                  value={
                    <a href={`tel:${student.guardianPhone}`} className="text-primary hover:underline">
                      {student.guardianPhone}
                    </a>
                  }
                />
                <Detail label="Occupation" value={student.guardianOccupation} />
              </dl>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Attendance</p>
                <p className="text-xl font-semibold tabular-nums">
                  {totalAttendance
                    ? `${Math.round((((counts.PRESENT ?? 0) + (counts.LATE ?? 0)) / totalAttendance) * 100)}%`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding dues</p>
                <p className={`text-xl font-semibold tabular-nums ${Number(due) > 0 ? "text-destructive" : ""}`}>
                  {formatMoney(due, symbol)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Batches</CardTitle>
          <CardAction>
            <EnrollDialog
              studentId={id}
              batches={availableBatches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }))}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          {student.enrollments.length === 0 ? (
            <Empty>Not enrolled in any batch yet.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Batch</TableHead>
                  <TableHead className="hidden sm:table-cell">Teacher</TableHead>
                  <TableHead className="hidden md:table-cell">Schedule</TableHead>
                  <TableHead>Monthly fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.enrollments.map((e) => {
                  const fee = e.batch.monthlyFee != null ? toNumber(e.batch.monthlyFee) - toNumber(e.discount) : null;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        <span className="font-medium">{e.batch.name}</span>
                        <p className="text-xs text-muted-foreground">
                          {e.batch.subject?.name ?? e.batch.code} · since {formatDate(e.enrolledAt)}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{e.batch.teacher?.name ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">{e.batch.scheduleNote ?? "—"}</TableCell>
                      <TableCell>
                        {fee != null ? formatMoney(fee, symbol) : "—"}
                        {toNumber(e.discount) > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {formatMoney(e.discount, symbol)} discount
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={e.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        {e.status === "ACTIVE" && <EnrollmentActions enrollmentId={e.id} batchName={e.batch.name} />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="attendance">
            <TabsList>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
            </TabsList>

            <TabsContent value="attendance">
              {recentAttendance.length === 0 ? (
                <Empty>No attendance recorded yet.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentAttendance.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{formatDate(a.date)}</TableCell>
                        <TableCell>{a.batch.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={a.status === "ABSENT" ? "destructive" : "secondary"}
                            className="capitalize"
                          >
                            {a.status.toLowerCase()}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="fees">
              {fees.length === 0 ? (
                <Empty>No fees charged yet.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fee</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fees.map((f) => {
                      const overdue = (f.status === "UNPAID" || f.status === "PARTIAL") && f.dueDate < today;
                      return (
                      <TableRow key={f.id}>
                        <TableCell>{f.title}</TableCell>
                        <TableCell className={overdue ? "font-medium text-destructive" : undefined}>{formatDate(f.dueDate)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(toNumber(f.amount) - toNumber(f.discount), symbol)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(f.paidAmount, symbol)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(fromPaisa(feeBalance(f)), symbol)}</TableCell>
                        <TableCell>
                          <StatusBadge status={overdue ? "OVERDUE" : f.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <FeeRowActions
                            fee={{
                              id: f.id,
                              studentId: id,
                              title: f.title,
                              status: f.status,
                              amount: formatMoney(f.amount, symbol),
                              paid: f.paidAmount.toString(),
                              discount: f.discount.toString(),
                              dueDate: toDateInput(f.dueDate),
                              note: f.note ?? "",
                              hasPayments: f._count.allocations > 0,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="payments">
              {payments.length === 0 ? (
                <Empty>No payments recorded yet.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">
                          <Link href={`/payments/${p.id}`} className="hover:underline">
                            {p.receiptNo}
                          </Link>
                          {p.type === "REVERSAL" && (
                            <Badge variant="destructive" className="ml-2">
                              Reversal
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatDateTime(p.paidAt)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatMoney(p.amount, symbol)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="results">
              {marks.length === 0 ? (
                <Empty>No exam marks recorded yet.</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Marks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {marks.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <Link href={`/results/${m.examSubject.exam.id}/${id}`} className="hover:underline">
                            {m.examSubject.exam.name}
                          </Link>
                          {m.examSubject.exam.status === "DRAFT" && <span className="ml-1 text-xs text-muted-foreground">(draft)</span>}
                        </TableCell>
                        <TableCell>{m.examSubject.subject.name}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {m.isAbsent ? "Absent" : `${toNumber(m.obtained)} / ${toNumber(m.examSubject.fullMarks)}`}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
