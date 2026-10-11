import { LoadingPage, SkeletonCard, SkeletonForm } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage className="mx-auto max-w-3xl">
      <SkeletonForm fields={8} />
      <SkeletonCard table={{ rows: 7, cols: 3 }} />
      <SkeletonCard table={{ rows: 1, cols: 2 }} />
      <SkeletonForm fields={3} />
    </LoadingPage>
  );
}
