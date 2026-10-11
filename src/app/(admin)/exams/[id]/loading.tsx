import { LoadingPage, SkeletonActions, SkeletonCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions buttons={3} meta />
      <SkeletonCard table={{ rows: 2, cols: 5 }} />
      <SkeletonCard table={{ rows: 8, cols: 4 }} />
    </LoadingPage>
  );
}
