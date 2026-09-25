/**
 * Mark a lesson complete: finalize its mastery, run the deterministic adaptation
 * pass (reorder / revisit / module-status), and log progress events.
 */
import { z } from "zod";
import { ObjectId } from "mongodb";
import { requireUser } from "@/lib/auth/guards";
import { completeLesson } from "@/lib/server/completeLesson";
import { badRequest, handler, json, readJson } from "@/lib/http";

const Body = z.object({
  curriculumId: z.string(),
  lessonRef: z.string(),
  timeSpentMs: z.number().int().nonnegative().optional(),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const { curriculumId, lessonRef, timeSpentMs } = await readJson(request, Body);
  if (!ObjectId.isValid(curriculumId)) throw badRequest("Invalid curriculumId");

  return json(await completeLesson({
    userId: user._id,
    curriculumId: new ObjectId(curriculumId),
    lessonRef,
    timeSpentMs,
  }));
});
