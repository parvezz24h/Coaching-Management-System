import { HeaderActions, SetPageTitle } from "@/components/page-title";
import { cn } from "@/lib/utils";

/**
 * Sets the top-bar title and shows the page's actions.
 *
 * Desktop: a row with small page details (IDs, status badges) on the left and
 * the actions on the right. Phones/tablets: actions move into the top bar as
 * icons; actions wrapped in <span data-header="body" className="contents">
 * (e.g. delete) stay in this row instead.
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
      {actions && <HeaderActions>{actions}</HeaderActions>}
      {(meta || actions) && (
        <div
          className={cn(
            "mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
            // On small screens only meta and body-only actions remain here; hide an empty row.
            !meta && "max-lg:[&:not(:has([data-header=body]))]:hidden",
          )}
        >
          {meta ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">{meta}</div>
          ) : (
            <div className="hidden sm:block" />
          )}
          {actions && (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end max-lg:[&>:not([data-header=body])]:hidden">
              {actions}
            </div>
          )}
        </div>
      )}
    </>
  );
}
