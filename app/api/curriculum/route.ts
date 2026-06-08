/**
 * GET the learner's current curriculum (most recently generated).
 */
import { requireUser } from "@/lib/auth/guards";
import { curriculaCollection } from "@/lib/db/collections";
import { publicCurriculum } from "@/lib/server/curriculumView";
import { handler, json, notFound } from "@/lib/http";

export const GET = handler(async () => {
  const user = await requireUser();
  const curricula = await curriculaCollection();
  const doc = await curricula
    .findOne({ userId: user._id })
    .sort({ createdAt: -1 })
    .lean();
  if (!doc) throw notFound("No curriculum yet — generate one first");
  return json({ curriculum: publicCurriculum(doc) });
});
