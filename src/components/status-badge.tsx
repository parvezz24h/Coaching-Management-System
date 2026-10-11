import { Badge } from "@/components/ui/badge";

const STYLES: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  INACTIVE: { label: "Inactive", className: "bg-muted text-muted-foreground" },
  LEFT: { label: "Left", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  DROPPED: { label: "Dropped", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  COMPLETED: { label: "Completed", className: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
  UNPAID: { label: "Unpaid", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
  PARTIAL: { label: "Partial", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  PAID: { label: "Paid", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  WAIVED: { label: "Waived", className: "bg-muted text-muted-foreground" },
  OVERDUE: { label: "Overdue", className: "bg-red-600 text-white dark:bg-red-500" },
  PAYMENT: { label: "Payment", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  REVERSAL: { label: "Reversal", className: "bg-red-500/10 text-red-700 dark:text-red-400" },
};

export function StatusBadge({ status }: { status: string }) {
  const style = STYLES[status] ?? { label: status, className: "" };
  return (
    <Badge variant="secondary" className={style.className}>
      {style.label}
    </Badge>
  );
}
