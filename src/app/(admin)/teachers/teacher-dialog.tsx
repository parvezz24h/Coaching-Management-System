"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/form-field";
import { applyActionErrors } from "@/components/form-utils";
import { type Option, SelectField } from "@/components/select-field";
import { type TeacherInput, teacherSchema } from "@/lib/validations/teacher";
import { saveTeacher } from "./actions";

export function TeacherDialog({
  teacherId,
  defaultValues,
  subjects,
  trigger,
}: {
  teacherId?: string;
  defaultValues: TeacherInput;
  subjects: Option[];
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<TeacherInput>({ resolver: zodResolver(teacherSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;
  const reg = form.register;

  async function onSubmit(values: TeacherInput) {
    const result = await saveTeacher(teacherId ?? null, values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    setOpen(false);
    if (!teacherId) form.reset(defaultValues);
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{teacherId ? "Edit teacher" : "Add teacher"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid max-h-[70vh] gap-4 overflow-y-auto p-0.5" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="t-name" error={errors.name?.message} required className="sm:col-span-2">
              <Input id="t-name" {...reg("name")} aria-invalid={!!errors.name} />
            </Field>
            <Field label="Phone" htmlFor="t-phone" error={errors.phone?.message} required>
              <Input id="t-phone" type="tel" {...reg("phone")} aria-invalid={!!errors.phone} />
            </Field>
            <Field label="Email" htmlFor="t-email" error={errors.email?.message}>
              <Input id="t-email" type="email" {...reg("email")} aria-invalid={!!errors.email} />
            </Field>
            <Field label="Qualification" htmlFor="t-qualification" error={errors.qualification?.message}>
              <Input id="t-qualification" placeholder="e.g. BSc in Physics" {...reg("qualification")} />
            </Field>
            <Field label="Joining date" htmlFor="t-joiningDate" error={errors.joiningDate?.message} required>
              <Input id="t-joiningDate" type="date" {...reg("joiningDate")} />
            </Field>
            <Field label="Status" htmlFor="t-status">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <SelectField
                    id="t-status"
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
            <Field label="Address" htmlFor="t-address" error={errors.address?.message}>
              <Input id="t-address" {...reg("address")} />
            </Field>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">Subjects taught</legend>
            <Controller
              control={form.control}
              name="subjectIds"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {subjects.map((s) => {
                    const checked = field.value.includes(s.value);
                    return (
                      <label key={s.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(c) =>
                            field.onChange(c ? [...field.value, s.value] : field.value.filter((v) => v !== s.value))
                          }
                        />
                        {s.label}
                      </label>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>

          <Field label="Notes" htmlFor="t-notes" error={errors.notes?.message}>
            <Textarea id="t-notes" rows={2} {...reg("notes")} />
          </Field>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {teacherId ? "Save changes" : "Add teacher"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
