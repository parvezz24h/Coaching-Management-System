"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/form-field";
import { applyActionErrors } from "@/components/form-utils";
import { type ReversePaymentInput, reversePaymentSchema } from "@/lib/validations/fees";
import { reversePayment } from "../actions";

export function ReverseDialog({ paymentId, receiptNo, amount }: { paymentId: string; receiptNo: string; amount: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<ReversePaymentInput>({
    resolver: zodResolver(reversePaymentSchema),
    defaultValues: { paymentId, reason: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ReversePaymentInput) {
    const result = await reversePayment(values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="destructive" className="print:hidden" />}>
        <Undo2 /> Reverse
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reverse receipt {receiptNo}?</DialogTitle>
          <DialogDescription>
            Payments are never deleted. This records a reversal of {amount} with its own receipt number, and the fees
            it paid become due again. It can&apos;t be undone — record a new payment instead if needed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Reason" htmlFor="rev-reason" error={errors.reason?.message} required>
            <Textarea id="rev-reason" rows={3} placeholder="e.g. Entered against the wrong student" {...form.register("reason")} />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Reverse payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
