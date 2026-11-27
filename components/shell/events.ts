import {
  OPEN_PALETTE_EVENT,
  OPEN_SHORTCUTS_EVENT,
} from "@/components/shell/constants";

export type PaletteMode = "default" | "search";

export function openCommandPalette(mode: PaletteMode = "default") {
  window.dispatchEvent(
    new CustomEvent<{ mode: PaletteMode }>(OPEN_PALETTE_EVENT, {
      detail: { mode },
    }),
  );
}

export function openShortcutsSheet() {
  window.dispatchEvent(new CustomEvent(OPEN_SHORTCUTS_EVENT));
}
