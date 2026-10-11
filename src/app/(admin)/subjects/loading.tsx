import { LoadingPage, SkeletonActions, SkeletonTable } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions />
      <SkeletonTable rows={8} cols={4} />
    </LoadingPage>
  );
}
