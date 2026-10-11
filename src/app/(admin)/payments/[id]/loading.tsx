import { LoadingPage, SkeletonActions, SkeletonDocument } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage className="mx-auto max-w-2xl">
      <SkeletonActions buttons={3} />
      <SkeletonDocument rows={2} />
    </LoadingPage>
  );
}
