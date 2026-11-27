"use client";

import type { FormEvent, ReactNode } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { LogoTile } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

/** Three small bars that bounce in turn while the assistant is working. */
export function TypingBars({ label }: { label: string }) {
  return (
    <span
      role="status"
      aria-label={label}
      className="flex h-5 items-end gap-[3px] pb-1"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{ animationDelay: `${i * 140}ms` }}
          className="h-2.5 w-[3px] animate-bounce rounded-full bg-faint motion-reduce:animate-none"
        />
      ))}
    </span>
  );
}

export function AssistantAvatar({ className }: { className?: string }) {
  return <LogoTile className={cn("mt-0.5", className)} />;
}

export function UserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end animate-in fade-in-0 slide-in-from-bottom-1 duration-(--dur-base) ease-(--ease-out)">
      <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-surface-2 px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap shadow-[inset_0_0_0_1px_var(--border)]">
        {children}
      </div>
    </div>
  );
}

export function AssistantTurn({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-(--dur-base) ease-(--ease-out)",
        className,
      )}
    >
      <AssistantAvatar />
      <div className="min-w-0 flex-1 text-[13.5px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

/** Rounded input surface with a send button. Enter sends, Shift+Enter adds a line. */
export function ChatComposer({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  busy,
  disabled,
  autoFocus,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder: string;
  label: string;
  busy: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col rounded-xl border border-border-strong bg-surface-1 p-2 transition-colors duration-(--dur-fast) focus-within:border-fg-2",
        className,
      )}
    >
      <Textarea
        aria-label={label}
        autoFocus={autoFocus}
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[52px] resize-none border-0 bg-transparent px-2 py-1.5 text-[13.5px] shadow-none focus-visible:ring-0 focus-visible:outline-none"
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 pl-2 text-[11.5px] text-faint max-sm:hidden">
          <Kbd>↵</Kbd> send
          <Kbd>⇧↵</Kbd> new line
        </span>
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          loading={busy}
          disabled={disabled || !value.trim()}
          className="ml-auto"
        >
          <ArrowUp />
        </Button>
      </div>
    </form>
  );
}
