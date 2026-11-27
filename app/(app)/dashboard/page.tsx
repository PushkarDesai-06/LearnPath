import { Suspense } from "react";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { DashboardContent } from "./DashboardContent";
import { DashboardSkeleton } from "./DashboardSkeleton";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  const topicId = typeof id === "string" ? id : null;
  // Auth before the boundary, so a signed-out request gets a real redirect.
  const user = await requireUserOrRedirect();

  // Keyed on the topic: a switch (router.push to ?id=) remounts the boundary,
  // so the skeleton replaces the old topic's path at once instead of it
  // lingering while the new one renders.
  return (
    <Suspense key={topicId ?? ""} fallback={<DashboardSkeleton />}>
      <DashboardContent
        userId={user._id.toHexString()}
        curriculumId={topicId}
      />
    </Suspense>
  );
}
