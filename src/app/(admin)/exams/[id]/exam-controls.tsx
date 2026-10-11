"use client";

import { useRouter } from "next/navigation";
import { Lock, LockOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/confirm-action";
import { deleteExam, setExamPublished } from "../actions";

export function PublishButton({ id, published, incomplete }: { id: string; published: boolean; incomplete: number }) {
  const router = useRouter();
  return published ? (
    <ConfirmAction
      trigger={
        <Button variant="outline">
          <LockOpen /> Unpublish
        </Button>
      }
      title="Unpublish results?"
      description="Marks and subjects become editable again. Marksheets will show as draft until you publish again."
      confirmLabel="Unpublish"
      destructive={false}
      action={() => setExamPublished(id, false)}
      onDone={() => router.refresh()}
    />
  ) : (
    <ConfirmAction
      trigger={
        <Button>
          <Lock /> Publish results
        </Button>
      }
      title="Publish results?"
      description={
        incomplete
          ? `${incomplete} student(s) still have missing marks and will show as incomplete. Publishing locks all marks.`
          : "Publishing locks all marks and subjects. You can unpublish later to make corrections."
      }
      confirmLabel="Publish"
      destructive={false}
      action={() => setExamPublished(id, true)}
      onDone={() => router.refresh()}
    />
  );
}

export function DeleteExamButton({ id, name, marks }: { id: string; name: string; marks: number }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon" aria-label={`Delete ${name}`}>
          <Trash2 className="text-destructive" />
        </Button>
      }
      title={`Delete ${name}?`}
      description={marks ? `This permanently deletes the exam and ${marks} mark(s).` : "This permanently deletes the exam."}
      action={() => deleteExam(id)}
      onDone={() => router.push("/exams")}
    />
  );
}
