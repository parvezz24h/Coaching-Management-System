import { cn } from "cn"

/** A placeholder block with a soft shimmer sweep (static when reduced motion is on). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-md bg-foreground/[0.08] dark:bg-foreground/[0.09]",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-foreground/[0.09] before:to-transparent motion-reduce:before:hidden",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
