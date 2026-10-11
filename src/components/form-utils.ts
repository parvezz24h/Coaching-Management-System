import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";

/** Apply a failed server action's field errors to a react-hook-form form. */
export function applyActionErrors<T extends FieldValues>(result: ActionResult<unknown>, setError: UseFormSetError<T>) {
  if (result.ok) return;
  for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
    if (messages?.[0]) setError(field as Path<T>, { message: messages[0] });
  }
  toast.error(result.error);
}
