"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronIcon } from "@/components/icons/animated";
import { EntryContextMenu } from "@/components/shell/EntryMenu";
import type { RowMenuEntry } from "@/components/shell/rowMenus";
import { useSidebarUi } from "@/components/shell/SidebarUi";
import { cn } from "@/lib/utils";

export const rowClass = cn(
  "group/link relative flex h-7 w-full min-w-0 items-center gap-2 overflow-hidden rounded-md pl-[10px] pr-1.5 text-left text-[13px] text-fg-2 outline-none",
  "transition-colors duration-(--dur-fast) ease-(--ease-out)",
  "hover:bg-hover hover:text-foreground active:bg-active",
  "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
  "data-[active=true]:bg-active data-[active=true]:text-foreground",
);

export const rowIconClass =
  "flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-colors duration-(--dur-fast) group-hover/link:text-foreground group-data-[active=true]/link:text-foreground [&_svg]:size-4";

/** Labels fade out as the rail narrows; the row clips them. */
export const labelClass =
  "min-w-0 flex-1 truncate transition-opacity duration-(--dur-base) group-data-[rail=true]/rail:opacity-0";

export const trailingClass =
  "shrink-0 transition-opacity duration-(--dur-base) group-data-[rail=true]/rail:pointer-events-none group-data-[rail=true]/rail:opacity-0";

/** Subtle sweep over the link that is still navigating. Must render inside a Link. */
function LinkShimmer() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-(--dur-fast)",
        "bg-linear-to-r from-transparent via-foreground/10 to-transparent",
        pending &&
          "animate-[lp-shimmer_1100ms_linear_infinite] opacity-100 motion-reduce:animate-none",
      )}
    />
  );
}

/** Tooltip that only shows while the sidebar is the icon rail, unless `always` is set. */
export function RowTooltip({
  children,
  label,
  detail,
  always = false,
}: {
  children: ReactNode;
  label: string;
  detail?: string;
  always?: boolean;
}) {
  const { rail } = useSidebarUi();
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" hidden={!rail && !always}>
        <span className="flex flex-col">
          <span>{label}</span>
          {detail ? (
            <span className="text-muted-foreground">{detail}</span>
          ) : null}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export function SidebarLinkRow({
  href,
  icon,
  label,
  active = false,
  trailing,
  menu,
  tooltip,
  className,
  linkProps,
  contextEntries,
  liProps,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  /** Sits inside the link, right aligned, hidden in the rail. */
  trailing?: ReactNode;
  /** Rendered beside the link, never inside it. Reserves its space so text never shifts. */
  menu?: ReactNode;
  tooltip?: { detail?: string; always?: boolean };
  className?: string;
  linkProps?: Omit<ComponentProps<typeof Link>, "href" | "className">;
  /** Right click on the row opens these entries, normally the same list as `menu`. */
  contextEntries?: RowMenuEntry[];
  liProps?: ComponentProps<"li"> & { [attribute: `data-${string}`]: string | undefined };
}) {
  const link = (
    <Link
      href={href}
      data-active={active}
      aria-current={active ? "page" : undefined}
      className={cn("group", rowClass, menu && "pr-8", className)}
      {...linkProps}
    >
      <span className={rowIconClass}>{icon}</span>
      <span className={labelClass}>{label}</span>
      {trailing ? <span className={trailingClass}>{trailing}</span> : null}
      <LinkShimmer />
    </Link>
  );

  const row = (
    <li
      {...liProps}
      className={cn("group/row relative", liProps?.className)}
    >
      <RowTooltip
        label={label}
        detail={tooltip?.detail}
        always={tooltip?.always}
      >
        {link}
      </RowTooltip>
      {menu}
    </li>
  );

  return contextEntries ? (
    <EntryContextMenu entries={contextEntries}>{row}</EntryContextMenu>
  ) : (
    row
  );
}

export function CountChip({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="rounded bg-surface-3 px-1.5 text-[11px] text-muted-foreground tabular-nums">
      {value > 99 ? "99+" : value}
    </span>
  );
}

export function GroupHeader({
  label,
  open,
  onToggle,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className={cn(
        "group/header relative flex h-6 w-full items-center gap-1 rounded-md px-[10px] text-[11.5px] font-medium text-faint outline-none",
        "transition-colors duration-(--dur-fast) hover:text-muted-foreground",
        "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
        "group-data-[rail=true]/rail:pointer-events-none",
      )}
    >
      <span className="truncate transition-opacity duration-(--dur-base) group-data-[rail=true]/rail:opacity-0">
        {label}
      </span>
      <ChevronIcon
        open={open}
        className="size-2.5 shrink-0 transition-opacity duration-(--dur-base) group-data-[rail=true]/rail:opacity-0"
      />
      <span
        aria-hidden
        className="absolute left-1/2 hidden h-px w-4 -translate-x-1/2 bg-border-strong opacity-0 transition-opacity duration-(--dur-base) group-data-[rail=true]/rail:block group-data-[rail=true]/rail:opacity-100"
      />
    </button>
  );
}

/** Height animates with the grid rows trick, so content of any size can collapse. */
export function AnimatedHeight({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      inert={!open}
      className={cn(
        "grid transition-[grid-template-rows] duration-(--dur-slow) ease-(--ease-out) motion-reduce:transition-none",
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
