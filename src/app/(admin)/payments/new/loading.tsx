import { LoadingPage, SkeletonFilters, SkeletonTable } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage className="mx-auto max-w-3xl">
      <SkeletonFilters selects={0} />
      <SkeletonTable rows={8} cols={3} />
    </LoadingPage>
  );
}
