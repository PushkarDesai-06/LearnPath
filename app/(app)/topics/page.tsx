import Link from "next/link";
import { BookOpen, Plus, ArrowRight } from "lucide-react";
import { requireUserOrRedirect } from "@/lib/auth/current";
import { listInProgressFunnels, listTopics } from "@/lib/data/topics";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default async function TopicsPage() {
  const user = await requireUserOrRedirect();
  const userId = user._id.toHexString();
  const [topics, inProgress] = await Promise.all([
    listTopics(userId),
    listInProgressFunnels(userId),
  ]);

  return (
    <div className="flex flex-col gap-10">
      {/* Hero */}
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
            Your studies
          </p>
          <h1 className="h-display text-3xl sm:text-4xl">Topics</h1>
        </div>
        <Button asChild>
          <Link href="/onboarding?new=1">
            <Plus data-icon="inline-start" />
            New topic
          </Link>
        </Button>
      </header>

      {inProgress.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
            Pick up
          </h2>
          <div className="flex flex-col gap-2">
            {inProgress.map((p) => (
              <Card key={p.onboardingId} className="border-primary/20">
                <CardContent className="flex items-center justify-between gap-3 py-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="font-medium">{p.topic}</p>
                    <p className="text-muted-foreground text-xs">
                      {p.status === "clarifying"
                        ? "Setup unfinished"
                        : "Assessment unfinished"}
                    </p>
                  </div>
                  <Button variant="secondary" asChild>
                    <Link
                      href={
                        p.next === "onboarding" ? "/onboarding" : "/assessment"
                      }
                    >
                      Continue
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {topics.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BookOpen />
            </EmptyMedia>
            <EmptyTitle className="text-lg">
              Pick something you want to learn.
            </EmptyTitle>
            <EmptyDescription>
              Describe a goal; LearnPath builds the path.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild>
              <Link href="/onboarding?new=1">Start your first topic</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {topics.map((t) => {
            const pct = Math.round(t.summary.overallMastery * 100);
            return (
              <Card
                key={t.id}
                className="group hover:border-primary/30 flex flex-col transition-colors"
              >
                <CardHeader>
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-muted-foreground/80 font-mono text-[10px] uppercase tracking-[0.14em] truncate">
                        {t.domain}
                      </p>
                      <CardTitle className="truncate text-lg font-medium">
                        {t.title}
                      </CardTitle>
                    </div>
                    <span className="text-primary shrink-0 font-mono text-base tabular-nums">
                      {pct}%
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-end gap-3">
                  <Progress value={pct} />
                  <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.14em]">
                    {t.summary.lessonsMastered}/{t.summary.lessonsTotal} lessons
                    · {t.summary.modulesCompleted}/{t.summary.modulesTotal}{" "}
                    modules
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between gap-1">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/tutor?id=${t.id}`}>Tutor</Link>
                  </Button>
                  <Button size="sm" asChild>
                    <Link href={`/dashboard?id=${t.id}`}>
                      Open path
                      <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
