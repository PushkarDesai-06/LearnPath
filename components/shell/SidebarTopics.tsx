"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive } from "lucide-react";
import { MasteryRing } from "@/components/MasteryRing";
import { StatusIcon, type StatusIconStatus } from "@/components/StatusIcon";
import { ChevronIcon, PlusIcon } from "@/components/icons/animated";
import {
  AnimatedHeight,
  GroupHeader,
  labelClass,
  rowClass,
  RowTooltip,
  SidebarLinkRow,
} from "@/components/shell/SidebarRow";
import { EntryContextMenu } from "@/components/shell/EntryMenu";
import { RowMenu } from "@/components/shell/RowMenu";
import { topicHref, type TopicMenuTarget } from "@/components/shell/rowMenus";
import { useSidebarUi } from "@/components/shell/SidebarUi";
import type { useTopicMenus } from "@/components/shell/useTopicMenus";
import { isPlainShortcut } from "@/lib/client/keys";
import { normalizeTitle, TITLE_MAX, topicHasProgress } from "@/lib/client/topicState";
import { NEW_TOPIC_HREF } from "@/components/shell/constants";
import type { ShellData, ShellTopic } from "@/lib/data/types";
import { cn } from "@/lib/utils";

type TopicUi = ReturnType<typeof useTopicMenus>;

function InlineRename({
  initial,
  onSubmit,
  onDone,
}: {
  initial: string;
  onSubmit: (title: string) => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const finished = useRef(false);
  const { holdPeek } = useSidebarUi();

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    holdPeek(true);
    return () => holdPeek(false);
  }, [holdPeek]);

  function finish(save: boolean) {
    if (finished.current) return;
    finished.current = true;
    const title = normalizeTitle(value);
    if (save && title && title !== initial) onSubmit(title);
    onDone();
  }

  return (
    <input
      ref={inputRef}
      value={value}
      maxLength={TITLE_MAX}
      aria-label={`Rename ${initial}`}
      autoComplete="off"
      onChange={(event) => setValue(event.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(true);
        } else if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          finish(false);
        }
      }}
      className="h-5 min-w-0 flex-1 rounded bg-background px-1 text-[13px] text-foreground ring-1 ring-border-strong outline-none focus:ring-foreground"
    />
  );
}

function topicTarget(topic: ShellTopic): TopicMenuTarget {
  return {
    id: topic.id,
    title: topic.title,
    hasProgress: topicHasProgress({
      mastery: topic.mastery,
      lessonsMastered: topic.modules.reduce(
        (sum, module) => sum + module.lessonsMastered,
        0,
      ),
    }),
  };
}

function TopicRow({
  topic,
  open,
  active,
  editing,
  topicUi,
  onToggle,
  onEditDone,
}: {
  topic: ShellTopic;
  open: boolean;
  active: boolean;
  editing: boolean;
  topicUi: TopicUi;
  onToggle: () => void;
  onEditDone: () => void;
}) {
  const { rail } = useSidebarUi();
  const rowRef = useRef<HTMLElement>(null);
  const restoreFocus = useRef(false);
  const target = topicTarget(topic);
  const entries = topicUi.menu(target);

  useEffect(() => {
    if (editing || !restoreFocus.current) return;
    restoreFocus.current = false;
    rowRef.current?.focus();
  }, [editing]);

  const className = cn("group", rowClass, "pr-8", active && "text-foreground");
  const inner = (
    <>
      <span
        className={cn(
          "flex w-3.5 shrink-0 items-center justify-center overflow-hidden text-faint transition-[width,margin] duration-(--dur-slow) ease-(--ease-out)",
          "group-data-[rail=true]/rail:-mr-2 group-data-[rail=true]/rail:w-0",
        )}
      >
        <ChevronIcon open={open} className="size-3.5" />
      </span>
      <MasteryRing value={topic.mastery} size={16} className="shrink-0" />
      <span className={labelClass}>{topic.title}</span>
    </>
  );

  const row = (
    <li
      className="group/row relative"
      onKeyDown={(event) => {
        if (
          event.currentTarget.contains(event.target as Node) &&
          event.key.toLowerCase() === "r" &&
          isPlainShortcut(event.nativeEvent)
        ) {
          event.preventDefault();
          topicUi.requestRename(target);
        }
      }}
    >
      {editing ? (
        <div className={cn("group", rowClass, "pr-1.5")}>
          <span className="w-3.5 shrink-0" aria-hidden />
          <MasteryRing value={topic.mastery} size={16} className="shrink-0" />
          <InlineRename
            initial={topic.title}
            onSubmit={(title) => void topicUi.actions.rename(topic, title)}
            onDone={() => {
              restoreFocus.current = true;
              onEditDone();
            }}
          />
        </div>
      ) : (
        <RowTooltip
          label={topic.title}
          detail={`${Math.round(topic.mastery * 100)}% mastery`}
        >
          {rail ? (
            <Link
              href={topicHref(topic.id)}
              className={className}
              aria-label={topic.title}
            >
              {inner}
            </Link>
          ) : (
            <button
              ref={(node) => {
                rowRef.current = node;
              }}
              type="button"
              aria-expanded={open}
              aria-label={`${topic.title}, ${open ? "collapse" : "expand"} modules`}
              onClick={onToggle}
              className={className}
            >
              {inner}
            </button>
          )}
        </RowTooltip>
      )}
      {editing ? null : (
        <RowMenu entries={entries} label={`Actions for ${topic.title}`} />
      )}
    </li>
  );

  return <EntryContextMenu entries={entries}>{row}</EntryContextMenu>;
}

function ModuleRows({ topic }: { topic: ShellTopic }) {
  return (
    <ul className="flex flex-col gap-px pt-px pb-0.5">
      {topic.modules.map((module) => (
        <li key={module.id}>
          <Link
            href={`${topicHref(topic.id)}#mod-${module.id}`}
            className={cn(
              "group group/link",
              rowClass,
              "h-6 pl-[32px] text-[12.5px]",
            )}
          >
            <StatusIcon
              status={module.status as StatusIconStatus}
              mastery={
                module.lessonsTotal > 0
                  ? module.lessonsMastered / module.lessonsTotal
                  : 0
              }
              size={13}
              animate={false}
              className="group-hover/link:text-foreground"
            />
            <span className="min-w-0 flex-1 truncate">{module.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

interface TopicsGroupProps {
  topics: ShellData["topics"];
  activeTopicId: string | null;
  open: boolean;
  onToggleGroup: () => void;
  isTopicOpen: (topicId: string) => boolean;
  onToggleTopic: (topicId: string) => void;
  topicUi: TopicUi;
  editingId: string | null;
  onEditDone: () => void;
}

export function TopicsGroup({
  topics,
  activeTopicId,
  open,
  onToggleGroup,
  isTopicOpen,
  onToggleTopic,
  topicUi,
  editingId,
  onEditDone,
}: TopicsGroupProps) {
  const { rail } = useSidebarUi();

  return (
    <section
      aria-label="Topics"
      className="mt-2 px-2"
      data-group="group:topics"
    >
      <GroupHeader label="Topics" open={open} onToggle={onToggleGroup} />
      <AnimatedHeight open={open}>
        <div className="flex flex-col gap-px pt-0.5">
          {topics.map((topic) => {
            const topicOpen = isTopicOpen(topic.id);
            return (
              <div key={topic.id}>
                <ul>
                  <TopicRow
                    topic={topic}
                    open={topicOpen}
                    active={topic.id === activeTopicId}
                    editing={editingId === topic.id}
                    topicUi={topicUi}
                    onToggle={() => onToggleTopic(topic.id)}
                    onEditDone={onEditDone}
                  />
                </ul>
                <AnimatedHeight open={topicOpen && !rail}>
                  <ModuleRows topic={topic} />
                </AnimatedHeight>
              </div>
            );
          })}
          <ul>
            <SidebarLinkRow
              href={NEW_TOPIC_HREF}
              icon={<PlusIcon />}
              label="New topic"
              className="text-muted-foreground"
            />
          </ul>
        </div>
      </AnimatedHeight>
    </section>
  );
}

export function ArchivedGroup({
  topics,
  open,
  onToggle,
  topicUi,
}: {
  topics: ShellData["archivedTopics"];
  open: boolean;
  onToggle: () => void;
  topicUi: TopicUi;
}) {
  if (topics.length === 0) return null;

  return (
    <section
      aria-label="Archived"
      className="mt-2 px-2"
      data-group="group:archived"
    >
      <GroupHeader label="Archived" open={open} onToggle={onToggle} />
      <AnimatedHeight open={open}>
        <ul className="flex flex-col gap-px pt-0.5">
          {topics.map((topic) => {
            const entries = topicUi.archivedMenu({
              id: topic.id,
              title: topic.title,
              hasProgress: true,
            });
            return (
              <SidebarLinkRow
                key={topic.id}
                href={topicHref(topic.id)}
                icon={<Archive />}
                label={topic.title}
                contextEntries={entries}
                menu={
                  <RowMenu
                    entries={entries}
                    label={`Actions for ${topic.title}`}
                  />
                }
              />
            );
          })}
        </ul>
      </AnimatedHeight>
    </section>
  );
}
