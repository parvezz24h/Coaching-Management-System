"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Field } from "@/components/form-field";
import { formatMoney } from "@/lib/format";
import { fromPaisa, toPaisa } from "@/lib/money";
import { cn } from "@/lib/utils";
import { collectPayment } from "../actions";

export type OpenFee = { id: string; title: string; dueDate: string; overdue: boolean; balance: string };

/** Spread a total across fees oldest first. */
function allocate(fees: OpenFee[], totalPaisa: number) {
  let left = totalPaisa;
  return Object.fromEntries(
    fees.map((f) => {
      const take = Math.min(left, toPaisa(f.balance));
      left -= take;
      return [f.id, take > 0 ? fromPaisa(take) : ""];
    }),
  );
}

export function CollectForm({
  studentId,
  fees,
  preselect,
  today,
  symbol,
}: {
  studentId: string;
  fees: OpenFee[];
  preselect?: string;
  today: string;
  symbol: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amounts, setAmounts] = useState<Record<string, string>>(() =>
    Object.fromEntries(fees.map((f) => [f.id, !preselect || f.id === preselect ? f.balance : ""])),
  );
  const [paidAt, setPaidAt] = useState(today);
  const [note, setNote] = useState("");
  const [received, setReceived] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const total = useMemo(
    () => fees.reduce((sum, f) => sum + (/^\d+(\.\d{1,2})?$/.test(amounts[f.id] ?? "") ? toPaisa(amounts[f.id]) : 0), 0),
    [fees, amounts],
  );
  const due = fees.reduce((sum, f) => sum + toPaisa(f.balance), 0);
  const change = received && /^\d+(\.\d{1,2})?$/.test(received) ? toPaisa(received) - total : null;

  function validate() {
    const errs: Record<string, string> = {};
    for (const f of fees) {
      const v = amounts[f.id]?.trim();
      if (!v) continue;
      if (!/^\d+(\.\d{1,2})?$/.test(v)) errs[f.id] = "Invalid amount";
      else if (toPaisa(v) > toPaisa(f.balance)) errs[f.id] = `Max ${formatMoney(f.balance, symbol)}`;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function submit() {
    if (!validate()) return;
    const allocations = fees
      .filter((f) => amounts[f.id]?.trim() && toPaisa(amounts[f.id]) > 0)
      .map((f) => ({ studentFeeId: f.id, amount: amounts[f.id].trim() }));
    if (allocations.length === 0) {
      toast.error("Enter an amount for at least one fee.");
      return;
    }
    startTransition(async () => {
      const result = await collectPayment({ studentId, paidAt, note, allocations });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.push(`/payments/${result.data!.id}`);
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
        <Field label="Quick fill — amount received" htmlFor="quick" hint="Spreads it over the oldest fees first">
          <Input
            id="quick"
            inputMode="decimal"
            className="w-44"
            placeholder={fromPaisa(due)}
            value={received}
            onChange={(e) => {
              setReceived(e.target.value);
              if (/^\d+(\.\d{1,2})?$/.test(e.target.value)) setAmounts(allocate(fees, Math.min(toPaisa(e.target.value), due)));
            }}
          />
        </Field>
        <Button variant="outline" size="sm" onClick={() => setAmounts(allocate(fees, due))}>
          Pay everything ({formatMoney(fromPaisa(due), symbol)})
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setAmounts({})}>
          Clear
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>Fee</TableHead>
            <TableHead className="hidden sm:table-cell">Due</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="w-36 text-right">Paying now</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fees.map((f) => {
            const checked = Boolean(amounts[f.id]?.trim());
            return (
              <TableRow key={f.id}>
                <TableCell>
                  <Checkbox
                    aria-label={`Pay ${f.title}`}
                    checked={checked}
                    onCheckedChange={(c) => setAmounts((a) => ({ ...a, [f.id]: c ? f.balance : "" }))}
                  />
                </TableCell>
                <TableCell>{f.title}</TableCell>
                <TableCell className={cn("hidden sm:table-cell", f.overdue && "font-medium text-destructive")}>{f.dueDate}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(f.balance, symbol)}</TableCell>
                <TableCell className="text-right">
                  <Input
                    inputMode="decimal"
                    aria-label={`Amount for ${f.title}`}
                    aria-invalid={!!errors[f.id] || undefined}
                    className="ml-auto h-8 w-32 text-right tabular-nums"
                    value={amounts[f.id] ?? ""}
                    onChange={(e) => setAmounts((a) => ({ ...a, [f.id]: e.target.value }))}
                  />
                  {errors[f.id] && <p className="mt-1 text-xs text-destructive">{errors[f.id]}</p>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <Field label="Payment date" htmlFor="paidAt">
          <Input id="paidAt" type="date" max={today} value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
        <Field label="Note" htmlFor="note">
          <Input id="note" placeholder="Optional, printed on the receipt" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Total cash received</p>
          <p className="text-2xl font-semibold tabular-nums">{formatMoney(fromPaisa(total), symbol)}</p>
          {change != null && change > 0 && (
            <p className="text-sm text-muted-foreground">Change to return: {formatMoney(fromPaisa(change), symbol)}</p>
          )}
        </div>
        <Button size="lg" onClick={submit} disabled={pending || total <= 0}>
          {pending ? <Loader2 className="animate-spin" /> : <Wallet />}
          Record payment &amp; print receipt
        </Button>
      </div>
    </div>
  );
}
