import { Suspense } from "react";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { FlashcardsContent } from "./FlashcardsContent";
import { FlashcardsSkeleton } from "./FlashcardsSkeleton";

export default async function FlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}) {
  const { id } = await searchParams;
  const topicId = typeof id === "string" ? id : null;
  // Auth before the boundary, so a signed-out request gets a real redirect.
  const user = await requireUserOrRedirect();

  // Keyed on the topic so a switch drops the old topic's session at once.
  return (
    <Suspense key={topicId ?? ""} fallback={<FlashcardsSkeleton />}>
      <FlashcardsContent userId={user._id.toHexString()} curriculumId={topicId} />
    </Suspense>
  );
}
