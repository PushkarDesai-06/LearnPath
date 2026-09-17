"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingRing } from "@/components/ui/loading-ring";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; text: string };
interface Conversation {
  id: string;
  title: string;
  messageCount: number;
}

/** Mint dot prefix for assistant turns — matches the logo + trail-rail mark. */
function TutorDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "bg-primary shadow-primary/40 mt-2 size-1.5 shrink-0 rounded-full shadow-[0_0_6px]",
        className,
      )}
    />
  );
}

// Layout-matched loading state for a thread transcript — alternating user
// bubbles and assistant blocks, sized like the real turns they stand in for.
const SKELETON_TURNS = [
  { role: "user", lines: ["w-36"] },
  { role: "assistant", lines: ["w-full", "w-11/12", "w-2/3"] },
  { role: "user", lines: ["w-52"] },
  { role: "assistant", lines: ["w-full", "w-3/4"] },
] as const;

function TranscriptSkeleton() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-label="Loading thread"
    >
      {SKELETON_TURNS.map((turn, i) =>
        turn.role === "user" ? (
          <div key={i} className="flex flex-row-reverse gap-3">
            <div className="bg-surface-2/80 flex max-w-[85%] flex-col gap-2 rounded-xl rounded-tr-sm px-3.5 py-2.5">
              {turn.lines.map((w, j) => (
                <Skeleton key={j} className={cn("h-3", w)} />
              ))}
            </div>
          </div>
        ) : (
          <div key={i} className="flex gap-3">
            <Skeleton className="mt-2 size-1.5 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-md bg-white/10 p-3 px-4">
              {turn.lines.map((w, j) => (
                <Skeleton key={j} className={cn("h-3", w)} />
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

export default function TutorPage() {
  const router = useRouter();
  const topicId = useSearchParams().get("id");
  // The thread list, tagged with the topic it was fetched for. Switching topics
  // invalidates it for free, so `conversations` reads null again and the page
  // falls back to its skeleton instead of showing the old topic's threads.
  const [threads, setThreads] = useState<{
    key: string;
    list: Conversation[];
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Id of the thread whose transcript `messages` currently holds — null for a
  // fresh, unsaved chat. Anything else than `activeId` means we're still loading.
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const q = topicId ? `?curriculumId=${topicId}` : "";
  // null until the list for THIS topic arrives — distinguishes "still loading"
  // from "none".
  const conversations = threads?.key === q ? threads.list : null;

  const loadingThread = activeId !== null && loadedId !== activeId;
  // The thread list and the first thread's history load back to back, so treat
  // them as one uninterrupted loading window.
  const loading = conversations === null || loadingThread;

  const refreshList = useCallback(() => {
    api<{ conversations: Conversation[] }>(`/api/tutor/conversations${q}`)
      .then((res) => setThreads({ key: q, list: res.conversations }))
      .catch(() => {});
  }, [q]);

  useEffect(() => {
    let active = true;
    api<{ conversations: Conversation[] }>(`/api/tutor/conversations${q}`)
      .then((res) => {
        if (!active) return;
        setThreads({ key: q, list: res.conversations });
        // Always re-point the selection: on a topic switch the old thread is
        // not in this list, and a topic with no threads must clear it entirely.
        setActiveId(res.conversations[0]?.id ?? null);
        setLoadedId(null);
        setMessages([]);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
          return;
        }
        setThreads({ key: q, list: [] });
        toast.error("Couldn't load your threads");
      });
    return () => {
      active = false;
    };
  }, [q, router]);

  useEffect(() => {
    // `loadedId === activeId` covers both an already-fetched thread and one we
    // just created by sending — its messages are already on screen.
    if (!activeId || loadedId === activeId) return;
    const id = activeId;
    let active = true;
    api<{ messages: { role: "user" | "assistant"; content: string }[] }>(
      `/api/tutor?conversationId=${id}`,
    )
      .then((res) => {
        if (!active) return;
        setMessages(
          res.messages.map((m) => ({ role: m.role, text: m.content })),
        );
        setLoadedId(id);
      })
      .catch(() => {
        if (!active) return;
        toast.error("Couldn't load that thread");
        // Settle on the empty transcript rather than spinning forever.
        setLoadedId(id);
      });
    return () => {
      active = false;
    };
  }, [activeId, loadedId]);

  /** Switch threads: drop the old transcript immediately so nothing stale shows. */
  function selectConversation(id: string) {
    if (id === activeId || busy || loading) return;
    setMessages([]);
    setActiveId(id);
  }

  function newConversation() {
    // Blocked while a thread's history is in flight — that fetch would land on
    // the fresh chat and drop someone else's transcript into it.
    if (busy || loading) return;
    setActiveId(null);
    setLoadedId(null);
    setMessages([]);
    toast.message("New thread started");
  }

  async function send() {
    if (busy || loading) return;
    const message = input.trim();
    if (!message) return;
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api<{ conversationId: string; reply: string }>(
        "/api/tutor",
        {
          body: {
            message,
            curriculumId: topicId ?? undefined,
            conversationId: activeId ?? undefined,
          },
        },
      );
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      if (!activeId) {
        setLoadedId(res.conversationId);
        setActiveId(res.conversationId);
      }
      refreshList();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
      {/* Conversation rail */}
      <aside className="flex flex-col gap-1">
        <Button
          onClick={newConversation}
          disabled={busy || loading}
          variant="outline"
          size="sm"
          className="mb-2 justify-start"
        >
          <Plus data-icon="inline-start" />
          New chat
        </Button>
        <p className="text-muted-foreground/80 mb-1 px-2 font-mono text-[10px] uppercase tracking-[0.16em]">
          Threads
        </p>
        {conversations === null ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))
        ) : conversations.length === 0 ? (
          <p className="text-muted-foreground/70 px-2 text-xs">
            No threads yet.
          </p>
        ) : (
          conversations.map((c) => (
            <Button
              key={c.id}
              variant={activeId === c.id ? "secondary" : "ghost"}
              size="sm"
              className="h-auto min-h-9 justify-start py-2 text-left"
              onClick={() => selectConversation(c.id)}
              disabled={busy || loading}
              title={c.title}
            >
              <span className="truncate text-left text-sm font-normal">
                {c.title}
              </span>
              {activeId === c.id && loadingThread && (
                <LoadingRing className="ml-auto size-3 shrink-0" />
              )}
            </Button>
          ))
        )}
      </aside>

      {/* Chat column — capped for reading comfort */}
      <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-2">
          {loading ? (
            <>
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-9 w-64 max-w-full" />
              <Skeleton className="h-4 w-80 max-w-full" />
            </>
          ) : (
            <>
              <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
                Socratic tutor
              </p>
              <h1 className="h-display text-3xl">Think it through.</h1>
              <p className="text-muted-foreground text-sm">
                I guide you toward answers. I won&apos;t hand them over.
              </p>
            </>
          )}
        </header>

        <div className="flex flex-col gap-6 pb-4">
          {loading && <TranscriptSkeleton />}
          {!loading && messages.length === 0 && (
            <div className="flex gap-3">
              <TutorDot />
              <div className="flex flex-col gap-1 pt-0.5">
                <p className="text-sm">
                  Ask whatever you&apos;re stuck on. I&apos;ll ask back.
                </p>
                <p className="text-muted-foreground text-xs">
                  Each chat is its own thread.
                </p>
              </div>
            </div>
          )}
          {!loading &&
            messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-3",
                  m.role === "user" && "flex-row-reverse",
                )}
              >
                {m.role === "assistant" && <TutorDot />}
                {m.role === "user" ? (
                  <div className="bg-surface-2/80 max-w-[85%] rounded-xl rounded-tr-sm px-3.5 py-2 text-sm whitespace-pre-wrap">
                    {m.text}
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 pt-0.5 text-sm bg-white/10 rounded-md p-2 px-4">
                    <Markdown className="prose-p:my-2 prose-pre:my-2 prose-code:text-foreground">
                      {m.text}
                    </Markdown>
                  </div>
                )}
              </div>
            ))}
          {busy && (
            <div className="flex items-center gap-3">
              <TutorDot className="mt-0 animate-pulse" />
              <span className="text-muted-foreground text-xs">Thinking…</span>
            </div>
          )}
        </div>

        {!loading && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="bg-surface-1 border-border focus-within:border-primary/30 sticky bottom-4 flex flex-col gap-1 rounded-xl border p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] transition-colors"
          >
            <Textarea
              rows={2}
              placeholder="What are you stuck on?"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="min-h-[60px] resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0 px-2.5 py-1.5"
              onKeyDown={(e) => {
                // Ignore Enter while an IME is composing a character.
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="flex items-center justify-between gap-2 mt-1">
              <span className="text-muted-foreground/60 font-inter text-[10px] uppercase tracking-tight">
                ↵ to send · ⇧↵ for newline
              </span>
              <Button type="submit" size="sm" disabled={busy || !input.trim()}>
                {busy ? (
                  <LoadingRing data-icon="inline-start" />
                ) : (
                  <Send data-icon="inline-start" />
                )}
                Ask
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
