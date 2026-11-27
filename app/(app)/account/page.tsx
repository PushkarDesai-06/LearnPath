import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { listTopics } from "@/lib/data/topics";
import { initials } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoutButton } from "@/components/LogoutButton";

// Rendered on the server, so pin locale and zone: the output must not depend
// on where the server happens to run.
const MEMBER_SINCE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default async function AccountPage() {
  const user = await requireUserOrRedirect();
  // Topics double as the account's learning rollup, so no extra query.
  const topics = await listTopics(user._id.toHexString());
  const { email } = user;
  const displayName = user.displayName ?? null;
  const createdAt = user.createdAt;

  const totals = topics.reduce(
    (acc, t) => ({
      lessonsMastered: acc.lessonsMastered + t.summary.lessonsMastered,
      lessonsTotal: acc.lessonsTotal + t.summary.lessonsTotal,
      modulesCompleted: acc.modulesCompleted + t.summary.modulesCompleted,
      modulesTotal: acc.modulesTotal + t.summary.modulesTotal,
      mastery: acc.mastery + t.summary.overallMastery,
    }),
    {
      lessonsMastered: 0,
      lessonsTotal: 0,
      modulesCompleted: 0,
      modulesTotal: 0,
      mastery: 0,
    },
  );
  // Mean of the per-topic averages — every topic counts the same, regardless of
  // how many lessons it happens to hold.
  const avgMastery =
    topics.length > 0 ? Math.round((totals.mastery / topics.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <header className="flex items-center gap-4">
        <Avatar size="lg">
          <AvatarFallback className="font-medium">
            {initials(email, displayName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
            Account
          </p>
          <h1 className="h-display truncate text-3xl sm:text-4xl">
            {displayName || email.split("@")[0]}
          </h1>
        </div>
      </header>

      {/* Instrument-panel stats — same strip the dashboard uses, across topics */}
      <section className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
        <Stat label="Topics" value={String(topics.length)} />
        <Stat
          label="Lessons mastered"
          value={`${totals.lessonsMastered}/${totals.lessonsTotal}`}
        />
        <Stat
          label="Modules done"
          value={`${totals.modulesCompleted}/${totals.modulesTotal}`}
        />
        <Stat label="Avg mastery" value={`${avgMastery}%`} />
      </section>

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Details</CardTitle>
          <CardDescription>
            How LearnPath knows you. Get in touch to change your email.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Detail label="Email" value={email} mono />
          <Detail label="Display name" value={displayName || "Not set"} />
          <div className="flex flex-col gap-0.5">
            <p className="text-muted-foreground/80 font-mono text-[10px] uppercase tracking-[0.16em]">
              Member since
            </p>
            <time dateTime={createdAt.toISOString()} className="truncate text-sm">
              {MEMBER_SINCE.format(createdAt)}
            </time>
          </div>
        </CardContent>
      </Card>

      {/* Studies */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Your studies</CardTitle>
          <CardDescription>
            {topics.length === 0
              ? "No topics yet — describe a goal and LearnPath builds the path."
              : `${topics.length} ${topics.length === 1 ? "topic" : "topics"} on your shelf.`}
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex gap-1">
          {topics.length === 0 ? (
            <Button asChild>
              <Link href="/onboarding?new=1">
                <Plus data-icon="inline-start" />
                New topic
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" asChild>
              <Link href="/topics">
                All topics
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Session */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Session</CardTitle>
          <CardDescription>
            Signing out ends this session on this device.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <LogoutButton />
        </CardFooter>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="font-mono text-2xl font-normal tabular-nums">{value}</p>
      <p className="text-muted-foreground/80 font-mono text-[10px] uppercase tracking-[0.16em]">
        {label}
      </p>
    </div>
  );
}

function Detail({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-muted-foreground/80 font-mono text-[10px] uppercase tracking-[0.16em]">
        {label}
      </p>
      <p className={mono ? "truncate font-mono text-sm" : "truncate text-sm"}>
        {value}
      </p>
    </div>
  );
}
