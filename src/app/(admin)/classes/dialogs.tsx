"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  type AcademicYearInput,
  academicYearSchema,
  type ClassLevelInput,
  classLevelSchema,
} from "@/lib/validations/academic";
import { deleteAcademicYear, deleteClassLevel, saveAcademicYear, saveClassLevel } from "./actions";

export function AcademicYearDialog({
  id,
  defaultValues,
  trigger,
}: {
  id?: string;
  defaultValues: AcademicYearInput;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<AcademicYearInput>({ resolver: zodResolver(academicYearSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: AcademicYearInput) {
    const result = await saveAcademicYear(id ?? null, values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaultValues);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{id ? "Edit academic year" : "Add academic year"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="ay-name" error={errors.name?.message} required>
            <Input id="ay-name" placeholder="e.g. 2027" {...form.register("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start date" htmlFor="ay-start" error={errors.startDate?.message} required>
              <Input id="ay-start" type="date" {...form.register("startDate")} />
            </Field>
            <Field label="End date" htmlFor="ay-end" error={errors.endDate?.message} required>
              <Input id="ay-end" type="date" {...form.register("endDate")} />
            </Field>
          </div>
          <Controller
            control={form.control}
            name="isCurrent"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(Boolean(c))} />
                Set as the current academic year
              </label>
            )}
          />
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

export function ClassLevelDialog({
  id,
  defaultValues,
  trigger,
}: {
  id?: string;
  defaultValues: ClassLevelInput;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<ClassLevelInput>({ resolver: zodResolver(classLevelSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ClassLevelInput) {
    const result = await saveClassLevel(id ?? null, values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset(defaultValues);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{id ? "Edit class" : "Add class"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="cl-name" error={errors.name?.message} required>
            <Input id="cl-name" placeholder="e.g. Class 9 or SSC" {...form.register("name")} />
          </Field>
          <Field label="Sort order" htmlFor="cl-order" error={errors.sortOrder?.message} hint="Lower numbers are listed first.">
            <Input id="cl-order" inputMode="numeric" {...form.register("sortOrder")} />
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

export function DeleteButton({ kind, id, name }: { kind: "year" | "class"; id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`}>
          <Trash2 className="text-destructive" />
        </Button>
      }
      title={`Delete ${name}?`}
      description="This can't be undone. It's blocked if anything still uses it."
      action={() => (kind === "year" ? deleteAcademicYear(id) : deleteClassLevel(id))}
      onDone={() => router.refresh()}
    />
  );
}
