"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Keyboard,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  SunMoon,
  SquarePen,
} from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LogoTile } from "@/components/brand/Logo";
import {
  THEME_LABEL,
  THEME_ORDER,
  useThemeCycle,
  type ThemeChoice,
} from "@/components/useThemeCycle";
import {
  SidebarDropdownMenu,
  useSidebarUi,
} from "@/components/shell/SidebarUi";
import { openShortcutsSheet } from "@/components/shell/events";
import { NEW_TOPIC_HREF } from "@/components/shell/constants";
import { cn } from "@/lib/utils";

const THEME_ICON: Record<ThemeChoice, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function SidebarHeader({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const { menuSide } = useSidebarUi();
  const { theme, setTheme } = useThemeCycle();
  const [pending, startTransition] = useTransition();

  function logout() {
    toast.success("Logged out");
    startTransition(() => logoutAction());
  }

  return (
    <div className="flex items-center gap-1 p-2 pb-1 group-data-[rail=true]/rail:flex-col">
      <SidebarDropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-8 min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md pr-2 pl-2 text-left text-[13px] font-medium outline-none",
              "transition-colors duration-(--dur-fast) hover:bg-hover data-[state=open]:bg-active active:bg-active",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
              "group-data-[rail=true]/rail:flex-none group-data-[rail=true]/rail:self-stretch",
            )}
          >
            <LogoTile />
            <span className="min-w-0 flex-1 truncate transition-opacity duration-(--dur-base) group-data-[rail=true]/rail:opacity-0">
              {name}
            </span>
            <ChevronDown className="size-3 shrink-0 text-muted-foreground transition-opacity duration-(--dur-base) group-data-[rail=true]/rail:opacity-0" />
            <span className="sr-only">Account menu</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={menuSide("bottom")}
          align="start"
          className="w-60"
        >
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{name}</span>
            <span className="truncate font-mono text-[11px] font-normal">
              {email}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/account">
              <Settings />
              Account settings
              <DropdownMenuShortcut>G S</DropdownMenuShortcut>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <SunMoon />
              Theme
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) => setTheme(value as ThemeChoice)}
              >
                {THEME_ORDER.map((choice) => {
                  const Icon = THEME_ICON[choice];
                  return (
                    <DropdownMenuRadioItem key={choice} value={choice}>
                      <Icon />
                      {THEME_LABEL[choice]}
                    </DropdownMenuRadioItem>
                  );
                })}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onSelect={openShortcutsSheet}>
            <Keyboard />
            Keyboard shortcuts
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={logout}
          >
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </SidebarDropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="group-data-[rail=true]/rail:hidden"
          >
            <Link href={NEW_TOPIC_HREF} aria-label="New topic">
              <SquarePen />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent shortcut="C">New topic</TooltipContent>
      </Tooltip>
    </div>
  );
}
