"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Trash2, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmAction } from "@/components/confirm-action";
import { Field } from "@/components/form-field";
import { applyActionErrors } from "@/components/form-utils";
import { type NewAdminInput, newAdminSchema } from "@/lib/validations/settings";
import { addAdmin, removeAdmin } from "./admin-actions";

type Admin = { id: string; name: string; email: string; createdAt: string; lastSeen: string | null };

export function AdminsCard({ admins, currentUserId }: { admins: Admin[]; currentUserId: string }) {
  const router = useRouter();
  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Admin accounts</CardTitle>
        <CardDescription>Everyone here has full access. There is no public sign-up.</CardDescription>
        <CardAction>
          <AddAdminDialog />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Last active</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <span className="font-medium">{a.name}</span>
                  {a.id === currentUserId && (
                    <Badge variant="secondary" className="ml-2">
                      You
                    </Badge>
                  )}
                  <p className="text-xs text-muted-foreground">{a.email}</p>
                </TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">{a.lastSeen ?? "Never"}</TableCell>
                <TableCell className="text-right">
                  {a.id !== currentUserId && admins.length > 1 && (
                    <ConfirmAction
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Remove ${a.email}`}>
                          <Trash2 className="text-destructive" />
                        </Button>
                      }
                      title={`Remove ${a.name}?`}
                      description="They are signed out immediately and can no longer log in. Their name stays on receipts they issued. You can add them back later."
                      confirmLabel="Remove access"
                      action={() => removeAdmin(a.id)}
                      onDone={() => router.refresh()}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AddAdminDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const blank = { name: "", email: "", password: "" };
  const form = useForm<NewAdminInput>({ resolver: zodResolver(newAdminSchema), defaultValues: blank });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: NewAdminInput) {
    const result = await addAdmin(values);
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
        if (o) form.reset(blank);
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlus /> Add admin
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add admin</DialogTitle>
          <DialogDescription>Share the password with them privately and ask them to change it after signing in.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Name" htmlFor="ad-name" error={errors.name?.message} required>
            <Input id="ad-name" {...form.register("name")} />
          </Field>
          <Field label="Email" htmlFor="ad-email" error={errors.email?.message} required>
            <Input id="ad-email" type="email" autoComplete="off" {...form.register("email")} />
          </Field>
          <Field label="Temporary password" htmlFor="ad-password" error={errors.password?.message} required>
            <Input id="ad-password" type="password" autoComplete="new-password" {...form.register("password")} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Add admin
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
