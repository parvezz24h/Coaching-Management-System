"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/form-field";
import { applyActionErrors } from "@/components/form-utils";
import { type CenterSettingsInput, centerSettingsSchema } from "@/lib/validations/settings";
import { saveCenterSettings } from "./actions";

export function SettingsForm({ defaultValues }: { defaultValues: CenterSettingsInput }) {
  const form = useForm<CenterSettingsInput>({ resolver: zodResolver(centerSettingsSchema), defaultValues });
  const { errors, isSubmitting, isDirty } = form.formState;
  const reg = form.register;

  async function onSubmit(values: CenterSettingsInput) {
    const result = await saveCenterSettings(values);
    if (!result.ok) return applyActionErrors(result, form.setError);
    toast.success(result.message);
    form.reset(values);
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Coaching center</CardTitle>
          <CardDescription>Shown in the sidebar, on the login page and on printed receipts.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Center name" htmlFor="s-name" error={errors.name?.message} required className="sm:col-span-2">
            <Input id="s-name" {...reg("name")} />
          </Field>
          <Field label="Phone" htmlFor="s-phone" error={errors.phone?.message}>
            <Input id="s-phone" type="tel" {...reg("phone")} />
          </Field>
          <Field label="Email" htmlFor="s-email" error={errors.email?.message}>
            <Input id="s-email" type="email" {...reg("email")} />
          </Field>
          <Field label="Address" htmlFor="s-address" error={errors.address?.message} className="sm:col-span-2">
            <Textarea id="s-address" rows={2} {...reg("address")} />
          </Field>
          <Field label="Student ID prefix" htmlFor="s-sp" error={errors.studentIdPrefix?.message} hint="e.g. STU → STU-2026-0001">
            <Input id="s-sp" className="uppercase" {...reg("studentIdPrefix")} />
          </Field>
          <Field label="Teacher ID prefix" htmlFor="s-tp" error={errors.teacherIdPrefix?.message} hint="e.g. TCH → TCH-0001">
            <Input id="s-tp" className="uppercase" {...reg("teacherIdPrefix")} />
          </Field>
          <Field label="Receipt prefix" htmlFor="s-rp" error={errors.receiptPrefix?.message} hint="e.g. RCP → RCP-2026-000001">
            <Input id="s-rp" className="uppercase" {...reg("receiptPrefix")} />
          </Field>
          <Field label="Currency symbol" htmlFor="s-cur" error={errors.currencySymbol?.message}>
            <Input id="s-cur" {...reg("currencySymbol")} />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Save settings
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
