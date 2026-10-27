/**
 * "Explain it differently": which lesson blocks a learner can ask to have
 * rewritten, in which styles, how a block is addressed, and the request limits.
 *
 * Pure and I/O-free. A variant is extra explanation only; nothing here (or
 * anywhere downstream) lets a variant move mastery or reorder the path.
 */
import type {
  LessonBlock,
  LessonBlockKind,
  VariantGenStatus,
  VariantStyle,
} from "@/lib/db/models";

export const VARIANT_STYLES = [
  "simpler",
  "analogy",
  "example",
  "walkthrough",
] as const satisfies readonly VariantStyle[];

const PROSE_STYLES: readonly VariantStyle[] = ["simpler", "analogy", "example"];
const STYLES_BY_KIND: Partial<Record<LessonBlockKind, readonly VariantStyle[]>> = {
  text: PROSE_STYLES,
  analogy: PROSE_STYLES,
  example: PROSE_STYLES,
  code: ["walkthrough", "simpler"],
};

/** Styles offered for a block kind; empty for practice and interactive blocks. */
export function stylesFor(kind: LessonBlockKind): readonly VariantStyle[] {
  return STYLES_BY_KIND[kind] ?? [];
}

/** Variants a learner may start per rolling 24 hours, across all topics. */
export const VARIANT_DAILY_LIMIT = 30;
export const VARIANT_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Generation attempts per (block, style) before it is given up on. */
export const MAX_VARIANT_ATTEMPTS = 3;
/** A `generating` claim older than this belongs to a request that died. */
export const VARIANT_STALE_MS = 3 * 60 * 1000;

/**
 * A block's stable address within its lesson. Lessons written since variants
 * shipped give every non-practice block a `blockId`; older lessons fall back to
 * the block's position, which is stable because a ready lesson's blocks are
 * never reordered or rewritten (only an interactive block's status changes).
 */
export function blockKey(block: LessonBlock, index: number): string {
  return block.blockId ?? `i${index}`;
}

export function findBlockByKey(
  blocks: LessonBlock[],
  key: string,
): { block: LessonBlock; index: number } | null {
  const index = blocks.findIndex((b, i) => blockKey(b, i) === key);
  return index === -1 ? null : { block: blocks[index], index };
}

/**
 * What a new request should do about an existing variant record:
 *   ready     → return the stored markdown
 *   busy      → another request is writing it; report `generating`
 *   retry     → failed or abandoned with attempts left; take over the claim
 *   exhausted → out of attempts
 */
export function variantClaimState(
  existing: { status: VariantGenStatus; attempts: number; claimedAt?: Date | null },
  now = Date.now(),
): "ready" | "busy" | "retry" | "exhausted" {
  if (existing.status === "ready") return "ready";
  const abandoned =
    existing.status === "failed" ||
    !existing.claimedAt ||
    existing.claimedAt.getTime() < now - VARIANT_STALE_MS;
  if (!abandoned) return "busy";
  return existing.attempts < MAX_VARIANT_ATTEMPTS ? "retry" : "exhausted";
}
