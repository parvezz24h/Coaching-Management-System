"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Ban, Banknote, Loader2, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-action";
import { Field } from "@/components/form-field";
import { applyActionErrors } from "@/components/form-utils";
import { type AdjustFeeInput, adjustFeeSchema } from "@/lib/validations/fees";
import { adjustFee, deleteFee, setFeeWaived } from "./actions";

export type FeeRow = {
  id: string;
  studentId: string;
  title: string;
  status: string;
  amount: string;
  discount: string;
  paid: string;
  dueDate: string;
  note: string;
  hasPayments: boolean;
};

export function FeeRowActions({ fee }: { fee: FeeRow }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "adjust" | "waive" | "reinstate" | "delete">(null);
  const close = (open: boolean) => !open && setDialog(null);
  const outstanding = fee.status === "UNPAID" || fee.status === "PARTIAL";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${fee.title}`} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {outstanding && (
            <DropdownMenuItem render={<Link href={`/payments/new?student=${fee.studentId}&fee=${fee.id}`} />}>
              <Banknote /> Collect payment
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setDialog("adjust")}>
            <Pencil /> Discount / due date
          </DropdownMenuItem>
          {outstanding && (
            <DropdownMenuItem onClick={() => setDialog("waive")}>
              <Ban /> Waive balance
            </DropdownMenuItem>
          )}
          {fee.status === "WAIVED" && (
            <DropdownMenuItem onClick={() => setDialog("reinstate")}>
              <RotateCcw /> Reinstate
            </DropdownMenuItem>
          )}
          {!fee.hasPayments && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDialog("delete")}>
                <Trash2 /> Remove charge
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AdjustFeeDialog fee={fee} open={dialog === "adjust"} onOpenChange={close} onDone={() => router.refresh()} />
      <ConfirmDialog
        open={dialog === "waive"}
        onOpenChange={close}
        title="Waive the remaining balance?"
        description={`Nothing more will be owed for "${fee.title}". Amounts already paid are kept. You can reinstate it later.`}
        confirmLabel="Waive"
        action={() => setFeeWaived(fee.id, true)}
        onDone={() => router.refresh()}
      />
      <ConfirmDialog
        open={dialog === "reinstate"}
        onOpenChange={close}
        title="Reinstate this fee?"
        description={`"${fee.title}" will be owed again.`}
        confirmLabel="Reinstate"
        destructive={false}
        action={() => setFeeWaived(fee.id, false)}
        onDone={() => router.refresh()}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={close}
        title="Remove this charge?"
        description={`"${fee.title}" will be deleted. Use this only for charges created by mistake.`}
        confirmLabel="Remove"
        action={() => deleteFee(fee.id)}
        onDone={() => router.refresh()}
      />
    </>
  );
}

function AdjustFeeDialog({
  fee,
  open,
  onOpenChange,
  onDone,
}: {
  fee: FeeRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const defaults = { discount: fee.discount, dueDate: fee.dueDate, note: fee.note };
  const form = useForm<AdjustFeeInput>({ resolver: zodResolver(adjustFeeSchema), defaultValues: defaults });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: AdjustFeeInput) {
    const result = await adjustFee(fee.id, values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) form.reset(defaults);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust fee</DialogTitle>
          <DialogDescription>
            {fee.title} · amount {fee.amount}
            {Number(fee.paid) > 0 && ` · ${fee.paid} paid`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Discount" htmlFor="af-discount" error={errors.discount?.message}>
              <Input id="af-discount" inputMode="decimal" {...form.register("discount")} />
            </Field>
            <Field label="Due date" htmlFor="af-due" error={errors.dueDate?.message}>
              <Input id="af-due" type="date" {...form.register("dueDate")} />
            </Field>
          </div>
          <Field label="Note" htmlFor="af-note" error={errors.note?.message}>
            <Input id="af-note" placeholder="Why it changed (optional)" {...form.register("note")} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
