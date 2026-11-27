"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, MessageSquarePlus, MoreHorizontal, PanelLeft } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoadingRing } from "@/components/ui/loading-ring";
import { Markdown } from "@/components/Markdown";
import {
  AssistantAvatar,
  AssistantTurn,
  ChatComposer,
  TypingBars,
  UserBubble,
} from "@/components/chat/ChatParts";
import { CopyCheckIcon } from "@/components/icons/animated";
import { PageHeader, type Crumb } from "@/components/shell/PageHeader";
import { cn } from "@/lib/utils";
import type { ChatMessageDTO, ConversationSummary } from "@/lib/data/types";
import { loadConversationAction } from "./actions";
import { TranscriptSkeleton, TUTOR_FRAME } from "./TutorParts";

type Msg = { role: "user" | "assistant"; text: string };

const COPIED_HOLD_MS = 700;

const toMsgs = (m: ChatMessageDTO[]): Msg[] =>
  m.map((x) => ({ role: x.role, text: x.content }));

const toTranscript = (messages: Msg[]) =>
  messages
    .map((m) => `${m.role === "user" ? "You" : "Tutor"}: ${m.text}`)
    .join("\n\n");

/**
 * The tutor workspace. The thread list and the newest thread arrive
 * server-rendered as props; from there this island owns the state: switching
 * threads loads a transcript via a Server Action, and sending updates the rail
 * locally (no list re-fetch). The page keys its boundary on the topic, so a
 * topic switch remounts this with fresh props.
 */
export function TutorChat({
  breadcrumbs,
  curriculumId,
  lesson,
  initialConversations,
  initialActiveId,
  initialMessages,
}: {
  breadcrumbs: Crumb[];
  curriculumId: string | null;
  lesson: { id: string; title: string } | null;
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
  const [threadsOpen, setThreadsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const locked = busy || switching !== null;

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, busy, switching]);

  async function selectConversation(id: string) {
    if (id === activeId || locked) return;
    setThreadsOpen(false);
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
    setThreadsOpen(false);
    setActiveId(null);
    setMessages([]);
    toast.message("New thread started");
  }

  async function copyTranscript() {
    try {
      await navigator.clipboard.writeText(toTranscript(messages));
      setCopied(true);
      toast.success("Transcript copied");
    } catch {
      toast.error("Could not copy the transcript");
    }
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => {
      setMenuOpen(false);
      setCopied(false);
    }, COPIED_HOLD_MS);
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
          lessonRef: lesson?.id,
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

  const threadList = (
    <ThreadList
      conversations={conversations}
      activeId={activeId}
      switching={switching}
      locked={locked}
      onSelect={(id) => void selectConversation(id)}
      onNew={newConversation}
    />
  );

  return (
    <div className={TUTOR_FRAME}>
      <PageHeader
        breadcrumbs={breadcrumbs}
        actions={
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Threads"
                className="md:hidden"
                onClick={() => setThreadsOpen(true)}
              >
                <PanelLeft />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Threads</TooltipContent>
          </Tooltip>
        }
        menu={
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Tutor options">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>Tutor options</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                disabled={messages.length === 0}
                onSelect={(event) => {
                  event.preventDefault();
                  void copyTranscript();
                }}
              >
                <CopyCheckIcon copied={copied} />
                Copy transcript
              </DropdownMenuItem>
              <DropdownMenuItem disabled={locked} onSelect={newConversation}>
                <MessageSquarePlus />
                Start new conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <Sheet open={threadsOpen} onOpenChange={setThreadsOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-2 md:hidden">
          <SheetTitle className="px-2 pt-1.5 pb-2 text-[13px] font-medium">
            Threads
          </SheetTitle>
          <SheetDescription className="sr-only">
            Switch between your tutor conversations.
          </SheetDescription>
          {threadList}
        </SheetContent>
      </Sheet>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border p-2 md:flex md:flex-col">
          {threadList}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div ref={scrollRef} className="h-full overflow-y-auto">
              <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pt-6 pb-10 sm:px-6">
                {lesson && (
                  <Link
                    href={`/learn/${lesson.id}`}
                    className="inline-flex max-w-full items-center gap-1.5 self-start rounded-md border border-border-strong px-2 py-1 text-[12px] text-fg-2 transition-colors duration-(--dur-fast) hover:bg-hover hover:text-foreground"
                  >
                    <BookOpen className="size-3 shrink-0" />
                    <span className="truncate">{lesson.title}</span>
                  </Link>
                )}
                {switching && <TranscriptSkeleton />}
                {!switching && messages.length === 0 && (
                  <AssistantTurn>
                    <p>Ask whatever you&apos;re stuck on. I&apos;ll ask back.</p>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      I guide you toward answers and don&apos;t hand them over.
                      Each chat is its own thread.
                    </p>
                  </AssistantTurn>
                )}
                {!switching &&
                  messages.map((m, i) =>
                    m.role === "user" ? (
                      <UserBubble key={i}>{m.text}</UserBubble>
                    ) : (
                      <AssistantTurn key={i}>
                        <Markdown className="prose-p:my-2 prose-p:first:mt-0 prose-pre:my-2">
                          {m.text}
                        </Markdown>
                      </AssistantTurn>
                    ),
                  )}
                {busy && (
                  <div className="flex items-center gap-3">
                    <AssistantAvatar className="mt-0" />
                    <TypingBars label="Tutor is thinking" />
                  </div>
                )}
              </div>
            </div>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-linear-to-t from-background to-transparent"
            />
          </div>

          <div className="shrink-0 px-4 pb-4 sm:px-6">
            <ChatComposer
              className="mx-auto w-full max-w-2xl"
              label="Message the tutor"
              placeholder="What are you stuck on?"
              value={input}
              onChange={setInput}
              onSubmit={() => void send()}
              busy={busy}
              disabled={locked}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ThreadList({
  conversations,
  activeId,
  switching,
  locked,
  onSelect,
  onNew,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  switching: string | null;
  locked: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5">
      <Button
        onClick={onNew}
        disabled={locked}
        variant="outline"
        size="sm"
        className="mb-2 justify-start"
      >
        <MessageSquarePlus data-icon="inline-start" />
        New chat
      </Button>
      <p className="px-2 pb-1 text-[11.5px] font-medium text-faint">Threads</p>
      {conversations.length === 0 ? (
        <p className="px-2 text-[12px] text-faint">No threads yet.</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
          {conversations.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                disabled={locked}
                title={c.title}
                aria-current={activeId === c.id ? "true" : undefined}
                className={cn(
                  "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-fg-2 transition-colors duration-(--dur-fast) outline-none hover:bg-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-60",
                  activeId === c.id && "bg-active text-foreground",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                {switching === c.id && (
                  <LoadingRing className="size-3 shrink-0" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
