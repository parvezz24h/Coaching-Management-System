"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { GradeRule } from "@/lib/constants";
import { subjectResult } from "@/lib/grading";
import { cn } from "@/lib/utils";
import { saveMarks } from "../actions";

type Entry = { obtained: string; absent: boolean };
type Row = { id: string; name: string; studentCode: string } & Entry;

const VALID = /^\d+(\.\d{1,2})?$/;

export function MarksSheet({
  examSubjectId,
  fullMarks,
  passMarks,
  scale,
  readOnly,
  students,
}: {
  examSubjectId: string;
  fullMarks: number;
  passMarks: number;
  scale: GradeRule[];
  readOnly: boolean;
  students: Row[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = useMemo(
    () => Object.fromEntries(students.map((s) => [s.id, { obtained: s.obtained, absent: s.absent }])),
    [students],
  );
  const [saved, setSaved] = useState<Record<string, Entry>>(initial);
  const [entries, setEntries] = useState<Record<string, Entry>>(initial);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const errorOf = (e: Entry) =>
    e.absent || e.obtained === "" ? null : !VALID.test(e.obtained) ? "Invalid" : Number(e.obtained) > fullMarks ? `Max ${fullMarks}` : null;
  const changed = students.filter((s) => {
    const a = entries[s.id];
    const b = saved[s.id];
    return a.obtained.trim() !== b.obtained.trim() || a.absent !== b.absent;
  });
  const hasErrors = students.some((s) => errorOf(entries[s.id]));
  const entered = students.filter((s) => entries[s.id].absent || entries[s.id].obtained !== "").length;

  useEffect(() => {
    if (changed.length === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed.length]);

  function update(id: string, patch: Partial<Entry>) {
    setEntries((all) => ({ ...all, [id]: { ...all[id], ...patch } }));
  }

  function save() {
    if (hasErrors) {
      toast.error("Fix the highlighted marks first.");
      return;
    }
    startTransition(async () => {
      const result = await saveMarks({
        examSubjectId,
        rows: changed.map((s) => ({ studentId: s.id, obtained: entries[s.id].absent ? "" : entries[s.id].obtained.trim(), absent: entries[s.id].absent })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setSaved(entries);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="sticky top-14 z-20 flex flex-col gap-3 border-b bg-card py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Full marks {fullMarks} · pass {passMarks} · {entered}/{students.length} entered
          {readOnly && " · locked (published)"}
        </p>
        {!readOnly && (
          <Button size="sm" onClick={save} disabled={pending || changed.length === 0}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            Save{changed.length ? ` (${changed.length})` : ""}
          </Button>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="hidden w-10 sm:table-cell">#</TableHead>
            <TableHead>Student</TableHead>
            <TableHead className="w-24 sm:w-36">Marks</TableHead>
            <TableHead className="w-12 sm:w-24">
              Abs<span className="hidden sm:inline">ent</span>
            </TableHead>
            <TableHead className="w-12 text-right sm:w-20">Grade</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((s, i) => {
            const e = entries[s.id];
            const error = errorOf(e);
            const preview =
              !error && (e.absent || e.obtained !== "")
                ? subjectResult(
                    { id: "x", name: "", fullMarks, passMarks },
                    { obtained: e.absent ? null : Number(e.obtained), isAbsent: e.absent },
                    scale,
                  )
                : null;
            const dirty = e.obtained.trim() !== saved[s.id].obtained.trim() || e.absent !== saved[s.id].absent;
            return (
              <TableRow key={s.id} className={cn(dirty && "bg-primary/5")}>
                <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">{i + 1}</TableCell>
                <TableCell>
                  <span className="font-medium">{s.name}</span>
                  <p className="font-mono text-xs text-muted-foreground">{s.studentCode}</p>
                </TableCell>
                <TableCell>
                  <Input
                    ref={(el) => {
                      inputs.current[i] = el;
                    }}
                    inputMode="decimal"
                    aria-label={`Marks for ${s.name}`}
                    aria-invalid={!!error || undefined}
                    disabled={readOnly || pending || e.absent}
                    className="h-8 w-20 text-right tabular-nums sm:w-24"
                    value={e.absent ? "" : e.obtained}
                    placeholder={e.absent ? "Absent" : "—"}
                    onChange={(ev) => update(s.id, { obtained: ev.target.value })}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter" || ev.key === "ArrowDown") {
                        ev.preventDefault();
                        inputs.current.slice(i + 1).find((el) => el && !el.disabled)?.focus();
                      } else if (ev.key === "ArrowUp") {
                        ev.preventDefault();
                        inputs.current.slice(0, i).reverse().find((el) => el && !el.disabled)?.focus();
                      }
                    }}
                  />
                  {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
                </TableCell>
                <TableCell>
                  <Checkbox
                    aria-label={`${s.name} was absent`}
                    checked={e.absent}
                    disabled={readOnly || pending}
                    onCheckedChange={(c) => update(s.id, { absent: Boolean(c) })}
                  />
                </TableCell>
                <TableCell className={cn("text-right font-medium", preview && !preview.passed && "text-destructive")}>
                  {preview ? preview.grade : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
