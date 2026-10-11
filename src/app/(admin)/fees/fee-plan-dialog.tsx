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
import { FEE_TYPES } from "@/lib/constants";
import { type FeePlanInput, feePlanSchema } from "@/lib/validations/fees";
import { deleteFeePlan, saveFeePlan } from "./actions";

export function FeePlanDialog({
  id,
  defaultValues,
  batches,
  classes,
  trigger,
}: {
  id?: string;
  defaultValues: FeePlanInput;
  batches: Option[];
  classes: Option[];
  trigger: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const form = useForm<FeePlanInput>({ resolver: zodResolver(feePlanSchema), defaultValues });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: FeePlanInput) {
    const result = await saveFeePlan(id ?? null, values);
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
          <DialogTitle>{id ? "Edit fee plan" : "New fee plan"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="fp-name" error={errors.name?.message} required>
            <Input id="fp-name" placeholder="e.g. Admission fee" {...form.register("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type" htmlFor="fp-type">
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => <SelectField id="fp-type" value={field.value} onChange={field.onChange} options={FEE_TYPES} />}
              />
            </Field>
            <Field label="Amount" htmlFor="fp-amount" error={errors.amount?.message} required>
              <Input id="fp-amount" inputMode="decimal" {...form.register("amount")} />
            </Field>
            <Field label="For batch" htmlFor="fp-batch" hint="Optional, for reference">
              <Controller
                control={form.control}
                name="batchId"
                render={({ field }) => (
                  <SelectField id="fp-batch" value={field.value} onChange={field.onChange} options={batches} noneLabel="Any" placeholder="Any" />
                )}
              />
            </Field>
            <Field label="For class" htmlFor="fp-class" hint="Optional, for reference">
              <Controller
                control={form.control}
                name="classLevelId"
                render={({ field }) => (
                  <SelectField id="fp-class" value={field.value} onChange={field.onChange} options={classes} noneLabel="Any" placeholder="Any" />
                )}
              />
            </Field>
          </div>
          <Controller
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(Boolean(c))} />
                Active (can be charged)
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

export function DeleteFeePlan({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`}>
          <Trash2 className="text-destructive" />
        </Button>
      }
      title={`Delete ${name}?`}
      description="Only plans that were never charged can be deleted. Otherwise mark the plan inactive."
      action={() => deleteFeePlan(id)}
      onDone={() => router.refresh()}
    />
  );
}
