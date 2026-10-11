import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Receipt } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/status-badge";
import { UrlFilter } from "@/components/url-filter";
import { UrlInput } from "@/components/url-input";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { currentMonthISO, formatDateTime, formatMoney, parseDateInput, todayISO } from "@/lib/format";
import { fromPaisa, toPaisa } from "@/lib/money";
import { pageParam, param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const PAGE_SIZE = 25;

export default async function PaymentsPage({ searchParams }: PageProps<"/payments">) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayISO();
  const from = parseDateInput(param(sp, "from")) ? param(sp, "from") : `${currentMonthISO()}-01`;
  const to = parseDateInput(param(sp, "to")) ? param(sp, "to") : today;
  const q = param(sp, "q");
  const type = param(sp, "type");
  const page = pageParam(sp);

  // Dates are calendar days in the center's timezone (UTC+6).
  const where: Prisma.PaymentWhereInput = {
    paidAt: { gte: new Date(`${from}T00:00:00+06:00`), lte: new Date(`${to}T23:59:59.999+06:00`) },
    ...((type === "PAYMENT" || type === "REVERSAL") && { type }),
    ...(q && {
      OR: [
        { receiptNo: { contains: q, mode: "insensitive" } },
        { student: { name: { contains: q, mode: "insensitive" } } },
        { student: { studentCode: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };
  const [payments, total, byType, settings] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        student: { select: { id: true, name: true, studentCode: true } },
        reversedBy: { select: { receiptNo: true } },
        receivedBy: { select: { name: true } },
        _count: { select: { allocations: true } },
      },
    }),
    db.payment.count({ where }),
    db.payment.groupBy({ by: ["type"], where: { paidAt: where.paidAt }, _sum: { amount: true }, _count: true }),
    db.centerSettings.findUnique({ where: { id: "default" }, select: { currencySymbol: true } }),
  ]);
  const symbol = settings?.currencySymbol ?? "৳";
  const sumOf = (t: string) => toPaisa(byType.find((b) => b.type === t)?._sum.amount);
  const countOf = (t: string) => byType.find((b) => b.type === t)?._count ?? 0;

  return (
    <>
      <PageHeader
        title="Payments"
        actions={
          <Link href="/payments/new" className={buttonVariants()}>
            <Plus /> Collect payment
          </Link>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Receipt no., student or ID" />
        <UrlInput param="from" type="date" defaultValue={from} max={today} label="From date" />
        <span className="hidden text-sm text-muted-foreground sm:inline">to</span>
        <UrlInput param="to" type="date" defaultValue={to} max={today} label="To date" />
        <UrlFilter
          param="type"
          options={[
            { value: "PAYMENT", label: "Payments" },
            { value: "REVERSAL", label: "Reversals" },
          ]}
          allLabel="All types"
        />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Collected</p>
            <p className="text-base font-semibold tabular-nums sm:text-xl">{formatMoney(fromPaisa(sumOf("PAYMENT")), symbol)}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">{countOf("PAYMENT")} receipts</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Reversed</p>
            <p className={cn("text-base font-semibold tabular-nums sm:text-xl", countOf("REVERSAL") > 0 && "text-destructive")}>
              {formatMoney(fromPaisa(sumOf("REVERSAL")), symbol)}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">{countOf("REVERSAL")} reversals</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Net cash</p>
            <p className="text-base font-semibold tabular-nums sm:text-xl">{formatMoney(fromPaisa(sumOf("PAYMENT") + sumOf("REVERSAL")), symbol)}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">For the selected dates</p>
          </CardContent>
        </Card>
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={Receipt} title="No payments in this period" description="Collected payments will appear here." />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card md:hidden">
            {payments.map((p) => (
              <li key={p.id}>
                <Link href={`/payments/${p.id}`} className="flex items-center gap-3 p-3 active:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.student.name}</p>
                    <p className={cn("font-mono text-xs text-muted-foreground", p.reversedBy && "line-through")}>{p.receiptNo}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(p.paidAt)}
                      {p.reversedBy && " · reversed"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("font-semibold tabular-nums", p.type === "REVERSAL" && "text-destructive", p.reversedBy && "text-muted-foreground line-through")}>
                      {formatMoney(p.amount, symbol)}
                    </p>
                    {p.type === "REVERSAL" && <StatusBadge status="REVERSAL" />}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Receipt</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Received by</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="pr-4">Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id} className={cn("relative cursor-pointer", p.reversedBy && "text-muted-foreground")}>
                    <TableCell className="pl-4">
                      <Link href={`/payments/${p.id}`} className={cn("font-mono text-xs font-medium hover:underline after:absolute after:inset-0 after:content-['']", p.reversedBy && "line-through")}>
                        {p.receiptNo}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {p._count.allocations} fee{p._count.allocations === 1 ? "" : "s"}
                        {p.reversedBy && ` · reversed by ${p.reversedBy.receiptNo}`}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Link href={`/students/${p.student.id}`} className="relative z-10 hover:underline">
                        {p.student.name}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{p.student.studentCode}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{formatDateTime(p.paidAt)}</TableCell>
                    <TableCell className="hidden lg:table-cell">{p.receivedBy?.name ?? "—"}</TableCell>
                    <TableCell className={cn("text-right font-medium tabular-nums", p.type === "REVERSAL" && "text-destructive")}>
                      {formatMoney(p.amount, symbol)}
                    </TableCell>
                    <TableCell className="pr-4">
                      <StatusBadge status={p.type} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} searchParams={sp} />
        </>
      )}
    </>
  );
}
