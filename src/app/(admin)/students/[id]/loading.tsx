import { Card, CardContent } from "@/components/ui/card";
import { LoadingPage, SkeletonActions, SkeletonCard, SkeletonFacts } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions buttons={2} meta />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent>
            <SkeletonFacts count={8} />
          </CardContent>
        </Card>
        <div className="grid gap-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={1} />
        </div>
      </div>
      <SkeletonCard table={{ rows: 2, cols: 5 }} />
      <SkeletonCard table={{ rows: 5, cols: 3 }} />
    </LoadingPage>
  );
}
