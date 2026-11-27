"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
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
import {
  SidebarDropdownMenu,
  useSidebarUi,
} from "@/components/shell/SidebarUi";
import type { RowMenuEntry } from "@/components/shell/rowMenus";
import { cn } from "@/lib/utils";

const COPIED_HOLD_MS = 700;

/** The 3 dot button of a sidebar row. Revealed on hover and focus, always shown on touch. */
export function RowMenu({
  entries,
  label,
  className,
}: {
  entries: RowMenuEntry[];
  label: string;
  className?: string;
}) {
  const { menuSide } = useSidebarUi();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => () => clearTimeout(closeTimer.current), []);

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
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setCopied(false);
    }, COPIED_HOLD_MS);
  }

  return (
    <SidebarDropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={label}
              className={cn(
                "absolute top-1 right-1 opacity-0 transition-opacity duration-(--dur-fast)",
                "group-hover/row:opacity-100 group-focus-within/row:opacity-100 data-[state=open]:opacity-100",
                "[@media(hover:none)]:opacity-100",
                "group-data-[rail=true]/rail:hidden",
                className,
              )}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        side={menuSide("bottom")}
        align="start"
        className="w-52"
      >
        {entries.map((entry, index) => {
          if (entry.type === "separator")
            return <DropdownMenuSeparator key={`sep-${index}`} />;
          if (entry.type === "link") {
            return (
              <DropdownMenuItem key={entry.id} asChild>
                {entry.newTab ? (
                  <a
                    href={entry.href}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {entry.icon}
                    {entry.label}
                  </a>
                ) : (
                  <Link href={entry.href}>
                    {entry.icon}
                    {entry.label}
                    {entry.shortcut ? (
                      <DropdownMenuShortcut>
                        {entry.shortcut}
                      </DropdownMenuShortcut>
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
    </SidebarDropdownMenu>
  );
}
