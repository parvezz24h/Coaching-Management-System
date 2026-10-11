"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { type ExamInput, examSchema } from "@/lib/validations/exams";
import { saveExam } from "./actions";

export function ExamDialog({
  id,
  defaultValues,
  academicYears,
  classLevels,
  batches,
  trigger,
}: {
  id?: string;
  defaultValues: ExamInput;
  academicYears: Option[];
  classLevels: Option[];
  batches: Option[];
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<ExamInput>({ resolver: zodResolver(examSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ExamInput) {
    const result = await saveExam(id ?? null, values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    setOpen(false);
    if (id) router.refresh();
    else router.push(`/exams/${result.data!.id}`);
  }

  const select = (name: "academicYearId" | "classLevelId" | "batchId", options: Option[], noneLabel?: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <SelectField
          id={`ex-${name}`}
          value={field.value}
          onChange={field.onChange}
          options={options}
          noneLabel={noneLabel}
          placeholder={noneLabel ?? "Select…"}
          invalid={!!errors[name]}
        />
      )}
    />
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaultValues);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{id ? "Edit exam" : "New exam"}</DialogTitle>
          <DialogDescription>
            Candidates are the batch&apos;s students, or every active student in the class if no batch is chosen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Exam name" htmlFor="ex-name" error={errors.name?.message} required>
            <Input id="ex-name" placeholder="e.g. Monthly Test — October" {...form.register("name")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Batch" htmlFor="ex-batchId" error={errors.batchId?.message}>
              {select("batchId", batches, "No batch (whole class)")}
            </Field>
            <Field label="Class" htmlFor="ex-classLevelId" hint="Used when no batch is chosen">
              {select("classLevelId", classLevels, "None")}
            </Field>
            <Field label="Academic year" htmlFor="ex-academicYearId" error={errors.academicYearId?.message} required>
              {select("academicYearId", academicYears)}
            </Field>
            <div />
            <Field label="Starts" htmlFor="ex-start" error={errors.startDate?.message} required>
              <Input id="ex-start" type="date" {...form.register("startDate")} />
            </Field>
            <Field label="Ends" htmlFor="ex-end" error={errors.endDate?.message}>
              <Input id="ex-end" type="date" {...form.register("endDate")} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {id ? "Save changes" : "Create exam"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
