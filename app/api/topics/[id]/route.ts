/** Rename (PATCH) or hard delete with cascade (DELETE) one of the learner's topics. */
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { handler, json, readJson } from "@/lib/http";
import { deleteTopic, parseTopicId, renameTopic } from "@/lib/server/topics";

const Body = z.object({ title: z.string().trim().min(1).max(120) });

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const { title } = await readJson(request, Body);
  await renameTopic(user._id, parseTopicId(id), title);
  return json({ id, title });
});

export const DELETE = handler(async (_request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  await deleteTopic(user._id, parseTopicId(id));
  return json({ ok: true });
});
