"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/confirm-action";
import { endEnrollment } from "../actions";

export function EnrollmentActions({ enrollmentId, batchName }: { enrollmentId: string; batchName: string }) {
  const router = useRouter();
  return (
    <div className="flex justify-end gap-1">
      <ConfirmAction
        trigger={<Button variant="ghost" size="sm">Complete</Button>}
        title="Mark enrollment completed?"
        description={`The student finished ${batchName}. Their attendance and fee history is kept.`}
        confirmLabel="Mark completed"
        action={() => endEnrollment(enrollmentId, "COMPLETED")}
        onDone={() => router.refresh()}
      />
      <ConfirmAction
        trigger={
          <Button variant="ghost" size="sm" className="text-destructive">
            Drop
          </Button>
        }
        title="Remove from batch?"
        description={`The student will be dropped from ${batchName}. Their attendance and fee history is kept, and they can be re-enrolled later.`}
        confirmLabel="Drop"
        action={() => endEnrollment(enrollmentId, "DROPPED")}
        onDone={() => router.refresh()}
      />
    </div>
  );
}

