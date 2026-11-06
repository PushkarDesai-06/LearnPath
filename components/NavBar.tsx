/**
 * Topbar markup. A Server Component: the identity and topic list arrive as
 * props (resolved server-side by `Nav`), and only the dropdowns and the topic
 * row are client islands.
 *
 * Also the Suspense fallback while `Nav` resolves. `signedIn` (cookie presence,
 * known without a DB read) lets that fallback hold the signed-in geometry, so
 * the links and avatar don't pop in a beat after the logo.
 */
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TopicBar, TopicBarSlot, type SwitcherTopic } from "@/components/TopicBar";
import { AccountMenu } from "@/components/AccountMenu";
import { NavLink } from "@/components/NavLink";
import type { SessionUser } from "@/lib/auth/types";
import logo from "../public/logo.svg";

export function NavBar({
  user,
  topics,
  signedIn = !!user,
}: {
  user: SessionUser | null;
  topics: SwitcherTopic[];
  /** Fallback only: a session cookie is present, the user isn't resolved yet. */
  signedIn?: boolean;
}) {
  return (
    <header className="bg-background/70 sticky top-0 z-10 border-b border-border/60 backdrop-blur-xl">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 w-full max-w-4xl items-center gap-2 px-4 sm:px-6"
      >
        <Link
          href={user ? "/topics" : "/"}
          className="logo-lockup mr-2 flex items-center gap-2 font-medium tracking-tight"
        >
          {/* Hover sends a ring out from behind the mark and runs a sweep
              across the wordmark — see `.logo-lockup` in globals.css. */}
          <span className="logo-mark">
            <Image src={logo} width={20} height={0} alt="" className="invert" />
          </span>
          <span className="logo-word text-base font-semibold tracking-tight">LearnPath</span>
        </Link>
        {user ? (
          <>
            <NavLink href="/topics">Topics</NavLink>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/onboarding?new=1" aria-label="New topic">
                <Plus data-icon="inline-start" />
                <span className="hidden sm:inline">New topic</span>
              </Link>
            </Button>
            <div className="ml-auto flex shrink-0 items-center">
              <AccountMenu email={user.email} displayName={user.displayName} />
            </div>
          </>
        ) : signedIn ? (
          <>
            <Skeleton className="h-5 w-14" />
            <Skeleton className="ml-2 h-5 w-20" />
            <Skeleton className="ml-auto size-8 rounded-full" />
          </>
        ) : (
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/login?mode=signup">Get started</Link>
            </Button>
          </div>
        )}
      </nav>
      {user ? <TopicBar topics={topics} /> : signedIn && <TopicBarSlot />}
    </header>
  );
}
