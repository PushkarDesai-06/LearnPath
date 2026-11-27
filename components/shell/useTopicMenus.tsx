"use client";

import { useCallback, useRef, useState } from "react";
import { DeleteTopicDialog } from "@/components/shell/DeleteTopicDialog";
import { RenameTopicDialog } from "@/components/shell/RenameTopicDialog";
import {
  archivedTopicRowMenu,
  topicRowMenu,
  type RowMenuEntry,
  type TopicMenuTarget,
} from "@/components/shell/rowMenus";
import { useTopicActions } from "@/components/shell/useTopicActions";

const OPEN_MENU_TRIGGER = '[aria-haspopup="menu"][aria-expanded="true"]';

/**
 * Everything a surface needs to offer topic menus: entry builders, and the
 * dialogs to mount once next to them (`dialogs`). Menu items only set state here,
 * so the dialogs live outside the menu content. `requestRename` lets a surface
 * with an inline field swap the dialog for its own editor.
 */
export function useTopicMenus(options?: {
  inlineRename?: (topic: TopicMenuTarget) => boolean;
}) {
  const actions = useTopicActions();
  const [renaming, setRenaming] = useState<TopicMenuTarget | null>(null);
  const [deleting, setDeleting] = useState<TopicMenuTarget | null>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const inlineRename = options?.inlineRename;

  const rememberTrigger = useCallback(() => {
    returnFocus.current =
      document.querySelector<HTMLElement>(OPEN_MENU_TRIGGER) ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);
  }, []);

  const requestRename = useCallback(
    (topic: TopicMenuTarget) => {
      if (inlineRename?.(topic)) return;
      rememberTrigger();
      setRenaming(topic);
    },
    [inlineRename, rememberTrigger],
  );

  const requestDelete = useCallback(
    (topic: TopicMenuTarget) => {
      rememberTrigger();
      setDeleting(topic);
    },
    [rememberTrigger],
  );

  const menu = useCallback(
    (topic: TopicMenuTarget): RowMenuEntry[] =>
      topicRowMenu(topic, {
        rename: requestRename,
        archive: actions.archive,
        requestDelete,
      }),
    [actions.archive, requestDelete, requestRename],
  );

  const archivedMenu = useCallback(
    (topic: TopicMenuTarget): RowMenuEntry[] =>
      archivedTopicRowMenu(topic, { restore: actions.restore, requestDelete }),
    [actions.restore, requestDelete],
  );

  const dialogs = (
    <>
      <RenameTopicDialog
        topic={renaming}
        returnFocus={returnFocus}
        onClose={() => setRenaming(null)}
        onSubmit={(topic, title) => {
          setRenaming(null);
          void actions.rename(topic, title);
        }}
      />
      <DeleteTopicDialog
        topic={deleting}
        returnFocus={returnFocus}
        onClose={() => setDeleting(null)}
        onConfirm={(topic) => {
          setDeleting(null);
          void actions.remove(topic);
        }}
      />
    </>
  );

  return { menu, archivedMenu, requestRename, dialogs, actions };
}
