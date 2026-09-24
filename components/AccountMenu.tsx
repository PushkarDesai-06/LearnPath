"use client";

/**
 * Topbar account menu — the avatar is the only identity chrome in the bar; the
 * email and the log-out action live behind it (and on /account).
 */

import { useTransition } from "react";
import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AccountMenu({
  email,
  displayName,
}: {
  email: string;
  displayName?: string | null;
}) {
  const [pending, startTransition] = useTransition();

  function logout() {
    toast.success("Logged out");
    // The action clears the cookie and redirects to /login in one round trip;
    // the cookie write re-renders the root layout, so the Nav goes bare.
    startTransition(() => logoutAction());
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Account"
        >
          <Avatar size="sm">
            <AvatarFallback className="text-[10px] font-medium">
              {initials(email, displayName)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          {displayName && (
            <span className="text-foreground text-sm font-medium">
              {displayName}
            </span>
          )}
          <span className="truncate font-mono text-[11px] font-normal">
            {email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/account">
              <UserRound />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            disabled={pending}
            onSelect={logout}
          >
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
