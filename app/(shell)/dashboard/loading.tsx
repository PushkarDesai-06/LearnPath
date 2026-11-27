import { DashboardSkeleton } from "./DashboardSkeleton";

/**
 * Route-level fallback. Navigating *into* /dashboard (e.g. switching topics
 * from a lesson page) waits on the server before the page can render; this
 * puts the skeleton up straight away instead of leaving the old route frozen.
 */
export default function Loading() {
  return <DashboardSkeleton />;
}
