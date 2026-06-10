/**
 * List the learner's topics. Returns both:
 *  - `topics`: generated curricula (each is a full topic), newest first.
 *  - `inProgress`: funnels still being set up (onboarding not yet turned into a
 *    curriculum), so half-finished onboarding/assessment work stays reachable
 *    instead of "disappearing".
 */
import { requireUser } from "@/lib/auth/guards";
import {
  curriculaCollection,
  onboardingCollection,
} from "@/lib/db/collections";
import { topicListItem } from "@/lib/server/curriculumView";
import { handler, json } from "@/lib/http";

export const GET = handler(async () => {
  const user = await requireUser();

  const curricula = await curriculaCollection();
  const docs = await curricula
    .find({ userId: user._id })
    .sort({ createdAt: -1 })
    .lean();

  const onboarding = await onboardingCollection();
  const funnels = await onboarding
    .find({
      userId: user._id,
      status: { $in: ["clarifying", "ready", "assessing"] },
    })
    .sort({ updatedAt: -1 })
    .lean();

  return json({
    topics: docs.map(topicListItem),
    inProgress: funnels.map((f) => ({
      onboardingId: f._id.toHexString(),
      topic: f.refinedTopic ?? f.rawDescription,
      status: f.status,
      // where the learner should continue
      next: f.status === "clarifying" ? "onboarding" : "assessment",
    })),
  });
});
