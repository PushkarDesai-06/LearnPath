import { requireUser } from "@/lib/auth/guards";
import { handler, json } from "@/lib/http";
import { resetLessonProgress } from "@/lib/server/lessonProgress";

export const POST = handler(
  async (_request, ctx: { params: Promise<{ lessonId: string }> }) => {
    const { lessonId } = await ctx.params;
    const user = await requireUser();
    return json(await resetLessonProgress(user._id, lessonId));
  },
);
