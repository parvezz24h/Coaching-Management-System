import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, SkeletonActions, SkeletonFilters, SkeletonStats, SkeletonTable } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions buttons={2} />
      <Skeleton className="h-9 w-full max-w-xl" />
      <SkeletonFilters search={false} selects={2} />
      <SkeletonStats count={4} className="grid-cols-2 sm:grid-cols-4" />
      <SkeletonTable rows={10} cols={8} />
    </LoadingPage>
  );
}
