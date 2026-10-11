"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action";

type ConfirmProps = {
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  action: () => Promise<ActionResult<unknown>>;
  onDone?: () => void;
};

/** A trigger that asks for confirmation, then runs a server action. */
export function ConfirmAction({ trigger, ...props }: ConfirmProps & { trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  return <ConfirmDialog {...props} open={open} onOpenChange={setOpen} trigger={trigger} />;
}

/** Controlled variant, for opening from a menu item. */
export function ConfirmDialog({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  destructive = true,
  action,
  onDone,
}: ConfirmProps & { open: boolean; onOpenChange: (open: boolean) => void; trigger?: React.ReactElement }) {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message ?? "Done");
        onOpenChange(false);
        onDone?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger render={trigger} />}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} onClick={run} disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
