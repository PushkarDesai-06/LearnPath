/**
 * GET a lesson's content — non-blocking, and the ONLY place a lesson gets
 * enqueued for background generation. The learn page renders server-side with
 * a pure read; when the lesson isn't written yet its client poller hits this
 * route, whose first call enqueues (see `ensureLessonQueued`).
 *
 * Response is one of:
 *   { status: "ready", lesson: {...blocks} }
 *   { status: "generating", curriculumId }
 */
import { requireUser } from "@/lib/auth/guards";
import { ensureLessonQueued } from "@/lib/data/lesson";
import { handler, json, notFound } from "@/lib/http";

export const GET = handler(
  async (_request, ctx: { params: Promise<{ lessonId: string }> }) => {
    const { lessonId } = await ctx.params;
    const user = await requireUser();
    const view = await ensureLessonQueued(user._id, lessonId);
    if (!view) throw notFound("Lesson not found");
    return json(view);
  },
);
