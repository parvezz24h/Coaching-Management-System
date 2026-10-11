import { LoadingPage, SkeletonActions, SkeletonFilters, SkeletonTable } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions />
      <SkeletonFilters search={false} selects={2} />
      <SkeletonTable rows={6} cols={4} />
    </LoadingPage>
  );
}
