"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <EmptyState
      icon={TriangleAlert}
      title="Something went wrong"
      description={`The page couldn't be loaded. Nothing you saved before this was lost.${error.digest ? ` (Ref: ${error.digest})` : ""}`}
      action={<Button onClick={() => retry()}>Try again</Button>}
    />
  );
}
