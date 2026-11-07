import { MapPinOff } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

/**
 * 404 for unmatched URLs and every `notFound()` (a lesson id that isn't the
 * learner's, say). Renders inside the root layout, so it gets the topbar; the
 * route-group layouts don't wrap it, hence its own <main>.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <EmptyState
        headingLevel={1}
        icon={MapPinOff}
        title="Page not found"
        description="That link doesn't lead anywhere. It may be mistyped, or the lesson or topic may belong to another account."
        action={{ href: "/topics", label: "Go to your topics" }}
      />
    </main>
  );
}
