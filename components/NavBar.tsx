/**
 * Topbar markup. A Server Component: the identity and topic list arrive as
 * props (resolved server-side by `Nav`), and only the dropdowns are client
 * islands. Rendered with `user={null}` as the Suspense fallback, which is the
 * logo-only bar.
 */
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TopicSwitcher, type SwitcherTopic } from "@/components/TopicSwitcher";
import { AccountMenu } from "@/components/AccountMenu";
import type { SessionUser } from "@/lib/auth/types";
import logo from "../public/logo.svg";

export function NavBar({
  user,
  topics,
}: {
  user: SessionUser | null;
  topics: SwitcherTopic[];
}) {
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
        {user && (
          <>
            <TopicSwitcher topics={topics} />
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
              <AccountMenu email={user.email} displayName={user.displayName} />
            </div>
          </>
        )}
      </nav>
    </header>
  );
}
