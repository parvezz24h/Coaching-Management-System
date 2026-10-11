import { LoadingPage, SkeletonCard } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} lines={1} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <SkeletonCard table={{ rows: 5, cols: 3 }} />
        <SkeletonCard table={{ rows: 3, cols: 4 }} />
      </div>
    </LoadingPage>
  );
}
