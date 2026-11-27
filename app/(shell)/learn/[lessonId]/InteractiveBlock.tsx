"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { Skeleton } from "@/components/ui/skeleton";
import type { LessonBlockDTO, LessonView } from "@/lib/data/types";

const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
const MIN_HEIGHT = 240;
const MAX_HEIGHT = 900;

type Status = "pending" | "ready" | "failed";

/**
 * An optional interactive demo. Its HTML is written by the artifact worker
 * after the lesson, so a `pending` block polls the lesson until it's ready.
 * The demo runs in a sandboxed iframe (opaque origin, served with its own CSP)
 * and talks to the page only through two postMessage types: its height and
 * an uncaught startup error. A demo that fails is hidden, because the lesson
 * reads fine without it.
 */
export function InteractiveBlock({
  block,
  lessonId,
}: {
  block: LessonBlockDTO;
  lessonId: string;
}) {
  const [status, setStatus] = useState<Status>(block.artifactStatus ?? "failed");
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [broken, setBroken] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const reported = useRef(false);

  useEffect(() => {
    if (status !== "pending") return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    const poll = () => {
      api<LessonView>(`/api/lesson/${lessonId}`)
        .then((res) => {
          if (!active) return;
          const next =
            res.status === "ready"
              ? res.lesson.blocks.find((b) => b.blockId === block.blockId)?.artifactStatus
              : undefined;
          if (next && next !== "pending") setStatus(next);
          else if (Date.now() >= deadline) setStatus("failed");
          else timer = setTimeout(poll, POLL_MS);
        })
        .catch(() => active && setStatus("failed"));
    };
    timer = setTimeout(poll, POLL_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [status, lessonId, block.blockId]);

  useEffect(() => {
    if (status !== "ready") return;
    const onMessage = (e: MessageEvent) => {
      // Only trust messages from our own frame (its origin is opaque: "null").
      if (e.source !== frame.current?.contentWindow) return;
      const data = e.data as { type?: string; h?: unknown };
      if (data?.type === "lp-artifact-height" && typeof data.h === "number") {
        reported.current = true;
        setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, data.h)));
      } else if (data?.type === "lp-artifact-error" && !reported.current) {
        // A startup error means the demo never rendered; later errors (from a
        // single control) leave the rest of the demo usable, so keep it.
        setBroken(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [status]);

  if (status === "failed") return null;

  return (
    <section className="flex flex-col gap-2">
      <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-[0.18em]">
        Interactive{block.caption ? ` · ${block.caption}` : ""}
      </p>
      {status === "pending" ? (
        <div
          role="status"
          className="bg-surface-1 border-border/60 flex flex-col gap-3 rounded-xl border p-4"
        >
          <Skeleton className="h-32 w-full" />
          <p className="text-muted-foreground text-xs">Building an interactive demo for you…</p>
        </div>
      ) : broken ? (
        <p className="text-muted-foreground text-xs">This interactive demo couldn&apos;t load.</p>
      ) : (
        <iframe
          ref={frame}
          src={`/api/lesson/${lessonId}/artifact/${block.blockId}`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          loading="lazy"
          title={block.caption ?? "Interactive demo"}
          style={{ height }}
          className="bg-surface-1 border-border/60 w-full rounded-xl border"
        />
      )}
    </section>
  );
}
