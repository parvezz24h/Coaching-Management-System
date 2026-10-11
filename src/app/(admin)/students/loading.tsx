import { LoadingPage, SkeletonActions, SkeletonFilters, SkeletonTable } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions />
      <SkeletonFilters selects={3} />
      <SkeletonTable rows={10} cols={6} />
    </LoadingPage>
  );
}
