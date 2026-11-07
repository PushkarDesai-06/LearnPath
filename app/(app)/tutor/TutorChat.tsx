"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { LoadingRing } from "@/components/ui/loading-ring";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Markdown } from "@/components/Markdown";
import { ChatComposer } from "@/components/ChatComposer";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import type { ChatMessageDTO, ConversationSummary } from "@/lib/data/types";
import { loadConversationAction } from "./actions";
import { ASSISTANT_TURN, TranscriptSkeleton, TutorDot, USER_TURN } from "./TutorParts";

type Msg = { id: string; role: "user" | "assistant"; text: string; failed?: boolean };

let seq = 0;
/** Local key for a turn, so a failed one can be retried or edited by identity. */
const nextId = () => `m${++seq}`;

const toMsgs = (m: ChatMessageDTO[]): Msg[] =>
  m.map((x) => ({ id: nextId(), role: x.role, text: x.content }));

/**
 * The tutor workspace. The thread list and the newest thread arrive
 * server-rendered as props; from there this island owns the state: switching
 * threads loads a transcript via a Server Action, and sending updates the list
 * locally (no re-fetch). The page keys its boundary on the topic, so a topic
 * switch remounts this with fresh props.
 *
 * The chat column is the same centred reading column as the other topic pages;
 * the thread list hangs in the left gutter when there's room for it, and folds
 * into a "Threads" menu in the header when there isn't.
 */
export function TutorChat({
  curriculumId,
  topicTitle,
  initialConversations,
  initialActiveId,
  initialMessages,
}: {
  curriculumId: string;
  topicTitle: string;
  initialConversations: ConversationSummary[];
  initialActiveId: string | null;
  initialMessages: ChatMessageDTO[];
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [messages, setMessages] = useState<Msg[]>(() => toMsgs(initialMessages));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  // Read out by a polite live region: only NEW replies, never loaded history.
  const [announcement, setAnnouncement] = useState("");

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
  }

  /** Send `message`; on failure the turn stays on screen, marked, with Retry/Edit. */
  async function deliver(message: string) {
    const id = nextId();
    setMessages((m) => [...m, { id, role: "user", text: message }]);
    setBusy(true);
    try {
      const res = await api<{ conversationId: string; title: string; reply: string }>(
        "/api/tutor",
        { body: { message, curriculumId, conversationId: activeId ?? undefined } },
      );
      setMessages((m) => [...m, { id: nextId(), role: "assistant", text: res.reply }]);
      setAnnouncement(`Tutor: ${res.reply}`);
      setActiveId(res.conversationId);
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
      setMessages((m) => m.map((x) => (x.id === id ? { ...x, failed: true } : x)));
      setAnnouncement("Your message wasn't sent.");
      toast.error(err instanceof Error ? err.message : "Couldn't reach the tutor");
    } finally {
      setBusy(false);
    }
  }

  function send() {
    if (locked) return;
    const message = input.trim();
    if (!message) return;
    setInput("");
    void deliver(message);
  }

  /** Drop a failed turn and either resend it or put it back in the box. */
  function recoverFailed(id: string, action: "retry" | "edit") {
    const failed = messages.find((m) => m.id === id && m.failed);
    if (!failed || locked) return;
    setMessages((m) => m.filter((x) => x.id !== id));
    if (action === "retry") void deliver(failed.text);
    else setInput(failed.text);
  }

  const threadButton = (c: ConversationSummary) => (
    <Button
      key={c.id}
      variant={activeId === c.id ? "secondary" : "ghost"}
      size="sm"
      className="h-auto min-h-9 w-full justify-start py-2 text-left"
      onClick={() => void selectConversation(c.id)}
      disabled={locked}
      aria-current={activeId === c.id ? "true" : undefined}
      title={c.title}
    >
      <span className="truncate text-left text-sm font-normal">{c.title}</span>
      {switching === c.id && <LoadingRing className="ml-auto size-3 shrink-0" />}
    </Button>
  );

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      {/* Thread list in the gutter, when the gutter is wide enough to hold it. */}
      <aside
        aria-label="Threads"
        className="absolute inset-y-0 right-full hidden w-52 pr-6 min-[1180px]:block"
      >
        <div className="sticky top-28 flex flex-col gap-1">
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
            <p className="text-muted-foreground/70 px-2 text-xs">No threads yet.</p>
          ) : (
            conversations.map(threadButton)
          )}
        </div>
      </aside>

      <div className="flex flex-col gap-8">
        <PageHeader
          eyebrow="Tutor"
          title={topicTitle}
          description="I guide you toward answers. I won't hand them over."
          actions={
            // Narrow screens: the gutter rail is hidden, so its controls live here.
            <div className="flex items-center gap-2 min-[1180px]:hidden">
              {conversations.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={locked}>
                      Threads
                      <ChevronsUpDown data-icon="inline-end" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Threads</DropdownMenuLabel>
                    {conversations.map((c) => (
                      <DropdownMenuItem key={c.id} onSelect={() => void selectConversation(c.id)}>
                        <span className="truncate">{c.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button onClick={newConversation} disabled={locked} variant="outline" size="sm">
                <Plus data-icon="inline-start" />
                New chat
              </Button>
            </div>
          }
        />

        <div className="flex flex-col gap-6 pb-4">
          {switching && <TranscriptSkeleton />}
          {!switching && messages.length === 0 && (
            <div className="flex gap-3">
              <TutorDot />
              <div className="flex flex-col gap-1 pt-0.5">
                <p className="text-sm">Ask whatever you&apos;re stuck on in this topic. I&apos;ll ask back.</p>
                <p className="text-muted-foreground text-xs">Each chat is its own thread.</p>
              </div>
            </div>
          )}
          {!switching &&
            messages.map((m) => (
              <div key={m.id} className={cn("flex gap-3", m.role === "user" && "flex-row-reverse")}>
                {m.role === "assistant" && <TutorDot />}
                {m.role === "user" ? (
                  <div className="flex max-w-[85%] flex-col items-end gap-1">
                    <div className={cn(USER_TURN, "max-w-full", m.failed && "opacity-60")}>{m.text}</div>
                    {m.failed && (
                      <p className="text-muted-foreground flex items-center gap-2 text-xs">
                        Not sent.
                        <button
                          type="button"
                          onClick={() => recoverFailed(m.id, "retry")}
                          disabled={locked}
                          className="text-foreground inline-flex items-center gap-1 underline underline-offset-2"
                        >
                          <RotateCw className="size-3" />
                          Retry
                        </button>
                        <button
                          type="button"
                          onClick={() => recoverFailed(m.id, "edit")}
                          disabled={locked}
                          className="text-foreground underline underline-offset-2"
                        >
                          Edit
                        </button>
                      </p>
                    )}
                  </div>
                ) : (
                  <div className={ASSISTANT_TURN}>
                    <Markdown className="prose-p:my-2 prose-pre:my-2 prose-code:text-foreground">
                      {m.text}
                    </Markdown>
                  </div>
                )}
              </div>
            ))}
          {busy && (
            <div className="flex items-center gap-3" role="status">
              <TutorDot className="mt-0 animate-pulse" />
              <span className="text-muted-foreground text-xs">Thinking…</span>
            </div>
          )}
          <p role="status" aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>

        <ChatComposer
          id="tutor-message"
          label={`Message the tutor about ${topicTitle}`}
          value={input}
          onChange={setInput}
          onSubmit={send}
          placeholder="What are you stuck on?"
          submitLabel="Ask"
          busy={busy}
          disabled={locked}
          className="sticky bottom-4"
        />
      </div>
    </div>
  );
}
