import type { ReactNode } from "react";
import {
  ArrowUpRight,
  ChevronsUpDown,
  Eye,
  Focus,
  Layers,
  MessageSquare,
  Pin,
  PinOff,
  RefreshCw,
  RotateCcw,
  SquareArrowOutUpRight,
  LayoutDashboard,
} from "lucide-react";
import type { ShellLessonLink, ShellTopic } from "@/lib/data/types";

/**
 * Menu entries for sidebar rows, defined once per row type so dropdowns (and a
 * later context menu) render the same list. To add an action, append an entry
 * to the matching builder: `link` navigates, `copy` copies a URL with feedback,
 * `action` runs a handler (it may be async), `separator` splits groups.
 */
export type RowMenuEntry =
  | { type: "separator" }
  | {
      type: "link";
      id: string;
      label: string;
      icon: ReactNode;
      href: string;
      newTab?: boolean;
      shortcut?: string;
    }
  | { type: "copy"; id: string; label: string; href: string }
  | {
      type: "action";
      id: string;
      label: string;
      icon: ReactNode;
      onSelect: () => void | Promise<void>;
      shortcut?: string;
      destructive?: boolean;
    };

export function lessonHref(link: Pick<ShellLessonLink, "lessonId">) {
  return `/learn/${link.lessonId}`;
}

export function topicHref(topicId: string) {
  return `/dashboard?id=${topicId}`;
}

function lessonLinkEntries(link: ShellLessonLink): RowMenuEntry[] {
  const href = lessonHref(link);
  return [
    { type: "link", id: "open", label: "Open", icon: <ArrowUpRight />, href },
    {
      type: "link",
      id: "open-new-tab",
      label: "Open in new tab",
      icon: <SquareArrowOutUpRight />,
      href,
      newTab: true,
    },
    { type: "copy", id: "copy-link", label: "Copy link", href },
  ];
}

export function pinnedRowMenu(link: ShellLessonLink): RowMenuEntry[] {
  return lessonLinkEntries(link);
}

export function recentRowMenu(link: ShellLessonLink): RowMenuEntry[] {
  return lessonLinkEntries(link);
}

export function topicRowMenu(topic: Pick<ShellTopic, "id">): RowMenuEntry[] {
  return [
    {
      type: "link",
      id: "open-dashboard",
      label: "Open dashboard",
      icon: <LayoutDashboard />,
      href: topicHref(topic.id),
      shortcut: "G D",
    },
    {
      type: "link",
      id: "ask-tutor",
      label: "Ask tutor",
      icon: <MessageSquare />,
      href: `/tutor?id=${topic.id}`,
      shortcut: "G T",
    },
    {
      type: "link",
      id: "review",
      label: "Review flashcards",
      icon: <Layers />,
      href: `/flashcards?id=${topic.id}`,
    },
    {
      type: "copy",
      id: "copy-link",
      label: "Copy link",
      href: topicHref(topic.id),
    },
  ];
}

export interface LessonMenuTarget {
  curriculumId: string;
  lessonId: string;
  pinned: boolean;
}

export interface LessonMenuHandlers {
  /** Omit where the peek panel is already the surface (it hides the entry). */
  peek?: () => void;
  togglePin: () => void;
  makeFlashcards: () => void;
  markForReview: () => void;
  requestReset: () => void;
}

/**
 * The lesson row menu, shared by the dashboard row (dropdown and context menu),
 * the peek panel and, later, the lesson page header. Focus mode opens the lesson,
 * where the F key toggles it.
 */
export function lessonRowMenu(
  { curriculumId, lessonId, pinned }: LessonMenuTarget,
  handlers: LessonMenuHandlers,
): RowMenuEntry[] {
  const href = lessonHref({ lessonId });
  const entries: RowMenuEntry[] = [
    {
      type: "link",
      id: "open",
      label: "Open",
      icon: <ArrowUpRight />,
      href,
      shortcut: "Enter",
    },
  ];
  if (handlers.peek) {
    entries.push({
      type: "action",
      id: "peek",
      label: "Peek",
      icon: <Eye />,
      onSelect: handlers.peek,
      shortcut: "Space",
    });
  }
  entries.push(
    {
      type: "action",
      id: "pin",
      label: pinned ? "Unpin" : "Pin",
      icon: pinned ? <PinOff /> : <Pin />,
      onSelect: handlers.togglePin,
      shortcut: "P",
    },
    {
      type: "link",
      id: "ask-tutor",
      label: "Ask tutor",
      icon: <MessageSquare />,
      href: `/tutor?id=${curriculumId}&lesson=${encodeURIComponent(lessonId)}`,
    },
    {
      type: "action",
      id: "flashcards",
      label: "Make flashcards",
      icon: <Layers />,
      onSelect: handlers.makeFlashcards,
    },
    {
      type: "action",
      id: "review",
      label: "Mark for review",
      icon: <RefreshCw />,
      onSelect: handlers.markForReview,
    },
    {
      type: "link",
      id: "focus",
      label: "Focus mode",
      icon: <Focus />,
      href,
    },
    { type: "copy", id: "copy-link", label: "Copy link", href },
    { type: "separator" },
    {
      type: "action",
      id: "reset",
      label: "Reset progress",
      icon: <RotateCcw />,
      onSelect: handlers.requestReset,
      destructive: true,
    },
  );
  return entries;
}

export function moduleHash(moduleId: string) {
  return `mod-${moduleId}`;
}

export function moduleRowMenu(
  module: { curriculumId: string; moduleId: string; expanded: boolean },
  toggle: () => void,
): RowMenuEntry[] {
  return [
    {
      type: "action",
      id: "toggle",
      label: module.expanded ? "Collapse" : "Expand",
      icon: <ChevronsUpDown />,
      onSelect: toggle,
    },
    {
      type: "link",
      id: "ask-tutor",
      label: "Ask tutor about this module",
      icon: <MessageSquare />,
      href: `/tutor?id=${module.curriculumId}`,
    },
    {
      type: "copy",
      id: "copy-link",
      label: "Copy link",
      href: `${topicHref(module.curriculumId)}#${moduleHash(module.moduleId)}`,
    },
  ];
}
