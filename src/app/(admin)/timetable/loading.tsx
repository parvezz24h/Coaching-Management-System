import { LoadingPage, SkeletonActions, SkeletonCard, SkeletonFilters } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions />
      <SkeletonFilters search={false} selects={2} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <SkeletonCard key={i} lines={i % 3 === 2 ? 1 : 4} />
        ))}
      </div>
    </LoadingPage>
  );
}
