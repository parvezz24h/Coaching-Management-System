"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCheck, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AttendanceCode } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { saveAttendance } from "./actions";

type Mark = AttendanceCode | "";
type Row = { id: string; name: string; studentCode: string; status: Mark };

const OPTIONS: { value: AttendanceCode; label: string; short: string; active: string }[] = [
  { value: "PRESENT", label: "Present", short: "P", active: "bg-emerald-600 text-white border-emerald-600" },
  { value: "LATE", label: "Late", short: "L", active: "bg-amber-500 text-white border-amber-500" },
  { value: "ABSENT", label: "Absent", short: "A", active: "bg-red-600 text-white border-red-600" },
];

export function AttendanceSheet({ batchId, date, students }: { batchId: string; date: string; students: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initial = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s.status])), [students]);
  const [saved, setSaved] = useState<Record<string, Mark>>(initial);
  const [marks, setMarks] = useState<Record<string, Mark>>(initial);

  const changed = students.filter((s) => (marks[s.id] ?? "") !== (saved[s.id] ?? ""));
  const dirty = changed.length > 0;
  const count = (v: Mark) => students.filter((s) => marks[s.id] === v).length;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function setAll(value: AttendanceCode) {
    setMarks(Object.fromEntries(students.map((s) => [s.id, value])));
  }

  function save() {
    startTransition(async () => {
      const result = await saveAttendance({
        batchId,
        date,
        records: changed.map((s) => ({ studentId: s.id, status: marks[s.id] ?? "" })),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      setSaved(marks);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground tabular-nums">
          <span className="font-medium text-emerald-700 dark:text-emerald-400">{count("PRESENT")} present</span>
          {" · "}
          <span className="font-medium text-amber-600 dark:text-amber-400">{count("LATE")} late</span>
          {" · "}
          <span className="font-medium text-red-600 dark:text-red-400">{count("ABSENT")} absent</span>
          {" · "}
          {count("")} unmarked
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAll("PRESENT")} disabled={pending}>
            <CheckCheck /> Mark all present
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Save />}
            Save{dirty ? ` (${changed.length})` : ""}
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>Student</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((s, i) => {
            const current = marks[s.id] ?? "";
            return (
              <TableRow key={s.id} className={cn(current !== (saved[s.id] ?? "") && "bg-primary/5")}>
                <TableCell className="text-muted-foreground tabular-nums">{i + 1}</TableCell>
                <TableCell>
                  <span className="font-medium">{s.name}</span>
                  <p className="font-mono text-xs text-muted-foreground">{s.studentCode}</p>
                </TableCell>
                <TableCell>
                  <div role="radiogroup" aria-label={`Attendance for ${s.name}`} className="flex justify-end gap-1">
                    {OPTIONS.map((o) => {
                      const active = current === o.value;
                      return (
                        <button
                          key={o.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          aria-label={o.label}
                          title={`${o.label} (click again to clear)`}
                          disabled={pending}
                          onClick={() => setMarks((m) => ({ ...m, [s.id]: active ? "" : o.value }))}
                          className={cn(
                            "h-8 min-w-8 rounded-md border px-2 text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:min-w-20",
                            active ? o.active : "bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <span className="sm:hidden">{o.short}</span>
                          <span className="hidden sm:inline">{o.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
