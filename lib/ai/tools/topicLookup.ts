/**
 * Topic-material retrieval for the Socratic tutor.
 *
 * `lookupTopicMaterial` does a lightweight keyword search over the active
 * topic's curriculum outline + generated lesson content, returning a BOUNDED
 * blob the tutor can ground its guidance in. It's exposed two ways:
 *   - injected into the tutor prompt every turn (grounding doesn't depend on the
 *     model deciding to call a function), and
 *   - as an Agents-SDK tool (`makeTopicLookupTool`) so the model can fetch more
 *     specific material on demand.
 * Every lookup is scoped to the owner (userId + curriculumId) — same IDOR rule.
 */
import { ObjectId } from "mongodb";
import { tool } from "@openai/agents";
import { z } from "zod";
import { curriculaCollection, lessonsCollection } from "@/lib/db/collections";
import type { CurriculumDoc, LessonDoc } from "@/lib/db/models";

const MAX_LESSONS_SCANNED = 30;
const MAX_EXCERPTS = 3;
const EXCERPT_CHARS = 320;
const MAX_OUTPUT_CHARS = 4000; // hard cap so a big topic can't blow the context

const STOP = new Set([
  "the", "a", "an", "is", "are", "was", "of", "to", "in", "and", "or", "for",
  "what", "how", "why", "when", "do", "does", "did", "i", "you", "it", "this",
  "that", "with", "on", "at", "be", "can", "my", "me", "we", "they", "as", "if",
  "so", "but", "not", "no", "yes", "about", "into", "from", "by", "an",
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length >= 3 && !STOP.has(t),
  );
}

function lessonText(doc: LessonDoc): string {
  return doc.blocks
    .map((b) => [b.markdown, b.code, b.prompt].filter(Boolean).join(" "))
    .join("\n");
}

function outline(cur: CurriculumDoc): string {
  return cur.modules
    .map(
      (m) =>
        `- Module "${m.title}": ${m.summary}\n` +
        m.lessons
          .map(
            (l) =>
              `    • ${l.title} — objectives: ${l.objectives.join("; ")}; covers: ${l.topics.join(", ")}`,
          )
          .join("\n"),
    )
    .join("\n");
}

function excerpt(text: string, qTokens: Set<string>): string {
  const lower = text.toLowerCase();
  let pos = -1;
  for (const t of qTokens) {
    const p = lower.indexOf(t);
    if (p >= 0 && (pos < 0 || p < pos)) pos = p;
  }
  const start = pos < 0 ? 0 : Math.max(0, pos - 80);
  const slice = text.slice(start, start + EXCERPT_CHARS).replace(/\s+/g, " ").trim();
  return slice + (text.length > start + EXCERPT_CHARS ? "…" : "");
}

export async function lookupTopicMaterial(params: {
  userId: ObjectId;
  curriculumId: ObjectId;
  query: string;
}): Promise<string> {
  const { userId, curriculumId, query } = params;

  const curricula = await curriculaCollection();
  const cur = await curricula.findOne({ _id: curriculumId, userId }).lean();
  if (!cur) return "No topic material available.";

  let out = `Topic: "${cur.title}" (domain: ${cur.domain})\n\nCurriculum outline:\n${outline(cur)}`;

  const lessons = await lessonsCollection();
  const docs = (
    await lessons.find({ userId, curriculumId }).limit(MAX_LESSONS_SCANNED).lean()
  ).filter((d) => d.blocks.length > 0);

  const qTokens = new Set(tokenize(query));
  if (qTokens.size > 0 && docs.length > 0) {
    const scored = docs
      .map((d) => {
        const text = lessonText(d);
        const score = tokenize(text).filter((t) => qTokens.has(t)).length;
        return { d, text, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_EXCERPTS);

    if (scored.length > 0) {
      out += `\n\nRelevant lesson excerpts for "${query}":`;
      for (const { d, text } of scored) {
        out += `\n- From "${d.title}": ${excerpt(text, qTokens)}`;
      }
    }
  }

  return out.length > MAX_OUTPUT_CHARS ? out.slice(0, MAX_OUTPUT_CHARS) + "…" : out;
}

/** The same retrieval, exposed as an Agents-SDK tool scoped to one topic. */
export function makeTopicLookupTool(userId: ObjectId, curriculumId: ObjectId) {
  return tool({
    name: "lookup_topic_material",
    description:
      "Look up relevant material from the learner's current topic — its " +
      "curriculum outline and the content of lessons they've studied. Use it to " +
      "ground hints in what the learner is actually learning (definitions, " +
      "examples, terminology).",
    parameters: z.object({
      query: z.string().describe("what to look up in the topic's material"),
    }),
    execute: async ({ query }) =>
      lookupTopicMaterial({ userId, curriculumId, query }),
  });
}
