"use client";

/**
 * The topbar's second row: which topic you're in, and that topic's three
 * places (Path, Tutor, Flashcards). It only exists on routes that belong to a
 * topic, and whether it exists depends on the pathname alone, so the row is in
 * the server HTML and never pops in after hydration.
 *
 * Topic-scoped pages read the active topic from `?id=` and fall back to the
 * learner's newest curriculum when it's absent (see `resolveCurriculum`), so the
 * bar mirrors that: the matching topic, or the first of the list. A lesson has
 * no `?id=` but announces its topic via `ActiveTopicMarker`.
 *
 * The list comes from the server (`Nav`); it refreshes whenever the tree does.
 */
import { Suspense, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useActiveTopic } from "@/components/ActiveTopic";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface SwitcherTopic {
  id: string;
  title: string;
  /** 0..1 */
  mastery: number;
}

/** Pages that scope themselves to `?id=`. */
const TOPIC_SCOPED = ["/dashboard", "/tutor", "/flashcards"];

const TABS = [
  { href: "/dashboard", label: "Path" },
  { href: "/tutor", label: "Tutor" },
  { href: "/flashcards", label: "Flashcards" },
] as const;

const isLesson = (pathname: string) => pathname.startsWith("/learn/");

/** Does this route belong to a topic (and so get the topic row)? */
export function hasTopicBar(pathname: string) {
  return TOPIC_SCOPED.includes(pathname) || isLesson(pathname);
}

const noopSubscribe = () => () => {};

function TopicBarInner({ topics }: { topics: SwitcherTopic[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const topicId = useSearchParams().get("id");
  // A lesson announces its topic from an effect, which can run before this
  // Suspense-wrapped bar hydrates. Ignore it until hydration is done so the
  // first client render matches the server's.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const announcedTopic = useActiveTopic();
  const announced = hydrated ? announcedTopic : null;

  const scoped = TOPIC_SCOPED.includes(pathname);
  const active = scoped
    ? topicId
      ? topics.find((t) => t.id === topicId)
      : // No id in the URL: the server falls back to the newest curriculum,
        // which is the first entry of this list (sorted createdAt desc).
        topics[0]
    : announced
      ? topics.find((t) => t.id === announced)
      : undefined;

  // A lesson is part of the path, so "Path" stays current while reading one.
  const currentTab = isLesson(pathname) ? "/dashboard" : pathname;
  const tabHref = (base: string, id = active?.id) => (id ? `${base}?id=${id}` : base);
  const switchHref = (id: string) => tabHref(scoped ? pathname : "/dashboard", id);

  function select(id: string) {
    if (active && id === active.id) return;
    // These pages render on the server from `?id=`, so the switch must be a
    // router navigation (a bare history.pushState wouldn't re-render them).
    router.push(switchHref(id), { scroll: false });
  }

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          // Warm the likely destinations while the learner reads the list.
          if (open) for (const t of topics) router.prefetch(switchHref(t.id));
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2.5 min-w-0 max-w-[10rem] shrink font-medium sm:max-w-[18rem]"
            aria-label={active ? `Topic: ${active.title}. Switch topic` : "Switch topic"}
          >
            <span className="truncate">{active?.title ?? "Loading topic…"}</span>
            <ChevronsUpDown data-icon="inline-end" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64" align="start">
          <DropdownMenuLabel>Switch topic</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={active?.id ?? ""} onValueChange={select}>
            {topics.map((t) => (
              <DropdownMenuRadioItem key={t.id} value={t.id}>
                <span className="truncate">{t.title}</span>
                <span className="text-muted-foreground ml-auto font-mono text-[10px] tabular-nums">
                  {Math.round(t.mastery * 100)}%
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-center" />
      <ul className="flex items-stretch gap-1 self-stretch">
        {TABS.map((tab) => {
          const current = currentTab === tab.href;
          return (
            <li key={tab.href} className="flex">
              <Link
                href={tabHref(tab.href)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "relative flex items-center px-2 text-sm transition-colors",
                  "focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-[3px]",
                  current
                    ? "text-foreground after:bg-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-px"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function TopicBar({ topics }: { topics: SwitcherTopic[] }) {
  const pathname = usePathname();
  if (topics.length === 0 || !hasTopicBar(pathname)) return null;
  return (
    <nav
      aria-label="Topic"
      className="mx-auto flex h-10 w-full max-w-4xl items-center gap-1 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:px-6"
    >
      {/* `useSearchParams` opts its subtree into client rendering; the row's
          height is fixed out here, so nothing shifts while it resolves. */}
      <Suspense fallback={null}>
        <TopicBarInner topics={topics} />
      </Suspense>
    </nav>
  );
}

/**
 * The row's height, reserved by the topbar's loading fallback on topic routes,
 * so the real row replaces it without moving the page.
 */
export function TopicBarSlot() {
  const pathname = usePathname();
  return hasTopicBar(pathname) ? <div aria-hidden className="h-10" /> : null;
}
