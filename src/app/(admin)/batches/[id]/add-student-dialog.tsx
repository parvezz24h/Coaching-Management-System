"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
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
import { enrollStudent } from "../../students/actions";

export function AddStudentDialog({ batchId, students }: { batchId: string; students: Option[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const blank = { studentId: "", batchId, enrolledAt: todayISO(), discount: "" };
  const form = useForm<EnrollmentInput>({ resolver: zodResolver(enrollmentSchema), defaultValues: blank });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: EnrollmentInput) {
    const result = await enrollStudent(values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    form.reset(blank);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={students.length === 0} />}>
        <UserPlus /> Add student
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add student to batch</DialogTitle>
          <DialogDescription>Active students in this batch&apos;s class are listed first.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Student" htmlFor="studentId" error={errors.studentId?.message} required>
            <Controller
              control={form.control}
              name="studentId"
              render={({ field }) => (
                <SelectField
                  id="studentId"
                  value={field.value}
                  onChange={field.onChange}
                  options={students}
                  placeholder="Select student"
                  invalid={!!errors.studentId}
                />
              )}
            />
          </Field>
          <Field label="Enrollment date" htmlFor="enrolledAt" error={errors.enrolledAt?.message} required>
            <Input id="enrolledAt" type="date" {...form.register("enrolledAt")} />
          </Field>
          <Field label="Monthly discount" htmlFor="discount" error={errors.discount?.message}>
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
