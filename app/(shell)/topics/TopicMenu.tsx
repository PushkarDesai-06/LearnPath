"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CopyCheckIcon } from "@/components/icons/animated";
import type { RowMenuEntry } from "@/components/shell/rowMenus";
import { cn } from "@/lib/utils";

const COPIED_HOLD_MS = 700;

/** 3 dot menu for a topic row or card. Renders whatever entries the row menu builder returns. */
export function TopicMenu({
  entries,
  label,
  className,
}: {
  entries: RowMenuEntry[];
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy(href: string) {
    try {
      await navigator.clipboard.writeText(
        new URL(href, window.location.origin).toString(),
      );
      setCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpen(false);
      setCopied(false);
    }, COPIED_HOLD_MS);
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              className={cn(
                "relative z-10 transition-opacity duration-(--dur-fast)",
                "[@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
                className,
              )}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-52">
        {entries.map((entry, index) => {
          if (entry.type === "separator")
            return <DropdownMenuSeparator key={`sep-${index}`} />;
          if (entry.type === "link") {
            return (
              <DropdownMenuItem key={entry.id} asChild>
                {entry.newTab ? (
                  <a href={entry.href} target="_blank" rel="noopener noreferrer">
                    {entry.icon}
                    {entry.label}
                  </a>
                ) : (
                  <Link href={entry.href}>
                    {entry.icon}
                    {entry.label}
                    {entry.shortcut ? (
                      <DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
                    ) : null}
                  </Link>
                )}
              </DropdownMenuItem>
            );
          }
          if (entry.type === "copy") {
            return (
              <DropdownMenuItem
                key={entry.id}
                onSelect={(event) => {
                  event.preventDefault();
                  void copy(entry.href);
                }}
              >
                <CopyCheckIcon copied={copied} />
                {entry.label}
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem
              key={entry.id}
              variant={entry.destructive ? "destructive" : "default"}
              onSelect={() => void entry.onSelect()}
            >
              {entry.icon}
              {entry.label}
              {entry.shortcut ? (
                <DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
