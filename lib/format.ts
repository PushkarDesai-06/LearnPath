/**
 * Humanize backend status enums for display, and map them to one of five
 * design tones used by badges, dots, and edges.
 *
 * Keep this the single source of truth — pages should never display a raw
 * snake_case enum to the user.
 */

export type StatusTone =
  | "mastered"
  | "progress"
  | "review"
  | "locked"
  | "generating"
  | "neutral";

const LABELS: Record<string, string> = {
  mastered: "Mastered",
  completed: "Completed",
  complete: "Completed",
  in_progress: "In progress",
  available: "Ready",
  ready: "Ready",
  needs_review: "Needs review",
  locked: "Locked",
  generating: "Generating",
  failed: "Failed",
  clarifying: "Clarifying",
};

export function formatStatus(status: string | undefined | null): string {
  if (!status) return "";
  if (LABELS[status]) return LABELS[status];
  return status
    .split(/[_\s-]+/)
    .map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function statusTone(status: string | undefined | null): StatusTone {
  switch (status) {
    case "mastered":
    case "completed":
    case "complete":
      return "mastered";
    case "in_progress":
    case "available":
    case "ready":
      return "progress";
    case "needs_review":
    case "failed":
      return "review";
    case "locked":
      return "locked";
    case "generating":
    case "clarifying":
      return "generating";
    default:
      return "neutral";
  }
}
