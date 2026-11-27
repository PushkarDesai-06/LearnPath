export const SIDEBAR_STATE_COOKIE = "sidebar_state";
export const SIDEBAR_WIDTH_COOKIE = "sidebar_width";

export const SIDEBAR_WIDTH_DEFAULT = 248;
export const SIDEBAR_WIDTH_MIN = 220;
export const SIDEBAR_WIDTH_MAX = 320;
export const SIDEBAR_WIDTH_RAIL = 52;

export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const PEEK_DELAY_MS = 300;

export function clampSidebarWidth(value: number) {
  if (!Number.isFinite(value)) return SIDEBAR_WIDTH_DEFAULT;
  return Math.min(
    SIDEBAR_WIDTH_MAX,
    Math.max(SIDEBAR_WIDTH_MIN, Math.round(value)),
  );
}

export const OPEN_PALETTE_EVENT = "lp:open-palette";
export const OPEN_SHORTCUTS_EVENT = "lp:open-shortcuts";

/** Pages that scope themselves to `?id=`. Anywhere else a topic is announced or absent. */
export const TOPIC_SCOPED_ROUTES = ["/dashboard", "/tutor", "/flashcards"];

export const NEW_TOPIC_HREF = "/onboarding?new=1";
