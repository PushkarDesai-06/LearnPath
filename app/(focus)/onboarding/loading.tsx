import { PageLoader } from "@/components/ui/loading-ring";

/** Route-level fallback while the server resumes any in-progress onboarding. */
export default function Loading() {
  return <PageLoader />;
}
