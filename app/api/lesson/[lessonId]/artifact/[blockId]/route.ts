/**
 * GET an interactive block's artifact as a standalone HTML document, loaded by
 * the lesson page's `<iframe sandbox="allow-scripts">`.
 *
 * The response carries its own CSP with `sandbox allow-scripts`, so the
 * model-written JS runs in an opaque origin — no cookies, no API access, no
 * network — even if this URL is opened directly rather than framed.
 */
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { readLessonArtifact } from "@/lib/data/lesson";
import { ARTIFACT_CSP, buildArtifactDocument } from "@/lib/ai/artifactHtml";
import { handler, notFound } from "@/lib/http";

export const GET = handler(
  async (
    _request,
    ctx: { params: Promise<{ lessonId: string; blockId: string }> },
  ) => {
    const { lessonId, blockId } = await ctx.params;
    const user = await requireUser();
    const artifact = await readLessonArtifact(user._id, lessonId, blockId);
    if (!artifact) throw notFound("Interactive demo not found");
    return new NextResponse(buildArtifactDocument(artifact.html, artifact.title), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": ARTIFACT_CSP,
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Cache-Control": "private, max-age=3600",
      },
    });
  },
);
