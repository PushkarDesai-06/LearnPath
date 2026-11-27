"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, ApiClientError } from "@/lib/client/api";
import { withProgress } from "@/lib/client/progress";
import type { FlashcardDeckResult } from "@/lib/data/types";

export interface LessonProgressPatch {
  status: string;
  masteryScore: number;
}

/** Where optimistic state lives. The dashboard store implements it. */
export interface LessonActionsHost {
  curriculumId: string;
  setPinned: (lessonId: string, pinned: boolean) => void;
  /** Shows `patch` over the server data, or restores the server data when null. */
  patchLesson: (lessonId: string, patch: LessonProgressPatch | null) => void;
}

export interface ActionLesson {
  id: string;
  title: string;
}

interface ProgressResponse {
  status: string;
  masteryScore: number;
}

const FLASHCARD_POLL_MS = 2500;
const FLASHCARD_TIMEOUT_MS = 2 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const cards = (count: number) => `${count} flashcard${count === 1 ? "" : "s"}`;

function messageOf(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Lesson mutations behind the row menus: pin, mark for review, reset and make
 * flashcards. Each is optimistic where the outcome is known, rolls back with the
 * API's own error message, and refreshes the route so the sidebar follows.
 */
export function useLessonActions(host: LessonActionsHost) {
  const router = useRouter();
  const { curriculumId, setPinned, patchLesson } = host;

  const failed = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof ApiClientError && error.status === 401) {
        router.push("/login");
        return;
      }
      if (
        error instanceof ApiClientError &&
        (error.status === 403 || error.status === 409)
      ) {
        router.refresh();
      }
      toast.error(messageOf(error, fallback));
    },
    [router],
  );

  const setPin = useCallback(
    async (lesson: ActionLesson, pinned: boolean, offerUndo: boolean) => {
      setPinned(lesson.id, pinned);
      try {
        await withProgress(() =>
          pinned
            ? api("/api/me/pins", {
                method: "POST",
                body: { curriculumId, lessonId: lesson.id },
              })
            : api(`/api/me/pins/${lesson.id}`, { method: "DELETE" }),
        );
      } catch (error) {
        setPinned(lesson.id, !pinned);
        failed(error, pinned ? "Could not pin the lesson" : "Could not unpin the lesson");
        return;
      }
      router.refresh();
      if (!offerUndo) return;
      toast(pinned ? `Pinned ${lesson.title}` : `Unpinned ${lesson.title}`, {
        action: {
          label: "Undo",
          onClick: () => void setPin(lesson, !pinned, false),
        },
      });
    },
    [curriculumId, failed, router, setPinned],
  );

  const mutateProgress = useCallback(
    async (
      lesson: ActionLesson,
      route: "review" | "reset",
      optimistic: LessonProgressPatch,
      success: string,
    ) => {
      patchLesson(lesson.id, optimistic);
      try {
        const result = await withProgress(() =>
          api<ProgressResponse>(`/api/lesson/${lesson.id}/${route}`, {
            method: "POST",
          }),
        );
        patchLesson(lesson.id, {
          status: result.status,
          masteryScore: result.masteryScore,
        });
        toast.success(success);
        router.refresh();
      } catch (error) {
        patchLesson(lesson.id, null);
        failed(error, "Could not update the lesson");
      }
    },
    [failed, patchLesson, router],
  );

  const markForReview = useCallback(
    (lesson: ActionLesson, masteryScore: number) =>
      mutateProgress(
        lesson,
        "review",
        { status: "needs_review", masteryScore },
        `Marked ${lesson.title} for review`,
      ),
    [mutateProgress],
  );

  const resetProgress = useCallback(
    (lesson: ActionLesson) =>
      mutateProgress(
        lesson,
        "reset",
        { status: "available", masteryScore: 0 },
        `Reset progress on ${lesson.title}`,
      ),
    [mutateProgress],
  );

  const makeFlashcards = useCallback(
    async (lesson: ActionLesson) => {
      const toastId = toast.loading(`Writing flashcards for ${lesson.title}`);
      const deadline = Date.now() + FLASHCARD_TIMEOUT_MS;
      try {
        for (;;) {
          const result = await withProgress(() =>
            api<FlashcardDeckResult>(`/api/lesson/${lesson.id}/flashcards`, {
              method: "POST",
            }),
          );
          if (result.status === "ready") {
            toast.success(`${cards(result.cardCount)} ready`, {
              id: toastId,
              action: {
                label: "Review",
                onClick: () => router.push(`/flashcards?id=${curriculumId}`),
              },
            });
            router.refresh();
            return;
          }
          if (Date.now() >= deadline) {
            throw new Error(
              "This is taking longer than expected. Try again in a moment.",
            );
          }
          await sleep(FLASHCARD_POLL_MS);
        }
      } catch (error) {
        toast.dismiss(toastId);
        failed(error, "Could not make flashcards");
      }
    },
    [curriculumId, failed, router],
  );

  return useMemo(
    () => ({
      pin: (lesson: ActionLesson) => setPin(lesson, true, true),
      unpin: (lesson: ActionLesson) => setPin(lesson, false, true),
      markForReview,
      resetProgress,
      makeFlashcards,
    }),
    [setPin, markForReview, resetProgress, makeFlashcards],
  );
}
