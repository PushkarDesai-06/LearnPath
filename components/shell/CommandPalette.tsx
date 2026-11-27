"use client";

import {
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Command as CommandPrimitive, defaultFilter } from "cmdk";
import {
  Archive,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  CornerDownLeft,
  Focus,
  Keyboard,
  Layers,
  LayoutGrid,
  Lock,
  MessageSquare,
  Home,
  PanelLeft,
  Pin,
  PinOff,
  Play,
  Plus,
  Search,
  Settings,
  SunMoon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";
import { StatusIcon, type StatusIconStatus } from "@/components/StatusIcon";
import { useFocusMode } from "@/components/shell/FocusMode";
import { useShellSnapshot } from "@/components/shell/ShellDataContext";
import { usePinActions } from "@/components/shell/usePinActions";
import { useSidebarTopic } from "@/components/shell/useSidebarTopic";
import { copyLink } from "@/components/shell/EntryMenuItems";
import { openShortcutsSheet, type PaletteMode } from "@/components/shell/events";
import { NEW_TOPIC_HREF } from "@/components/shell/constants";
import { displayKey } from "@/components/shell/shortcuts";
import {
  THEME_LABEL,
  THEME_ORDER,
  useThemeCycle,
  type ThemeChoice,
} from "@/components/useThemeCycle";
import { useNavigate } from "@/lib/client/progress";
import { useIsMac } from "@/lib/client/platform";
import {
  buildSuggestions,
  findLessonLink,
  flattenLessons,
  orderActions,
  orderGroups,
  paletteContext,
  type PaletteGroupId,
} from "@/lib/client/paletteIndex";
import { cn } from "@/lib/utils";

interface PaletteEntry {
  id: string;
  group: PaletteGroupId;
  label: string;
  secondary?: string;
  keywords?: string[];
  icon: ReactNode;
  keys?: string[];
  dimmed?: boolean;
  scope?: "lesson" | "global";
  run: () => void;
}

const GROUP_LABEL: Record<PaletteGroupId, string> = {
  suggested: "Suggested",
  navigate: "Navigate",
  topics: "Topics",
  lessons: "Lessons",
  actions: "Actions",
  recent: "Recent",
  archived: "Archived topics",
};

const itemClass =
  "relative flex h-9 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] text-fg-2 outline-none select-none transition-colors duration-75 data-[selected=true]:bg-active data-[selected=true]:text-foreground";

function Row({
  entry,
  isMac,
  onPick,
}: {
  entry: PaletteEntry;
  isMac: boolean;
  onPick: (entry: PaletteEntry) => void;
}) {
  return (
    <CommandPrimitive.Item
      value={entry.id}
      keywords={entry.keywords}
      onSelect={() => onPick(entry)}
      className={cn(itemClass, entry.dimmed && "opacity-55")}
    >
      <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-[15px]">
        {entry.icon}
      </span>
      <span className="truncate">{entry.label}</span>
      {entry.secondary ? (
        <span className="min-w-0 truncate text-xs text-faint">
          {entry.secondary}
        </span>
      ) : null}
      {entry.keys ? (
        <span className="ml-auto flex shrink-0 items-center gap-1 pl-3">
          {entry.keys.map((key, index) => (
            <Kbd key={index}>{displayKey(key, isMac)}</Kbd>
          ))}
        </span>
      ) : null}
    </CommandPrimitive.Item>
  );
}

function lessonIcon(status: string, masteryScore: number) {
  return (
    <StatusIcon
      status={status as StatusIconStatus}
      mastery={masteryScore}
      size={15}
      animate={false}
    />
  );
}

function usePaletteEntries(searchMode: boolean, query: string) {
  const pathname = usePathname();
  const navigate = useNavigate();
  const isMac = useIsMac();
  const { toggleSidebar } = useSidebar();
  const focusMode = useFocusMode();
  const { topics, archivedTopics, pins, recents, dueCardsTotal } =
    useShellSnapshot();
  const pinActions = usePinActions(pins, recents);
  const { activeId, fallbackId } = useSidebarTopic(topics.map((t) => t.id));

  const context = paletteContext(pathname);
  const lessonId = context === "lesson" ? pathname.split("/")[2] : null;
  const currentLink = useMemo(
    () => (lessonId ? findLessonLink(topics, lessonId) : null),
    [topics, lessonId],
  );
  const pinned = currentLink
    ? pins.some((pin) => pin.lessonId === currentLink.lessonId)
    : false;

  const hasQuery = query.trim() !== "";

  const entries = useMemo(() => {
    const go = (href: string) => () => navigate.push(href);
    const scope = fallbackId ? `?id=${fallbackId}` : "";
    const list: PaletteEntry[] = [];

    const suggestions = buildSuggestions({ topics, activeId, recents });
    if (suggestions.continueLesson) {
      const next = suggestions.continueLesson;
      list.push({
        id: "suggested:continue",
        group: "suggested",
        label: "Continue lesson",
        secondary: `${next.title}, ${next.topicTitle}`,
        keywords: [next.title, next.topicTitle, "resume"],
        icon: <Play />,
        run: go(`/learn/${next.lessonId}`),
      });
    }
    if (suggestions.review) {
      const { count, topicId } = suggestions.review;
      list.push({
        id: "suggested:review",
        group: "suggested",
        label: "Review due cards",
        secondary: `${count} due`,
        keywords: ["flashcards", "study"],
        icon: <Layers />,
        run: go(`/flashcards?id=${topicId}`),
      });
    }

    list.push(
      {
        id: "navigate:dashboard",
        group: "navigate",
        label: "Dashboard",
        icon: <Home />,
        keys: ["G", "D"],
        run: go(`/dashboard${scope}`),
      },
      {
        id: "navigate:review",
        group: "navigate",
        label: "Review",
        secondary: dueCardsTotal > 0 ? `${dueCardsTotal} due` : undefined,
        keywords: ["flashcards"],
        icon: <Layers />,
        keys: ["G", "R"],
        run: go(`/flashcards${scope}`),
      },
      {
        id: "navigate:tutor",
        group: "navigate",
        label: "Tutor",
        keywords: ["chat", "ask"],
        icon: <MessageSquare />,
        keys: ["G", "T"],
        run: go(`/tutor${scope}`),
      },
      {
        id: "navigate:topics",
        group: "navigate",
        label: "All topics",
        icon: <LayoutGrid />,
        keys: ["G", "A"],
        run: go("/topics"),
      },
      {
        id: "navigate:account",
        group: "navigate",
        label: "Account",
        keywords: ["settings", "profile"],
        icon: <Settings />,
        keys: ["G", "S"],
        run: go("/account"),
      },
    );

    for (const topic of topics) {
      list.push({
        id: `topic:${topic.id}`,
        group: "topics",
        label: topic.title,
        secondary: topic.dueCards > 0 ? `${topic.dueCards} due` : undefined,
        keywords: ["topic", ...topic.modules.map((m) => m.title)],
        icon: <LayoutGrid />,
        run: go(`/dashboard?id=${topic.id}`),
      });
    }
    for (const topic of archivedTopics) {
      list.push({
        id: `archived:${topic.id}`,
        group: "archived",
        label: topic.title,
        secondary: "Archived",
        keywords: ["topic", "archive"],
        icon: <Archive />,
        run: go("/topics"),
      });
    }

    const showLessons = searchMode || hasQuery || context === "dashboard";
    if (showLessons) {
      const all = flattenLessons(topics, activeId);
      const visible =
        searchMode || hasQuery
          ? all
          : all.filter((lesson) => lesson.topicId === activeId);
      for (const lesson of visible) {
        list.push({
          id: `lesson:${lesson.lessonId}`,
          group: "lessons",
          label: lesson.title,
          secondary: lesson.locked ? `${lesson.topicTitle}, locked` : lesson.topicTitle,
          keywords: [lesson.topicTitle, lesson.moduleTitle],
          icon: lesson.locked ? <Lock /> : lessonIcon(lesson.status, lesson.masteryScore),
          dimmed: lesson.locked,
          run: go(
            lesson.locked
              ? `/dashboard?id=${lesson.topicId}`
              : `/learn/${lesson.lessonId}`,
          ),
        });
      }
    }

    const actions: (PaletteEntry & { scope: "lesson" | "global" })[] = [
      {
        id: "action:new-topic",
        group: "actions",
        scope: "global",
        label: "New topic",
        keywords: ["create", "learn"],
        icon: <Plus />,
        keys: ["C"],
        run: go(NEW_TOPIC_HREF),
      },
      {
        id: "action:sidebar",
        group: "actions",
        scope: "global",
        label: "Toggle sidebar",
        keywords: ["collapse", "expand"],
        icon: <PanelLeft />,
        keys: ["["],
        run: toggleSidebar,
      },
      {
        id: "action:theme",
        group: "actions",
        scope: "global",
        label: "Switch theme",
        keywords: ["dark", "light", "appearance", "system"],
        icon: <SunMoon />,
        keys: ["Ctrl", "Shift", "L"],
        run: () => {},
      },
      {
        id: "action:copy-link",
        group: "actions",
        scope: "global",
        label: "Copy link to this page",
        keywords: ["url", "share"],
        icon: <Copy />,
        run: () => void copyLink(window.location.href),
      },
      {
        id: "action:shortcuts",
        group: "actions",
        scope: "global",
        label: "Keyboard shortcuts",
        keywords: ["keys", "help"],
        icon: <Keyboard />,
        keys: ["?"],
        run: openShortcutsSheet,
      },
    ];
    if (focusMode.isLessonRoute) {
      actions.push({
        id: "action:focus",
        group: "actions",
        scope: "lesson",
        label: focusMode.focus ? "Leave focus mode" : "Enter focus mode",
        keywords: ["toggle focus", "distraction"],
        icon: <Focus />,
        keys: ["F"],
        run: focusMode.toggle,
      });
    }
    if (currentLink) {
      actions.push({
        id: "action:pin",
        group: "actions",
        scope: "lesson",
        label: pinned ? "Unpin current lesson" : "Pin current lesson",
        keywords: ["favorite"],
        icon: pinned ? <PinOff /> : <Pin />,
        keys: ["P"],
        run: () =>
          void (pinned ? pinActions.unpin(currentLink) : pinActions.pin(currentLink)),
      });
    }
    list.push(...orderActions(actions, context));

    if (!hasQuery) {
      for (const recent of recents) {
        list.push({
          id: `recent:${recent.lessonId}`,
          group: "recent",
          label: recent.title,
          secondary: recent.topicTitle,
          icon: <Clock />,
          run: go(`/learn/${recent.lessonId}`),
        });
      }
    }
    return list;
  }, [
    topics,
    archivedTopics,
    recents,
    dueCardsTotal,
    activeId,
    fallbackId,
    context,
    searchMode,
    hasQuery,
    navigate,
    toggleSidebar,
    focusMode,
    currentLink,
    pinned,
    pinActions,
  ]);

  const visibleEntries = useMemo(
    () => (hasQuery ? entries : entries.filter((e) => e.group !== "archived")),
    [entries, hasQuery],
  );

  return { entries: visibleEntries, context, isMac };
}

function PaletteBody({
  mode,
  onClose,
}: {
  mode: PaletteMode;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState<"root" | "theme">("root");
  const { theme, setTheme } = useThemeCycle();
  const searchMode = mode === "search";
  const { entries, context, isMac } = usePaletteEntries(searchMode, query);

  const labels = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry.label])),
    [entries],
  );
  const filter = useCallback(
    (value: string, search: string, keywords?: string[]) =>
      defaultFilter(labels.get(value) ?? value, search, keywords),
    [labels],
  );

  const pick = useCallback(
    (entry: PaletteEntry) => {
      if (entry.id === "action:theme") {
        setPage("theme");
        setQuery("");
        return;
      }
      onClose();
      entry.run();
    },
    [onClose],
  );

  const pickTheme = (choice: ThemeChoice) => {
    onClose();
    setTheme(choice);
  };

  const groups = orderGroups(context, searchMode);
  const placeholder =
    page === "theme"
      ? "Choose a theme"
      : searchMode
        ? "Search lessons and topics"
        : "Type a command or search";

  return (
    <CommandPrimitive
      label="Command palette"
      filter={filter}
      loop
      onKeyDown={(event) => {
        if (event.key === "Backspace" && query === "" && page !== "root") {
          event.preventDefault();
          setPage("root");
        }
      }}
      className="flex flex-col"
    >
      <div className="flex h-[50px] items-center gap-2.5 border-b border-border px-4">
        {page === "theme" ? (
          <ArrowLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <CommandPrimitive.Input
          autoFocus
          value={query}
          onValueChange={setQuery}
          placeholder={placeholder}
          className="h-full flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-faint"
        />
      </div>
      <CommandPrimitive.List className="max-h-[340px] overflow-x-hidden overflow-y-auto p-1.5 [scrollbar-color:var(--border-strong)_transparent] [scrollbar-width:thin]">
        <CommandPrimitive.Empty className="py-8 text-center text-sm text-muted-foreground">
          Nothing matches that.
        </CommandPrimitive.Empty>
        {page === "theme" ? (
          <CommandPrimitive.Group
            heading="Theme"
            className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:text-faint"
          >
            {THEME_ORDER.map((choice) => (
              <CommandPrimitive.Item
                key={choice}
                value={`theme:${choice}`}
                keywords={[THEME_LABEL[choice]]}
                onSelect={() => pickTheme(choice)}
                className={itemClass}
              >
                <SunMoon className="size-[15px] text-muted-foreground" />
                {THEME_LABEL[choice]}
                {theme === choice ? <Check className="ml-auto size-4" /> : null}
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.Group>
        ) : (
          groups.map((group) => {
            const items = entries.filter((entry) => entry.group === group);
            if (items.length === 0) return null;
            return (
              <CommandPrimitive.Group
                key={group}
                heading={GROUP_LABEL[group]}
                className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[11.5px] [&_[cmdk-group-heading]]:text-faint"
              >
                {items.map((entry) => (
                  <Row key={entry.id} entry={entry} isMac={isMac} onPick={pick} />
                ))}
              </CommandPrimitive.Group>
            );
          })
        )}
      </CommandPrimitive.List>
      <div className="flex items-center gap-4 border-t border-border px-3.5 py-2 text-[11.5px] text-faint">
        <span className="flex items-center gap-1.5">
          <Kbd className="h-[18px] min-w-[18px] text-[10px]">↑</Kbd>
          <Kbd className="h-[18px] min-w-[18px] text-[10px]">↓</Kbd>
          move
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd className="h-[18px] min-w-[18px] text-[10px]">
            <CornerDownLeft />
          </Kbd>
          open
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd className="h-[18px] text-[10px]">Esc</Kbd>
          close
        </span>
        {page === "theme" ? (
          <span className="ml-auto flex items-center gap-1.5">
            <Kbd className="h-[18px] text-[10px]">Backspace</Kbd>
            back
          </span>
        ) : null}
      </div>
    </CommandPrimitive>
  );
}

export function CommandPalette({
  open,
  mode,
  onOpenChange,
}: {
  open: boolean;
  mode: PaletteMode;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[14vh] translate-y-0 gap-0 overflow-hidden rounded-[14px] bg-surface-2 p-0 data-open:zoom-in-[.97] data-closed:zoom-out-[.97] motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none sm:max-w-[620px]"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Search for a page, topic, lesson or action.
        </DialogDescription>
        <PaletteBody mode={mode} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
