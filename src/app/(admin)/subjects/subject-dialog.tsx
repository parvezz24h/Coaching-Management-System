"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { type SubjectInput, subjectSchema } from "@/lib/validations/academic";
import { deleteSubject, saveSubject } from "./actions";

export function SubjectDialog({
  id,
  defaultValues,
  trigger,
}: {
  id?: string;
  defaultValues: SubjectInput;
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<SubjectInput>({ resolver: zodResolver(subjectSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: SubjectInput) {
    const result = await saveSubject(id ?? null, values);
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
          <Field label="Name" htmlFor="sub-name" error={errors.name?.message} required>
            <Input id="sub-name" placeholder="e.g. Physics" {...form.register("name")} />
          </Field>
          <Field label="Code" htmlFor="sub-code" error={errors.code?.message} required hint="Short unique code, e.g. PHY">
            <Input id="sub-code" className="uppercase" {...form.register("code")} />
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

export function DeleteSubject({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`}>
          <Trash2 className="text-destructive" />
        </Button>
      }
      title={`Delete ${name}?`}
      description="It will be removed from teachers and batches that use it."
      action={() => deleteSubject(id)}
      onDone={() => router.refresh()}
    />
  );
}
