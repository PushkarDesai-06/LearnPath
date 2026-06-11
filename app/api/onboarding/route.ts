/**
 * GET the learner's in-progress onboarding (the clarity loop), so the UI can
 * resume it after leaving — showing the past questions instead of starting over.
 * Returns the most recent onboarding that hasn't yet become a curriculum.
 */
import { requireUser } from "@/lib/auth/guards";
import { onboardingCollection } from "@/lib/db/collections";
import { handler, json } from "@/lib/http";

export const GET = handler(async () => {
  const user = await requireUser();
  const onboarding = await onboardingCollection();
  const ob = await onboarding
    .findOne({ userId: user._id, status: { $in: ["clarifying", "ready"] } })
    .sort({ updatedAt: -1 })
    .lean();

  if (!ob) return json({ onboarding: null });

  return json({
    onboarding: {
      id: ob._id.toHexString(),
      status: ob.status,
      refinedTopic: ob.refinedTopic ?? null,
      cycle: ob.clarity.cycle,
      maxCycles: ob.clarity.maxCycles,
      exchanges: ob.clarity.exchanges.map((e) => ({
        role: e.role,
        text: e.text,
      })),
    },
  });
});
