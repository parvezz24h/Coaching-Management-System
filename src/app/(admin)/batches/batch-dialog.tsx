"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ConfirmAction } from "@/components/confirm-action";
import { Field } from "@/components/form-field";
import { applyActionErrors } from "@/components/form-utils";
import { type Option, SelectField } from "@/components/select-field";
import { type BatchInput, batchSchema } from "@/lib/validations/academic";
import { deleteBatch, saveBatch } from "./actions";

export type BatchOptions = {
  academicYears: Option[];
  classLevels: Option[];
  subjects: Option[];
  teachers: Option[];
};

export function BatchDialog({
  id,
  defaultValues,
  options,
  trigger,
}: {
  id?: string;
  defaultValues: BatchInput;
  options: BatchOptions;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<BatchInput>({ resolver: zodResolver(batchSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;
  const reg = form.register;

  async function onSubmit(values: BatchInput) {
    const result = await saveBatch(id ?? null, values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    setOpen(false);
    router.refresh();
  }

  const select = (name: "academicYearId" | "classLevelId" | "subjectId" | "teacherId", opts: Option[], noneLabel?: string) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <SelectField
          id={`b-${name}`}
          value={field.value}
          onChange={field.onChange}
          options={opts}
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{id ? "Edit batch" : "Create batch"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-h-[70vh] gap-4 overflow-y-auto p-0.5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Batch name" htmlFor="b-name" error={errors.name?.message} required>
              <Input id="b-name" placeholder="e.g. SSC Physics — Morning" {...reg("name")} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Code" htmlFor="b-code" error={errors.code?.message} required>
              <Input id="b-code" placeholder="SSC-PHY-M" className="uppercase" {...reg("code")} aria-invalid={!!errors.code} />
            </Field>
            <Field label="Academic year" htmlFor="b-academicYearId" error={errors.academicYearId?.message} required>
              {select("academicYearId", options.academicYears)}
            </Field>
            <Field label="Class" htmlFor="b-classLevelId" error={errors.classLevelId?.message} required>
              {select("classLevelId", options.classLevels)}
            </Field>
            <Field label="Subject" htmlFor="b-subjectId" hint="Leave empty for multi-subject batches.">
              {select("subjectId", options.subjects, "No single subject")}
            </Field>
            <Field label="Teacher" htmlFor="b-teacherId">
              {select("teacherId", options.teachers, "Unassigned")}
            </Field>
            <Field label="Monthly fee" htmlFor="b-monthlyFee" error={errors.monthlyFee?.message}>
              <Input id="b-monthlyFee" inputMode="decimal" placeholder="e.g. 1500" {...reg("monthlyFee")} />
            </Field>
            <Field label="Capacity" htmlFor="b-capacity" error={errors.capacity?.message}>
              <Input id="b-capacity" inputMode="numeric" placeholder="No limit" {...reg("capacity")} />
            </Field>
            <Field label="Room" htmlFor="b-room" error={errors.room?.message}>
              <Input id="b-room" placeholder="e.g. Room 2" {...reg("room")} />
            </Field>
            <Field label="Start date" htmlFor="b-startDate" error={errors.startDate?.message}>
              <Input id="b-startDate" type="date" {...reg("startDate")} />
            </Field>
            <Field
              label="Schedule"
              htmlFor="b-scheduleNote"
              error={errors.scheduleNote?.message}
              hint="A short summary. Exact weekly slots go in the timetable."
              className="sm:col-span-2"
            >
              <Input id="b-scheduleNote" placeholder="e.g. Sat, Mon, Wed · 4:00–5:30 PM" {...reg("scheduleNote")} />
            </Field>
            <Field label="Status" htmlFor="b-status">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <SelectField
                    id="b-status"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: "ACTIVE", label: "Active" },
                      { value: "INACTIVE", label: "Inactive" },
                    ]}
                  />
                )}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {id ? "Save changes" : "Create batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteBatch({ id, name, onDeleted }: { id: string; name: string; onDeleted?: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`}>
          <Trash2 className="text-destructive" />
        </Button>
      }
      title={`Delete ${name}?`}
      description="Only batches that never had students can be deleted. Otherwise, mark the batch inactive."
      action={() => deleteBatch(id)}
      onDone={() => (onDeleted ? router.push(onDeleted) : router.refresh())}
    />
  );
}
