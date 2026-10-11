"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Loader2 } from "lucide-react";
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
import { type Option, SelectField } from "@/components/select-field";
import { formatMoney } from "@/lib/format";
import { generateTuition, type TuitionPreview } from "./actions";

export function GenerateTuitionDialog({
  batches,
  defaultMonth,
  symbol,
}: {
  batches: Option[];
  defaultMonth: string;
  symbol: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(defaultMonth);
  const [dueDay, setDueDay] = useState("10");
  const [batchId, setBatchId] = useState("");
  const [preview, setPreview] = useState<TuitionPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [saving, startSaving] = useTransition();

  // Re-run the dry run whenever the inputs change.
  useEffect(() => {
    if (!open) return;
    startLoading(async () => {
      const result = await generateTuition({ month, dueDay, batchId }, true);
      if (result.ok) {
        setPreview(result.data!);
        setError(null);
      } else {
        setPreview(null);
        setError(Object.values(result.fieldErrors ?? {}).flat()[0] ?? result.error);
      }
    });
  }, [open, month, dueDay, batchId]);

  function generate() {
    startSaving(async () => {
      const result = await generateTuition({ month, dueDay, batchId }, false);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Nothing to create");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <CalendarPlus /> Generate tuition
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generate monthly tuition</DialogTitle>
          <DialogDescription>
            Charges each active enrollment its batch&apos;s monthly fee, minus the student&apos;s discount. Already
            charged enrollments are skipped, so it&apos;s safe to run again.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Month" htmlFor="gt-month">
              <Input id="gt-month" type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
            </Field>
            <Field label="Due on day" htmlFor="gt-due" hint="Clamped to the month's last day">
              <Input id="gt-due" inputMode="numeric" value={dueDay} onChange={(e) => setDueDay(e.target.value)} />
            </Field>
          </div>
          <Field label="Batches" htmlFor="gt-batch">
            <SelectField
              id="gt-batch"
              value={batchId}
              onChange={setBatchId}
              options={batches}
              noneLabel="All active batches"
              placeholder="All active batches"
            />
          </Field>
          <div className="rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
            {loading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Calculating…
              </span>
            ) : error ? (
              <span className="text-destructive">{error}</span>
            ) : preview ? (
              preview.toCreate === 0 ? (
                <span className="text-muted-foreground">
                  Nothing to create
                  {preview.alreadyCharged ? ` — ${preview.alreadyCharged} enrollment(s) already charged for this month.` : "."}
                </span>
              ) : (
                <span>
                  Will create <strong>{preview.toCreate}</strong> fee{preview.toCreate === 1 ? "" : "s"} across{" "}
                  {preview.batches} batch{preview.batches === 1 ? "" : "es"}, totalling{" "}
                  <strong>{formatMoney(preview.total, symbol)}</strong>
                  {preview.alreadyCharged > 0 && (
                    <span className="text-muted-foreground"> · {preview.alreadyCharged} already charged</span>
                  )}
                </span>
              )
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={generate} disabled={saving || loading || !preview || preview.toCreate === 0}>
            {saving && <Loader2 className="animate-spin" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
