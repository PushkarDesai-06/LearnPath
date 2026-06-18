"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
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

function TutorInner() {
  const router = useRouter();
  const topicId = useSearchParams().get("id");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const q = topicId ? `?curriculumId=${topicId}` : "";

  const refreshList = useCallback(() => {
    api<{ conversations: Conversation[] }>(`/api/tutor/conversations${q}`)
      .then((res) => setConversations(res.conversations))
      .catch(() => {});
  }, [q]);

  useEffect(() => {
    let active = true;
    api<{ conversations: Conversation[] }>(`/api/tutor/conversations${q}`)
      .then((res) => {
        if (!active) return;
        setConversations(res.conversations);
        if (res.conversations.length > 0) setActiveId(res.conversations[0].id);
      })
      .catch((err) => {
        if (active && err instanceof ApiClientError && err.status === 401)
          router.push("/login");
      });
    return () => {
      active = false;
    };
  }, [q, router]);

  useEffect(() => {
    if (!activeId) return;
    let active = true;
    api<{ messages: { role: "user" | "assistant"; content: string }[] }>(
      `/api/tutor?conversationId=${activeId}`,
    )
      .then(
        (res) =>
          active &&
          setMessages(
            res.messages.map((m) => ({ role: m.role, text: m.content })),
          ),
      )
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeId]);

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    toast.message("New thread started");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
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
      if (!activeId) setActiveId(res.conversationId);
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
        {conversations.map((c) => (
          <Button
            key={c.id}
            variant={activeId === c.id ? "secondary" : "ghost"}
            size="sm"
            className="h-auto min-h-9 justify-start py-2 text-left"
            onClick={() => setActiveId(c.id)}
            title={c.title}
          >
            <span className="truncate text-left text-sm font-normal">
              {c.title}
            </span>
          </Button>
        ))}
        {conversations.length === 0 && (
          <p className="text-muted-foreground/70 px-2 text-xs">
            No threads yet.
          </p>
        )}
      </aside>

      {/* Chat column — capped for reading comfort */}
      <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
            Socratic tutor
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Think it through.
          </h1>
          <p className="text-muted-foreground text-sm">
            I guide you toward answers. I won&apos;t hand them over.
          </p>
        </header>

        <div className="flex flex-col gap-6 pb-4">
          {messages.length === 0 && (
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
          {messages.map((m, i) => (
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
                <div className="min-w-0 flex-1 pt-0.5 text-sm leading-relaxed">
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

        <form
          onSubmit={send}
          className="bg-surface-1 border-border focus-within:border-primary/30 sticky bottom-4 flex flex-col gap-1 rounded-xl border p-3 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] transition-colors"
        >
          <Textarea
            rows={2}
            placeholder="What are you stuck on?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[60px] resize-none border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                send(e as unknown as React.FormEvent);
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground/60 font-mono text-[10px] uppercase tracking-[0.14em]">
              ⌘ + ↵ to send
            </span>
            <Button
              type="submit"
              size="sm"
              disabled={busy || !input.trim()}
            >
              {busy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              Ask
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TutorPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <TutorInner />
    </Suspense>
  );
}
