/**
 * Turn a written lesson into flashcards.
 *
 * Responds with `{ status: "ready", cardCount }` once the cards exist (the
 * first request waits for the agent; later ones return at once), or
 * `{ status: "generating" }` while another request is writing them, in which
 * case the client POSTs again shortly. See lib/server/flashcards.ts.
 */
import { requireUser } from "@/lib/auth/guards";
import { handler, json } from "@/lib/http";
import { requestFlashcardDeck } from "@/lib/server/flashcards";

export const POST = handler(
  async (_request, ctx: { params: Promise<{ lessonId: string }> }) => {
    const { lessonId } = await ctx.params;
    const user = await requireUser();
    return json(await requestFlashcardDeck({ userId: user._id, lessonRef: lessonId }));
  },
);
