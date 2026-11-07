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
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Topics" };

export default async function TopicsPage() {
  const user = await requireUserOrRedirect();
  const userId = user._id.toHexString();
  const [topics, inProgress] = await Promise.all([
    listTopics(userId),
    listInProgressFunnels(userId),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Your studies"
        title="Topics"
        actions={
          // With no topics the empty state carries the one call to action.
          topics.length > 0 && (
            <Button asChild className="cta-path">
              <Link href="/onboarding?new=1">
                <Plus
                  data-icon="inline-start"
                  className="transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/button:rotate-90"
                />
                New topic
                {/* Draws the trail on hover — see `.cta-path` in globals.css. */}
                <span aria-hidden className="cta-trail" />
              </Link>
            </Button>
          )
        }
      />

      {inProgress.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
            Unfinished setup
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
                        : p.status === "ready"
                          ? "Quiz not taken yet"
                          : "Quiz unfinished"}
                    </p>
                  </div>
                  <Button variant="secondary" asChild>
                    <Link
                      href={`/${p.next}?ob=${p.onboardingId}`}
                      aria-label={`Continue ${p.topic}`}
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
        <EmptyState
          icon={BookOpen}
          title="Pick something you want to learn."
          description="Describe a goal; LearnPath builds the path."
          action={{ href: "/onboarding?new=1", label: "Start your first topic" }}
        />
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
                  <Progress value={pct} aria-label={`${t.title} mastery`} />
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
