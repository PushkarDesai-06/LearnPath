/**
 * Grade one flashcard review and reschedule it. Self-graded, so it never moves
 * lesson mastery. Returns the card's new schedule and due date.
 */
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { FLASHCARD_GRADES } from "@/lib/domain/flashcards";
import { handler, json, readJson } from "@/lib/http";
import { reviewFlashcard } from "@/lib/server/flashcards";

const Body = z.object({ grade: z.enum(FLASHCARD_GRADES) });

export const POST = handler(
  async (request, ctx: { params: Promise<{ cardId: string }> }) => {
    const { cardId } = await ctx.params;
    const user = await requireUser();
    const { grade } = await readJson(request, Body);
    return json(await reviewFlashcard({ userId: user._id, cardId, grade }));
  },
);
