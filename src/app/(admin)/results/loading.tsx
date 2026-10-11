import { LoadingPage, SkeletonActions, SkeletonCard, SkeletonFilters, SkeletonTable } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions buttons={2} />
      <SkeletonFilters search={false} selects={1} />
      <SkeletonCard lines={2} />
      <SkeletonTable rows={10} cols={7} />
    </LoadingPage>
  );
}
