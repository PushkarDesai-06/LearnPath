import { requireUser, publicUser } from "@/lib/auth/guards";
import { onboardingCollection } from "@/lib/db/collections";
import { handler, json } from "@/lib/http";

/**
 * Current user + a lightweight bootstrap summary (onboarding status), so a
 * client can decide where to send the learner next.
 */
export const GET = handler(async () => {
  const user = await requireUser();

  const onboarding = await onboardingCollection();
  const ob = await onboarding
    .findOne({ userId: user._id })
    .sort({ updatedAt: -1 })
    .lean();

  return json({
    user: publicUser(user),
    onboarding: ob
      ? { status: ob.status, refinedTopic: ob.refinedTopic ?? null }
      : null,
  });
});
