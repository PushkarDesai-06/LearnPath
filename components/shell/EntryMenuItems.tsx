"use client";

import { useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { CopyCheckIcon } from "@/components/icons/animated";
import type { RowMenuEntry } from "@/components/shell/rowMenus";

export async function copyLink(href: string) {
  try {
    await navigator.clipboard.writeText(
      new URL(href, window.location.origin).toString(),
    );
    toast.success("Link copied");
    return true;
  } catch {
    toast.error("Could not copy the link");
    return false;
  }
}

const PARTS = {
  dropdown: {
    Item: DropdownMenuItem,
    Separator: DropdownMenuSeparator,
    Shortcut: DropdownMenuShortcut,
  },
  context: {
    Item: ContextMenuItem,
    Separator: ContextMenuSeparator,
    Shortcut: ContextMenuShortcut,
  },
} as const;

/**
 * Menu content that moves focus on its own (a dialog or an inline field opens)
 * must not have Radix hand focus back to the trigger when the menu closes.
 * Spread `contentProps` on the menu content and `markFocusMoved` into the items.
 */
export function useFocusHandoff() {
  const moved = useRef(false);
  return {
    markFocusMoved: () => {
      moved.current = true;
    },
    contentProps: {
      onCloseAutoFocus: (event: Event) => {
        if (!moved.current) return;
        moved.current = false;
        event.preventDefault();
      },
    },
  };
}

/** Renders row menu entries inside a dropdown or a context menu, so both show the same list. */
export function EntryMenuItems({
  entries,
  kind,
  copy,
  onFocusMoved,
}: {
  entries: RowMenuEntry[];
  kind: "dropdown" | "context";
  /** A menu that stays open after Copy shows the check through this. */
  copy?: { copied: boolean; onCopy: (href: string) => void | Promise<unknown> };
  onFocusMoved?: () => void;
}) {
  const { Item, Separator, Shortcut } = PARTS[kind];

  return entries.map((entry, index) => {
    if (entry.type === "separator") return <Separator key={`sep-${index}`} />;

    if (entry.type === "link") {
      return (
        <Item key={entry.id} asChild>
          {entry.download ? (
            <a href={entry.href} download>
              {entry.icon}
              {entry.label}
            </a>
          ) : entry.newTab ? (
            <a href={entry.href} target="_blank" rel="noopener noreferrer">
              {entry.icon}
              {entry.label}
            </a>
          ) : (
            <Link href={entry.href}>
              {entry.icon}
              {entry.label}
              {entry.shortcut ? <Shortcut>{entry.shortcut}</Shortcut> : null}
            </Link>
          )}
        </Item>
      );
    }

    if (entry.type === "copy") {
      return (
        <Item
          key={entry.id}
          onSelect={(event) => {
            if (copy) event.preventDefault();
            void (copy ? copy.onCopy(entry.href) : copyLink(entry.href));
          }}
        >
          <CopyCheckIcon copied={copy?.copied ?? false} className="size-3.5" />
          {entry.label}
        </Item>
      );
    }

    return (
      <Item
        key={entry.id}
        variant={entry.destructive ? "destructive" : "default"}
        onSelect={() => {
          if (entry.movesFocus) onFocusMoved?.();
          void entry.onSelect();
        }}
      >
        {entry.icon}
        {entry.label}
        {entry.shortcut ? <Shortcut>{entry.shortcut}</Shortcut> : null}
      </Item>
    );
  });
}
