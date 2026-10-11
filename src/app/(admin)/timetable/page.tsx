import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Clock, MapPin, Pencil, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { UrlFilter } from "@/components/url-filter";
import type { Prisma } from "@/generated/prisma/client";
import { WEEKDAY_LABELS, WEEKDAYS, weekdayOf } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatTime, formatTimeRange, parseDateInput, todayISO } from "@/lib/format";
import { param } from "@/lib/search-params";
import { requireAdmin } from "@/lib/session";
import { cn } from "@/lib/utils";
import { DeleteSession, SessionDialog } from "./session-dialog";

export const metadata: Metadata = { title: "Timetable" };

export default async function TimetablePage({ searchParams }: PageProps<"/timetable">) {
  await requireAdmin();
  const sp = await searchParams;
  const batchId = param(sp, "batch");
  const teacherId = param(sp, "teacher");

  const where: Prisma.ClassSessionWhereInput = {
    batch: { status: "ACTIVE" },
    ...(batchId && { batchId }),
    ...(teacherId && { teacherId }),
  };

  const [sessions, batches, subjects, teachers] = await Promise.all([
    db.classSession.findMany({
      where,
      orderBy: [{ startTime: "asc" }, { endTime: "asc" }],
      include: {
        batch: { select: { id: true, name: true, code: true } },
        subject: { select: { name: true } },
        teacher: { select: { name: true } },
      },
    }),
    db.batch.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true, subjectId: true, teacherId: true, room: true },
    }),
    db.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.teacher.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: { id: true, name: true, status: true },
    }),
  ]);

  const batchOptions = batches.map((b) => ({
    value: b.id,
    label: `${b.name} (${b.code})`,
    subjectId: b.subjectId ?? "",
    teacherId: b.teacherId ?? "",
    room: b.room ?? "",
  }));
  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));
  const teacherOptions = teachers.map((t) => ({
    value: t.id,
    label: t.status === "ACTIVE" ? t.name : `${t.name} (inactive)`,
  }));
  const dialogProps = { batches: batchOptions, subjects: subjectOptions, teachers: teacherOptions };
  const today = weekdayOf(parseDateInput(todayISO())!);
  const filtered = Boolean(batchId || teacherId);

  const addButton = (
    <SessionDialog
      {...dialogProps}
      defaultValues={{
        batchId,
        subjectId: "",
        teacherId: "",
        weekdays: [],
        startTime: "16:00",
        endTime: "17:30",
        room: "",
      }}
      trigger={
        <Button disabled={batches.length === 0}>
          <Plus /> Add class
        </Button>
      }
    />
  );

  return (
    <>
      <PageHeader title="Timetable" description="Weekly class schedule for active batches" actions={addButton} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <UrlFilter param="batch" options={batchOptions} allLabel="All batches" />
        <UrlFilter param="teacher" options={teacherOptions} allLabel="All teachers" />
      </div>

      {batches.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No active batches"
          description="Create a batch first, then schedule its classes here."
          action={
            <Link href="/batches" className="text-sm text-primary hover:underline">
              Go to batches
            </Link>
          }
        />
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={filtered ? "No classes match these filters" : "No classes scheduled yet"}
          description={filtered ? undefined : "Add weekly class slots for your batches."}
          action={!filtered && addButton}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {WEEKDAYS.map((day) => {
            const daySessions = sessions.filter((s) => s.weekday === day);
            return (
              <Card key={day} size="sm" className={cn(day === today && "ring-2 ring-primary/40")}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-sm">
                    {WEEKDAY_LABELS[day]}
                    {day === today && <span className="text-xs font-normal text-primary">Today</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2">
                  {daySessions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No classes</p>
                  ) : (
                    daySessions.map((s) => {
                      const label = `${s.batch.name}, ${WEEKDAY_LABELS[s.weekday]} ${formatTime(s.startTime)}`;
                      return (
                        <div key={s.id} className="group rounded-lg border bg-muted/30 p-2.5 text-sm">
                          <div className="flex items-start justify-between gap-1">
                            <p className="flex items-center gap-1 text-xs font-medium whitespace-nowrap tabular-nums text-primary">
                              <Clock className="size-3 shrink-0" />
                              {formatTimeRange(s.startTime, s.endTime)}
                            </p>
                            <div className="-mt-1 -mr-1 flex">
                              <SessionDialog
                                {...dialogProps}
                                id={s.id}
                                defaultValues={{
                                  batchId: s.batchId,
                                  subjectId: s.subjectId ?? "",
                                  teacherId: s.teacherId ?? "",
                                  weekdays: [s.weekday],
                                  startTime: s.startTime,
                                  endTime: s.endTime,
                                  room: s.room ?? "",
                                }}
                                trigger={
                                  <Button variant="ghost" size="icon-xs" aria-label={`Edit ${label}`}>
                                    <Pencil />
                                  </Button>
                                }
                              />
                              <DeleteSession id={s.id} label={label} />
                            </div>
                          </div>
                          <Link href={`/batches/${s.batch.id}`} className="mt-1 block font-medium hover:underline">
                            {s.batch.name}
                          </Link>
                          {s.subject && <p className="text-xs text-muted-foreground">{s.subject.name}</p>}
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            {s.teacher && (
                              <span className="flex items-center gap-1">
                                <UserRound className="size-3" />
                                {s.teacher.name}
                              </span>
                            )}
                            {s.room && (
                              <span className="flex items-center gap-1">
                                <MapPin className="size-3" />
                                {s.room}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
