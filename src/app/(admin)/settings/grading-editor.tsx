"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DEFAULT_GRADING_SCALE, type GradeRule } from "@/lib/constants";
import { saveGradingScale } from "./actions";

type Row = { grade: string; minPercent: string; gpa: string };
const toRows = (scale: GradeRule[]): Row[] =>
  scale.map((g) => ({ grade: g.grade, minPercent: String(g.minPercent), gpa: g.gpa.toFixed(2) }));

export function GradingEditor({ scale }: { scale: GradeRule[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(toRows(scale));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(rows) !== JSON.stringify(toRows(scale));

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  function save() {
    const complete = rows.every((r) => r.grade.trim() && Number.isFinite(Number(r.minPercent)) && r.minPercent.trim() && Number.isFinite(Number(r.gpa)) && r.gpa.trim());
    if (!complete) {
      setError("Every row needs a grade, a minimum % and a GPA.");
      return;
    }
    const parsed = rows.map((r) => ({ grade: r.grade.trim(), minPercent: Number(r.minPercent), gpa: Number(r.gpa) }));
    setError(null);
    startTransition(async () => {
      const result = await saveGradingScale(parsed);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Grading scale</CardTitle>
        <CardDescription>
          Used for all marksheets. A subject below its pass marks always gets the lowest grade; the overall grade comes
          from the GPA. Changes apply to existing results too.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Grade</TableHead>
              <TableHead>Minimum %</TableHead>
              <TableHead>GPA</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Input aria-label="Grade" className="h-8 w-16 sm:w-24" value={r.grade} onChange={(e) => update(i, { grade: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input aria-label="Minimum percent" inputMode="decimal" className="h-8 w-16 sm:w-24" value={r.minPercent} onChange={(e) => update(i, { minPercent: e.target.value })} />
                </TableCell>
                <TableCell>
                  <Input aria-label="GPA" inputMode="decimal" className="h-8 w-16 sm:w-24" value={r.gpa} onChange={(e) => update(i, { gpa: e.target.value })} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.grade || "row"}`} disabled={rows.length <= 2} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                    <Trash2 className="text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {error && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      </CardContent>
      <CardFooter className="justify-between gap-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRows((r) => [...r, { grade: "", minPercent: "", gpa: "" }])} disabled={rows.length >= 15}>
            <Plus /> Add grade
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRows(toRows(DEFAULT_GRADING_SCALE))}>
            <RotateCcw /> Bangladesh default
          </Button>
        </div>
        <Button onClick={save} disabled={pending || !dirty}>
          {pending && <Loader2 className="animate-spin" />}
          Save scale
        </Button>
      </CardFooter>
    </Card>
  );
}
