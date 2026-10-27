/**
 * Flashcards from lessons: the review schedule, the generation limits, and the
 * Anki export format.
 *
 * Pure and I/O-free, so the review page can preview the next interval for each
 * grade with the same function the route uses to save it. Reviews are the
 * learner's own judgement, so nothing here moves lesson mastery or the path.
 */
import type { FlashcardGrade, FlashcardSchedule, VariantGenStatus } from "@/lib/db/models";

export const FLASHCARD_GRADES = ["again", "hard", "good", "easy"] as const satisfies readonly FlashcardGrade[];

/** Lessons a learner may turn into flashcards per rolling 24 hours, across all topics. */
export const DECK_DAILY_LIMIT = 20;
export const DECK_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Generation attempts per lesson before it is given up on. */
export const MAX_DECK_ATTEMPTS = 3;
/** A `generating` claim older than this belongs to a request that died. */
export const DECK_STALE_MS = 3 * 60 * 1000;
/** Cards kept from one lesson, whatever the model returns. */
export const MAX_CARDS_PER_DECK = 12;
/** Due cards handed to one review session. */
export const REVIEW_SESSION_LIMIT = 50;

const MIN_EASE = 1.3;
const START_EASE = 2.5;
const MAX_INTERVAL_DAYS = 365;
/** A forgotten card comes back within the same sitting. */
export const RELEARN_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const NEW_CARD: FlashcardSchedule = { reps: 0, intervalDays: 0, ease: START_EASE, lapses: 0 };

/**
 * SM-2, simplified the way Anki presents it. `reps` counts successful reviews
 * in a row; "again" resets it and the card is relearned from the start.
 *   new card:  hard 1d · good 1d · easy 4d
 *   2nd:       hard 1d · good 3d · easy 4d
 *   after:     hard ×1.2 · good ×ease · easy ×ease×1.3, each at least a day
 *              longer than the grade below it
 */
export function scheduleCard(
  card: FlashcardSchedule,
  grade: FlashcardGrade,
  now = Date.now(),
): FlashcardSchedule & { due: Date } {
  if (grade === "again") {
    return {
      reps: 0,
      intervalDays: 0,
      ease: Math.max(MIN_EASE, card.ease - 0.2),
      lapses: card.lapses + (card.reps > 0 ? 1 : 0),
      due: new Date(now + RELEARN_MS),
    };
  }
  const { reps, intervalDays: last, ease } = card;
  const good = reps === 0 ? 1 : reps === 1 ? 3 : Math.max(last + 1, Math.round(last * ease));
  const hard = reps === 0 ? 1 : Math.min(good, Math.max(last, Math.round(last * 1.2), 1));
  const easy = reps === 0 ? 4 : Math.max(good + 1, Math.round(good * 1.3));
  const days = Math.min(MAX_INTERVAL_DAYS, { hard, good, easy }[grade]);
  const nextEase =
    grade === "hard" ? Math.max(MIN_EASE, ease - 0.15) : grade === "easy" ? ease + 0.15 : ease;
  return {
    reps: reps + 1,
    intervalDays: days,
    ease: Number(nextEase.toFixed(2)),
    lapses: card.lapses,
    due: new Date(now + days * DAY_MS),
  };
}

/**
 * How long until the card comes back for each grade, as shown on the buttons.
 * Intervals are relative, so this needs no clock and is safe to call in render.
 */
export function previewIntervals(card: FlashcardSchedule): Record<FlashcardGrade, string> {
  const out = {} as Record<FlashcardGrade, string>;
  for (const grade of FLASHCARD_GRADES) {
    out[grade] = formatInterval(scheduleCard(card, grade, 0).due.getTime());
  }
  return out;
}

/** "10m", "3d", "2mo", "1y": short enough for a button. */
export function formatInterval(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Number((days / 365).toFixed(1))}y`;
}

/**
 * What a new request should do about an existing deck record:
 *   ready     → the cards are written
 *   busy      → another request is writing them; report `generating`
 *   retry     → failed or abandoned with attempts left; take over the claim
 *   exhausted → out of attempts
 */
export function deckClaimState(
  existing: { status: VariantGenStatus; attempts: number; claimedAt?: Date | null },
  now = Date.now(),
): "ready" | "busy" | "retry" | "exhausted" {
  if (existing.status === "ready") return "ready";
  const abandoned =
    existing.status === "failed" ||
    !existing.claimedAt ||
    existing.claimedAt.getTime() < now - DECK_STALE_MS;
  if (!abandoned) return "busy";
  return existing.attempts < MAX_DECK_ATTEMPTS ? "retry" : "exhausted";
}

/**
 * Tidy the model's cards: trim, drop empty or duplicate fronts (case and
 * spacing insensitive), and keep at most MAX_CARDS_PER_DECK.
 */
export function cleanCards(cards: { front: string; back: string }[]): { front: string; back: string }[] {
  const seen = new Set<string>();
  const out: { front: string; back: string }[] = [];
  for (const card of cards) {
    const front = card.front.trim();
    const back = card.back.trim();
    const key = front.toLowerCase().replace(/\s+/g, " ");
    if (!front || !back || seen.has(key)) continue;
    seen.add(key);
    out.push({ front, back });
    if (out.length === MAX_CARDS_PER_DECK) break;
  }
  return out;
}

// --- Anki export -------------------------------------------------------------

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** A card field as Anki HTML: escaped, `code` kept as code, line breaks as <br>. */
function ankiField(text: string): string {
  return escapeHtml(text)
    .replace(/`([^`\n]+)`/g, "<code>$1</code>")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, "<br>");
}

/** Anki tags can't contain spaces. */
function ankiTag(text: string): string {
  return text.trim().replace(/\s+/g, "_").replace(/[^\p{L}\p{N}_:-]/gu, "") || "lesson";
}

/**
 * A plain-text file for Anki's File → Import (2.1.55+ reads the `#` headers):
 * tab-separated front, back and tags, one card per line, into a deck named
 * after the topic.
 */
export function toAnkiText(
  topicTitle: string,
  cards: { front: string; back: string; lessonTitle: string }[],
): string {
  const deck = topicTitle.replace(/[\t\r\n]+/g, " ").replace(/::/g, ":").trim() || "Topic";
  const lines = [
    "#separator:tab",
    "#html:true",
    `#deck:LearnPath::${deck}`,
    "#tags column:3",
    ...cards.map((c) =>
      [ankiField(c.front), ankiField(c.back), `LearnPath ${ankiTag(c.lessonTitle)}`].join("\t"),
    ),
  ];
  return `${lines.join("\n")}\n`;
}
