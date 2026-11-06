import { describe, it, expect } from "vitest";
import { normalizeLessonBlocks } from "@/lib/domain/lessonContent";
import type { LessonBlock } from "@/lib/db/models";

const title = "GROUP BY with HAVING";

describe("normalizeLessonBlocks", () => {
  it("drops an opening heading that repeats the title", () => {
    const [out] = normalizeLessonBlocks(
      [{ kind: "text", markdown: "## GROUP BY with HAVING\n\nIn this lesson..." }],
      title,
    );
    expect(out.markdown).toBe("In this lesson...");
  });

  it("keeps a different opening heading", () => {
    const block: LessonBlock = { kind: "text", markdown: "## Why grouping matters\n\nText" };
    expect(normalizeLessonBlocks([block], title)[0]).toBe(block);
  });

  it("only checks the first block for the title", () => {
    const later: LessonBlock = { kind: "text", markdown: "## GROUP BY with HAVING\n\nRecap" };
    const out = normalizeLessonBlocks([{ kind: "text", markdown: "Intro" }, later], title);
    expect(out[1]).toBe(later);
  });

  it("drops a bold or plain label lead-in on analogy and example blocks", () => {
    const out = normalizeLessonBlocks(
      [
        { kind: "text", markdown: "Intro" },
        { kind: "analogy", markdown: "**Analogy:** Imagine a librarian" },
        { kind: "example", markdown: "Example: assume a table" },
      ],
      title,
    );
    expect(out[1].markdown).toBe("Imagine a librarian");
    expect(out[2].markdown).toBe("assume a table");
  });

  it("keeps prose that merely starts with the word", () => {
    const block: LessonBlock = { kind: "analogy", markdown: "Analogy is a useful tool here" };
    expect(normalizeLessonBlocks([{ kind: "text", markdown: "x" }, block], title)[1]).toBe(block);
  });

  it("never empties a block", () => {
    const block: LessonBlock = { kind: "text", markdown: "# GROUP BY with HAVING" };
    expect(normalizeLessonBlocks([block], title)[0]).toBe(block);
  });

  it("preserves block ids and count", () => {
    const blocks: LessonBlock[] = [
      { kind: "text", markdown: "# GROUP BY with HAVING\nBody", blockId: "a" },
      { kind: "practice", prompt: "q" },
    ];
    const out = normalizeLessonBlocks(blocks, title);
    expect(out).toHaveLength(2);
    expect(out[0].blockId).toBe("a");
    expect(out[1]).toBe(blocks[1]);
  });
});
