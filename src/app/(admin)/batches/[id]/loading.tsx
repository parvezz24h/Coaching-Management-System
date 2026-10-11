import { Card, CardContent } from "@/components/ui/card";
import { LoadingPage, SkeletonActions, SkeletonCard, SkeletonFacts } from "@/components/skeletons";

export default function Loading() {
  return (
    <LoadingPage>
      <SkeletonActions buttons={2} meta />
      <Card>
        <CardContent>
          <SkeletonFacts count={9} />
        </CardContent>
      </Card>
      <SkeletonCard table={{ rows: 8, cols: 4 }} />
    </LoadingPage>
  );
}
