import type { ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  ChevronsUpDown,
  Download,
  Eye,
  Focus,
  Layers,
  MessageSquare,
  Pin,
  PinOff,
  PencilLine,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
  SquareArrowOutUpRight,
  LayoutDashboard,
} from "lucide-react";
import type { ShellLessonLink } from "@/lib/data/types";

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
      /** Saves the response as a file instead of navigating. */
      download?: boolean;
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
      /** The handler opens a dialog or editor, so focus must not return to the trigger. */
      movesFocus?: boolean;
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

export function pinnedRowMenu(
  link: ShellLessonLink,
  handlers: { unpin: (link: ShellLessonLink) => void },
): RowMenuEntry[] {
  return [
    ...lessonLinkEntries(link),
    { type: "separator" },
    {
      type: "action",
      id: "unpin",
      label: "Unpin",
      icon: <PinOff />,
      onSelect: () => handlers.unpin(link),
      shortcut: "P",
    },
  ];
}

export function recentRowMenu(
  link: ShellLessonLink,
  pinned: boolean,
  handlers: {
    pin: (link: ShellLessonLink) => void;
    unpin: (link: ShellLessonLink) => void;
    remove: (link: ShellLessonLink) => void;
  },
): RowMenuEntry[] {
  const href = lessonHref(link);
  return [
    { type: "link", id: "open", label: "Open", icon: <ArrowUpRight />, href },
    {
      type: "action",
      id: "pin",
      label: pinned ? "Unpin" : "Pin",
      icon: pinned ? <PinOff /> : <Pin />,
      onSelect: () => (pinned ? handlers.unpin(link) : handlers.pin(link)),
      shortcut: "P",
    },
    { type: "separator" },
    {
      type: "action",
      id: "remove-recent",
      label: "Remove from recent",
      icon: <X />,
      onSelect: () => handlers.remove(link),
    },
  ];
}

/** The topic a menu acts on. `hasProgress` decides how hard Delete asks. */
export interface TopicMenuTarget {
  id: string;
  title: string;
  hasProgress: boolean;
}

export interface TopicMenuHandlers {
  rename: (topic: TopicMenuTarget) => void;
  archive: (topic: TopicMenuTarget) => void;
  requestDelete: (topic: TopicMenuTarget) => void;
}

/** The one topic menu: sidebar row, topics page rows and cards, dashboard header. */
export function topicRowMenu(
  topic: TopicMenuTarget,
  handlers: TopicMenuHandlers,
): RowMenuEntry[] {
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
      type: "link",
      id: "export-flashcards",
      label: "Export flashcards",
      icon: <Download />,
      href: `/api/flashcards/export?id=${topic.id}`,
      download: true,
    },
    {
      type: "copy",
      id: "copy-link",
      label: "Copy link",
      href: topicHref(topic.id),
    },
    { type: "separator" },
    {
      type: "action",
      id: "rename",
      label: "Rename",
      icon: <PencilLine />,
      onSelect: () => handlers.rename(topic),
      shortcut: "R",
      movesFocus: true,
    },
    {
      type: "action",
      id: "archive",
      label: "Archive",
      icon: <Archive />,
      onSelect: () => handlers.archive(topic),
    },
    {
      type: "action",
      id: "delete",
      label: "Delete",
      icon: <Trash2 />,
      onSelect: () => handlers.requestDelete(topic),
      destructive: true,
      movesFocus: true,
    },
  ];
}

export function archivedTopicRowMenu(
  topic: TopicMenuTarget,
  handlers: {
    restore: (topic: TopicMenuTarget) => void;
    requestDelete: (topic: TopicMenuTarget) => void;
  },
): RowMenuEntry[] {
  return [
    {
      type: "link",
      id: "open",
      label: "Open",
      icon: <ArrowUpRight />,
      href: topicHref(topic.id),
    },
    {
      type: "action",
      id: "restore",
      label: "Restore",
      icon: <ArchiveRestore />,
      onSelect: () => handlers.restore(topic),
    },
    { type: "separator" },
    {
      type: "action",
      id: "delete",
      label: "Delete",
      icon: <Trash2 />,
      onSelect: () => handlers.requestDelete(topic),
      destructive: true,
      movesFocus: true,
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
