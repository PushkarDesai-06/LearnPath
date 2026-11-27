"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { shellOverrides } from "@/components/shell/shellOverrides";
import { useActionError } from "@/components/shell/useActionError";
import { api, ApiClientError } from "@/lib/client/api";
import { sameOrder } from "@/lib/client/topicState";
import { withProgress } from "@/lib/client/progress";
import { MAX_PINS, removeEntry, reorderPins } from "@/lib/domain/prefs";
import type { ShellLessonLink } from "@/lib/data/types";

const CAP_MESSAGE = `You can pin up to ${MAX_PINS} lessons. Unpin one first.`;

const idsOf = (links: ShellLessonLink[]) => links.map((link) => link.lessonId);

/**
 * Pin and recent mutations for the sidebar: unpin with Undo, pin from Recent,
 * remove from Recent and reorder. All are optimistic through `shellOverrides`
 * and roll back with the API's message on failure.
 */
export function usePinActions(pins: ShellLessonLink[], recents: ShellLessonLink[]) {
  const router = useRouter();
  const failed = useActionError();
  const latest = useRef({ pins, recents });

  useEffect(() => {
    latest.current = { pins, recents };
  });

  const pin = useCallback(
    async (link: ShellLessonLink, restoreOrder?: string[]) => {
      const before = latest.current.pins;
      if (before.some((p) => p.lessonId === link.lessonId)) return;
      if (before.length >= MAX_PINS) {
        toast.error(CAP_MESSAGE);
        return;
      }
      shellOverrides.setPins([...before, link]);
      try {
        await withProgress(async () => {
          await api("/api/me/pins", {
            method: "POST",
            body: { curriculumId: link.curriculumId, lessonId: link.lessonId },
          });
          if (restoreOrder) {
            await api("/api/me/pins", {
              method: "PATCH",
              body: { order: restoreOrder },
            });
          }
        });
      } catch (error) {
        shellOverrides.setPins(before);
        if (error instanceof ApiClientError && error.status === 409) {
          toast.error(CAP_MESSAGE);
          router.refresh();
        } else {
          failed(error, "Could not pin the lesson");
        }
        return;
      }
      if (!restoreOrder) toast.success(`Pinned ${link.title}`);
      router.refresh();
    },
    [failed, router],
  );

  const unpin = useCallback(
    async (link: ShellLessonLink) => {
      const before = latest.current.pins;
      shellOverrides.setPins(removeEntry(before, link.lessonId));
      try {
        await withProgress(() =>
          api(`/api/me/pins/${link.lessonId}`, { method: "DELETE" }),
        );
      } catch (error) {
        shellOverrides.setPins(before);
        failed(error, "Could not unpin the lesson");
        return;
      }
      router.refresh();
      toast(`Unpinned ${link.title}`, {
        action: {
          label: "Undo",
          onClick: () => void pin(link, idsOf(before)),
        },
      });
    },
    [failed, pin, router],
  );

  const reorder = useCallback(
    async (order: string[]) => {
      const before = latest.current.pins;
      const next = reorderPins(before, order);
      if (sameOrder(idsOf(next), idsOf(before))) return;
      shellOverrides.setPins(next);
      try {
        await withProgress(() =>
          api("/api/me/pins", { method: "PATCH", body: { order: idsOf(next) } }),
        );
      } catch (error) {
        shellOverrides.setPins(before);
        failed(error, "Could not reorder the pins");
        return;
      }
      router.refresh();
    },
    [failed, router],
  );

  const removeRecent = useCallback(
    async (link: ShellLessonLink) => {
      const before = latest.current.recents;
      shellOverrides.setRecents(removeEntry(before, link.lessonId));
      try {
        await withProgress(() =>
          api(`/api/me/recents/${link.lessonId}`, { method: "DELETE" }),
        );
      } catch (error) {
        shellOverrides.setRecents(before);
        failed(error, "Could not remove the lesson from recent");
        return;
      }
      router.refresh();
    },
    [failed, router],
  );

  return useMemo(
    () => ({ pin: (link: ShellLessonLink) => pin(link), unpin, reorder, removeRecent }),
    [pin, unpin, reorder, removeRecent],
  );
}
