/** The tones the status Badge variant understands. */

export type StatusTone =
  | "mastered"
  | "progress"
  | "review"
  | "locked"
  | "generating"
  | "neutral";

/** Initials for an avatar: display name if we have one, else the email local part. */
export function initials(email: string, displayName?: string | null) {
  const source = displayName?.trim() || email.split("@")[0];
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const letters =
    words.length > 1 ? words[0][0] + words[1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}
