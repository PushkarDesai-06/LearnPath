"use client";

/**
 * Topbar topic switcher. Topic-scoped pages read the active topic from `?id=`
 * and fall back to the learner's newest curriculum when it's absent (see
 * `resolveCurriculum`), so the trigger mirrors that: the matching topic, or the
 * first of the list when the URL carries no id. On any other route no topic is
 * active, so the trigger reads "Select topic" and picking one opens its
 * dashboard.
 */

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { api } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Topic {
  id: string;
  title: string;
  summary: { overallMastery: number };
}

// Pages that scope themselves to `?id=`; anywhere else a switch lands on the
// topic's dashboard instead of appending an id the route would ignore.
const TOPIC_SCOPED = ["/dashboard", "/tutor"];

function TopicSwitcherInner() {
  const router = useRouter();
  const pathname = usePathname();
  const topicId = useSearchParams().get("id");
  // null until the list arrives — keeps the topbar from jumping on first paint.
  const [topics, setTopics] = useState<Topic[] | null>(null);

  const load = useCallback(
    () =>
      api<{ topics: Topic[] }>("/api/topics")
        .then((res) => setTopics(res.topics))
        .catch(() => setTopics([])),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!topics || topics.length === 0) return null;

  // Only a topic-scoped route has an active topic. Elsewhere (/topics, a lesson,
  // the landing page) nothing is selected and the trigger stays a prompt.
  const scoped = TOPIC_SCOPED.includes(pathname);
  const active = !scoped
    ? undefined
    : topicId
      ? topics.find((t) => t.id === topicId)
      : // No id in the URL: the server falls back to the newest curriculum,
        // which is the first entry of this list (sorted createdAt desc).
        topics[0];

  function select(id: string) {
    if (active && id === active.id) return;
    router.push(`${scoped ? pathname : "/dashboard"}?id=${id}`);
  }

  return (
    <>
      {/* Owned here, not by the topbar: a learner with no topics renders
          nothing at all, and a lone divider would be left behind. */}
      <Separator orientation="vertical" className="mx-1 h-4" />
      <DropdownMenu
        onOpenChange={(open) => {
          // Refresh on open so a topic created earlier this session shows up.
          if (open) void load();
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
                  {Math.round(t.summary.overallMastery * 100)}%
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function TopicSwitcher() {
  // `useSearchParams` opts its subtree into client rendering; the boundary keeps
  // the rest of the topbar prerenderable.
  return (
    <Suspense fallback={null}>
      <TopicSwitcherInner />
    </Suspense>
  );
}
