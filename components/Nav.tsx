"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Plus } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Me {
  user: { email: string };
}

export function Nav() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let active = true;
    api<Me>("/api/me")
      .then((res) => active && setMe(res))
      .catch(() => active && setMe(null));
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    setMe(null);
    toast.success("Logged out");
    router.push("/login");
  }

  return (
    <header className="bg-background/70 sticky top-0 z-10 border-b border-border/60 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-medium tracking-tight"
        >
          {/* Logo mark — a mint dot tracing back to the trail rail signature */}
          <span
            aria-hidden
            className="bg-primary shadow-primary/40 size-2 rounded-full shadow-[0_0_8px]"
          />
          <span className="font-display text-base italic">LearnPath</span>
        </Link>
        {me && (
          <>
            <div className="ml-1 flex items-center">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/topics">Topics</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/onboarding?new=1">
                  <Plus data-icon="inline-start" />
                  New topic
                </Link>
              </Button>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-muted-foreground hidden font-mono text-[11px] tracking-tight sm:inline">
                {me.user.email}
              </span>
              <Separator
                orientation="vertical"
                className="hidden h-4 sm:block"
              />
              <Button variant="ghost" size="sm" onClick={logout}>
                <LogOut data-icon="inline-start" />
                Log out
              </Button>
            </div>
          </>
        )}
      </nav>
    </header>
  );
}
