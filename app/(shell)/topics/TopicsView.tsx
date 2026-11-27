"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Archive, BookOpen, Layers, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MasteryRing } from "@/components/MasteryRing";
import { StatusIcon } from "@/components/StatusIcon";
import { ArrowRightIcon } from "@/components/icons/animated";
import { topicRowMenu } from "@/components/shell/rowMenus";
import { cn } from "@/lib/utils";
import { TopicMenu } from "./TopicMenu";

export interface TopicRow {
  id: string;
  title: string;
  domain: string;
  mastery: number;
  lessonsMastered: number;
  lessonsTotal: number;
  modulesCompleted: number;
  modulesTotal: number;
  dueCards: number;
  createdLabel: string;
}

export interface ArchivedRow {
  id: string;
  title: string;
  archivedLabel: string;
}

export interface FunnelRow {
  onboardingId: string;
  topic: string;
  status: string;
  next: "onboarding" | "assessment";
}

type Layout = "list" | "grid";

const LAYOUT_KEY = "lp:topics-layout";
const LAYOUT_EVENT = "lp:topics-layout-change";

function readLayout(): Layout {
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function subscribeLayout(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LAYOUT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LAYOUT_EVENT, onChange);
  };
}

function useLayout() {
  const layout = useSyncExternalStore<Layout>(
    subscribeLayout,
    readLayout,
    () => "list",
  );
  const setLayout = useCallback((next: Layout) => {
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // Storage unavailable: the choice just won't persist.
    }
    window.dispatchEvent(new Event(LAYOUT_EVENT));
  }, []);
  return [layout, setLayout] as const;
}

const rowBase =
  "group/row relative flex items-center gap-3 rounded-lg transition-colors duration-(--dur-fast) hover:bg-hover focus-within:bg-hover";

const stretchedLink =
  "outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-foreground";

function moduleProgress(t: TopicRow) {
  return `${t.modulesCompleted}/${t.modulesTotal} modules`;
}

function DueCount({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] tabular-nums text-fg-2">
      <Layers className="size-3" aria-hidden />
      {count} due
    </span>
  );
}

function TopicListRow({ topic }: { topic: TopicRow }) {
  return (
    <li className={cn(rowBase, "min-h-11 px-2.5 py-1.5")}>
      <MasteryRing value={topic.mastery} size={20} />
      <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
        <Link
          href={`/dashboard?id=${topic.id}`}
          className={cn("min-w-0 truncate text-[13.5px] font-medium", stretchedLink)}
        >
          {topic.title}
        </Link>
        <span className="truncate text-[12px] text-muted-foreground">
          {topic.domain}
        </span>
      </div>
      <span className="hidden w-24 shrink-0 text-[12px] tabular-nums text-muted-foreground md:block">
        {moduleProgress(topic)}
      </span>
      <span className="hidden w-16 shrink-0 sm:block">
        <DueCount count={topic.dueCards} />
      </span>
      <span className="hidden w-20 shrink-0 text-right text-[12px] text-faint lg:block">
        {topic.createdLabel}
      </span>
      <TopicMenu
        entries={topicRowMenu({ id: topic.id })}
        label={`Options for ${topic.title}`}
      />
    </li>
  );
}

function TopicCard({ topic }: { topic: TopicRow }) {
  return (
    <li
      className={cn(
        "group/row relative flex flex-col gap-3 rounded-xl border border-border bg-surface-1 p-4 transition-colors duration-(--dur-fast) hover:border-border-strong hover:bg-surface-2 focus-within:border-border-strong",
      )}
    >
      <div className="flex items-start gap-3">
        <MasteryRing value={topic.mastery} size={28} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <Link
            href={`/dashboard?id=${topic.id}`}
            className={cn("truncate text-[14px] font-medium", stretchedLink, "after:rounded-xl")}
          >
            {topic.title}
          </Link>
          <span className="truncate text-[12px] text-muted-foreground">
            {topic.domain}
          </span>
        </div>
        <TopicMenu
          entries={topicRowMenu({ id: topic.id })}
          label={`Options for ${topic.title}`}
          className="-mt-1 -mr-1"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
        <span className="tabular-nums">
          {topic.lessonsMastered}/{topic.lessonsTotal} lessons
        </span>
        <span className="tabular-nums">{moduleProgress(topic)}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[12px] text-faint">
        <span>{topic.createdLabel}</span>
        <DueCount count={topic.dueCards} />
      </div>
    </li>
  );
}

function LayoutToggle({
  layout,
  onChange,
}: {
  layout: Layout;
  onChange: (next: Layout) => void;
}) {
  const options = [
    { value: "list", label: "List view", icon: List },
    { value: "grid", label: "Grid view", icon: LayoutGrid },
  ] as const;
  return (
    <div
      role="group"
      aria-label="Layout"
      className="inline-flex rounded-lg bg-surface-2 p-0.5 shadow-[inset_0_0_0_1px_var(--border)]"
    >
      {options.map(({ value, label, icon: Icon }) => (
        <Tooltip key={value}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={label}
              aria-pressed={layout === value}
              onClick={() => onChange(value)}
              className={cn(layout === value && "bg-surface-3 text-foreground")}
            >
              <Icon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

export function TopicsView({
  topics,
  archived,
  funnels,
}: {
  topics: TopicRow[];
  archived: ArchivedRow[];
  funnels: FunnelRow[];
}) {
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [layout, setLayout] = useLayout();

  return (
    <div className="flex flex-col gap-6">
      {funnels.length > 0 && (
        <section className="flex flex-col gap-1" aria-label="In progress">
          <h2 className="px-2.5 pb-1 text-[11.5px] font-medium text-faint">
            Pick up where you left off
          </h2>
          <ul className="flex flex-col">
            {funnels.map((f) => (
              <li key={f.onboardingId} className={cn(rowBase, "min-h-10 px-2.5 py-1")}>
                <StatusIcon status="in_progress" mastery={0.3} animate={false} />
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="min-w-0 truncate text-[13.5px]">{f.topic}</span>
                  <span className="hidden shrink-0 text-[12px] text-muted-foreground sm:inline">
                    {f.status === "clarifying"
                      ? "Setup unfinished"
                      : "Assessment unfinished"}
                  </span>
                </div>
                <Button asChild variant="secondary" size="sm" className="group">
                  <Link href={f.next === "onboarding" ? "/onboarding" : "/assessment"}>
                    Resume
                    <ArrowRightIcon data-icon="inline-end" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="active" className="px-2.5">
              Topics
              <span className="text-[11.5px] tabular-nums text-faint">
                {topics.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="px-2.5">
              Archived
              <span className="text-[11.5px] tabular-nums text-faint">
                {archived.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === "active" && topics.length > 0 && (
          <LayoutToggle layout={layout} onChange={setLayout} />
        )}
      </div>

      {tab === "active" &&
        (topics.length === 0 ? (
          <Empty className="border border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpen />
              </EmptyMedia>
              <EmptyTitle className="text-base">
                Pick something you want to learn
              </EmptyTitle>
              <EmptyDescription>
                Describe a goal and LearnPath builds the path.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/onboarding?new=1">Start your first topic</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : layout === "list" ? (
          <ul className="flex flex-col">
            {topics.map((t) => (
              <TopicListRow key={t.id} topic={t} />
            ))}
          </ul>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {topics.map((t) => (
              <TopicCard key={t.id} topic={t} />
            ))}
          </ul>
        ))}

      {tab === "archived" &&
        (archived.length === 0 ? (
          <Empty className="border border-border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Archive />
              </EmptyMedia>
              <EmptyTitle className="text-base">Nothing archived</EmptyTitle>
              <EmptyDescription>
                Topics you archive show up here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="flex flex-col">
            {archived.map((t) => (
              <li key={t.id} className={cn(rowBase, "min-h-11 px-2.5 py-1.5")}>
                <Archive className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <Link
                  href={`/dashboard?id=${t.id}`}
                  className={cn("min-w-0 flex-1 truncate text-[13.5px] text-fg-2", stretchedLink)}
                >
                  {t.title}
                </Link>
                <span className="shrink-0 text-[12px] text-faint">
                  Archived {t.archivedLabel}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
