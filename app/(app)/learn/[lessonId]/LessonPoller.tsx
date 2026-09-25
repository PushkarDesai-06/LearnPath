"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiClientError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { LessonView } from "@/lib/data/types";

const POLL_MS = 2500;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Shown while a lesson isn't written yet. The page itself was rendered with a
 * pure read; this island's FIRST request to `GET /api/lesson/[id]` is what
 * enqueues generation (render must not, since it can run on prefetch). It then
 * polls, and once the lesson is ready re-renders the server page, which now
 * has the content. `children` is the server-rendered "writing…" notice.
 */
export function LessonPoller({
  lessonId,
  children,
}: {
  lessonId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [canRetry, setCanRetry] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let cooldown: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    const poll = () => {
      api<LessonView>(`/api/lesson/${lessonId}`)
        .then((res) => {
          if (!active) return;
          if (res.status === "ready") router.refresh();
          else if (res.status === "failed") {
            setError(res.message);
            setFailed(true);
            setCanRetry(res.canRetry);
            setWaiting(res.retryAfterMs > 0);
            cooldown = setTimeout(() => setWaiting(false), res.retryAfterMs);
          }
          else if (Date.now() >= deadline)
            setError("This is taking longer than expected.");
          else timer = setTimeout(poll, POLL_MS);
        })
        .catch((err) => {
          if (!active) return;
          if (err instanceof ApiClientError && err.status === 401) {
            router.push("/login");
            return;
          }
          setError(err instanceof Error ? err.message : "Failed to load lesson");
        });
    };
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
      clearTimeout(cooldown);
    };
  }, [lessonId, router, attempt]);

  async function retry() {
    setRetrying(true);
    try {
      if (failed) await api(`/api/lesson/${lessonId}`, { method: "POST" });
      setError("");
      setFailed(false);
      setAttempt((a) => a + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retry lesson");
    } finally {
      setRetrying(false);
    }
  }

  if (!error) return <>{children}</>;
  return (
    <div className="flex flex-col items-center gap-3 py-24">
      <Alert variant="destructive" className="max-w-md">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
      {canRetry && <Button
        variant="secondary"
        disabled={waiting || retrying}
        onClick={retry}
      >
        {waiting ? "Please wait before retrying" : retrying ? "Retrying…" : "Retry"}
      </Button>}
    </div>
  );
}
