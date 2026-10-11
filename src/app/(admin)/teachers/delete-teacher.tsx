"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/confirm-action";
import { deleteTeacher } from "./actions";

export function DeleteTeacher({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmAction
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`}>
          <Trash2 className="text-destructive" />
        </Button>
      }
      title={`Delete ${name}?`}
      description="This permanently removes the teacher. To keep their history, mark them inactive instead."
      action={() => deleteTeacher(id)}
      onDone={() => router.refresh()}
    />
  );
}
