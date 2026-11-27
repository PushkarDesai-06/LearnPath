"use client";

/** True when a key press belongs to a text field, so global shortcuts must stay out of the way. */
export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.getAttribute("role") === "textbox";
}

export function hasOpenOverlay() {
  return (
    document.querySelector(
      '[role="dialog"], [role="alertdialog"], [role="menu"]',
    ) !== null
  );
}

/** A plain, unmodified key press outside inputs and IME composition. */
export function isPlainShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.isComposing || event.repeat) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  return !isTypingTarget(event.target);
}
