import { FlashcardsSkeleton } from "./FlashcardsSkeleton";

/** Route-level fallback for navigating into /flashcards (incl. a topic switch). */
export default function Loading() {
  return <FlashcardsSkeleton />;
}
