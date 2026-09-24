import { TutorSkeleton } from "./TutorParts";

/** Route-level fallback for navigating into /tutor (incl. a topic switch). */
export default function Loading() {
  return <TutorSkeleton />;
}
