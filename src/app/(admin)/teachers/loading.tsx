import { LoadingPage, SkeletonActions, SkeletonFilters, SkeletonTable } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions />
      <SkeletonFilters selects={0} />
      <SkeletonTable rows={6} cols={5} />
    </LoadingPage>
  );
}
