/**
 * GET a topic's curriculum. Pass `?curriculumId=` to select a specific topic;
 * omit it to fall back to the learner's most recent curriculum.
 */
import { requireUser } from "@/lib/auth/guards";
import { resolveCurriculum } from "@/lib/server/curriculumLocate";
import { publicCurriculum } from "@/lib/server/curriculumView";
import { gateModuleStatuses } from "@/lib/domain/adapt";
import { handler, json, notFound } from "@/lib/http";

export const GET = handler(async (request) => {
  const user = await requireUser();
  const curriculumId = new URL(request.url).searchParams.get("curriculumId");
  const doc = await resolveCurriculum(user._id, curriculumId);
  if (!doc) throw notFound("Curriculum not found");
  // Apply the access window at read time so existing curricula reflect the
  // current gating rule (the persisted status may predate it).
  doc.modules = gateModuleStatuses(doc.modules);
  return json({ curriculum: publicCurriculum(doc) });
});
