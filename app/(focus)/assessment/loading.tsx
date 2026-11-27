import { PageLoader } from "@/components/ui/loading-ring";

/** Route-level fallback while the server reads the quiz state. */
export default function Loading() {
  return <PageLoader />;
}
