import { LoadingPage, SkeletonActions, SkeletonCard, SkeletonFilters } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions buttons={2} />
      <SkeletonFilters search={false} selects={2} />
      <SkeletonCard table={{ rows: 10, cols: 8 }} />
    </LoadingPage>
  );
}
