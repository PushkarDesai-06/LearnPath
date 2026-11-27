"use server";

import "server-only";
import { requireUser } from "@/lib/auth/guards";
import { getConversation } from "@/lib/data/tutor";
import type { ConversationDTO } from "@/lib/data/types";

/**
 * Load one owned thread's transcript when the learner switches threads. The
 * initial thread is server-rendered with the page; this covers later switches
 * without a full re-render. Server Actions are reachable by direct POST, so
 * the owner check (inside `getConversation`) is what keeps it safe.
 */
export async function loadConversationAction(
  conversationId: string,
): Promise<ConversationDTO | null> {
  const user = await requireUser();
  return getConversation(user._id.toHexString(), conversationId);
}
