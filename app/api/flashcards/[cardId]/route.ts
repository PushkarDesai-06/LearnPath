/** Remove one flashcard (a card the learner finds wrong or useless). */
import { requireUser } from "@/lib/auth/guards";
import { handler, json } from "@/lib/http";
import { deleteFlashcard } from "@/lib/server/flashcards";

export const DELETE = handler(
  async (_request, ctx: { params: Promise<{ cardId: string }> }) => {
    const { cardId } = await ctx.params;
    const user = await requireUser();
    await deleteFlashcard({ userId: user._id, cardId });
    return json({ ok: true });
  },
);
