import { SetPageTitle } from "@/components/page-title";

/**
 * Sets the title shown in the top bar, and renders an optional row with
 * small page details (codes, status badges) on the left and actions on the right.
 */
export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <>
      <SetPageTitle title={title} />
      {(meta || actions) && (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {meta ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">{meta}</div>
          ) : (
            <div className="hidden sm:block" />
          )}
          {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
        </div>
      )}
    </>
  );
}
