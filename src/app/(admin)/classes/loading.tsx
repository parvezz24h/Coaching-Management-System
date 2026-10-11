import { LoadingPage, SkeletonCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <div className="grid gap-4 xl:grid-cols-2">
        <SkeletonCard table={{ rows: 3, cols: 3 }} />
        <SkeletonCard table={{ rows: 8, cols: 3 }} />
      </div>
    </LoadingPage>
  );
}
