/**
 * The learner's in-progress onboarding (the clarity loop), so the page can
 * resume it. Absorbs the former `GET /api/onboarding`.
 */
import "server-only";
import { ObjectId } from "mongodb";
import { onboardingCollection } from "@/lib/db/collections";
import type { OnboardingResume } from "@/lib/data/types";

export async function getResumableOnboarding(
  userId: string,
): Promise<OnboardingResume | null> {
  const onboarding = await onboardingCollection();
  const ob = await onboarding
    .findOne({
      userId: new ObjectId(userId),
      status: { $in: ["clarifying", "ready"] },
    })
    .sort({ updatedAt: -1 })
    .lean();
  if (!ob) return null;
  return {
    id: ob._id.toHexString(),
    status: ob.status,
    refinedTopic: ob.refinedTopic ?? null,
    cycle: ob.clarity.cycle,
    maxCycles: ob.clarity.maxCycles,
    exchanges: ob.clarity.exchanges.map((e) => ({ role: e.role, text: e.text })),
  };
}
