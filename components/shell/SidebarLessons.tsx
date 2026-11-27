"use client";

import { Clock } from "lucide-react";
import { PinIcon } from "@/components/icons/animated";
import {
  AnimatedHeight,
  GroupHeader,
  SidebarLinkRow,
} from "@/components/shell/SidebarRow";
import { RowMenu } from "@/components/shell/RowMenu";
import {
  lessonHref,
  pinnedRowMenu,
  recentRowMenu,
  type RowMenuEntry,
} from "@/components/shell/rowMenus";
import type { GroupId } from "@/components/shell/useSidebarGroups";
import type { ShellLessonLink } from "@/lib/data/types";

interface LessonGroupProps {
  id: GroupId;
  label: string;
  links: ShellLessonLink[];
  kind: "pinned" | "recent";
  pathname: string;
  open: boolean;
  onToggle: () => void;
}

const MENUS: Record<
  LessonGroupProps["kind"],
  (link: ShellLessonLink) => RowMenuEntry[]
> = {
  pinned: pinnedRowMenu,
  recent: recentRowMenu,
};

/** Pinned and Recent share a shape: a titled group of lesson links with a 3 dot menu each. */
export function LessonGroup({
  id,
  label,
  links,
  kind,
  pathname,
  open,
  onToggle,
}: LessonGroupProps) {
  if (links.length === 0) return null;

  return (
    <section aria-label={label} className="mt-2 px-2" data-group={id}>
      <GroupHeader label={label} open={open} onToggle={onToggle} />
      <AnimatedHeight open={open}>
        <ul className="flex flex-col gap-px pt-0.5">
          {links.map((link) => (
            <SidebarLinkRow
              key={`${link.curriculumId}:${link.lessonId}`}
              href={lessonHref(link)}
              icon={kind === "pinned" ? <PinIcon /> : <Clock />}
              label={link.title}
              active={pathname === lessonHref(link)}
              tooltip={{
                detail: `${link.topicTitle} / ${link.moduleTitle}`,
                always: true,
              }}
              menu={
                <RowMenu
                  entries={MENUS[kind](link)}
                  label={`Actions for ${link.title}`}
                />
              }
            />
          ))}
        </ul>
      </AnimatedHeight>
    </section>
  );
}
