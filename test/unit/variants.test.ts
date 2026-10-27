/**
 * "Explain it differently" rules: which blocks take which styles, how blocks
 * are addressed (old lessons by position), when an existing record may be taken
 * over, and how the agent's markdown reply is cleaned up.
 */
import { describe, expect, it } from "vitest";
import {
  blockKey,
  findBlockByKey,
  MAX_VARIANT_ATTEMPTS,
  stylesFor,
  variantClaimState,
  VARIANT_STALE_MS,
} from "@/lib/domain/variants";
import { blockVariantReplySchema } from "@/lib/ai/schemas";
import type { LessonBlock } from "@/lib/db/models";

describe("stylesFor", () => {
  it("offers prose styles for prose blocks and a walkthrough for code", () => {
    expect(stylesFor("text")).toEqual(["simpler", "analogy", "example"]);
    expect(stylesFor("analogy")).toEqual(["simpler", "analogy", "example"]);
    expect(stylesFor("code")).toEqual(["walkthrough", "simpler"]);
  });

  it("never offers rewrites of practice or interactive blocks", () => {
    expect(stylesFor("practice")).toEqual([]);
    expect(stylesFor("interactive")).toEqual([]);
  });
});

describe("block keys", () => {
  const blocks: LessonBlock[] = [
    { kind: "text", markdown: "legacy, no id" },
    { kind: "example", markdown: "new", blockId: "b-1" },
  ];

  it("uses the block id, falling back to position for older lessons", () => {
    expect(blockKey(blocks[0], 0)).toBe("i0");
    expect(blockKey(blocks[1], 1)).toBe("b-1");
  });

  it("finds a block by either kind of key", () => {
    expect(findBlockByKey(blocks, "i0")).toEqual({ block: blocks[0], index: 0 });
    expect(findBlockByKey(blocks, "b-1")).toEqual({ block: blocks[1], index: 1 });
    expect(findBlockByKey(blocks, "i1")).toBeNull(); // has an id, so not addressable by position
    expect(findBlockByKey(blocks, "nope")).toBeNull();
  });
});

describe("variantClaimState", () => {
  const now = Date.now();
  const fresh = new Date(now - 1000);
  const stale = new Date(now - VARIANT_STALE_MS - 1);

  it("returns a ready variant as is", () => {
    expect(variantClaimState({ status: "ready", attempts: 1 }, now)).toBe("ready");
  });

  it("leaves a live claim alone", () => {
    expect(variantClaimState({ status: "generating", attempts: 1, claimedAt: fresh }, now)).toBe("busy");
  });

  it("takes over failed or abandoned records while attempts remain", () => {
    expect(variantClaimState({ status: "failed", attempts: 1 }, now)).toBe("retry");
    expect(variantClaimState({ status: "generating", attempts: 2, claimedAt: stale }, now)).toBe("retry");
  });

  it("gives up after the attempt limit", () => {
    expect(variantClaimState({ status: "failed", attempts: MAX_VARIANT_ATTEMPTS }, now)).toBe("exhausted");
    expect(
      variantClaimState({ status: "generating", attempts: MAX_VARIANT_ATTEMPTS, claimedAt: stale }, now),
    ).toBe("exhausted");
  });
});

describe("blockVariantReplySchema", () => {
  it("trims the reply and unwraps a whole-reply markdown fence", () => {
    expect(blockVariantReplySchema.parse("  Plain words.  ")).toBe("Plain words.");
    expect(blockVariantReplySchema.parse("```markdown\n# Hi\n\nThere\n```")).toBe("# Hi\n\nThere");
  });

  it("keeps code fences that are part of the explanation", () => {
    const reply = "Step one:\n\n```js\nx = 1\n```\n\nDone.";
    expect(blockVariantReplySchema.parse(reply)).toBe(reply);
  });

  it("rejects an empty reply so the agent is asked again", () => {
    expect(blockVariantReplySchema.safeParse("   ").success).toBe(false);
    expect(blockVariantReplySchema.safeParse("```\n\n```").success).toBe(false);
  });
});
