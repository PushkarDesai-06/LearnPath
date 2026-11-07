/**
 * Onboarding clarity loop.
 *
 * Each POST carries the learner's description (initial) or their answer to the
 * previous clarifying question. We run clarityAgent, accumulate the exchange on
 * the onboarding doc (authoritative state), and stop when the description is
 * clear enough OR we hit the cycle cap (best-effort proceed).
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { onboardingCollection } from "@/lib/db/collections";
import type { OnboardingDoc } from "@/lib/db/models";
import { runClarityAgent } from "@/lib/ai/agents/clarity";
import { badRequest, conflict, handler, json, notFound, readJson } from "@/lib/http";

const MAX_CYCLES = 4;

const Body = z.object({
  description: z.string().trim().min(1, "Please describe what you want to learn"),
  restart: z.boolean().optional(),
  /** The setup being continued; without it, the newest unfinished one. */
  onboardingId: z.string().optional(),
});

export const POST = handler(async (request) => {
  const user = await requireUser();
  const { description, restart, onboardingId } = await readJson(request, Body);

  const onboarding = await onboardingCollection();
  const now = new Date();

  // Continue a clarification. A named setup (`onboardingId`) must be the
  // learner's own and still clarifying; without one, the newest open setup is
  // continued, or a fresh one started (always fresh on `restart`).
  let doc: OnboardingDoc | null = null;
  if (onboardingId && !restart) {
    if (!ObjectId.isValid(onboardingId)) throw badRequest("Invalid onboardingId");
    doc = await onboarding.findOne({ _id: new ObjectId(onboardingId), userId: user._id }).lean();
    if (!doc) throw notFound("Setup not found");
    if (doc.status !== "clarifying") throw conflict("This topic is already set up. Start the quiz instead.");
  } else if (!restart) {
    doc = await onboarding
      .findOne({ userId: user._id, status: "clarifying" })
      .sort({ updatedAt: -1 })
      .lean();
  }

  if (!doc) {
    const fresh: OnboardingDoc = {
      _id: new ObjectId(),
      userId: user._id,
      rawDescription: description,
      clarity: { clearEnough: false, cycle: 0, maxCycles: MAX_CYCLES, exchanges: [] },
      status: "clarifying",
      createdAt: now,
      updatedAt: now,
    };
    await onboarding.create(fresh);
    doc = fresh;
  }

  // Record the learner's latest message.
  const exchanges = [...doc.clarity.exchanges, { role: "user" as const, text: description, at: now }];

  const result = await runClarityAgent({
    rawDescription: doc.rawDescription,
    priorExchanges: exchanges.map((e) => ({ role: e.role, text: e.text })),
  });

  const cycle = doc.clarity.cycle + 1;
  const capReached = cycle >= doc.clarity.maxCycles;
  const done = result.clearEnough || capReached;

  // Assistant turn: either the followup question or an acknowledgement.
  const assistantText = result.clearEnough
    ? `Got it — we'll focus on: ${result.refinedTopic ?? doc.rawDescription}`
    : result.followupQuestion ??
      (capReached
        ? "Thanks — we'll proceed with your description as-is."
        : "Could you tell me a bit more?");
  exchanges.push({ role: "assistant", text: assistantText, at: now });

  const refinedTopic = done
    ? result.refinedTopic ?? doc.rawDescription
    : doc.refinedTopic;
  const domain = done ? result.domain ?? doc.rawDescription : doc.domain;

  await onboarding.updateOne(
    { _id: doc._id },
    {
      $set: {
        clarity: {
          clearEnough: result.clearEnough,
          cycle,
          maxCycles: doc.clarity.maxCycles,
          exchanges,
        },
        refinedTopic,
        domain,
        status: done ? "ready" : "clarifying",
        updatedAt: now,
      },
    },
  );

  return json({
    onboardingId: doc._id.toHexString(),
    clearEnough: result.clearEnough,
    capReached,
    done,
    cycle,
    maxCycles: doc.clarity.maxCycles,
    status: done ? "ready" : "clarifying",
    followupQuestion: done ? null : assistantText,
    refinedTopic: done ? refinedTopic : null,
    domain: done ? domain : null,
    reason: result.reason,
  });
});
