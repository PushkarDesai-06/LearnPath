/** Generate the path for the explicitly selected, owned assessment. */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { generateCurriculum } from "@/lib/server/curriculumGeneration";
import { publicCurriculum } from "@/lib/server/curriculumView";
import { handler, json, readJson } from "@/lib/http";

const Body = z.object({ assessmentId: z.string().regex(/^[a-f0-9]{24}$/i, "Invalid assessmentId") });

export const POST = handler(async (request) => {
  const user = await requireUser();
  const { assessmentId } = await readJson(request, Body);
  const result = await generateCurriculum(user._id, new ObjectId(assessmentId));
  return json({ curriculum: publicCurriculum(result.curriculum), existed: result.existed }, result.existed ? 200 : 201);
});
