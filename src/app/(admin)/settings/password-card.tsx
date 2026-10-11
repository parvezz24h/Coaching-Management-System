"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/form-field";
import { authClient } from "@/lib/auth-client";
import { type ChangePasswordInput, changePasswordSchema } from "@/lib/validations/settings";

export function PasswordCard() {
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: ChangePasswordInput) {
    const { error } = await authClient.changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      if (error.status === 429) toast.error("Too many attempts. Wait a minute and try again.");
      else form.setError("currentPassword", { message: "Current password is incorrect" });
      return;
    }
    toast.success("Password changed. Other devices have been signed out.");
    form.reset();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Change your password</CardTitle>
          <CardDescription>Other signed-in devices will be signed out.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Current password" htmlFor="pw-current" error={errors.currentPassword?.message}>
            <Input id="pw-current" type="password" autoComplete="current-password" {...form.register("currentPassword")} />
          </Field>
          <Field label="New password" htmlFor="pw-new" error={errors.newPassword?.message}>
            <Input id="pw-new" type="password" autoComplete="new-password" {...form.register("newPassword")} />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm" error={errors.confirm?.message}>
            <Input id="pw-confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Change password
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
