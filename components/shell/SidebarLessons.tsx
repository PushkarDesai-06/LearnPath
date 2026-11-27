"use client";

import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
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
import type { usePinActions } from "@/components/shell/usePinActions";
import type { GroupId } from "@/components/shell/useSidebarGroups";
import type { ShellLessonLink } from "@/lib/data/types";
import { isPlainShortcut } from "@/lib/client/keys";
import { moveBeside, shiftId } from "@/lib/client/topicState";
import { cn } from "@/lib/utils";

type PinActions = ReturnType<typeof usePinActions>;

interface LessonGroupProps {
  id: GroupId;
  label: string;
  links: ShellLessonLink[];
  kind: "pinned" | "recent";
  pathname: string;
  open: boolean;
  onToggle: () => void;
  pinnedIds: ReadonlySet<string>;
  actions: PinActions;
}

interface DragState {
  id: string;
  over: { id: string; placement: "before" | "after" } | null;
}

const dropIndicator = cn(
  "data-[drop]:before:absolute data-[drop]:before:inset-x-1 data-[drop]:before:z-10 data-[drop]:before:h-0.5 data-[drop]:before:rounded-full data-[drop]:before:bg-foreground",
  "data-[drop=before]:before:-top-px data-[drop=after]:before:-bottom-px",
);

const draggableRow = cn(
  "cursor-grab active:cursor-grabbing [&_a]:cursor-grab data-[dragging=true]:opacity-40",
  dropIndicator,
);

/** Pinned and Recent share a shape: a titled group of lesson links with a 3 dot menu each. */
export function LessonGroup({
  id,
  label,
  links,
  kind,
  pathname,
  open,
  onToggle,
  pinnedIds,
  actions,
}: LessonGroupProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const refocus = useRef<string | null>(null);

  useEffect(() => {
    if (!refocus.current) return;
    document
      .querySelector<HTMLElement>(`[data-lesson-row="${refocus.current}"] a`)
      ?.focus();
    refocus.current = null;
  }, [links]);

  if (links.length === 0) return null;

  const ids = links.map((link) => link.lessonId);
  const pinned = kind === "pinned";

  function entriesFor(link: ShellLessonLink): RowMenuEntry[] {
    return pinned
      ? pinnedRowMenu(link, { unpin: actions.unpin })
      : recentRowMenu(link, pinnedIds.has(link.lessonId), {
          pin: actions.pin,
          unpin: actions.unpin,
          remove: actions.removeRecent,
        });
  }

  function placementOf(event: DragEvent<HTMLLIElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientY < rect.top + rect.height / 2 ? "before" : "after";
  }

  function keyDown(event: KeyboardEvent<HTMLLIElement>, link: ShellLessonLink) {
    if (!event.currentTarget.contains(event.target as Node)) return;

    if (pinned && event.altKey && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const next = shiftId(ids, link.lessonId, event.key === "ArrowUp" ? -1 : 1);
      if (next === ids) return;
      refocus.current = link.lessonId;
      setAnnouncement(
        `${link.title} moved to position ${next.indexOf(link.lessonId) + 1} of ${next.length}`,
      );
      void actions.reorder(next);
      return;
    }

    if (event.key.toLowerCase() === "p" && isPlainShortcut(event.nativeEvent)) {
      event.preventDefault();
      if (pinned || pinnedIds.has(link.lessonId)) void actions.unpin(link);
      else void actions.pin(link);
    }
  }

  return (
    <section aria-label={label} className="mt-2 px-2" data-group={id}>
      <GroupHeader label={label} open={open} onToggle={onToggle} />
      <AnimatedHeight open={open}>
        <ul className="flex flex-col gap-px pt-0.5">
          {links.map((link) => {
            const entries = entriesFor(link);
            const over = drag?.over?.id === link.lessonId ? drag.over : null;
            return (
              <SidebarLinkRow
                key={`${link.curriculumId}:${link.lessonId}`}
                href={lessonHref(link)}
                icon={pinned ? <PinIcon /> : <Clock />}
                label={link.title}
                active={pathname === lessonHref(link)}
                tooltip={{
                  detail: `${link.topicTitle} / ${link.moduleTitle}`,
                  always: true,
                }}
                contextEntries={entries}
                liProps={{
                  "data-lesson-row": link.lessonId,
                  onKeyDown: (event) => keyDown(event, link),
                  ...(pinned
                    ? {
                        className: draggableRow,
                        draggable: true,
                        "data-dragging": String(drag?.id === link.lessonId),
                        "data-drop": over && over.id !== drag?.id ? over.placement : undefined,
                        onDragStart: (event) => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", link.lessonId);
                          setDrag({ id: link.lessonId, over: null });
                        },
                        onDragOver: (event) => {
                          if (!drag) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          const placement = placementOf(event);
                          if (
                            drag.over?.id !== link.lessonId ||
                            drag.over.placement !== placement
                          ) {
                            setDrag({ ...drag, over: { id: link.lessonId, placement } });
                          }
                        },
                        onDrop: (event) => {
                          if (!drag) return;
                          event.preventDefault();
                          const next = moveBeside(
                            ids,
                            drag.id,
                            link.lessonId,
                            placementOf(event),
                          );
                          setDrag(null);
                          void actions.reorder(next);
                        },
                        onDragEnd: () => setDrag(null),
                      }
                    : {}),
                }}
                menu={
                  <RowMenu entries={entries} label={`Actions for ${link.title}`} />
                }
              />
            );
          })}
        </ul>
        {pinned ? (
          <p role="status" className="sr-only">
            {announcement}
          </p>
        ) : null}
      </AnimatedHeight>
    </section>
  );
}
