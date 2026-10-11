import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, UserSearch } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { db } from "@/lib/db";
import { formatDate, formatMoney, parseDateInput, todayISO } from "@/lib/format";
import { feeBalance, fromPaisa } from "@/lib/money";
import { param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { CollectForm } from "./collect-form";

export const metadata: Metadata = { title: "Collect payment" };

export default async function CollectPaymentPage({ searchParams }: PageProps<"/payments/new">) {
  await requireAdmin();
  const sp = await searchParams;
  const studentId = param(sp, "student");
  const settings = await db.centerSettings.findUnique({ where: { id: "default" }, select: { currencySymbol: true } });
  const symbol = settings?.currencySymbol ?? "৳";

  if (!studentId) return <PickStudent q={param(sp, "q")} symbol={symbol} />;

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: {
      classLevel: { select: { name: true } },
      fees: { where: { status: { in: ["UNPAID", "PARTIAL"] } }, orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!student) return <PickStudent q="" symbol={symbol} />;

  const today = todayISO();
  const todayDate = parseDateInput(today)!;
  const fees = student.fees.map((f) => ({
    id: f.id,
    title: f.title,
    dueDate: formatDate(f.dueDate),
    overdue: f.dueDate < todayDate,
    balance: fromPaisa(feeBalance(f)),
  }));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Collect payment"
        actions={
          <Link href="/payments/new" data-header="body" className={buttonVariants({ variant: "ghost" })}>
            <ArrowLeft /> Change student
          </Link>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>
            <Link href={`/students/${student.id}`} className="hover:underline">
              {student.name}
            </Link>
          </CardTitle>
          <CardDescription>
            <span className="font-mono">{student.studentCode}</span>
            {student.classLevel && ` · ${student.classLevel.name}`} · Guardian {student.guardianName} ({student.guardianPhone})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {fees.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing outstanding"
              description="This student has no unpaid fees. Charge a fee or generate tuition first."
              action={
                <Link href="/fees" className={buttonVariants({ variant: "outline" })}>
                  Go to fees
                </Link>
              }
            />
          ) : (
            <CollectForm studentId={student.id} fees={fees} preselect={param(sp, "fee") || undefined} today={today} symbol={symbol} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Student search; students who owe money are listed first. */
async function PickStudent({ q, symbol }: { q: string; symbol: string }) {
  const students = await db.student.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { studentCode: { contains: q, mode: "insensitive" } },
            { guardianPhone: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : { fees: { some: { status: { in: ["UNPAID", "PARTIAL"] } } } },
    take: 30,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      studentCode: true,
      guardianPhone: true,
      fees: { where: { status: { in: ["UNPAID", "PARTIAL"] } }, select: { amount: true, discount: true, paidAmount: true, status: true } },
    },
  });
  const rows = students
    .map((s) => ({ ...s, due: s.fees.reduce((sum, f) => sum + feeBalance(f), 0) }))
    .sort((a, b) => b.due - a.due || a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Collect payment" />
      <div className="mb-4">
        <SearchInput placeholder="Name, student ID or guardian phone" />
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title={q ? "No students found" : "Nobody owes anything right now"}
          description={q ? "Try a different name, ID or phone number." : "Search for a student above."}
        />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Student</TableHead>
                <TableHead className="hidden sm:table-cell">Guardian phone</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-4">
                    <span className="font-medium">{s.name}</span>
                    <p className="font-mono text-xs text-muted-foreground">{s.studentCode}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{s.guardianPhone}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.due ? formatMoney(fromPaisa(s.due), symbol) : "—"}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <Link href={`/payments/new?student=${s.id}`} className={buttonVariants({ size: "sm", variant: s.due ? "default" : "outline" })}>
                      Select
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
