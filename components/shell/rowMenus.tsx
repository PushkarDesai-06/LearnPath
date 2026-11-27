import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Layers,
  MessageSquare,
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
