/**
 * "Explain it differently": rewrite one lesson block in the requested style.
 *
 * Responds with `{ status: "ready", style, markdown }` once written (the first
 * request waits for the agent; later ones return the stored rewrite), or
 * `{ status: "generating", style }` while another request is writing it, in
 * which case the client POSTs again shortly. See lib/server/blockVariant.ts.
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { VARIANT_STYLES } from "@/lib/domain/variants";
import { handler, json, readJson } from "@/lib/http";
import { requestBlockVariant } from "@/lib/server/blockVariant";

const Body = z.object({ style: z.enum(VARIANT_STYLES) });

export const POST = handler(
  async (
    request,
    ctx: { params: Promise<{ lessonId: string; blockKey: string }> },
  ) => {
    const { lessonId, blockKey } = await ctx.params;
    const user = await requireUser();
    const { style } = await readJson(request, Body);
    const result = await requestBlockVariant({
      userId: user._id,
      lessonRef: lessonId,
      blockKey,
      style,
    });
    return json(result);
  },
);
