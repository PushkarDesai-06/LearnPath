"use client";

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

async function copyLink(href: string) {
  try {
    await navigator.clipboard.writeText(
      new URL(href, window.location.origin).toString(),
    );
    toast.success("Link copied");
  } catch {
    toast.error("Could not copy the link");
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

/** Renders row menu entries inside a dropdown or a context menu, so both show the same list. */
export function EntryMenuItems({
  entries,
  kind,
}: {
  entries: RowMenuEntry[];
  kind: "dropdown" | "context";
}) {
  const { Item, Separator, Shortcut } = PARTS[kind];

  return entries.map((entry, index) => {
    if (entry.type === "separator") return <Separator key={`sep-${index}`} />;

    if (entry.type === "link") {
      return (
        <Item key={entry.id} asChild>
          {entry.newTab ? (
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
        <Item key={entry.id} onSelect={() => void copyLink(entry.href)}>
          <CopyCheckIcon copied={false} className="size-3.5" />
          {entry.label}
        </Item>
      );
    }

    return (
      <Item
        key={entry.id}
        variant={entry.destructive ? "destructive" : "default"}
        onSelect={() => void entry.onSelect()}
      >
        {entry.icon}
        {entry.label}
        {entry.shortcut ? <Shortcut>{entry.shortcut}</Shortcut> : null}
      </Item>
    );
  });
}
