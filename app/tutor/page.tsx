"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Badge, Button, Card, ErrorText, Spinner } from "@/components/ui";

type Msg = { role: "user" | "assistant"; text: string };

export default function TutorPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Restore the persisted conversation on mount.
  useEffect(() => {
    let active = true;
    api<{ messages: { role: "user" | "assistant"; content: string }[] }>(
      "/api/tutor",
    )
      .then((res) => {
        if (active)
          setMessages(res.messages.map((m) => ({ role: m.role, text: m.content })));
      })
      .catch((err) => {
        if (active && err instanceof ApiClientError && err.status === 401) {
          router.push("/login");
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message) return;
    setMessages((m) => [...m, { role: "user", text: message }]);
    setInput("");
    setBusy(true);
    setError("");
    try {
      const res = await api<{ reply: string; gaveDirectAnswer: boolean }>(
        "/api/tutor",
        { body: { message } },
      );
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Socratic tutor</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Ask anything about your topic. The tutor guides you toward the answer
          rather than handing it over.
        </p>
      </div>

      <div className="space-y-3">
        {messages.length === 0 && (
          <Card>
            <p className="text-sm text-gray-400">
              Try: &ldquo;I&apos;m stuck on how recursion terminates.&rdquo;
            </p>
          </Card>
        )}
        {messages.map((m, i) => (
          <Card
            key={i}
            className={m.role === "user" ? "bg-blue-50 dark:bg-blue-950" : ""}
          >
            <div className="mb-1 flex items-center gap-2">
              <Badge tone={m.role === "user" ? "blue" : "gray"}>
                {m.role === "user" ? "You" : "Tutor"}
              </Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm">{m.text}</p>
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
  );
}
