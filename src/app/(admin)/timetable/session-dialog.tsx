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
import { type Option, SelectField } from "@/components/select-field";
import { WEEKDAY_LABELS, WEEKDAYS } from "@/lib/constants";
import { type ClassSessionInput, classSessionSchema } from "@/lib/validations/schedule";
import { deleteClassSession, saveClassSession } from "./actions";

export type BatchOption = Option & { subjectId: string; teacherId: string; room: string };

export function SessionDialog({
  id,
  defaultValues,
  batches,
  subjects,
  teachers,
  trigger,
}: {
  id?: string;
  defaultValues: ClassSessionInput;
  batches: BatchOption[];
  subjects: Option[];
  teachers: Option[];
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<ClassSessionInput>({ resolver: zodResolver(classSessionSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ClassSessionInput) {
    const result = await saveClassSession(id ?? null, values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    setOpen(false);
    router.refresh();
  }

  // Picking a batch fills in its usual subject, teacher and room when those are empty.
  function onBatchChange(batchId: string, set: (v: string) => void) {
    set(batchId);
    const b = batches.find((x) => x.value === batchId);
    if (!b) return;
    const { getValues, setValue } = form;
    if (!getValues("subjectId")) setValue("subjectId", b.subjectId);
    if (!getValues("teacherId")) setValue("teacherId", b.teacherId);
    if (!getValues("room")) setValue("room", b.room);
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{id ? "Edit class" : "Add class to timetable"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Batch" htmlFor="cs-batch" error={errors.batchId?.message} required>
            <Controller
              control={form.control}
              name="batchId"
              render={({ field }) => (
                <SelectField
                  id="cs-batch"
                  value={field.value}
                  onChange={(v) => onBatchChange(v, field.onChange)}
                  options={batches}
                  placeholder="Select batch"
                  invalid={!!errors.batchId}
                />
              )}
            />
          </Field>

          <Field label={id ? "Day" : "Days"} error={errors.weekdays?.message} required>
            <Controller
              control={form.control}
              name="weekdays"
              render={({ field }) =>
                id ? (
                  <SelectField
                    value={field.value[0] ?? ""}
                    onChange={(v) => field.onChange(v ? [v] : [])}
                    options={WEEKDAYS.map((d) => ({ value: d, label: WEEKDAY_LABELS[d] }))}
                  />
                ) : (
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {WEEKDAYS.map((d) => (
                      <label key={d} className="flex items-center gap-1.5 text-sm">
                        <Checkbox
                          checked={field.value.includes(d)}
                          onCheckedChange={(c) =>
                            field.onChange(c ? [...field.value, d] : field.value.filter((x) => x !== d))
                          }
                        />
                        {WEEKDAY_LABELS[d].slice(0, 3)}
                      </label>
                    ))}
                  </div>
                )
              }
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Starts" htmlFor="cs-start" error={errors.startTime?.message} required>
              <Input id="cs-start" type="time" {...form.register("startTime")} />
            </Field>
            <Field label="Ends" htmlFor="cs-end" error={errors.endTime?.message} required>
              <Input id="cs-end" type="time" {...form.register("endTime")} />
            </Field>
            <Field label="Subject" htmlFor="cs-subject">
              <Controller
                control={form.control}
                name="subjectId"
                render={({ field }) => (
                  <SelectField
                    id="cs-subject"
                    value={field.value}
                    onChange={field.onChange}
                    options={subjects}
                    noneLabel="None"
                    placeholder="None"
                  />
                )}
              />
            </Field>
            <Field label="Teacher" htmlFor="cs-teacher">
              <Controller
                control={form.control}
                name="teacherId"
                render={({ field }) => (
                  <SelectField
                    id="cs-teacher"
                    value={field.value}
                    onChange={field.onChange}
                    options={teachers}
                    noneLabel="Unassigned"
                    placeholder="Unassigned"
                  />
                )}
              />
            </Field>
            <Field label="Room" htmlFor="cs-room" error={errors.room?.message} className="col-span-2">
              <Input id="cs-room" placeholder="e.g. Room 2" {...form.register("room")} />
            </Field>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {id ? "Save changes" : "Add class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteSession({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-xs" aria-label={`Remove ${label}`}>
          <Trash2 className="text-destructive" />
        </Button>
      }
      title="Remove this class?"
      description={`${label} will be removed from the weekly timetable. Attendance already taken is kept.`}
      confirmLabel="Remove"
      action={() => deleteClassSession(id)}
      onDone={() => router.refresh()}
    />
  );
}
