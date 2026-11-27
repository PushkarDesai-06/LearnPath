import {
  OPEN_PALETTE_EVENT,
  OPEN_SHORTCUTS_EVENT,
} from "@/components/shell/constants";

export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_PALETTE_EVENT));
}

export function openShortcutsSheet() {
  window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_EVENT));
}
