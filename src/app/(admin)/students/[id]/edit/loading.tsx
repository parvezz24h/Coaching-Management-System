import { LoadingPage, SkeletonActions, SkeletonForm } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage className="mx-auto max-w-3xl">
      <SkeletonActions buttons={0} meta />
      <SkeletonForm cards={3} fields={4} />
    </LoadingPage>
  );
}
