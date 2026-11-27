"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { LoadingRing } from "@/components/ui/loading-ring";

/** Ends the session via the logout Server Action (clears cookie + redirects). */
export function LogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="destructive"
      disabled={pending}
      onClick={() => {
        toast.success("Logged out");
        startTransition(() => logoutAction());
      }}
    >
      {pending ? (
        <LoadingRing data-icon="inline-start" className="text-current" />
      ) : (
        <LogOut data-icon="inline-start" />
      )}
      Log out
    </Button>
  );
}
