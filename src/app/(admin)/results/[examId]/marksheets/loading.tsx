import { LoadingPage, SkeletonActions, SkeletonDocument } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions buttons={2} />
      <SkeletonDocument rows={4} />
      <SkeletonDocument rows={4} />
    </LoadingPage>
  );
}
