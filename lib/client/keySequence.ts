export const SEQUENCE_LEADER = "g";
export const SEQUENCE_WINDOW_MS = 1000;

export const SEQUENCE_TARGETS = {
  d: "dashboard",
  r: "review",
  t: "tutor",
  a: "topics",
  s: "account",
} as const;

export type SequenceTarget =
  (typeof SEQUENCE_TARGETS)[keyof typeof SEQUENCE_TARGETS];

export interface SequenceState {
  pendingSince: number | null;
}

export const IDLE_SEQUENCE: SequenceState = { pendingSince: null };

export interface SequenceStep {
  state: SequenceState;
  target: SequenceTarget | null;
  /** True when the key belonged to the sequence and must not trigger anything else. */
  consumed: boolean;
}

/** `G` arms the sequence for a second; the next key inside that window picks the destination. */
export function advanceSequence(
  state: SequenceState,
  key: string,
  now: number,
): SequenceStep {
  const lower = key.toLowerCase();
  const armed =
    state.pendingSince !== null &&
    now - state.pendingSince <= SEQUENCE_WINDOW_MS;

  if (armed) {
    const target =
      lower in SEQUENCE_TARGETS
        ? SEQUENCE_TARGETS[lower as keyof typeof SEQUENCE_TARGETS]
        : null;
    if (target) {
      return { state: IDLE_SEQUENCE, target, consumed: true };
    }
    if (lower === SEQUENCE_LEADER) {
      return { state: { pendingSince: now }, target: null, consumed: true };
    }
    return { state: IDLE_SEQUENCE, target: null, consumed: false };
  }

  if (lower === SEQUENCE_LEADER) {
    return { state: { pendingSince: now }, target: null, consumed: true };
  }
  return { state: IDLE_SEQUENCE, target: null, consumed: false };
}
