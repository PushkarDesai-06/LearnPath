"use client";

import { useState, type RefObject } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { titleMatches } from "@/lib/client/topicState";
import type { TopicMenuTarget } from "@/components/shell/rowMenus";

function DeleteBody({
  topic,
  onConfirm,
}: {
  topic: TopicMenuTarget;
  onConfirm: (topic: TopicMenuTarget) => void;
}) {
  const [typed, setTyped] = useState("");
  const confirmed = !topic.hasProgress || titleMatches(typed, topic.title);

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete {topic.title}?</AlertDialogTitle>
        <AlertDialogDescription>
          This permanently removes the topic with all of its lessons,
          flashcards, tutor chats and progress. It cannot be undone. Archive it
          instead if you may want it back.
        </AlertDialogDescription>
      </AlertDialogHeader>
      {topic.hasProgress ? (
        <div className="grid gap-1.5">
          <Label htmlFor="delete-topic-confirm">
            Type {topic.title} to confirm
          </Label>
          <Input
            id="delete-topic-confirm"
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && confirmed) onConfirm(topic);
            }}
          />
        </div>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          variant="destructive"
          disabled={!confirmed}
          onClick={() => onConfirm(topic)}
        >
          Delete topic
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

/** Confirms a hard delete. Topics with progress also need their title typed. Controlled by `topic`. */
export function DeleteTopicDialog({
  topic,
  returnFocus,
  onConfirm,
  onClose,
}: {
  topic: TopicMenuTarget | null;
  returnFocus: RefObject<HTMLElement | null>;
  onConfirm: (topic: TopicMenuTarget) => void;
  onClose: () => void;
}) {
  return (
    <AlertDialog
      open={topic !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (returnFocus.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        {topic ? (
          <DeleteBody key={topic.id} topic={topic} onConfirm={onConfirm} />
        ) : null}
      </AlertDialogContent>
    </AlertDialog>
  );
}
