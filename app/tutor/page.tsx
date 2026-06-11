"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
      .then((res) =>
        active &&
        setMessages(res.messages.map((m) => ({ role: m.role, text: m.content }))),
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
    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
      <aside className="flex flex-col gap-1">
        <Button onClick={newConversation} variant="outline" size="sm" className="mb-1">
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
            <span className="truncate">{c.title}</span>
          </Button>
        ))}
        {conversations.length === 0 && (
          <p className="text-muted-foreground px-1 text-xs">No conversations yet.</p>
        )}
      </aside>

      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Socratic tutor</h1>
          <p className="text-muted-foreground text-sm">
            Guides you toward answers instead of handing them over. Each chat is
            its own thread.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {messages.length === 0 && (
            <Card>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Ask anything about this topic to start a new conversation.
                </p>
              </CardContent>
            </Card>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground self-end whitespace-pre-wrap"
                  : "bg-muted self-start",
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
          ))}
          {busy && <Spinner className="text-muted-foreground" />}
        </div>

        <form onSubmit={send} className="flex flex-col gap-2">
          <Textarea
            rows={2}
            placeholder="Ask a question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="submit" disabled={busy} className="self-start">
            <Send data-icon="inline-start" />
            Send
          </Button>
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
