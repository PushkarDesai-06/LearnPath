/**
 * Cleanup of model-written lesson prose that duplicates the page chrome.
 *
 * The lesson page already shows the title as its H1 and labels analogy and
 * example blocks with an eyebrow, but the model often repeats both: an opening
 * `## <lesson title>` heading and a bold `**Analogy:**` lead-in. Only those exact
 * echoes are removed; any other heading or label is the author's content and
 * stays. Block count and order never change (block keys are positional for old
 * lessons), and a block that would end up empty keeps its original text.
 */
import type { LessonBlock } from "@/lib/db/models";

const LEAD_LABELS: Partial<Record<LessonBlock["kind"], string>> = {
  analogy: "analogy",
  example: "example",
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[*_`#:.!\s]+/g, " ")
    .trim();

/** Drop a first-line markdown heading whose text is the lesson title. */
function stripTitleHeading(markdown: string, title: string): string {
  const match = markdown.match(/^\s*#{1,6}\s+(.+?)\s*#*\s*(?:\r?\n|$)/);
  if (!match || normalize(match[1]) !== normalize(title)) return markdown;
  return markdown.slice(match[0].length).replace(/^\s+/, "");
}

/** Drop a leading "Analogy:" / "**Example:**" lead-in that repeats the block eyebrow. */
function stripLeadLabel(markdown: string, label: string): string {
  const pattern = new RegExp(
    `^\\s*(?:[*_]{1,2})?\\s*${label}\\s*:?\\s*(?:[*_]{1,2})?\\s*:?\\s*`,
    "i",
  );
  const match = markdown.match(pattern);
  if (!match) return markdown;
  // Only a real label: "Analogy:" or "**Analogy**", not prose that starts with the word.
  const lead = match[0];
  if (!/:|\*\*|__/.test(lead)) return markdown;
  return markdown.slice(lead.length);
}

export function normalizeLessonBlocks<T extends LessonBlock>(blocks: T[], title: string): T[] {
  return blocks.map((block, index) => {
    if (block.markdown === undefined) return block;
    let markdown = block.markdown;
    if (index === 0) markdown = stripTitleHeading(markdown, title);
    const label = LEAD_LABELS[block.kind];
    if (label) markdown = stripLeadLabel(markdown, label);
    if (!markdown.trim() || markdown === block.markdown) return block;
    return { ...block, markdown };
  });
}
