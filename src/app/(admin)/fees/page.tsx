import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { SearchInput } from "@/components/search-input";
import { StatusBadge } from "@/components/status-badge";
import { UrlFilter } from "@/components/url-filter";
import type { Prisma } from "@/generated/prisma/client";
import { FEE_TYPES } from "@/lib/constants";
import { db } from "@/lib/db";
import { currentMonthISO, formatDate, formatMoney, parseDateInput, toDateInput, todayISO } from "@/lib/format";
import { feeBalance, feeNet, fromPaisa, toPaisa } from "@/lib/money";
import { pageParam, param, type SearchParams } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ChargeFeeDialog } from "./charge-fee-dialog";
import { DeleteFeePlan, FeePlanDialog } from "./fee-plan-dialog";
import { FeeRowActions } from "./fee-row-actions";
import { GenerateTuitionDialog } from "./generate-tuition-dialog";

export const metadata: Metadata = { title: "Fees & dues" };

const PAGE_SIZE = 25;
const STATUS_FILTERS = [
  { value: "OUTSTANDING", label: "Outstanding" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "WAIVED", label: "Waived" },
  { value: "ALL", label: "All charges" },
];

export default async function FeesPage({ searchParams }: PageProps<"/fees">) {
  await requireAdmin();
  const sp = await searchParams;
  const view = param(sp, "view") === "plans" ? "plans" : "dues";

  const [batches, classes, students, plans, settings] = await Promise.all([
    db.batch.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } }),
    db.classLevel.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.student.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" }, select: { id: true, name: true, studentCode: true } }),
    db.feePlan.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: {
        batch: { select: { name: true } },
        classLevel: { select: { name: true } },
        _count: { select: { studentFees: true } },
      },
    }),
    db.centerSettings.findUnique({ where: { id: "default" }, select: { currencySymbol: true } }),
  ]);
  const symbol = settings?.currencySymbol ?? "৳";
  const batchOptions = batches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }));
  const classOptions = classes.map((c) => ({ value: c.id, label: c.name }));
  const studentOptions = students.map((s) => ({ value: s.id, label: `${s.name} (${s.studentCode})` }));
  const planOptions = plans.filter((p) => p.isActive).map((p) => ({ value: p.id, label: `${p.name} — ${formatMoney(p.amount, symbol)}` }));

  return (
    <>
      <PageHeader
        title="Fees & dues"
        actions={
          <>
            <ChargeFeeDialog
              plans={planOptions}
              batches={batchOptions}
              classes={classOptions}
              students={studentOptions}
              defaultDueDate={todayISO()}
            />
            <GenerateTuitionDialog batches={batchOptions} defaultMonth={currentMonthISO()} symbol={symbol} />
          </>
        }
      />
      <nav className="mb-4 flex gap-1 border-b" aria-label="Fees sections">
        {[
          { key: "dues", label: "Dues & charges", href: "/fees" },
          { key: "plans", label: `Fee plans (${plans.length})`, href: "/fees?view=plans" },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={view === t.key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              view === t.key ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {view === "plans" ? (
        <PlansView plans={plans} batches={batchOptions} classes={classOptions} symbol={symbol} />
      ) : (
        <DuesView sp={sp} batches={batchOptions} symbol={symbol} />
      )}
    </>
  );
}

async function DuesView({ sp, batches, symbol }: { sp: SearchParams; batches: { value: string; label: string }[]; symbol: string }) {
  const q = param(sp, "q");
  const status = STATUS_FILTERS.some((s) => s.value === param(sp, "status")) ? param(sp, "status") : "OUTSTANDING";
  const batchId = param(sp, "batch");
  const page = pageParam(sp);
  const today = parseDateInput(todayISO())!;

  const statusWhere: Prisma.StudentFeeWhereInput =
    status === "OUTSTANDING"
      ? { status: { in: ["UNPAID", "PARTIAL"] } }
      : status === "OVERDUE"
        ? { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today } }
        : status === "ALL"
          ? {}
          : { status: status as "PAID" | "WAIVED" };
  const where: Prisma.StudentFeeWhereInput = {
    ...statusWhere,
    ...(batchId && { enrollment: { batchId } }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { student: { name: { contains: q, mode: "insensitive" } } },
        { student: { studentCode: { contains: q, mode: "insensitive" } } },
        { student: { guardianPhone: { contains: q } } },
      ],
    }),
  };
  const outstandingWhere: Prisma.StudentFeeWhereInput = { status: { in: ["UNPAID", "PARTIAL"] } };
  const sums = { amount: true, discount: true, paidAmount: true } as const;

  const [fees, total, outstanding, overdue, overdueStudents] = await Promise.all([
    db.studentFee.findMany({
      where,
      orderBy: [{ dueDate: status === "PAID" || status === "ALL" ? "desc" : "asc" }, { student: { name: "asc" } }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        student: { select: { id: true, name: true, studentCode: true, guardianPhone: true } },
        _count: { select: { allocations: true } },
      },
    }),
    db.studentFee.count({ where }),
    db.studentFee.aggregate({ where: outstandingWhere, _sum: sums, _count: true }),
    db.studentFee.aggregate({ where: { ...outstandingWhere, dueDate: { lt: today } }, _sum: sums, _count: true }),
    db.studentFee.groupBy({ by: ["studentId"], where: { ...outstandingWhere, dueDate: { lt: today } } }),
  ]);
  const balanceOf = (s: typeof outstanding._sum) => toPaisa(s.amount) - toPaisa(s.discount) - toPaisa(s.paidAmount);
  const filtered = Boolean(q || batchId || status !== "OUTSTANDING");
  const feeRow = (f: (typeof fees)[number]) => ({
    id: f.id,
    studentId: f.student.id,
    title: f.title,
    status: f.status,
    amount: formatMoney(f.amount, symbol),
    paid: f.paidAmount.toString(),
    discount: f.discount.toString(),
    dueDate: toDateInput(f.dueDate),
    note: f.note ?? "",
    hasPayments: f._count.allocations > 0,
  });

  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-base font-semibold tabular-nums sm:text-xl">{formatMoney(fromPaisa(balanceOf(outstanding._sum)), symbol)}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">{outstanding._count} unpaid or partly paid fees</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Overdue</p>
            <p className={cn("text-base font-semibold tabular-nums sm:text-xl", overdue._count > 0 && "text-destructive")}>
              {formatMoney(fromPaisa(balanceOf(overdue._sum)), symbol)}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              {overdue._count} fees · {overdueStudents.length} student{overdueStudents.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent>
            <p className="text-xs text-muted-foreground">Due later</p>
            <p className="text-base font-semibold tabular-nums sm:text-xl">
              {formatMoney(fromPaisa(balanceOf(outstanding._sum) - balanceOf(overdue._sum)), symbol)}
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">Not yet past due date</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Search student, ID, phone or fee" />
        <UrlFilter param="status" options={STATUS_FILTERS.filter((s) => s.value !== "OUTSTANDING")} allLabel="Outstanding" />
        <UrlFilter param="batch" options={batches} allLabel="All batches" />
      </div>

      {fees.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={filtered ? "No fees match these filters" : "No outstanding dues"}
          description={filtered ? undefined : "Use “Generate tuition” at the start of each month to bill students."}
        />
      ) : (
        <>
          <ul className="divide-y rounded-xl border bg-card md:hidden">
            {fees.map((f) => {
              const overdueRow = (f.status === "UNPAID" || f.status === "PARTIAL") && f.dueDate < today;
              return (
                <li key={f.id} className="flex items-start gap-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/students/${f.student.id}`} className="truncate font-medium hover:underline">
                        {f.student.name}
                      </Link>
                      <StatusBadge status={overdueRow ? "OVERDUE" : f.status} />
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{f.title}</p>
                    <p className={cn("text-xs text-muted-foreground", overdueRow && "font-medium text-destructive")}>
                      Due {formatDate(f.dueDate)}
                      {toPaisa(f.paidAmount) > 0 && ` · paid ${formatMoney(f.paidAmount, symbol)}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums">{formatMoney(fromPaisa(feeBalance(f)), symbol)}</p>
                    <p className="text-xs text-muted-foreground">balance</p>
                  </div>
                  <FeeRowActions fee={feeRow(f)} />
                </li>
              );
            })}
          </ul>
          <Card className="hidden py-0 md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Student</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead className="hidden md:table-cell">Due</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Amount</TableHead>
                  <TableHead className="hidden text-right lg:table-cell">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fees.map((f) => {
                  const overdueRow = (f.status === "UNPAID" || f.status === "PARTIAL") && f.dueDate < today;
                  return (
                    <TableRow key={f.id}>
                      <TableCell className="pl-4">
                        <Link href={`/students/${f.student.id}`} className="font-medium hover:underline">
                          {f.student.name}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">{f.student.studentCode}</p>
                      </TableCell>
                      <TableCell className="max-w-64">
                        <span className="line-clamp-2">{f.title}</span>
                        {toPaisa(f.discount) > 0 && (
                          <p className="hidden text-xs text-muted-foreground sm:block">{formatMoney(f.discount, symbol)} discount</p>
                        )}
                      </TableCell>
                      <TableCell className={cn("hidden md:table-cell", overdueRow && "font-medium text-destructive")}>
                        {formatDate(f.dueDate)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">
                        {formatMoney(fromPaisa(feeNet(f)), symbol)}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatMoney(f.paidAmount, symbol)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(fromPaisa(feeBalance(f)), symbol)}</TableCell>
                      <TableCell>
                        <StatusBadge status={overdueRow ? "OVERDUE" : f.status} />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <FeeRowActions fee={feeRow(f)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} searchParams={sp} />
        </>
      )}
    </>
  );
}

function PlansView({
  plans,
  batches,
  classes,
  symbol,
}: {
  plans: Array<
    Prisma.FeePlanGetPayload<{
      include: { batch: { select: { name: true } }; classLevel: { select: { name: true } }; _count: { select: { studentFees: true } } };
    }>
  >;
  batches: { value: string; label: string }[];
  classes: { value: string; label: string }[];
  symbol: string;
}) {
  const typeLabel = Object.fromEntries(FEE_TYPES.map((t) => [t.value, t.label]));
  const addButton = (
    <FeePlanDialog
      batches={batches}
      classes={classes}
      defaultValues={{ name: "", type: "ADMISSION", amount: "", batchId: "", classLevelId: "", isActive: true }}
      trigger={
        <Button size="sm">
          <Plus /> New fee plan
        </Button>
      }
    />
  );
  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Monthly tuition comes from each batch&apos;s monthly fee. Use plans for admission, exam and other fees.
        </p>
        {addButton}
      </div>
      {plans.length === 0 ? (
        <EmptyState icon={Wallet} title="No fee plans yet" description="Create plans such as Admission fee or Model test fee." action={addButton} />
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Plan</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden md:table-cell">Applies to</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Charged</TableHead>
                <TableHead className="pr-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id} className={cn(!p.isActive && "opacity-60")}>
                  <TableCell className="pl-4 font-medium">
                    {p.name}
                    {!p.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">(inactive)</span>}
                  </TableCell>
                  <TableCell>{typeLabel[p.type]}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(p.amount, symbol)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {[p.batch?.name, p.classLevel?.name].filter(Boolean).join(" · ") || "Anyone"}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{p._count.studentFees}</TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <FeePlanDialog
                        id={p.id}
                        batches={batches}
                        classes={classes}
                        defaultValues={{
                          name: p.name,
                          type: p.type,
                          amount: p.amount.toString(),
                          batchId: p.batchId ?? "",
                          classLevelId: p.classLevelId ?? "",
                          isActive: p.isActive,
                        }}
                        trigger={
                          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${p.name}`}>
                            <Pencil />
                          </Button>
                        }
                      />
                      <DeleteFeePlan id={p.id} name={p.name} />
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
