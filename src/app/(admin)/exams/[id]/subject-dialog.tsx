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
import { type ExamSubjectInput, examSubjectSchema } from "@/lib/validations/exams";
import { deleteExamSubject, saveExamSubject } from "../actions";

export function ExamSubjectDialog({
  examId,
  id,
  defaultValues,
  subjects,
  trigger,
}: {
  examId: string;
  id?: string;
  defaultValues: ExamSubjectInput;
  subjects: Option[];
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<ExamSubjectInput>({ resolver: zodResolver(examSubjectSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ExamSubjectInput) {
    const result = await saveExamSubject(examId, id ?? null, values);
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
          <DialogTitle>{id ? "Edit subject" : "Add subject"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Subject" htmlFor="es-subject" error={errors.subjectId?.message} required>
            <Controller
              control={form.control}
              name="subjectId"
              render={({ field }) => (
                <SelectField id="es-subject" value={field.value} onChange={field.onChange} options={subjects} placeholder="Select subject" invalid={!!errors.subjectId} />
              )}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Full marks" htmlFor="es-full" error={errors.fullMarks?.message} required>
              <Input id="es-full" inputMode="decimal" {...form.register("fullMarks")} />
            </Field>
            <Field label="Pass marks" htmlFor="es-pass" error={errors.passMarks?.message} required>
              <Input id="es-pass" inputMode="decimal" {...form.register("passMarks")} />
            </Field>
            <Field label="Date" htmlFor="es-date" error={errors.examDate?.message} className="col-span-2 sm:col-span-1">
              <Input id="es-date" type="date" {...form.register("examDate")} />
            </Field>
          </div>
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

export function DeleteExamSubject({ examId, id, name, marks }: { examId: string; id: string; name: string; marks: number }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${name}`}>
          <Trash2 className="text-destructive" />
        </Button>
      }
      title={`Remove ${name} from this exam?`}
      description={marks ? `This also deletes the ${marks} mark(s) already entered for it.` : "No marks have been entered for it yet."}
      confirmLabel="Remove"
      action={() => deleteExamSubject(examId, id)}
      onDone={() => router.refresh()}
    />
  );
}
