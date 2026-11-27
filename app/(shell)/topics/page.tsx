import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth/current";
import {
  listArchivedTopics,
  listInProgressFunnels,
  listTopics,
} from "@/lib/data/topics";
import { getShellData } from "@/lib/data/shell";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/icons/animated";
import { PageContainer } from "@/components/shell/PageContainer";
import { PageHeader } from "@/components/shell/PageHeader";
import { TopicsView, type TopicRow } from "./TopicsView";

// Rendered on the server, so pin locale and zone: the output must not depend
// on where the server happens to run.
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export default async function TopicsPage() {
  const user = await requireUserOrRedirect();
  const userId = user._id.toHexString();
  const [topics, archived, funnels, shell] = await Promise.all([
    listTopics(userId),
    listArchivedTopics(userId),
    listInProgressFunnels(userId),
    getShellData(userId),
  ]);

  const dueByTopic = new Map(shell.topics.map((t) => [t.id, t.dueCards]));
  const rows: TopicRow[] = topics.map((t) => ({
    id: t.id,
    title: t.title,
    domain: t.domain,
    mastery: t.summary.overallMastery,
    lessonsMastered: t.summary.lessonsMastered,
    lessonsTotal: t.summary.lessonsTotal,
    modulesCompleted: t.summary.modulesCompleted,
    modulesTotal: t.summary.modulesTotal,
    dueCards: dueByTopic.get(t.id) ?? 0,
    createdLabel: SHORT_DATE.format(new Date(t.createdAt)),
  }));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Topics" }]}
        actions={
          <Button asChild size="sm">
            <Link href="/onboarding?new=1" className="group">
              <PlusIcon data-icon="inline-start" />
              New topic
            </Link>
          </Button>
        }
      />
      <PageContainer>
        <TopicsView
          topics={rows}
          archived={archived.map((a) => ({
            id: a.id,
            title: a.title,
            archivedLabel: SHORT_DATE.format(new Date(a.archivedAt)),
          }))}
          funnels={funnels}
        />
      </PageContainer>
    </>
  );
}
