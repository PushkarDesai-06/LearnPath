"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopicSwitcher } from "@/components/TopicSwitcher";
import { AccountMenu } from "@/components/AccountMenu";
import { useSession } from "@/components/SessionProvider";
import Image from "next/image";
import logo from "../public/logo.svg";

export function Nav() {
  // Undefined (still resolving) and null (signed out) both render bare chrome.
  const { me, signOut } = useSession();

  return (
    <header className="bg-background/70 sticky top-0 z-10 border-b border-border/60 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-medium tracking-tight"
        >
          {/* Logo mark — a mint dot tracing back to the trail rail signature */}
          <span className="">
            <Image
              src={logo}
              width={20}
              height={0}
              alt="logo"
              className="invert"
            />
          </span>
          <span className="text-base font-semibold tracking-tight">
            LearnPath
          </span>
        </Link>
        {me && (
          <>
            <TopicSwitcher />
            <div className="flex items-center">
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
            <div className="ml-auto flex items-center">
              <AccountMenu
                email={me.email}
                displayName={me.displayName}
                onLogout={signOut}
              />
            </div>
          </>
        )}
      </nav>
    </header>
  );
}
