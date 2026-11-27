/** Unpin a lesson. Unpinning something that is not pinned is a no-op. */
import { requireUser } from "@/lib/auth/guards";
import { removeEntry } from "@/lib/domain/prefs";
import { handler, json } from "@/lib/http";
import { lessonRefsDTO, mutatePrefs } from "@/lib/server/prefs";

export const DELETE = handler(
  async (_request, ctx: { params: Promise<{ lessonId: string }> }) => {
    const { lessonId } = await ctx.params;
    const user = await requireUser();
    const pins = await mutatePrefs(user._id, (prefs) => {
      const remaining = removeEntry(prefs.pinnedLessons, lessonId);
      const unchanged = remaining.length === prefs.pinnedLessons.length;
      return {
        value: remaining,
        changes: unchanged ? undefined : { pinnedLessons: remaining },
      };
    });
    return json({ pins: lessonRefsDTO(pins) });
  },
);
