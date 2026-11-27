"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useActiveTopic } from "@/components/ActiveTopic";
import { TOPIC_SCOPED_ROUTES } from "@/components/shell/constants";
import { shellOverrides } from "@/components/shell/shellOverrides";
import { useActionError } from "@/components/shell/useActionError";
import { api } from "@/lib/client/api";
import { useNavigate, withProgress } from "@/lib/client/progress";

export interface TopicRef {
  id: string;
  title: string;
}

/**
 * Topic mutations behind every topic menu: rename, archive, restore and delete.
 * Each shows its result immediately through `shellOverrides`, rolls back with the
 * API's message on failure and refreshes the route so server data catches up.
 */
export function useTopicActions() {
  const router = useNavigate();
  const failed = useActionError();
  const pathname = usePathname();
  const idParam = useSearchParams().get("id");
  const announced = useActiveTopic();
  const openTopicId = TOPIC_SCOPED_ROUTES.includes(pathname) ? idParam : announced;

  const rename = useCallback(
    async (topic: TopicRef, title: string) => {
      if (title === topic.title) return true;
      shellOverrides.patchTopic(topic.id, { title });
      try {
        await withProgress(() =>
          api(`/api/topics/${topic.id}`, { method: "PATCH", body: { title } }),
        );
      } catch (error) {
        shellOverrides.patchTopic(topic.id, { title: undefined });
        failed(error, "Could not rename the topic");
        return false;
      }
      router.refresh();
      return true;
    },
    [failed, router],
  );

  const restore = useCallback(
    async (topic: TopicRef) => {
      shellOverrides.patchTopic(topic.id, { state: "active" });
      try {
        await withProgress(() =>
          api(`/api/topics/${topic.id}/restore`, { method: "POST" }),
        );
      } catch (error) {
        shellOverrides.patchTopic(topic.id, { state: undefined });
        failed(error, "Could not restore the topic");
        return;
      }
      toast.success(`Restored ${topic.title}`);
      router.refresh();
    },
    [failed, router],
  );

  const archive = useCallback(
    async (topic: TopicRef) => {
      shellOverrides.patchTopic(topic.id, { state: "archived" });
      try {
        await withProgress(() =>
          api(`/api/topics/${topic.id}/archive`, { method: "POST" }),
        );
      } catch (error) {
        shellOverrides.patchTopic(topic.id, { state: undefined });
        failed(error, "Could not archive the topic");
        return;
      }
      toast(`Archived ${topic.title}`, {
        action: { label: "Undo", onClick: () => void restore(topic) },
      });
      if (openTopicId === topic.id) router.push("/topics");
      router.refresh();
    },
    [failed, openTopicId, restore, router],
  );

  const remove = useCallback(
    async (topic: TopicRef) => {
      shellOverrides.patchTopic(topic.id, { state: "deleted" });
      try {
        await withProgress(() =>
          api(`/api/topics/${topic.id}`, { method: "DELETE" }),
        );
      } catch (error) {
        shellOverrides.patchTopic(topic.id, { state: undefined });
        failed(error, "Could not delete the topic");
        return;
      }
      toast.success(`Deleted ${topic.title}`);
      if (openTopicId === topic.id) router.push("/topics");
      router.refresh();
    },
    [failed, openTopicId, router],
  );

  return useMemo(
    () => ({ rename, archive, restore, remove }),
    [rename, archive, restore, remove],
  );
}
