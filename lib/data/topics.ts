/**
 * The learner's topics (curricula) and half-finished setup funnels.
 * Absorbs the former `GET /api/topics`.
 */
import "server-only";
import { cache } from "react";
import { ObjectId } from "mongodb";
import {
  curriculaCollection,
  onboardingCollection,
} from "@/lib/db/collections";
import { topicListItem } from "@/lib/server/curriculumView";
import type { InProgressFunnel, TopicListItem } from "@/lib/data/types";

/** Generated curricula, newest first. Shared by the Nav, /topics and /account. */
export const listTopics = cache(
  async (userId: string): Promise<TopicListItem[]> => {
    const curricula = await curriculaCollection();
    const docs = await curricula
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean();
    return docs.map(topicListItem);
  },
);

/**
 * Funnels still being set up (onboarding not yet turned into a curriculum), so
 * half-finished onboarding/assessment work stays reachable.
 */
export async function listInProgressFunnels(
  userId: string,
): Promise<InProgressFunnel[]> {
  const onboarding = await onboardingCollection();
  const funnels = await onboarding
    .find({
      userId: new ObjectId(userId),
      status: { $in: ["clarifying", "ready", "assessing"] },
    })
    .sort({ updatedAt: -1 })
    .lean();
  return funnels.map((f) => ({
    onboardingId: f._id.toHexString(),
    topic: f.refinedTopic ?? f.rawDescription,
    status: f.status,
    next: f.status === "clarifying" ? "onboarding" : "assessment",
  }));
}
