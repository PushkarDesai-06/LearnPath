"use client";

import { Home, Layers, LayoutGrid, MessageSquare } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { SearchIcon } from "@/components/icons/animated";
import {
  CountChip,
  labelClass,
  RowTooltip,
  SidebarLinkRow,
  trailingClass,
} from "@/components/shell/SidebarRow";
import { openCommandPalette } from "@/components/shell/events";
import { useIsMac } from "@/lib/client/platform";
import { cn } from "@/lib/utils";

export function SidebarSearch() {
  const isMac = useIsMac();
  const shortcut = isMac ? "⌘K" : "Ctrl K";

  return (
    <div className="px-2 pt-1 pb-2">
      <RowTooltip label={`Search  ${shortcut}`}>
        <button
          type="button"
          aria-label="Search"
          onClick={() => openCommandPalette()}
          className={cn(
            "group/link group flex h-7 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md bg-surface-1 pl-[10px] pr-1 text-left text-[13px] text-faint outline-none",
            "shadow-[inset_0_0_0_1px_var(--border)] transition-[box-shadow,color] duration-(--dur-fast) ease-(--ease-out)",
            "hover:text-muted-foreground hover:shadow-[inset_0_0_0_1px_var(--border-strong)] active:bg-active",
            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
          )}
        >
          <span className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-3.5">
            <SearchIcon />
          </span>
          <span className={labelClass}>Search</span>
          <Kbd className={cn("h-[18px] text-[10px]", trailingClass)}>
            {shortcut}
          </Kbd>
        </button>
      </RowTooltip>
    </div>
  );
}

interface PrimaryNavProps {
  pathname: string;
  topicId: string | null;
  dueCards: number;
}

export function PrimaryNav({ pathname, topicId, dueCards }: PrimaryNavProps) {
  const scope = topicId ? `?id=${topicId}` : "";
  const items = [
    {
      href: `/dashboard${scope}`,
      route: "/dashboard",
      label: "Dashboard",
      icon: <Home />,
    },
    {
      href: `/flashcards${scope}`,
      route: "/flashcards",
      label: "Review",
      icon: <Layers />,
      trailing: <CountChip value={dueCards} />,
    },
    {
      href: `/tutor${scope}`,
      route: "/tutor",
      label: "Tutor",
      icon: <MessageSquare />,
    },
    {
      href: "/topics",
      route: "/topics",
      label: "All topics",
      icon: <LayoutGrid />,
    },
  ];

  return (
    <nav aria-label="Primary" className="px-2">
      <ul className="flex flex-col gap-px">
        {items.map((item) => (
          <SidebarLinkRow
            key={item.route}
            href={item.href}
            icon={item.icon}
            label={item.label}
            trailing={item.trailing}
            active={pathname === item.route}
          />
        ))}
      </ul>
    </nav>
  );
}
