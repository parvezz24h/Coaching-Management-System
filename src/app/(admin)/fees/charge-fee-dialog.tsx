"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Receipt } from "lucide-react";
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
import { type ChargeFeeInput, chargeFeeSchema } from "@/lib/validations/fees";
import { chargeFeePlan } from "./actions";

export function ChargeFeeDialog({
  plans,
  batches,
  classes,
  students,
  defaultDueDate,
  defaults,
  trigger,
}: {
  plans: Option[];
  batches: Option[];
  classes: Option[];
  students: Option[];
  defaultDueDate: string;
  defaults?: Partial<ChargeFeeInput>;
  trigger?: React.ReactElement;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const initial: ChargeFeeInput = {
    feePlanId: "",
    scope: "batch",
    targetId: "",
    dueDate: defaultDueDate,
    period: "",
    ...defaults,
  };
  const form = useForm<ChargeFeeInput>({ resolver: zodResolver(chargeFeeSchema), defaultValues: initial });
  const { errors, isSubmitting } = form.formState;
  const scope = useWatch({ control: form.control, name: "scope" });
  const targets = scope === "batch" ? batches : scope === "class" ? classes : students;

  async function onSubmit(values: ChargeFeeInput) {
    const result = await chargeFeePlan(values);
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
        if (o) form.reset(initial);
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button variant="outline" disabled={plans.length === 0}>
              <Receipt /> Charge fee
            </Button>
          )
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Charge a fee</DialogTitle>
          <DialogDescription>
            Bill an admission, exam or other fee plan to a batch, a class or one student. Students already charged
            the same plan for the same period are skipped.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Fee plan" htmlFor="cf-plan" error={errors.feePlanId?.message} required>
            <Controller
              control={form.control}
              name="feePlanId"
              render={({ field }) => (
                <SelectField id="cf-plan" value={field.value} onChange={field.onChange} options={plans} placeholder="Select plan" invalid={!!errors.feePlanId} />
              )}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
            <Field label="Charge to" htmlFor="cf-scope">
              <Controller
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <SelectField
                    id="cf-scope"
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      form.setValue("targetId", "");
                    }}
                    options={[
                      { value: "batch", label: "A batch" },
                      { value: "class", label: "A class" },
                      { value: "student", label: "One student" },
                    ]}
                  />
                )}
              />
            </Field>
            <Field label={scope === "batch" ? "Batch" : scope === "class" ? "Class" : "Student"} htmlFor="cf-target" error={errors.targetId?.message} required>
              <Controller
                control={form.control}
                name="targetId"
                render={({ field }) => (
                  <SelectField id="cf-target" value={field.value} onChange={field.onChange} options={targets} placeholder="Select…" invalid={!!errors.targetId} />
                )}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Due date" htmlFor="cf-due" error={errors.dueDate?.message} required>
              <Input id="cf-due" type="date" {...form.register("dueDate")} />
            </Field>
            <Field label="For month" htmlFor="cf-period" error={errors.period?.message} hint="Optional — for recurring fees">
              <Input id="cf-period" type="month" {...form.register("period")} />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Charge
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
