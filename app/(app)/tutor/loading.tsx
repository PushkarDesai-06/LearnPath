import { PageLoader } from "@/components/ui/loading-ring";

/** Route-level fallback — also the Suspense boundary `useSearchParams` needs. */
export default function Loading() {
  return <PageLoader />;
}
