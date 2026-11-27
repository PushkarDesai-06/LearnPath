import { requireUser } from "@/lib/auth/guards";
import { handler, json } from "@/lib/http";
import { parseTopicId, setTopicArchived } from "@/lib/server/topics";

export const POST = handler(
  async (_request, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const user = await requireUser();
    await setTopicArchived(user._id, parseTopicId(id), true);
    return json({ id, archived: true });
  },
);
