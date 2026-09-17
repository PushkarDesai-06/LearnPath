import { LessonSkeleton } from "./LessonSkeleton";

/** Route-level fallback — also the Suspense boundary `useSearchParams` needs. */
export default function Loading() {
  return <LessonSkeleton />;
}
