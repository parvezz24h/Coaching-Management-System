import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { PrintButton } from "@/components/print-button";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { amountInWords, toPaisa } from "@/lib/money";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { ReverseDialog } from "./reverse-dialog";

export async function generateMetadata({ params }: PageProps<"/payments/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = await db.payment.findUnique({ where: { id }, select: { receiptNo: true } });
  return { title: p ? `Receipt ${p.receiptNo}` : "Receipt" };
}

export default async function ReceiptPage({ params }: PageProps<"/payments/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const [payment, settings] = await Promise.all([
    db.payment.findUnique({
      where: { id },
      include: {
        student: { include: { classLevel: { select: { name: true } } } },
        allocations: { include: { studentFee: { select: { title: true, dueDate: true } } }, orderBy: { studentFee: { dueDate: "asc" } } },
        receivedBy: { select: { name: true } },
        reversalOf: { select: { id: true, receiptNo: true } },
        reversedBy: { select: { id: true, receiptNo: true, paidAt: true, note: true } },
      },
    }),
    db.centerSettings.findUnique({ where: { id: "default" } }),
  ]);
  if (!payment) notFound();

  const symbol = settings?.currencySymbol ?? "৳";
  const isReversal = payment.type === "REVERSAL";
  const amountPaisa = toPaisa(payment.amount);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="print:hidden">
        <PageHeader
          title={isReversal ? "Reversal" : "Payment receipt"}
          actions={
            <>
              <Link href="/payments" data-header="desktop" className={buttonVariants({ variant: "ghost" })}>
                <ArrowLeft /> Payments
              </Link>
              <PrintButton label="Print receipt" />
              {!isReversal && !payment.reversedBy && (
                <ReverseDialog paymentId={payment.id} receiptNo={payment.receiptNo} amount={formatMoney(payment.amount, symbol)} />
              )}
            </>
          }
        />
        {payment.reversedBy && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Reversed on {formatDateTime(payment.reversedBy.paidAt)} by{" "}
            <Link href={`/payments/${payment.reversedBy.id}`} className="font-medium underline">
              {payment.reversedBy.receiptNo}
            </Link>
            {payment.reversedBy.note && ` — ${payment.reversedBy.note}`}
          </p>
        )}
      </div>

      <article className="relative overflow-hidden rounded-xl border bg-card p-6 text-sm sm:p-8 print:rounded-none print:border-0 print:p-0">
        {(payment.reversedBy || isReversal) && (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 text-6xl font-black tracking-widest text-destructive/10 sm:text-7xl">
              {isReversal ? "REVERSAL" : "REVERSED"}
            </span>
          </div>
        )}
        <header className="flex flex-col gap-1 border-b pb-4 text-center">
          <h2 className="text-lg font-semibold">{settings?.name ?? "Coaching Center"}</h2>
          {settings?.address && <p className="text-muted-foreground">{settings.address}</p>}
          {(settings?.phone || settings?.email) && (
            <p className="text-muted-foreground">{[settings?.phone, settings?.email].filter(Boolean).join(" · ")}</p>
          )}
          <p className="mt-2 text-xs font-semibold tracking-widest uppercase">{isReversal ? "Payment reversal" : "Money receipt"}</p>
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 py-4">
          <div>
            <dt className="text-xs text-muted-foreground">Receipt no.</dt>
            <dd className="font-mono font-medium">{payment.receiptNo}</dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-muted-foreground">Date</dt>
            <dd>{formatDateTime(payment.paidAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Student</dt>
            <dd className="font-medium">{payment.student.name}</dd>
            <dd className="font-mono text-xs text-muted-foreground">{payment.student.studentCode}</dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-muted-foreground">Guardian</dt>
            <dd>{payment.student.guardianName}</dd>
            <dd className="text-xs text-muted-foreground">{payment.student.guardianPhone}</dd>
          </div>
          {payment.reversalOf && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Reverses receipt</dt>
              <dd>
                <Link href={`/payments/${payment.reversalOf.id}`} className="font-mono hover:underline">
                  {payment.reversalOf.receiptNo}
                </Link>
              </dd>
            </div>
          )}
        </dl>

        <table className="w-full border-y text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 font-medium">Due date</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {payment.allocations.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="py-2">{a.studentFee.title}</td>
                <td className="py-2 pl-2 whitespace-nowrap text-muted-foreground">{formatDate(a.studentFee.dueDate)}</td>
                <td className="py-2 pl-2 text-right whitespace-nowrap tabular-nums">{formatMoney(a.amount, symbol)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t font-semibold">
              <td className="py-2" colSpan={2}>
                {isReversal ? "Total reversed" : "Total paid (cash)"}
              </td>
              <td className={cn("py-2 text-right text-base tabular-nums", isReversal && "text-destructive")}>
                {formatMoney(payment.amount, symbol)}
              </td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-xs text-muted-foreground">In words: {amountInWords(amountPaisa)}</p>
        {payment.note && <p className="mt-3 text-sm">Note: {payment.note}</p>}

        <footer className="mt-12 flex items-end justify-between text-xs text-muted-foreground">
          <p>Received by {payment.receivedBy?.name ?? "—"}</p>
          <p className="border-t border-foreground/40 px-6 pt-1">Authorised signature</p>
        </footer>
      </article>
    </div>
  );
}
