import { LoadingPage, SkeletonActions, SkeletonFilters, SkeletonList, SkeletonStats } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions />
      <SkeletonFilters selects={3} />
      <SkeletonStats />
      <SkeletonList rows={8} cols={5} />
    </LoadingPage>
  );
}
