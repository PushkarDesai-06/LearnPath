/**
 * "Explain it differently": return, or write, one rewrite of one lesson block.
 *
 * Generation runs inside the learner's request (one short markdown reply, and
 * only an explicit POST starts it, so prefetch can't). It is still guarded the
 * way the lesson worker is:
 *  - Dedup: the unique (user, topic, lesson, block, style) index means only the
 *    insert that wins runs the agent; concurrent requests report `generating`.
 *  - Fencing: each run holds a claim token, and only the holder may save.
 *  - Recovery: a failed record, or one whose request died mid-run, is taken
 *    over by the next request until MAX_VARIANT_ATTEMPTS is used up.
 *
 * Variants never touch mastery or the path. Success logs one progress event.
 */
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import {
  blockVariantsCollection,
  lessonsCollection,
  progressEventsCollection,
} from "@/lib/db/collections";
import type { BlockVariantDoc, VariantStyle } from "@/lib/db/models";
import type { BlockVariantResult } from "@/lib/data/types";
import { runVariantAgent } from "@/lib/ai/agents/variant";
import { modelName } from "@/lib/ai/provider";
import { precedingText } from "@/lib/jobs/artifactWorker";
import { loadLearnerContext } from "@/lib/jobs/learnerContext";
import { locateLesson } from "@/lib/server/curriculumLocate";
import { requireLessonAccess } from "@/lib/server/lessonAccess";
import { isLessonReady } from "@/lib/server/lessonReady";
import {
  findBlockByKey,
  stylesFor,
  variantClaimState,
  VARIANT_DAILY_LIMIT,
  VARIANT_WINDOW_MS,
} from "@/lib/domain/variants";
import { ApiError, badRequest, conflict, notFound } from "@/lib/http";

/**
 * Runs right after a new (block, style) record is inserted, so returning a
 * stored variant or retrying a failed one never counts twice. The new record is
 * the reservation: counting only records up to and including it (by `_id`) means
 * parallel requests can't all pass a check made before any of them inserted.
 * Exactly the first VARIANT_DAILY_LIMIT reservations in the window succeed; a
 * later one removes itself and is refused before the model is called.
 */
async function enforceDailyLimit(
  userId: ObjectId,
  reservation: { _id: ObjectId; claimToken: string },
): Promise<void> {
  const variants = await blockVariantsCollection();
  const since = new Date(Date.now() - VARIANT_WINDOW_MS);
  const used = await variants.countDocuments({
    userId,
    createdAt: { $gte: since },
    _id: { $lte: reservation._id },
  });
  if (used > VARIANT_DAILY_LIMIT) {
    await variants.deleteOne(reservation);
    throw new ApiError(
      429,
      `You've used today's ${VARIANT_DAILY_LIMIT} rewrites. They reset over the next 24 hours.`,
    );
  }
}

export async function requestBlockVariant({
  userId,
  lessonRef,
  blockKey,
  style,
}: {
  userId: ObjectId;
  lessonRef: string;
  blockKey: string;
  style: VariantStyle;
}): Promise<BlockVariantResult> {
  const located = await locateLesson(userId, lessonRef);
  if (!located) throw notFound("Lesson not found");
  requireLessonAccess(located.curriculum, lessonRef);
  const { curriculum, lesson } = located;

  const lessons = await lessonsCollection();
  const doc = await lessons
    .findOne({ userId, curriculumId: curriculum._id, lessonRef })
    .lean();
  if (!doc || !isLessonReady(doc)) throw conflict("This lesson isn't ready yet.");
  const found = findBlockByKey(doc.blocks, blockKey);
  if (!found) throw notFound("Block not found");
  if (!stylesFor(found.block.kind).includes(style)) {
    throw badRequest("This block can't be explained that way.");
  }

  const variants = await blockVariantsCollection();
  const identity = { userId, curriculumId: curriculum._id, lessonRef, blockKey, style };
  const generating: BlockVariantResult = { status: "generating", style };
  const claimToken = randomUUID();
  const now = new Date();
  let id: ObjectId;

  const existing = (await variants.findOne(identity).lean()) as BlockVariantDoc | null;
  if (existing) {
    const state = variantClaimState(existing);
    if (state === "ready") return { status: "ready", style, markdown: existing.markdown ?? "" };
    if (state === "busy") return generating;
    if (state === "exhausted") {
      throw conflict("We couldn't write this explanation after several attempts.");
    }
    // Take over the failed or abandoned record, conditioned on the claim we saw.
    const took = await variants.updateOne(
      { _id: existing._id, status: existing.status, claimToken: existing.claimToken ?? null },
      {
        $set: { status: "generating", claimToken, claimedAt: now, error: null, updatedAt: now },
        $inc: { attempts: 1 },
      },
    );
    if (!took.matchedCount) return generating; // a concurrent request took it first
    id = existing._id;
  } else {
    id = new ObjectId();
    try {
      await variants.create({
        _id: id,
        ...identity,
        status: "generating",
        claimToken,
        claimedAt: now,
        attempts: 1,
        createdAt: now,
        updatedAt: now,
      });
    } catch (err) {
      if ((err as { code?: number })?.code !== 11000) throw err;
      return generating; // a concurrent request inserted first and is writing it
    }
    await enforceDailyLimit(userId, { _id: id, claimToken });
  }

  const owned = { _id: id, claimToken };
  try {
    const learner = await loadLearnerContext(curriculum, lesson);
    const markdown = await runVariantAgent({
      lessonTitle: lesson.title,
      objectives: lesson.objectives,
      block: found.block,
      style,
      context: precedingText(doc.blocks, found.index),
      upcomingPractice: doc.blocks
        .slice(found.index + 1)
        .filter((b) => b.kind === "practice" && b.prompt)
        .map((b) => b.prompt!),
      ...learner,
    });

    const saved = await variants.updateOne(owned, {
      $set: {
        status: "ready",
        markdown,
        model: modelName(),
        claimToken: null,
        claimedAt: null,
        updatedAt: new Date(),
      },
    });
    // A request that outlived its claim still answers its own learner; the
    // record belongs to whoever took it over.
    if (saved.matchedCount) {
      const events = await progressEventsCollection();
      await events.create({
        _id: new ObjectId(),
        userId,
        curriculumId: curriculum._id,
        lessonRef,
        type: "block_variant_requested",
        topics: lesson.topics,
        at: new Date(),
      });
    }
    return { status: "ready", style, markdown };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[variants] generation failed:", lessonRef, blockKey, style, message);
    await variants.updateOne(owned, {
      $set: { status: "failed", error: message, claimToken: null, claimedAt: null, updatedAt: new Date() },
    });
    throw err;
  }
}
