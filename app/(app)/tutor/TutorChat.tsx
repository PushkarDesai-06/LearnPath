"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingRing } from "@/components/ui/loading-ring";
import { Markdown } from "@/components/Markdown";
import { cn } from "@/lib/utils";
import type { ChatMessageDTO, ConversationSummary } from "@/lib/data/types";
import { loadConversationAction } from "./actions";
import { TranscriptSkeleton, TutorDot, TutorHeader } from "./TutorParts";

type Msg = { role: "user" | "assistant"; text: string };

const toMsgs = (m: ChatMessageDTO[]): Msg[] =>
  m.map((x) => ({ role: x.role, text: x.content }));

/**
 * The tutor workspace. The thread list and the newest thread arrive
 * server-rendered as props; from there this island owns the state: switching
 * threads loads a transcript via a Server Action, and sending updates the rail
 * locally (no list re-fetch). The page keys its boundary on the topic, so a
 * topic switch remounts this with fresh props.
 */
export function TutorChat({
  curriculumId,
  initialConversations,
  initialActiveId,
  initialMessages,
}: {
  curriculumId: string | null;
  initialConversations: ConversationSummary[];
  initialActiveId: string | null;
  initialMessages: ChatMessageDTO[];
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [messages, setMessages] = useState<Msg[]>(() =>
    toMsgs(initialMessages),
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Id of the thread whose transcript is loading, if any.
  const [switching, setSwitching] = useState<string | null>(null);
  const locked = busy || switching !== null;

  async function selectConversation(id: string) {
    if (id === activeId || locked) return;
    setSwitching(id);
    try {
      const convo = await loadConversationAction(id);
      if (!convo) {
        toast.error("Couldn't load that thread");
        return;
      }
      setActiveId(id);
      setMessages(toMsgs(convo.messages));
    } catch {
      toast.error("Couldn't load that thread");
    } finally {
      setSwitching(null);
    }
  }

  function newConversation() {
    if (locked) return;
    setActiveId(null);
    setMessages([]);
    toast.message("New thread started");
  }

  async function send() {
    if (locked) return;
    const message = input.trim();
    if (!message) return;
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setBusy(true);
    try {
      const res = await api<{
        conversationId: string;
        title: string;
        reply: string;
      }>("/api/tutor", {
        body: {
          message,
          curriculumId: curriculumId ?? undefined,
          conversationId: activeId ?? undefined,
        },
      });
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      setActiveId(res.conversationId);
      // Mirror the server's ordering (updatedAt desc) without re-fetching:
      // the thread just written to moves to the top.
      setConversations((list) => {
        const prev = list.find((c) => c.id === res.conversationId);
        const updated: ConversationSummary = {
          id: res.conversationId,
          title: prev?.title ?? res.title,
          messageCount: (prev?.messageCount ?? 0) + 2,
          updatedAt: new Date().toISOString(),
        };
        return [updated, ...list.filter((c) => c.id !== res.conversationId)];
      });
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
          disabled={locked}
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
        {conversations.length === 0 ? (
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
              onClick={() => void selectConversation(c.id)}
              disabled={locked}
              title={c.title}
            >
              <span className="truncate text-left text-sm font-normal">
                {c.title}
              </span>
              {switching === c.id && (
                <LoadingRing className="ml-auto size-3 shrink-0" />
              )}
            </Button>
          ))
        )}
      </aside>

      {/* Chat column — capped for reading comfort */}
      <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-6">
        <TutorHeader />

        <div className="flex flex-col gap-6 pb-4">
          {switching && <TranscriptSkeleton />}
          {!switching && messages.length === 0 && (
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
          {!switching &&
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
            <Button type="submit" size="sm" disabled={locked || !input.trim()}>
              {busy ? (
                <LoadingRing data-icon="inline-start" />
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
