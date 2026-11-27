export type ShortcutKind = "chord" | "symbol" | "letter";

export interface ShortcutEventInfo {
  kind: ShortcutKind;
  isComposing: boolean;
  defaultPrevented: boolean;
  repeat: boolean;
  typing: boolean;
  /** A dialog or menu other than the one the shortcut itself controls is open. */
  overlayOpen: boolean;
  /** The current page binds bare letters itself (an active flashcard review). */
  pageOwnsLetters: boolean;
}

/**
 * Decides whether a global shortcut must stay out of the way. Chords (Ctrl or
 * Cmd) still work from inside text fields; bare keys never do.
 */
export function shouldIgnoreShortcut(info: ShortcutEventInfo) {
  if (info.isComposing || info.defaultPrevented || info.overlayOpen) return true;
  if (info.kind === "chord") return false;
  if (info.repeat || info.typing) return true;
  return info.kind === "letter" && info.pageOwnsLetters;
}

export function pageOwnsLetters(pathname: string) {
  return pathname === "/flashcards";
}
