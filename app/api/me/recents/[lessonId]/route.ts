/** Remove one lesson from the recent list. */
import { requireUser } from "@/lib/auth/guards";
import { removeEntry } from "@/lib/domain/prefs";
import { handler, json } from "@/lib/http";
import { lessonRefsDTO, mutatePrefs } from "@/lib/server/prefs";

export const DELETE = handler(
  async (_request, ctx: { params: Promise<{ lessonId: string }> }) => {
    const { lessonId } = await ctx.params;
    const user = await requireUser();
    const recents = await mutatePrefs(user._id, (prefs) => {
      const remaining = removeEntry(prefs.recentLessons, lessonId);
      const unchanged = remaining.length === prefs.recentLessons.length;
      return {
        value: remaining,
        changes: unchanged ? undefined : { recentLessons: remaining },
      };
    });
    return json({ recents: lessonRefsDTO(recents) });
  },
);
