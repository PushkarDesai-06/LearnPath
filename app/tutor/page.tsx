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

function SocraticMark({ className }: { className?: string }) {
  // The tutor's identity mark — italic Newsreader "S" inside a mint hairline
  // ring. Quiet, but consistent across every tutor message.
  return (
    <span
      aria-hidden
      className={cn(
        "border-primary/40 text-primary inline-flex size-6 shrink-0 items-center justify-center rounded-full border bg-primary/5 font-display text-sm italic",
        className,
      )}
    >
      S
    </span>
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
    toast.message("Started a new conversation");
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
    <div className="grid gap-6 md:grid-cols-[200px_1fr]">
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
        {conversations.map((c) => (
          <Button
            key={c.id}
            variant={activeId === c.id ? "secondary" : "ghost"}
            size="sm"
            className="justify-start"
            onClick={() => setActiveId(c.id)}
            title={c.title}
          >
            <span className="truncate text-left">{c.title}</span>
          </Button>
        ))}
        {conversations.length === 0 && (
          <p className="text-muted-foreground px-1 text-xs">
            No conversations yet.
          </p>
        )}
      </aside>

      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
            Socratic tutor
          </p>
          <h1 className="h-display text-3xl">Think it through.</h1>
          <p className="text-muted-foreground text-sm">
            I guide you toward answers. I won&apos;t hand them over.
          </p>
        </header>

        <div className="flex flex-col gap-5">
          {messages.length === 0 && (
            <div className="border-border rounded-2xl border border-dashed p-6">
              <div className="flex items-start gap-3">
                <SocraticMark />
                <div className="flex flex-col gap-1">
                  <p className="text-sm">
                    Ask whatever you&apos;re stuck on. I&apos;ll ask back.
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Each chat is its own thread.
                  </p>
                </div>
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                m.role === "user" && "justify-end",
              )}
            >
              {m.role === "assistant" && <SocraticMark />}
              <div
                className={cn(
                  "max-w-[78%] text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-surface-2 rounded-2xl rounded-br-md px-4 py-2.5 whitespace-pre-wrap"
                    : "pt-0.5",
                )}
              >
                {m.role === "assistant" ? (
                  <Markdown className="prose-p:my-1.5 prose-pre:my-2">
                    {m.text}
                  </Markdown>
                ) : (
                  m.text
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex items-center gap-3">
              <SocraticMark />
              <Spinner className="text-muted-foreground" />
            </div>
          )}
        </div>

        <form
          onSubmit={send}
          className="bg-surface-1 border-border focus-within:border-primary/30 sticky bottom-4 flex flex-col gap-2 rounded-2xl border p-3 transition-colors"
        >
          <Textarea
            rows={2}
            placeholder="What are you stuck on?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                send(e as unknown as React.FormEvent);
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground/70 text-xs">
              ⌘↵ to send
            </span>
            <Button type="submit" size="sm" disabled={busy || !input.trim()}>
              <Send data-icon="inline-start" />
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
