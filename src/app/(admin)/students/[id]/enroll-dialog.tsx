"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import { applyActionErrors } from "@/components/form-utils";
import { type Option, SelectField } from "@/components/select-field";
import { todayISO } from "@/lib/format";
import { type EnrollmentInput, enrollmentSchema } from "@/lib/validations/student";
import { enrollStudent } from "../actions";

export function EnrollDialog({ studentId, batches }: { studentId: string; batches: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<EnrollmentInput>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: { studentId, batchId: "", enrolledAt: todayISO(), discount: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: EnrollmentInput) {
    const result = await enrollStudent(values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    setOpen(false);
    form.reset({ studentId, batchId: "", enrolledAt: todayISO(), discount: "" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={batches.length === 0} />}>
        <Plus /> Enroll in batch
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enroll in batch</DialogTitle>
          <DialogDescription>Only active batches the student isn&apos;t already in are listed.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Batch" htmlFor="batchId" error={errors.batchId?.message} required>
            <Controller
              control={form.control}
              name="batchId"
              render={({ field }) => (
                <SelectField
                  id="batchId"
                  value={field.value}
                  onChange={field.onChange}
                  options={batches}
                  placeholder="Select batch"
                  invalid={!!errors.batchId}
                />
              )}
            />
          </Field>
          <Field label="Enrollment date" htmlFor="enrolledAt" error={errors.enrolledAt?.message} required>
            <Input id="enrolledAt" type="date" {...form.register("enrolledAt")} />
          </Field>
          <Field
            label="Monthly discount"
            htmlFor="discount"
            error={errors.discount?.message}
            hint="Flat amount taken off this batch's monthly fee."
          >
            <Input id="discount" inputMode="decimal" placeholder="0" {...form.register("discount")} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Enroll
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
