"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, LogOut, Plus } from "lucide-react";
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
    <header className="bg-background/80 sticky top-0 z-10 border-b backdrop-blur">
      <nav className="mx-auto flex h-14 w-full max-w-3xl items-center gap-2 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <GraduationCap className="text-primary size-5" />
          LearnPath
        </Link>
        {me && (
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/topics">Topics</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/onboarding?new=1">
                <Plus data-icon="inline-start" />
                New topic
              </Link>
            </Button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-muted-foreground hidden text-sm sm:inline">
                {me.user.email}
              </span>
              <Separator orientation="vertical" className="hidden h-5 sm:block" />
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
