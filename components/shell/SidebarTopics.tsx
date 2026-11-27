"use client";

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
import { RowMenu } from "@/components/shell/RowMenu";
import { topicHref, topicRowMenu } from "@/components/shell/rowMenus";
import { useSidebarUi } from "@/components/shell/SidebarUi";
import { NEW_TOPIC_HREF } from "@/components/shell/constants";
import type { ShellData, ShellTopic } from "@/lib/data/types";
import { cn } from "@/lib/utils";

function TopicRow({
  topic,
  open,
  active,
  onToggle,
}: {
  topic: ShellTopic;
  open: boolean;
  active: boolean;
  onToggle: () => void;
}) {
  const { rail } = useSidebarUi();
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

  return (
    <li className="group/row relative">
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
      <RowMenu
        entries={topicRowMenu(topic)}
        label={`Actions for ${topic.title}`}
      />
    </li>
  );
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
}

export function TopicsGroup({
  topics,
  activeTopicId,
  open,
  onToggleGroup,
  isTopicOpen,
  onToggleTopic,
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
                    onToggle={() => onToggleTopic(topic.id)}
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
}: {
  topics: ShellData["archivedTopics"];
  open: boolean;
  onToggle: () => void;
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
          {topics.map((topic) => (
            <SidebarLinkRow
              key={topic.id}
              href={topicHref(topic.id)}
              icon={<Archive />}
              label={topic.title}
            />
          ))}
        </ul>
      </AnimatedHeight>
    </section>
  );
}
