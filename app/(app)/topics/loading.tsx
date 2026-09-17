import { TopicsSkeleton } from "./TopicsSkeleton";

/** Route-level fallback, so navigating in shows the skeleton straight away. */
export default function Loading() {
  return <TopicsSkeleton />;
}
