"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Kbd } from "@/components/ui/kbd";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { ShortcutsSheet } from "@/components/shell/ShortcutsSheet";
import { useShellSnapshot } from "@/components/shell/ShellDataContext";
import { useSidebarTopic } from "@/components/shell/useSidebarTopic";
import {
  NEW_TOPIC_HREF,
  OPEN_PALETTE_EVENT,
  OPEN_SHORTCUTS_EVENT,
} from "@/components/shell/constants";
import type { PaletteMode } from "@/components/shell/events";
import { useThemeCycle } from "@/components/useThemeCycle";
import {
  advanceSequence,
  IDLE_SEQUENCE,
  SEQUENCE_WINDOW_MS,
  type SequenceState,
  type SequenceTarget,
} from "@/lib/client/keySequence";
import { hasOpenOverlay, isTypingTarget } from "@/lib/client/keys";
import { useNavigate } from "@/lib/client/progress";
import {
  pageOwnsLetters,
  shouldIgnoreShortcut,
  type ShortcutKind,
} from "@/lib/client/shortcutRules";

function destination(target: SequenceTarget, scope: string) {
  switch (target) {
    case "dashboard":
      return `/dashboard${scope}`;
    case "review":
      return `/flashcards${scope}`;
    case "tutor":
      return `/tutor${scope}`;
    case "topics":
      return "/topics";
    case "account":
      return "/account";
  }
}

/**
 * Owns the global keys and the two overlays they open. Mounted once in the shell,
 * so the palette and the shortcuts sheet are reachable from every signed in page.
 */
export function ShortcutsProvider() {
  const pathname = usePathname();
  const navigate = useNavigate();
  const { cycle } = useThemeCycle();
  const { topics } = useShellSnapshot();
  const { fallbackId } = useSidebarTopic(topics.map((t) => t.id));

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>("default");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [awaiting, setAwaiting] = useState(false);

  const sequence = useRef<SequenceState>(IDLE_SEQUENCE);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const live = useRef({ paletteOpen, sheetOpen });
  useEffect(() => {
    live.current = { paletteOpen, sheetOpen };
  });

  const openPalette = useCallback((mode: PaletteMode) => {
    setSheetOpen(false);
    setPaletteMode(mode);
    setPaletteOpen(true);
  }, []);

  const openSheet = useCallback(() => {
    setPaletteOpen(false);
    setSheetOpen(true);
  }, []);

  useEffect(() => {
    const onPalette = (event: Event) => {
      const mode = (event as CustomEvent<{ mode?: PaletteMode }>).detail?.mode;
      openPalette(mode === "search" ? "search" : "default");
    };
    window.addEventListener(OPEN_PALETTE_EVENT, onPalette);
    window.addEventListener(OPEN_SHORTCUTS_EVENT, openSheet);
    return () => {
      window.removeEventListener(OPEN_PALETTE_EVENT, onPalette);
      window.removeEventListener(OPEN_SHORTCUTS_EVENT, openSheet);
    };
  }, [openPalette, openSheet]);

  useEffect(() => {
    const scope = fallbackId ? `?id=${fallbackId}` : "";
    const ownsLetters = pageOwnsLetters(pathname);

    const disarm = () => {
      clearTimeout(timer.current);
      sequence.current = IDLE_SEQUENCE;
      setAwaiting(false);
    };

    const ignored = (event: KeyboardEvent, kind: ShortcutKind) => {
      return shouldIgnoreShortcut({
        kind,
        isComposing: event.isComposing,
        defaultPrevented: event.defaultPrevented,
        repeat: event.repeat,
        typing: isTypingTarget(event.target),
        overlayOpen:
          hasOpenOverlay() && !(kind === "chord" && live.current.paletteOpen),
        pageOwnsLetters: ownsLetters,
      });
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (event.altKey) return;
        if (key === "k" && !event.shiftKey) {
          if (ignored(event, "chord")) return;
          event.preventDefault();
          if (live.current.paletteOpen) setPaletteOpen(false);
          else openPalette("default");
        } else if (key === "l" && event.shiftKey) {
          if (ignored(event, "chord")) return;
          event.preventDefault();
          cycle();
        }
        return;
      }
      if (event.altKey) return;

      if (event.key === "?") {
        if (ignored(event, "symbol")) return;
        event.preventDefault();
        openSheet();
        return;
      }
      if (event.key === "/" && !event.shiftKey) {
        if (ignored(event, "symbol")) return;
        event.preventDefault();
        openPalette("search");
        return;
      }

      if (event.shiftKey || key.length !== 1 || ignored(event, "letter")) {
        disarm();
        return;
      }

      const step = advanceSequence(sequence.current, key, Date.now());
      sequence.current = step.state;
      if (step.consumed) {
        event.preventDefault();
        clearTimeout(timer.current);
        if (step.target) {
          setAwaiting(false);
          navigate.push(destination(step.target, scope));
        } else {
          setAwaiting(true);
          timer.current = setTimeout(disarm, SEQUENCE_WINDOW_MS);
        }
        return;
      }
      disarm();
      if (key === "c") {
        event.preventDefault();
        navigate.push(NEW_TOPIC_HREF);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer.current);
    };
  }, [pathname, fallbackId, navigate, cycle, openPalette, openSheet]);

  return (
    <>
      {awaiting ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-lg bg-popover px-2.5 py-1.5 text-xs text-muted-foreground shadow-(--shadow-pop) animate-in fade-in-0 duration-(--dur-fast)"
        >
          <Kbd>G</Kbd>
          then D, R, T, A or S
        </div>
      ) : null}
      <CommandPalette
        open={paletteOpen}
        mode={paletteMode}
        onOpenChange={setPaletteOpen}
      />
      <ShortcutsSheet open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  );
}
