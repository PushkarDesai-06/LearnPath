import { Suspense } from "react";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { FlashcardsContent } from "./FlashcardsContent";
import { FlashcardsSkeleton } from "./FlashcardsSkeleton";

import type { Metadata } from "next";
import { topicPageMetadata } from "@/lib/data/metadata";

export function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>;
}): Promise<Metadata> {
  return topicPageMetadata("Flashcards", searchParams);
}

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
