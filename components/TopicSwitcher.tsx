"use client";

/**
 * Topbar topic switcher. Topic-scoped pages read the active topic from `?id=`
 * and fall back to the learner's newest curriculum when it's absent (see
 * `resolveCurriculum`), so the trigger mirrors that: the matching topic, or the
 * first of the list when the URL carries no id. A lesson has no `?id=` but does
 * belong to a topic, so it announces one via `ActiveTopicMarker`. On any other
 * route no topic is active, so the trigger reads "Select topic" and picking one
 * opens its dashboard.
 *
 * The list comes from the server (`Nav`); it refreshes whenever the tree does
 * (`router.refresh()` after a mutation, or a hard load).
 */

import { Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useActiveTopic } from "@/components/ActiveTopic";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SwitcherTopic {
  id: string;
  title: string;
  /** 0..1 */
  mastery: number;
}

// Pages that scope themselves to `?id=`; anywhere else a switch lands on the
// topic's dashboard instead of appending an id the route would ignore.
const TOPIC_SCOPED = ["/dashboard", "/tutor"];

function TopicSwitcherInner({ topics }: { topics: SwitcherTopic[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const topicId = useSearchParams().get("id");
  const announced = useActiveTopic();

  if (topics.length === 0) return null;

  // A topic-scoped route names its topic in the URL; anywhere else the page may
  // announce one (a lesson does). Failing both — /topics, the landing page —
  // nothing is selected and the trigger stays a prompt.
  const scoped = TOPIC_SCOPED.includes(pathname);
  const active = scoped
    ? topicId
      ? topics.find((t) => t.id === topicId)
      : // No id in the URL: the server falls back to the newest curriculum,
        // which is the first entry of this list (sorted createdAt desc).
        topics[0]
    : announced
      ? topics.find((t) => t.id === announced)
      : undefined;

  const hrefFor = (id: string) =>
    scoped ? `${pathname}?id=${id}` : `/dashboard?id=${id}`;

  function select(id: string) {
    if (active && id === active.id) return;
    // These pages render on the server from `?id=`, so the switch must be a
    // router navigation (a bare history.pushState wouldn't re-render them).
    // The route's loading.tsx / keyed Suspense puts the skeleton up at once.
    router.push(hrefFor(id), { scroll: false });
  }

  return (
    <>
      {/* Owned here, not by the topbar: a learner with no topics renders
          nothing at all, and a lone divider would be left behind. */}
      <Separator orientation="vertical" className="mx-1 h-4" />
      <DropdownMenu
        onOpenChange={(open) => {
          // Warm the likely destinations while the learner reads the list.
          if (open) for (const t of topics) router.prefetch(hrefFor(t.id));
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="max-w-[9rem] sm:max-w-[14rem]"
          >
            <span className="truncate">{active?.title ?? "Select topic"}</span>
            <ChevronsUpDown data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-60" align="start">
          <DropdownMenuLabel>Switch topic</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={active?.id ?? ""}
            onValueChange={select}
          >
            {topics.map((t) => (
              <DropdownMenuRadioItem key={t.id} value={t.id}>
                <span className="truncate">{t.title}</span>
                <span className="text-muted-foreground ml-auto font-mono text-[10px] tabular-nums">
                  {Math.round(t.mastery * 100)}%
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function TopicSwitcher({ topics }: { topics: SwitcherTopic[] }) {
  // `useSearchParams` opts its subtree into client rendering; the boundary keeps
  // the rest of the topbar server-rendered.
  return (
    <Suspense fallback={null}>
      <TopicSwitcherInner topics={topics} />
    </Suspense>
  );
}
