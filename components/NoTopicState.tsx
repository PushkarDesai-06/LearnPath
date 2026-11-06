/**
 * What a topic-scoped page (path, tutor, flashcards) shows when it has no topic
 * to show. Three different situations, three different next steps:
 *  - the URL names a topic that doesn't exist or isn't the learner's,
 *  - the learner has a setup in progress but no path yet,
 *  - the learner has nothing yet.
 */
import { BookOpen, CircleSlash, Compass } from "lucide-react";
import { listInProgressFunnels } from "@/lib/data/topics";
import { EmptyState } from "@/components/EmptyState";

export async function NoTopicState({
  userId,
  requestedId,
}: {
  userId: string;
  requestedId: string | null;
}) {
  if (requestedId) {
    return (
      <EmptyState
        headingLevel={1}
        icon={CircleSlash}
        title="Topic not found"
        description="This topic doesn't exist, or it isn't one of yours."
        action={{ href: "/topics", label: "Go to your topics" }}
      />
    );
  }

  const [unfinished] = await listInProgressFunnels(userId);
  if (unfinished) {
    return (
      <EmptyState
        headingLevel={1}
        icon={Compass}
        title="Your path isn't built yet"
        description={`Finish setting up “${unfinished.topic}” and your path will appear here.`}
        action={{
          href: `/${unfinished.next}?ob=${unfinished.onboardingId}`,
          label: unfinished.next === "onboarding" ? "Finish setup" : "Take the quiz",
        }}
      />
    );
  }

  return (
    <EmptyState
      headingLevel={1}
      icon={BookOpen}
      title="You don't have a topic yet"
      description="Describe something you want to learn. LearnPath builds the path."
      action={{ href: "/onboarding?new=1", label: "Start your first topic" }}
    />
  );
}
