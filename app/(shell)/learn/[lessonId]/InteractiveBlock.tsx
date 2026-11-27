"use client";

import { useEffect, useRef, useState } from "react";
import { MousePointerClick } from "lucide-react";
import { api } from "@/lib/client/api";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIcon } from "@/components/StatusIcon";
import { useThemeCycle } from "@/components/useThemeCycle";
import type { ArtifactTheme } from "@/lib/ai/artifactHtml";
import type { LessonBlockDTO, LessonView } from "@/lib/data/types";
import { BlockLabel } from "./BlockLabel";

const POLL_MS = 3000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000;
const MIN_HEIGHT = 240;
const MAX_HEIGHT = 900;

type Status = "pending" | "ready" | "failed";

/**
 * An optional interactive demo. Its HTML is written by the artifact worker
 * after the lesson, so a `pending` block polls the lesson until it's ready.
 * A demo that fails is hidden, because the lesson reads fine without it.
 */
export function InteractiveBlock({
  block,
  lessonId,
}: {
  block: LessonBlockDTO;
  lessonId: string;
}) {
  const [status, setStatus] = useState<Status>(block.artifactStatus ?? "failed");
  const { isDark, mounted } = useThemeCycle();

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

  if (status === "failed") return null;

  return (
    <section className="flex flex-col gap-2">
      <BlockLabel
        label={`Interactive${block.caption ? `: ${block.caption}` : ""}`}
        Icon={MousePointerClick}
      />
      {status === "pending" || !mounted ? (
        <div
          role="status"
          className="bg-surface-1 border-border flex flex-col gap-3 rounded-xl border p-4"
        >
          <Skeleton className="h-32 w-full" />
          {status === "pending" && (
            <p className="text-muted-foreground flex items-center gap-2 text-xs">
              <StatusIcon status="generating" size={14} />
              Building an interactive demo for you...
            </p>
          )}
        </div>
      ) : (
        <ArtifactFrame lessonId={lessonId} block={block} theme={isDark ? "dark" : "light"} />
      )}
    </section>
  );
}

/**
 * The demo runs in a sandboxed iframe (opaque origin, served with its own CSP)
 * and cannot see the page's theme, so the theme goes in the URL for the first
 * paint and in a postMessage when it changes. The demo talks back through two
 * message types only: its height and an uncaught startup error.
 */
function ArtifactFrame({
  lessonId,
  block,
  theme,
}: {
  lessonId: string;
  block: LessonBlockDTO;
  theme: ArtifactTheme;
}) {
  const [initialTheme] = useState(theme);
  const [height, setHeight] = useState(MIN_HEIGHT);
  const [broken, setBroken] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const reported = useRef(false);

  const postTheme = (value: ArtifactTheme) =>
    frame.current?.contentWindow?.postMessage({ type: "lp-theme", theme: value }, "*");

  useEffect(() => {
    postTheme(theme);
  }, [theme]);

  useEffect(() => {
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
  }, []);

  if (broken) {
    return (
      <p className="text-muted-foreground text-xs">
        This interactive demo couldn&apos;t load.
      </p>
    );
  }

  return (
    <iframe
      ref={frame}
      src={`/api/lesson/${lessonId}/artifact/${block.blockId}?theme=${initialTheme}`}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      loading="lazy"
      title={block.caption ?? "Interactive demo"}
      style={{ height }}
      onLoad={() => postTheme(theme)}
      className="bg-surface-1 border-border w-full rounded-xl border"
    />
  );
}
