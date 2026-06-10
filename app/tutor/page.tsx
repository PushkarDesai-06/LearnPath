"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, Spinner } from "@/components/ui";

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
  const [error, setError] = useState("");

  const q = topicId ? `?curriculumId=${topicId}` : "";

  const loadConversations = useCallback(
    (selectFirst: boolean) => {
      api<{ conversations: Conversation[] }>(`/api/tutor/conversations${q}`)
        .then((res) => {
          setConversations(res.conversations);
          if (selectFirst && res.conversations.length > 0) {
            setActiveId(res.conversations[0].id);
          }
        })
        .catch((err) => {
          if (err instanceof ApiClientError && err.status === 401)
            router.push("/login");
        });
    },
    [q, router],
  );

  // Load conversation list on mount.
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

  // Load the active conversation's messages. (When activeId is null, messages
  // were already cleared by newConversation()/initial state.)
  useEffect(() => {
    if (!activeId) return;
    let active = true;
    api<{ messages: { role: "user" | "assistant"; content: string }[] }>(
      `/api/tutor?conversationId=${activeId}`,
    )
      .then((res) => {
        if (active)
          setMessages(res.messages.map((m) => ({ role: m.role, text: m.content })));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeId]);

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setError("");
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message) return;
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await api<{
        conversationId: string;
        reply: string;
      }>("/api/tutor", {
        body: {
          message,
          curriculumId: topicId ?? undefined,
          conversationId: activeId ?? undefined,
        },
      });
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      if (!activeId) setActiveId(res.conversationId);
      loadConversations(false); // refresh titles / new thread in the list
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.push("/login");
        return;
      }
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[200px_1fr]">
      {/* conversation list */}
      <div className="space-y-2">
        <Button onClick={newConversation} className="w-full">
          + New chat
        </Button>
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveId(c.id)}
            className={`block w-full truncate rounded-md px-3 py-2 text-left text-sm ${
              activeId === c.id
                ? "bg-blue-100 dark:bg-blue-950"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title={c.title}
          >
            {c.title}
          </button>
        ))}
        {conversations.length === 0 && (
          <p className="px-1 text-xs text-gray-400">No conversations yet.</p>
        )}
      </div>

      {/* chat */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Socratic tutor</h1>
          <p className="text-sm text-gray-500">
            Guides you toward answers instead of handing them over. Each chat is
            its own thread.
          </p>
        </div>

        <div className="space-y-3">
          {messages.length === 0 && (
            <Card>
              <p className="text-sm text-gray-400">
                Ask anything about this topic to start a new conversation.
              </p>
            </Card>
          )}
          {messages.map((m, i) => (
            <Card
              key={i}
              className={m.role === "user" ? "bg-blue-50 dark:bg-blue-950" : ""}
            >
              <Badge tone={m.role === "user" ? "blue" : "gray"}>
                {m.role === "user" ? "You" : "Tutor"}
              </Badge>
              <p className="mt-1 whitespace-pre-wrap text-sm">{m.text}</p>
            </Card>
          ))}
          {busy && <Spinner label="Tutor is thinking…" />}
        </div>

        <form onSubmit={send} className="space-y-2">
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            rows={2}
            placeholder="Ask a question…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy}>
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
