/**
 * GET a topic's curriculum. Pass `?curriculumId=` to select a specific topic;
 * omit it to fall back to the learner's most recent curriculum.
 */
import { requireUser } from "@/lib/auth/guards";
import { resolveCurriculum } from "@/lib/server/curriculumLocate";
import { publicCurriculum } from "@/lib/server/curriculumView";
import { handler, json, notFound } from "@/lib/http";

export const GET = handler(async (request) => {
  const user = await requireUser();
  const curriculumId = new URL(request.url).searchParams.get("curriculumId");
  const doc = await resolveCurriculum(user._id, curriculumId);
  if (!doc) throw notFound("Curriculum not found");
  return json({ curriculum: publicCurriculum(doc) });
});
