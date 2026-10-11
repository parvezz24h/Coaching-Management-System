import { Skeleton } from "@/components/ui/skeleton";
import { LoadingPage, SkeletonActions, SkeletonFilters, SkeletonList, SkeletonStats } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions buttons={2} />
      <Skeleton className="h-9 w-56" />
      <SkeletonStats />
      <SkeletonFilters selects={2} />
      <SkeletonList rows={8} cols={7} />
    </LoadingPage>
  );
}
