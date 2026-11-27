"use client";

import { useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeTitle, TITLE_MAX } from "@/lib/client/topicState";
import type { TopicMenuTarget } from "@/components/shell/rowMenus";

function RenameForm({
  topic,
  onSubmit,
}: {
  topic: TopicMenuTarget;
  onSubmit: (topic: TopicMenuTarget, title: string) => void;
}) {
  const [value, setValue] = useState(topic.title);
  const title = normalizeTitle(value);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (title) onSubmit(topic, title);
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename topic</DialogTitle>
        <DialogDescription>
          Only the name changes. Lessons and progress stay as they are.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="rename-topic-title">Topic name</Label>
        <Input
          id="rename-topic-title"
          value={value}
          maxLength={TITLE_MAX}
          autoComplete="off"
          onChange={(event) => setValue(event.target.value)}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={!title}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Small rename dialog for surfaces without an inline field. Controlled by `topic`. */
export function RenameTopicDialog({
  topic,
  returnFocus,
  onSubmit,
  onClose,
}: {
  topic: TopicMenuTarget | null;
  returnFocus: RefObject<HTMLElement | null>;
  onSubmit: (topic: TopicMenuTarget, title: string) => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={topic !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          if (returnFocus.current?.isConnected) {
            event.preventDefault();
            returnFocus.current.focus();
          }
        }}
      >
        {topic ? <RenameForm key={topic.id} topic={topic} onSubmit={onSubmit} /> : null}
      </DialogContent>
    </Dialog>
  );
}
