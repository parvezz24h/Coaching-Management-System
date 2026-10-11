import { LoadingPage, SkeletonActions, SkeletonFilters, SkeletonTable } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions />
      <SkeletonFilters selects={2} />
      <SkeletonTable rows={5} cols={6} />
    </LoadingPage>
  );
}
