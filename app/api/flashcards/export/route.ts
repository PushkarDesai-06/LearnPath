/**
 * A topic's flashcards as a file for Anki's File → Import. `?id=` selects the
 * topic (owner-scoped; the newest topic when absent).
 */
import { requireUser } from "@/lib/auth/guards";
import { handler, notFound } from "@/lib/http";
import { exportFlashcards } from "@/lib/server/flashcards";
import { NextResponse } from "next/server";

export const GET = handler(async (request) => {
  const user = await requireUser();
  const id = new URL(request.url).searchParams.get("id");
  const file = await exportFlashcards(user._id, id);
  if (!file) throw notFound("Topic not found");
  return new NextResponse(file.text, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "content-disposition": `attachment; filename="${file.filename}"`,
      "cache-control": "no-store",
    },
  });
});
