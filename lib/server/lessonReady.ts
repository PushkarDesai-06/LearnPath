/**
 * Single source of truth for "does this lesson have renderable content?".
 *
 * A stored lesson doc is NOT trustworthy on `genStatus` alone — an old doc can
 * sit at `ready` with empty or `{kind}`-only blocks. Readiness is therefore
 * always derived from the blocks themselves.
 *
 * Two forms of the same rule live here on purpose, and must be kept in step:
 *   - `isLessonReady` — in-process check, used when the doc is already loaded.
 *   - `generatedLessonRefs` — the same predicate pushed into an aggregation, so
 *     the dashboard can label a whole curriculum without pulling every lesson's
 *     markdown over the wire.
 */
import type { ObjectId } from "mongodb";
import { lessonsCollection } from "@/lib/db/collections";
import type { LessonBlock, LessonDoc } from "@/lib/db/models";

const nonEmpty = (v?: string) => typeof v === "string" && v.trim().length > 0;

/** A block carries real content (guards against stored empty/`{kind}`-only blocks). */
export function hasRealContent(b: LessonBlock): boolean {
  return nonEmpty(b.markdown) || nonEmpty(b.code) || nonEmpty(b.prompt);
}

/** A lesson is renderable when it has at least one block with actual content. */
export function isLessonReady(doc: LessonDoc | null): boolean {
  return !!doc && doc.blocks.length > 0 && doc.blocks.some(hasRealContent);
}

/**
 * `lessonRef`s in this curriculum whose content is already written.
 *
 * Mirrors `isLessonReady` in aggregation form: a block counts when markdown,
 * code or prompt has a non-whitespace character (concatenating first is
 * equivalent — whitespace-only fields still trim to nothing). `$anyElementTrue`
 * over an empty `blocks` array yields false, matching the `length > 0` guard.
 * Only the ref and the resulting boolean come back, never the content.
 */
export async function generatedLessonRefs(
  userId: ObjectId,
  curriculumId: ObjectId,
): Promise<Set<string>> {
  const lessons = await lessonsCollection();
  const rows = await lessons.aggregate<{ lessonRef: string; ready: boolean }>([
    { $match: { userId, curriculumId } },
    {
      $project: {
        _id: 0,
        lessonRef: 1,
        ready: {
          $anyElementTrue: {
            $map: {
              input: { $ifNull: ["$blocks", []] },
              as: "b",
              in: {
                $gt: [
                  {
                    $strLenCP: {
                      $trim: {
                        input: {
                          $concat: [
                            { $ifNull: ["$$b.markdown", ""] },
                            { $ifNull: ["$$b.code", ""] },
                            { $ifNull: ["$$b.prompt", ""] },
                          ],
                        },
                      },
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      },
    },
  ]);
  return new Set(rows.filter((r) => r.ready).map((r) => r.lessonRef));
}
